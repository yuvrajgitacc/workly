import os
import re
import uuid
import json
import zipfile
from pathlib import Path
import pandas as pd
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from google_auth_oauthlib.flow import Flow
import logging

from api.models import Session, IngestJob, Candidate
from api.decorators import require_api_key, check_rate_limit
from models.schemas import success_response, error_response
from workers.celery_worker import process_resume_batch, sync_gmail_resumes, sync_gdrive_resumes
from agents.normalization_agent import SkillNormalizationAgent

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")

logger = logging.getLogger(__name__)

def _run_task_safe(task, *args, **kwargs):
    try:
        task.delay(*args, **kwargs)
    except Exception as e:
        logger.warning("Celery dispatch failed for task %s, running synchronously: %s", getattr(task, '__name__', str(task)), e)
        try:
            task.apply(args=args, kwargs=kwargs)
        except Exception as inner_err:
            logger.error("Synchronous task execution failed: %s", inner_err)

TIER_FILE_LIMITS = {
    "free":       {"per_batch": 50,  "zip_files": 50,   "llm_enrichment": True},
    "starter":    {"per_batch": 50,  "zip_files": 50,   "llm_enrichment": True},
    "business":   {"per_batch": 200, "zip_files": 200,  "llm_enrichment": True},
    "enterprise": {"per_batch": 500, "zip_files": 500,  "llm_enrichment": True},
}

def _get_tier_limits(company):
    tier = getattr(company, 'tier', 'free') or 'free'
    return TIER_FILE_LIMITS.get(tier, TIER_FILE_LIMITS['free']), tier

@csrf_exempt
@require_api_key
@check_rate_limit("parse")
def upload_resumes(request):
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        session_id = request.POST.get("session_id")
        files = request.FILES.getlist("files")
        if not session_id or not files:
            return JsonResponse(error_response("session_id and files are required"), status=400)

        limits, tier = _get_tier_limits(request.company)
        max_batch = limits["per_batch"]
        use_llm = limits["llm_enrichment"]

        if len(files) > max_batch:
            return JsonResponse(error_response(
                f"Your '{tier}' plan allows max {max_batch} files per batch. "
                f"You uploaded {len(files)}. Upgrade at /portal/billing"
            ), status=400)

        save_dir = f"{UPLOAD_DIR}/{session_id}"
        os.makedirs(save_dir, exist_ok=True)
        saved_paths = []

        for file in files:
            if not file.name.lower().endswith((".pdf", ".docx", ".doc", ".txt")):
                continue

            fname = f"{uuid.uuid4()}_{file.name}"
            path = f"{save_dir}/{fname}"
            
            # Check file size (10 MB)
            if file.size > 10 * 1024 * 1024:
                continue

            with open(path, "wb+") as f:
                for chunk in file.chunks():
                    f.write(chunk)
            saved_paths.append(path)

        session = Session.objects.filter(id=session_id).first()
        if not session:
            return JsonResponse(error_response("Session not found"), status=404)

        job = IngestJob.objects.create(
            session=session,
            type="upload",
            status="pending",
            total_files=len(saved_paths),
            processed_files=0,
            failed_files=0
        )

        _run_task_safe(process_resume_batch, str(job.id), saved_paths, session_id, "upload", use_llm)

        return JsonResponse(success_response({
            "job_id": str(job.id),
            "total_files": len(saved_paths),
            "status": "pending",
            "message": f"Processing {len(saved_paths)} resumes..."
        }))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

@csrf_exempt
@require_api_key
@check_rate_limit("parse")
def upload_zip(request):
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        session_id = request.POST.get("session_id")
        zip_file = request.FILES.get("file")
        if not session_id or not zip_file:
            return JsonResponse(error_response("session_id and file are required"), status=400)

        if not zip_file.name.lower().endswith(".zip"):
            return JsonResponse(error_response("File must be .zip"), status=400)

        save_dir = f"{UPLOAD_DIR}/{session_id}"
        os.makedirs(save_dir, exist_ok=True)

        zip_path = f"{save_dir}/{uuid.uuid4()}_{zip_file.name}"
        with open(zip_path, "wb+") as f:
            for chunk in zip_file.chunks():
                f.write(chunk)

        limits, tier = _get_tier_limits(request.company)
        max_zip = limits["zip_files"]
        use_llm = limits["llm_enrichment"]

        extracted = []
        with zipfile.ZipFile(zip_path, "r") as z:
            for name in z.namelist():
                if len(extracted) >= max_zip:
                    break
                ext = Path(name).suffix.lower()
                if ext in [".pdf", ".docx", ".doc", ".txt"]:
                    z.extract(name, save_dir)
                    extracted.append(f"{save_dir}/{name}")

        session = Session.objects.filter(id=session_id).first()
        if not session:
            return JsonResponse(error_response("Session not found"), status=404)

        job = IngestJob.objects.create(
            session=session,
            type="upload",
            status="pending",
            total_files=len(extracted),
            processed_files=0,
            failed_files=0
        )

        _run_task_safe(process_resume_batch, str(job.id), extracted, session_id, "upload", use_llm)

        return JsonResponse(success_response({
            "job_id": str(job.id),
            "total_files": len(extracted),
            "status": "pending"
        }))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

@csrf_exempt
@require_api_key
def get_google_oauth_url(request):
    if request.method != "GET":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        oauth_type = request.GET.get("type")
        session_id = request.GET.get("session_id")
        
        scopes = []
        if oauth_type == "gmail":
            scopes = ["https://www.googleapis.com/auth/gmail.readonly"]
        elif oauth_type in ["gdrive", "form"]:
            scopes = ["https://www.googleapis.com/auth/drive.readonly"]

        client_secrets_file = os.getenv("GOOGLE_CLIENT_SECRETS_FILE", "credentials.json")
        if not os.path.exists(client_secrets_file):
            return JsonResponse(error_response("Google OAuth not configured locally."), status=400)

        state = f"{oauth_type}:{session_id}"
        flow = Flow.from_client_secrets_file(
            client_secrets_file,
            scopes=scopes,
            state=state
        )
        flow.redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:3000/api/oauth/callback")

        auth_url, _ = flow.authorization_url(
            access_type="offline",
            prompt="consent"
        )

        return JsonResponse(success_response({"auth_url": auth_url}))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

@csrf_exempt
@require_api_key
def gmail_connect(request):
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        data = json.loads(request.body)
        session_id = data.get("session_id")
        auth_code = data.get("auth_code")
        if not session_id or not auth_code:
            return JsonResponse(error_response("session_id and auth_code are required"), status=400)

        session = Session.objects.filter(id=session_id).first()
        if not session:
            return JsonResponse(error_response("Session not found"), status=404)

        session.gmail_tokens = {"token": auth_code}  # Dummy bind
        session.gmail_address = "recruiter@vishleshan.com"
        session.save()

        return JsonResponse(success_response({
            "connected": True,
            "gmail_address": session.gmail_address
        }))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

@csrf_exempt
@require_api_key
def gmail_sync(request):
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        data = json.loads(request.body)
        session_id = data.get("session_id")
        if not session_id:
            return JsonResponse(error_response("session_id is required"), status=400)

        session = Session.objects.filter(id=session_id).first()
        if not session:
            return JsonResponse(error_response("Session not found"), status=404)

        job = IngestJob.objects.create(session=session, type="gmail", status="pending")

        _run_task_safe(sync_gmail_resumes, session_id, str(job.id))
        return JsonResponse(success_response({"job_id": str(job.id), "status": "pending"}))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

@csrf_exempt
@require_api_key
def gdrive_connect(request):
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        data = json.loads(request.body)
        session_id = data.get("session_id")
        auth_code = data.get("auth_code")
        folder_url = data.get("folder_url", "")
        if not session_id or not auth_code:
            return JsonResponse(error_response("session_id and auth_code are required"), status=400)

        match = re.search(r'/folders/([a-zA-Z0-9_-]+)', folder_url)
        folder_id = match.group(1) if match else folder_url

        session = Session.objects.filter(id=session_id).first()
        if not session:
            return JsonResponse(error_response("Session not found"), status=404)

        session.gdrive_tokens = {"token": auth_code}
        session.gdrive_folder_id = folder_id
        session.save()

        return JsonResponse(success_response({
            "connected": True,
            "folder_id": folder_id,
            "file_count": 0
        }))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

@csrf_exempt
@require_api_key
def gdrive_sync(request):
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        data = json.loads(request.body)
        session_id = data.get("session_id")
        if not session_id:
            return JsonResponse(error_response("session_id is required"), status=400)

        session = Session.objects.filter(id=session_id).first()
        if not session:
            return JsonResponse(error_response("Session not found"), status=404)

        job = IngestJob.objects.create(session=session, type="gdrive", status="pending")

        _run_task_safe(sync_gdrive_resumes, session_id, str(job.id))
        return JsonResponse(success_response({"job_id": str(job.id), "status": "pending"}))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

@csrf_exempt
@require_api_key
def google_form(request):
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        data = json.loads(request.body)
        session_id = data.get("session_id")
        if not session_id:
            return JsonResponse(error_response("session_id is required"), status=400)

        session = Session.objects.filter(id=session_id).first()
        if not session:
            return JsonResponse(error_response("Session not found"), status=404)

        job = IngestJob.objects.create(session=session, type="form", status="pending")

        return JsonResponse(success_response({"job_id": str(job.id), "status": "pending"}))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

@csrf_exempt
@require_api_key
def ats_import(request):
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        session_id = request.POST.get("session_id")
        fmt = request.POST.get("format")
        file = request.FILES.get("file")
        if not session_id or not fmt or not file:
            return JsonResponse(error_response("session_id, format, and file are required"), status=400)

        path = f"{UPLOAD_DIR}/temp_{uuid.uuid4()}.{fmt}"
        with open(path, "wb+") as f:
            for chunk in file.chunks():
                f.write(chunk)

        session = Session.objects.filter(id=session_id).first()
        if not session:
            return JsonResponse(error_response("Session not found"), status=404)

        rounds = session.rounds or []
        first_round_order = rounds[0]["order"] if rounds else 0

        records = []
        if fmt == "csv":
            df = pd.read_csv(path)
            records = df.to_dict("records")
        elif fmt == "json":
            with open(path, "r") as f:
                records = json.load(f)
        elif fmt == "xlsx":
            df = pd.read_excel(path)
            records = df.to_dict("records")

        norm_agent = SkillNormalizationAgent()
        imported = 0
        errors = []

        for row in records:
            try:
                raw_skills = str(row.get("skills", "")).split(";")
                # normalize is async, run in sync context
                from asgiref.sync import async_to_sync
                normalized = async_to_sync(norm_agent.normalize)(raw_skills)

                Candidate.objects.create(
                    session_id=session_id,
                    name=row.get("name"),
                    email=row.get("email"),
                    phone=row.get("phone"),
                    location=row.get("location"),
                    total_experience_years=float(row.get("experience_years", 0)),
                    normalized_skills=normalized,
                    current_round_index=first_round_order,
                    status="new",
                    source="ats_import"
                )
                imported += 1
            except Exception as e:
                errors.append(f"Row error: {str(e)}")

        # Clean up temp file
        try:
            os.remove(path)
        except:
            pass

        return JsonResponse(success_response({
            "imported": imported,
            "failed": len(errors),
            "errors": errors
        }))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

@csrf_exempt
@require_api_key
def get_job_status(request, job_id):
    if request.method != "GET":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        job = IngestJob.objects.filter(id=job_id).first()
        if not job:
            return JsonResponse(error_response("Job not found"), status=404)

        total = job.total_files or 0
        processed = job.processed_files or 0
        progress = (processed / total * 100) if total > 0 else 0

        return JsonResponse(success_response({
            "job_id": str(job.id),
            "status": job.status,
            "job_type": job.type,
            "total_files": total,
            "processed_files": processed,
            "failed_files": job.failed_files,
            "progress_percent": round(progress, 1),
            "error_log": job.error_log,
            "created_at": job.created_at.isoformat() if job.created_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None
        }))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

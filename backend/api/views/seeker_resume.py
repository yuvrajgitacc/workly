"""
Job Seeker Resume Views
────────────────────────
Handles:
  - Upload resume (PDF/DOCX) → parse with existing parsing_agent → store in JobSeekerAccount
  - Enhance resume with ResumeEnhancerAgent
  - Get current resume data
"""

import os
import uuid
import logging
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from api.models import JobSeekerAccount
from api.views.seeker_auth import require_seeker_jwt
from api.services.email_service import FROM_EMAIL
from models.schemas import success_response, error_response
from agents.parsing_agent import ResumeParsingAgent
from agents.normalization_agent import SkillNormalizationAgent
from agents.resume_enhancer_agent import ResumeEnhancerAgent

logger = logging.getLogger(__name__)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")


@csrf_exempt
@require_seeker_jwt
def upload_resume(request):
    """
    POST /api/v1/seeker/resume/upload
    Upload a PDF/DOCX resume → immediately save file → dispatch parse_seeker_resume task.
    """
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        file = request.FILES.get("file")
        if not file:
            return JsonResponse(error_response("No file provided"), status=400)

        allowed_ext = (".pdf", ".docx", ".doc", ".txt")
        if not file.name.lower().endswith(allowed_ext):
            return JsonResponse(error_response("Only PDF, DOCX, DOC, or TXT files are accepted"), status=400)

        if file.size > 10 * 1024 * 1024:  # 10 MB
            return JsonResponse(error_response("File size must be under 10 MB"), status=400)

        # Save file
        seeker_dir = os.path.join(UPLOAD_DIR, "seekers", str(request.seeker.id))
        os.makedirs(seeker_dir, exist_ok=True)

        fname = f"{uuid.uuid4()}_{file.name}"
        file_path = os.path.join(seeker_dir, fname)
        with open(file_path, "wb+") as f:
            for chunk in file.chunks():
                f.write(chunk)

        # Initialize status in Redis
        import redis
        import json as _json
        from datetime import datetime, timezone as dt_timezone
        from workers.celery_worker import parse_seeker_resume

        redis_client = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))
        redis_key = f"seeker:resume_parse_status:{request.seeker.id}"
        
        status_data = {
            "status": "processing",
            "progress": 5,
            "error": None,
            "updated_at": datetime.now(dt_timezone.utc).isoformat() + "Z"
        }
        try:
            redis_client.set(redis_key, _json.dumps(status_data), ex=3600)
        except Exception as redis_err:
            logger.warning("Failed to initialize Redis parser status: %s", redis_err)

        # Dispatch Celery task with safe fallback
        try:
            parse_seeker_resume.delay(str(request.seeker.id), file_path, file.name, file.size)
        except Exception as celery_err:
            logger.warning("Celery dispatch failed for parse_seeker_resume, running synchronously: %s", celery_err)
            try:
                parse_seeker_resume.apply(args=[str(request.seeker.id), file_path, file.name, file.size])
                # Task ran synchronously, status in Redis is already updated to 'success' or 'failed'
                status_raw = redis_client.get(redis_key)
                if status_raw:
                    status_data = _json.loads(status_raw)
            except Exception as sync_err:
                logger.error("Synchronous resume parsing task execution failed: %s", sync_err)
                status_data = {
                    "status": "failed",
                    "progress": 100,
                    "error": str(sync_err),
                    "updated_at": datetime.now(dt_timezone.utc).isoformat() + "Z"
                }

        return JsonResponse(success_response(status_data))

    except Exception as e:
        logger.error("Resume upload error: %s", e)
        return JsonResponse(error_response(f"Server error: {e}"), status=500)


@csrf_exempt
@require_seeker_jwt
def get_parse_status(request):
    """
    GET /api/v1/seeker/resume/parse-status
    Gets the current Redis resume parsing status.
    """
    if request.method != "GET":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        import redis
        import json as _json
        
        redis_client = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))
        redis_key = f"seeker:resume_parse_status:{request.seeker.id}"
        
        status_raw = redis_client.get(redis_key)
        if not status_raw:
            return JsonResponse(success_response({
                "status": "idle",
                "progress": 0,
                "error": None
            }))
            
        status_data = _json.loads(status_raw)
        return JsonResponse(success_response(status_data))
    except Exception as e:
        logger.warning("Failed to fetch parsing status from Redis: %s", e)
        # Fallback if Redis is down
        return JsonResponse(success_response({
            "status": "idle",
            "progress": 0,
            "error": None,
            "redis_error": str(e)
        }))



@csrf_exempt
@require_seeker_jwt
def enhance_resume(request):
    """
    POST /api/v1/seeker/resume/enhance
    Run the AI Resume Enhancer on the seeker's current resume.
    Body (optional): { "job_description": "..." }
    """
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        seeker = request.seeker

        if not seeker.resume_data:
            return JsonResponse(error_response("Please upload a resume first"), status=400)

        import json as _json
        body = {}
        if request.body:
            try:
                body = _json.loads(request.body)
            except Exception:
                pass

        job_description = body.get("job_description", "")

        enhancer = ResumeEnhancerAgent()
        result = enhancer.enhance(seeker.resume_data, job_description)

        if result["success"]:
            # Store the enhanced version
            seeker.enhanced_resume = result["data"]
            seeker.save(update_fields=["enhanced_resume"])

        return JsonResponse(success_response(result["data"]))

    except Exception as e:
        logger.error("Resume enhance error: %s", e)
        return JsonResponse(error_response(f"Server error: {e}"), status=500)


@csrf_exempt
@require_seeker_jwt
def get_resume(request):
    """
    GET /api/v1/seeker/resume
    Returns the seeker's current parsed resume and enhanced version.
    """
    if request.method != "GET":
        return JsonResponse(error_response("Method not allowed"), status=405)
    seeker = request.seeker
    return JsonResponse(success_response({
        "has_resume": bool(seeker.resume_file_path or seeker.resume_data),
        "resume_data": seeker.resume_data,
        "enhanced_resume": seeker.enhanced_resume,
        "skills": seeker.skills,
    }))


@csrf_exempt
def public_parse_resume(request):
    """
    POST /api/v1/public/parse-resume
    Public endpoint to temporarily upload and parse a resume PDF/DOCX (before seeker registration).
    """
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        file = request.FILES.get("file") or request.FILES.get("resumeFile")
        if not file:
            return JsonResponse(error_response("No file provided"), status=400)

        allowed_ext = (".pdf", ".docx", ".doc", ".txt")
        if not file.name.lower().endswith(allowed_ext):
            return JsonResponse(error_response("Only PDF, DOCX, DOC, or TXT files are accepted"), status=400)

        if file.size > 10 * 1024 * 1024:  # 10 MB
            return JsonResponse(error_response("File size must be under 10 MB"), status=400)

        # Save to temporary directory
        temp_dir = os.path.join(UPLOAD_DIR, "temp")
        os.makedirs(temp_dir, exist_ok=True)

        fname = f"{uuid.uuid4()}_{file.name}"
        file_path = os.path.join(temp_dir, fname)
        with open(file_path, "wb+") as f:
            for chunk in file.chunks():
                f.write(chunk)

        # Parse with existing agent (synchronous wrapper)
        from asgiref.sync import async_to_sync
        parser = ResumeParsingAgent()
        file_ext = file.name.split('.')[-1].lower()
        if file_ext == "doc":
            file_ext = "docx"
        elif file_ext not in ["pdf", "docx", "txt"]:
            file_ext = "txt"
        
        parsed_response = async_to_sync(parser.parse)(file_path, file_ext)
        parsed = parsed_response.get("parsed", {})

        # Normalize skills
        raw_skills = parsed.get("skills", [])
        try:
            norm_agent = SkillNormalizationAgent()
            normalized_skills = async_to_sync(norm_agent.normalize)(raw_skills)
        except Exception as norm_err:
            logger.warning("Skill normalization failed: %s", norm_err)
            normalized_skills = raw_skills

        return JsonResponse(success_response({
            "temp_file_path": file_path,
            "name": parsed.get("name"),
            "email": parsed.get("email"),
            "phone": parsed.get("phone"),
            "location": parsed.get("location"),
            "headline": parsed.get("current_role"),
            "skills": normalized_skills,
            "experience": parsed.get("experience", []),
            "education": parsed.get("education", []),
            "total_experience_years": parsed.get("total_experience_years", 0),
            "file_name": file.name,
            "file_size_kb": round(file.size / 1024, 2)
        }))

    except Exception as e:
        logger.error("Public resume parse error: %s", e)
        return JsonResponse(error_response(f"Server error: {e}"), status=500)

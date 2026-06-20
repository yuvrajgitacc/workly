"""
Job Seeker Auth Views
─────────────────────
Handles register / login / me / profile for JobSeekerAccount.
Uses a separate JWT claim ("seeker_id") so tokens don't conflict with recruiter tokens.
"""

import json
import logging
from datetime import datetime, timedelta
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from passlib.context import CryptContext
from jose import jwt, JWTError

from api.models import JobSeekerAccount
from api.decorators import JWT_SECRET, JWT_ALGORITHM
from models.schemas import success_response, error_response

logger = logging.getLogger(__name__)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ACCESS_TOKEN_EXPIRE_DAYS = 7


def _make_seeker_token(seeker: JobSeekerAccount) -> str:
    payload = {
        "seeker_id": str(seeker.id),
        "email": seeker.email,
        "tier": seeker.tier,
        "exp": datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def require_seeker_jwt(view_func):
    """Decorator that injects request.seeker from the Authorization header."""
    from functools import wraps

    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth_header.startswith("Bearer "):
            return JsonResponse(error_response("Authentication required"), status=401)
        token = auth_header.split(" ", 1)[1]
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        except JWTError:
            return JsonResponse(error_response("Invalid or expired token"), status=401)

        seeker_id = payload.get("seeker_id")
        if not seeker_id:
            return JsonResponse(error_response("Invalid token type"), status=401)

        seeker = JobSeekerAccount.objects.filter(id=seeker_id, is_active=True).first()
        if not seeker:
            return JsonResponse(error_response("Account not found"), status=401)

        request.seeker = seeker
        return view_func(request, *args, **kwargs)

    return wrapper


def _seeker_dict(seeker: JobSeekerAccount) -> dict:
    resume = seeker.resume_data or {}
    
    # Calculate stats dynamically
    from api.models import JobApplication, SavedJob
    applications_count = JobApplication.objects.filter(seeker=seeker).count()
    interviews_count = JobApplication.objects.filter(seeker=seeker, status__in=["shortlisted", "interview"]).count()
    saved_jobs_count = SavedJob.objects.filter(seeker=seeker).count()
    
    # Calculate profile strength
    profile_strength = 0
    if seeker.full_name: profile_strength += 10
    if seeker.headline: profile_strength += 10
    if seeker.location: profile_strength += 10
    if seeker.resume_file_path: profile_strength += 20
    
    experience = resume.get("experience", [])
    if experience: profile_strength += 15
    
    education = resume.get("education", [])
    if education: profile_strength += 10
    
    if seeker.skills and len(seeker.skills) >= 3: profile_strength += 15
    
    open_to = resume.get("open_to", {})
    work_types = open_to.get("workTypes", []) or open_to.get("work_types", [])
    if work_types: profile_strength += 10
    
    return {
        "id": str(seeker.id),
        "full_name": seeker.full_name,
        "email": seeker.email,
        "phone": seeker.phone,
        "location": seeker.location,
        "headline": seeker.headline,
        "tier": seeker.tier,
        "has_resume": bool(seeker.resume_file_path or seeker.resume_data),
        "resume_file_path": seeker.resume_file_path,
        "resume_data": seeker.resume_data or {},
        "skills": seeker.skills or [],
        "created_at": seeker.created_at.isoformat() if seeker.created_at else None,
        
        # Resume metadata
        "resume_file_name": resume.get("resume_file_name"),
        "resume_updated_at": resume.get("resume_updated_at"),
        "resume_size": resume.get("resume_size"),
        
        # Preferences
        "open_to": open_to,
        
        # Stats
        "applications_count": applications_count,
        "interviews_count": interviews_count,
        "saved_jobs_count": saved_jobs_count,
        "profile_strength": profile_strength,
    }


# ── Views ─────────────────────────────────────────────────────────────────────

@csrf_exempt
def register(request):
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        import os
        import uuid
        import shutil
        
        data = json.loads(request.body)
        email = (data.get("email") or "").strip().lower()
        password = data.get("password", "")
        full_name = (data.get("full_name") or data.get("name") or "").strip()

        if not email or not password or not full_name:
            return JsonResponse(error_response("full_name, email, and password are required"), status=400)

        if len(password) < 8:
            return JsonResponse(error_response("Password must be at least 8 characters"), status=400)

        if JobSeekerAccount.objects.filter(email=email).exists():
            return JsonResponse(error_response("An account with this email already exists"), status=400)

        # Collect extra details if provided (from multi-step register)
        phone = data.get("phone", "").strip() or None
        location = data.get("location", "").strip() or None
        headline = data.get("headline", "").strip() or data.get("title", "").strip() or None
        
        skills = data.get("skills", [])
        experience = data.get("experience", [])
        education = data.get("education", [])
        open_to = data.get("openTo", {}) or data.get("open_to", {})
        
        temp_file_path = data.get("temp_file_path")
        file_name = data.get("file_name") or data.get("resume_file_name")
        file_size_kb = data.get("file_size_kb") or data.get("resume_size")
        total_experience_years = data.get("total_experience_years", 0)

        seeker = JobSeekerAccount.objects.create(
            full_name=full_name,
            email=email,
            password_hash=pwd_context.hash(password[:72]),
            phone=phone,
            location=location,
            headline=headline,
            skills=skills,
            tier="free",
        )
        
        # Store resume data JSON
        resume_data = {
            "experience": experience,
            "education": education,
            "total_experience_years": total_experience_years,
            "open_to": open_to,
        }

        # If a temp file was uploaded, move it to seeker's directory
        if temp_file_path and os.path.exists(temp_file_path):
            upload_dir = os.getenv("UPLOAD_DIR", "uploads")
            seeker_dir = os.path.join(upload_dir, "seekers", str(seeker.id))
            os.makedirs(seeker_dir, exist_ok=True)
            
            permanent_name = f"{uuid.uuid4()}_{os.path.basename(temp_file_path)}"
            permanent_path = os.path.join(seeker_dir, permanent_name)
            
            try:
                shutil.move(temp_file_path, permanent_path)
                seeker.resume_file_path = permanent_path
                
                # Save file metadata in resume_data
                resume_data["resume_file_name"] = file_name or os.path.basename(temp_file_path)
                resume_data["resume_updated_at"] = datetime.utcnow().isoformat() + "Z"
                resume_data["resume_size"] = file_size_kb or round(os.path.getsize(permanent_path) / 1024, 2)
            except Exception as move_err:
                logger.error("Failed to move temp resume file: %s", move_err)

        seeker.resume_data = resume_data
        seeker.save()

        token = _make_seeker_token(seeker)
        return JsonResponse(success_response({
            "seeker_token": token,
            "seeker": _seeker_dict(seeker),
            "message": "Account created successfully",
        }), status=201)

    except json.JSONDecodeError:
        return JsonResponse(error_response("Invalid JSON body"), status=400)
    except Exception as e:
        logger.error("Seeker register error: %s", e)
        return JsonResponse(error_response(f"Server error: {e}"), status=500)


@csrf_exempt
def login(request):
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        data = json.loads(request.body)
        email = (data.get("email") or "").strip().lower()
        password = data.get("password", "")

        if not email or not password:
            return JsonResponse(error_response("Email and password are required"), status=400)

        seeker = JobSeekerAccount.objects.filter(email=email, is_active=True).first()
        if not seeker or not pwd_context.verify(password[:72], seeker.password_hash):
            return JsonResponse(error_response("Invalid email or password"), status=401)

        token = _make_seeker_token(seeker)
        return JsonResponse(success_response({
            "seeker_token": token,
            "seeker": _seeker_dict(seeker),
        }))

    except json.JSONDecodeError:
        return JsonResponse(error_response("Invalid JSON body"), status=400)
    except Exception as e:
        logger.error("Seeker login error: %s", e)
        return JsonResponse(error_response(f"Server error: {e}"), status=500)


@csrf_exempt
@require_seeker_jwt
def me(request):
    if request.method != "GET":
        return JsonResponse(error_response("Method not allowed"), status=405)
    return JsonResponse(success_response(_seeker_dict(request.seeker)))


@csrf_exempt
@require_seeker_jwt
def update_profile(request):
    if request.method not in ["POST", "PATCH", "PUT"]:
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        data = json.loads(request.body)
        seeker = request.seeker
        fields_changed = []

        if "full_name" in data and data["full_name"].strip():
            seeker.full_name = data["full_name"].strip()
            fields_changed.append("full_name")
        if "phone" in data:
            seeker.phone = data["phone"].strip() or None
            fields_changed.append("phone")
        if "location" in data:
            seeker.location = data["location"].strip() or None
            fields_changed.append("location")
        if "headline" in data or "title" in data:
            seeker.headline = (data.get("headline") or data.get("title") or "").strip() or None
            fields_changed.append("headline")
        if "skills" in data:
            seeker.skills = data["skills"]
            fields_changed.append("skills")

        # Handle updating resume_data fields (experience, education, open_to)
        resume = seeker.resume_data or {}
        resume_changed = False
        
        if "experience" in data:
            resume["experience"] = data["experience"]
            resume_changed = True
            
        if "education" in data:
            resume["education"] = data["education"]
            resume_changed = True
            
        if "open_to" in data or "openTo" in data:
            resume["open_to"] = data.get("open_to") or data.get("openTo")
            resume_changed = True

        if resume_changed:
            seeker.resume_data = resume
            fields_changed.append("resume_data")

        if fields_changed:
            seeker.save(update_fields=fields_changed)

        return JsonResponse(success_response(_seeker_dict(seeker)))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {e}"), status=500)

"""
Job Seeker Jobs & Applications Views
──────────────────────────────────────
Handles:
  - List public jobs (sessions with status=active)
  - Job detail with AI match score against seeker's resume
  - Apply to a job → creates Candidate + JobApplication + emails + notifications
  - List seeker's applications
  - Notifications CRUD
"""

import json
import logging
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone

from api.models import Session, Candidate, JobApplication, Notification, JobSeekerAccount, Company
from api.views.seeker_auth import require_seeker_jwt
from api.services.email_service import (
    send_application_received_to_company,
    send_application_confirmation_to_seeker,
    send_status_update_to_seeker,
)
from models.schemas import success_response, error_response
from api.services.matching_service import calculate_match

logger = logging.getLogger(__name__)


def _session_to_job(session: Session, match_score=None, applied=False) -> dict:
    """Serialize a Session as a public job listing."""
    return {
        "id": str(session.id),
        "company_id": str(session.company_id),
        "job_title": session.job_title,
        "company_name": session.company.name if session.company else "Unknown Company",
        "job_description": session.job_description[:500] + "..." if len(session.job_description) > 500 else session.job_description,
        "full_description": session.job_description,
        "status": session.status,
        "rounds": len(session.rounds) if session.rounds else 1,
        "inferred_skills": session.inferred_skills or [],
        "created_at": session.created_at.isoformat() if session.created_at else None,
        "match_score": match_score,
        "applied": applied,
        "applicant_count": session.seeker_applications.count(),
        "location": session.location or "Remote",
        "employment_type": session.employment_type or "Full-time",
        "salary_range": session.salary_range or "Competitive",
        "experience_level": session.experience_level or "Mid-Level",
        "company_logo_path": session.company.logo_path if session.company else None,
    }


def _get_skill_name(s):
    if isinstance(s, dict):
        return s.get("canonical_skill") or s.get("raw_skill") or ""
    return str(s)


def _compute_match_score(seeker_skills: list, job_skills: list) -> int:
    """
    Simple set-intersection match score (0–100).
    A real implementation uses the MatchingAgent, but this is fast and dependency-free.
    """
    if not seeker_skills or not job_skills:
        return 0

    seeker_lower = {str(_get_skill_name(s)).lower().strip() for s in seeker_skills if s}
    job_lower = {str(_get_skill_name(s)).lower().strip() for s in job_skills if s}

    seeker_lower = {s for s in seeker_lower if s}
    job_lower = {s for s in job_lower if s}

    if not job_lower:
        return 0

    intersection = seeker_lower & job_lower
    return round(len(intersection) / len(job_lower) * 100)


# ── Public (authenticated seeker) endpoints ────────────────────────────────────

@csrf_exempt
@require_seeker_jwt
def list_jobs(request):
    """GET /api/v1/seeker/jobs — list all active public job postings."""
    if request.method != "GET":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        seeker = request.seeker
        q = request.GET.get("q", "").strip().lower()
        location = request.GET.get("location", "").strip().lower()
        job_type = request.GET.get("job_type", "").strip().lower()

        sessions = Session.objects.filter(status="active").order_by("-created_at")

        if q:
            sessions = sessions.filter(job_title__icontains=q)
        if location:
            from django.db.models import Q
            sessions = sessions.filter(Q(location__icontains=location) | Q(job_description__icontains=location))

        # Get seeker's applied session IDs
        applied_ids = set(
            str(sid) for sid in
            JobApplication.objects.filter(seeker=seeker).values_list("session_id", flat=True)
        )

        # Get seeker experience years safely
        resume = seeker.resume_data or {}
        raw_exp = resume.get("total_experience_years")
        try:
            exp_years = float(raw_exp) if raw_exp is not None else 0.0
        except (ValueError, TypeError):
            exp_years = 0.0

        jobs = []
        for s in sessions[:50]:
            try:
                criteria = s.criteria or {}
                match_res = calculate_match(
                    normalized_skills=seeker.skills,
                    total_experience_years=exp_years,
                    location=seeker.location or resume.get("location"),
                    criteria=criteria,
                    parsing_method="llm"
                )
                score = match_res["match_score"]
            except Exception as match_err:
                logger.error("Error in calculate_match during list_jobs for session %s: %s", s.id, match_err)
                score = _compute_match_score(seeker.skills, s.inferred_skills)
                
            jobs.append(_session_to_job(s, match_score=score, applied=str(s.id) in applied_ids))

        # Sort by match score descending
        jobs.sort(key=lambda j: j["match_score"] or 0, reverse=True)

        return JsonResponse(success_response({
            "jobs": jobs,
            "total": len(jobs),
        }))
    except Exception as e:
        logger.error("list_jobs error: %s", e)
        return JsonResponse(error_response(f"Server error: {e}"), status=500)


@csrf_exempt
@require_seeker_jwt
def job_detail(request, session_id):
    """GET /api/v1/seeker/jobs/<session_id> — single job detail with skill alignment."""
    if request.method != "GET":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        seeker = request.seeker
        session = Session.objects.filter(id=session_id).first()
        if not session:
            return JsonResponse(error_response("Job not found"), status=404)

        # Get seeker experience years safely
        resume = seeker.resume_data or {}
        raw_exp = resume.get("total_experience_years")
        try:
            exp_years = float(raw_exp) if raw_exp is not None else 0.0
        except (ValueError, TypeError):
            exp_years = 0.0

        try:
            criteria = session.criteria or {}
            match_res = calculate_match(
                normalized_skills=seeker.skills,
                total_experience_years=exp_years,
                location=seeker.location or resume.get("location"),
                criteria=criteria,
                parsing_method="llm"
            )
            score = match_res["match_score"]
        except Exception as match_err:
            logger.error("Error in calculate_match during job_detail for session %s: %s", session.id, match_err)
            score = _compute_match_score(seeker.skills, session.inferred_skills)

        applied = JobApplication.objects.filter(seeker=seeker, session=session).exists()
        from api.models import SavedJob
        is_saved = SavedJob.objects.filter(seeker=seeker, session=session).exists()

        # Compute skill alignment
        seeker_skills_list = seeker.skills or []
        seeker_lower = {}
        for s in seeker_skills_list:
            if s:
                name = _get_skill_name(s)
                if name:
                    seeker_lower[name.lower().strip()] = s

        job_skills = session.inferred_skills or []
        matched_skills = []
        missing_skills = []
        for s in job_skills:
            if s:
                name = _get_skill_name(s)
                if name:
                    if name.lower().strip() in seeker_lower:
                        matched_skills.append(s)
                    else:
                        missing_skills.append(s)

        job = _session_to_job(session, match_score=score, applied=applied)
        job["is_saved"] = is_saved
        job["skill_alignment"] = {
            "matched": matched_skills,
            "missing": missing_skills,
            "match_pct": score,
        }
        return JsonResponse(success_response(job))
    except Exception as e:
        logger.error("job_detail error: %s", e)
        return JsonResponse(error_response(f"Server error: {e}"), status=500)


@csrf_exempt
@require_seeker_jwt
def apply_job(request, session_id):
    """
    POST /api/v1/seeker/jobs/<session_id>/apply
    Body: { "cover_note": "..." }  (optional)

    Flow:
      1. Validate seeker has a resume
      2. Check no duplicate application
      3. Create Candidate record in session (for ATS view)
      4. Create JobApplication record
      5. Create Notifications for seeker + company
      6. Send emails (non-blocking)
    """
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        seeker = request.seeker

        if not seeker.resume_data:
            return JsonResponse(error_response("Please upload your resume before applying"), status=400)

        session = Session.objects.filter(id=session_id, status="active").first()
        if not session:
            return JsonResponse(error_response("Job posting not found or no longer active"), status=404)

        # Duplicate check
        if JobApplication.objects.filter(seeker=seeker, session=session).exists():
            return JsonResponse(error_response("You have already applied to this job"), status=400)

        body = {}
        if request.body:
            try:
                body = json.loads(request.body)
            except Exception:
                pass
        cover_note = body.get("cover_note", "")

        # Build resume data for Candidate record
        resume = seeker.resume_data or {}

        # Unified match scoring using criteria
        match_score = None
        recommendation = ""
        match_details = {}
        agent_processing_status = "completed"
        agent_error_message = None

        # Safe float conversion for experience years
        raw_exp = resume.get("total_experience_years")
        try:
            exp_years = float(raw_exp) if raw_exp is not None else 0.0
        except (ValueError, TypeError):
            exp_years = 0.0

        try:
            criteria = session.criteria or {}
            match_res = calculate_match(
                normalized_skills=seeker.skills,
                total_experience_years=exp_years,
                location=seeker.location or resume.get("location"),
                criteria=criteria,
                parsing_method="llm"
            )
            match_score = match_res["match_score"]
            recommendation = match_res["recommendation"]
            match_details = match_res["match_details"]
        except Exception as e:
            logger.error("Error in calculate_match during self-apply: %s", e)
            agent_processing_status = "failed"
            agent_error_message = str(e)

        first_round_order = _safe_int(session.rounds[0].get("order", 1)) if session.rounds else 1

        # Create Candidate in the ATS session
        candidate = Candidate.objects.create(
            session=session,
            name=seeker.full_name,
            email=seeker.email,
            phone=seeker.phone or resume.get("phone"),
            location=seeker.location or resume.get("location"),
            resume_file_path=seeker.resume_file_path,
            raw_resume_data=resume,
            normalized_skills=seeker.skills,
            total_experience_years=exp_years,
            status="new",
            source="platform_apply",
            application_source="portal",
            agent_processing_status=agent_processing_status,
            agent_error_message=agent_error_message,
            current_round_index=first_round_order,
            match_score=match_score,
            recommendation=recommendation,
            match_details=match_details
        )

        # Create JobApplication record
        application = JobApplication.objects.create(
            seeker=seeker,
            session=session,
            candidate=candidate,
            cover_note=cover_note,
            status="applied",
        )

        # Notification for seeker
        Notification.objects.create(
            seeker=seeker,
            type="general",
            title=f"Application submitted — {session.job_title}",
            message=f"Your application to {session.company.name if session.company else 'Unknown Company'} for {session.job_title} has been submitted.",
            link=f"/jobs/dashboard/applications",
        )

        # Notification for company
        Notification.objects.create(
            company=session.company,
            type="application_received",
            title=f"New applicant — {session.job_title}",
            message=f"{seeker.full_name} applied for {session.job_title}.",
            link=f"/dashboard/sessions/{session_id}",
        )

        # Send emails (non-blocking — failure won't break apply)
        send_application_received_to_company(
            company_email=session.company.email,
            company_name=session.company.name if session.company else "Unknown Company",
            seeker_name=seeker.full_name,
            job_title=session.job_title,
            session_id=session_id,
        )
        send_application_confirmation_to_seeker(
            seeker_email=seeker.email,
            seeker_name=seeker.full_name,
            job_title=session.job_title,
            company_name=session.company.name if session.company else "Unknown Company",
        )

        return JsonResponse(success_response({
            "application_id": str(application.id),
            "status": "applied",
            "message": f"Successfully applied to {session.job_title} at {session.company.name if session.company else 'Unknown Company'}",
        }), status=201)

    except Exception as e:
        logger.error("apply_job error: %s", e)
        return JsonResponse(error_response(f"Server error: {e}"), status=500)


def _safe_int(val, default=1):
    if val is None:
        return default
    try:
        return int(val)
    except (ValueError, TypeError):
        return default


def _parse_announcement_date(date_val):
    if not date_val:
        return None
    from django.utils.dateparse import parse_datetime
    from django.utils import timezone
    from datetime import datetime
    
    # If already a datetime object
    if isinstance(date_val, datetime):
        if timezone.is_naive(date_val):
            try:
                return timezone.make_aware(date_val, timezone.get_current_timezone())
            except Exception:
                return None
        return date_val
        
    # If it is a string
    if isinstance(date_val, str):
        try:
            dt = parse_datetime(date_val)
            if dt:
                if timezone.is_naive(dt):
                    dt = timezone.make_aware(dt, timezone.get_current_timezone())
                return dt
        except Exception:
            pass
            
    return None


@csrf_exempt
@require_seeker_jwt
def my_applications(request):
    """GET /api/v1/seeker/applications — list all seeker's job applications."""
    if request.method != "GET":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        seeker = request.seeker
        apps = JobApplication.objects.filter(seeker=seeker).select_related("session").order_by("-applied_at")

        result = []
        now = timezone.now()
        
        for app in apps:
            session = app.session
            candidate = app.candidate
            
            # Default fallback values
            visible_status = app.status
            visible_round_index = 1
            if session.rounds:
                visible_round_index = _safe_int(session.rounds[0].get("order", 1))
                
            if candidate:
                actual_round = candidate.current_round_index
                actual_status = candidate.status
                
                rounds_sorted = sorted(session.rounds or [], key=lambda x: _safe_int(x.get("order", 1)))
                
                temp_status = "applied"
                temp_visible_round = _safe_int(rounds_sorted[0].get("order", 1)) if rounds_sorted else 1
                
                for r in rounds_sorted:
                    r_order = _safe_int(r.get("order", 1))
                    r_date_str = r.get("result_announcement_date")
                    
                    r_date = _parse_announcement_date(r_date_str)
                    date_has_passed = not r_date or now >= r_date
                    
                    if r_order <= actual_round:
                        if date_has_passed:
                            if actual_round > r_order:
                                temp_status = "shortlisted"
                                next_rounds = [x for x in rounds_sorted if _safe_int(x.get("order", 1)) > r_order]
                                if next_rounds:
                                    temp_visible_round = _safe_int(next_rounds[0].get("order", 1))
                            else:
                                if actual_status == "rejected":
                                    temp_status = "rejected"
                                    temp_visible_round = r_order
                                elif actual_status == "hired":
                                    temp_status = "hired"
                                    temp_visible_round = r_order
                                elif actual_status == "forwarded":
                                    temp_status = "shortlisted"
                                    temp_visible_round = r_order
                                else:
                                    temp_status = "applied"
                                    temp_visible_round = r_order
                        else:
                            # Round announcement is in the future. Stop advancing.
                            break
                    else:
                        break
                        
                visible_status = temp_status
                visible_round_index = temp_visible_round
            
            result.append({
                "id": str(app.id),
                "job_id": str(session.id),
                "job_title": session.job_title,
                "company_name": session.company.name if session.company else "Unknown Company",
                "status": visible_status,
                "visible_status": visible_status,
                "visible_round_index": visible_round_index,
                "cover_note": app.cover_note,
                "applied_at": app.applied_at.isoformat(),
                "updated_at": app.updated_at.isoformat(),
                "company_logo_path": session.company.logo_path if session.company else None,
                "rounds": session.rounds or [],
                "agent_processing_status": candidate.agent_processing_status if candidate else "completed",
                "agent_error_message": candidate.agent_error_message if candidate else None,
                "match_score": candidate.match_score if candidate else None
            })

        return JsonResponse(success_response({
            "applications": result,
            "total": len(result),
            "server_time": timezone.now().isoformat()
        }))
    except Exception as e:
        logger.error("my_applications error: %s", e)
        return JsonResponse(error_response(f"Server error: {e}"), status=500)


# ── Notifications ──────────────────────────────────────────────────────────────

@csrf_exempt
@require_seeker_jwt
def get_notifications(request):
    """GET /api/v1/seeker/notifications"""
    if request.method != "GET":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        notifs = Notification.objects.filter(seeker=request.seeker).order_by("-created_at")[:50]
        data = [{
            "id": str(n.id),
            "type": n.type,
            "title": n.title,
            "message": n.message,
            "is_read": n.is_read,
            "link": n.link,
            "created_at": n.created_at.isoformat(),
        } for n in notifs]
        unread_count = Notification.objects.filter(seeker=request.seeker, is_read=False).count()
        return JsonResponse(success_response({"notifications": data, "unread_count": unread_count}))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {e}"), status=500)


@csrf_exempt
@require_seeker_jwt
def mark_notification_read(request, notif_id):
    """PATCH /api/v1/seeker/notifications/<id>/read"""
    if request.method not in ["PATCH", "POST", "PUT"]:
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        notif = Notification.objects.filter(id=notif_id, seeker=request.seeker).first()
        if not notif:
            return JsonResponse(error_response("Notification not found"), status=404)
        notif.is_read = True
        notif.save(update_fields=["is_read"])
        return JsonResponse(success_response({"marked_read": True}))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {e}"), status=500)


@csrf_exempt
@require_seeker_jwt
def mark_all_notifications_read(request):
    """POST /api/v1/seeker/notifications/read-all"""
    if request.method not in ["POST", "PATCH"]:
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        Notification.objects.filter(seeker=request.seeker, is_read=False).update(is_read=True)
        return JsonResponse(success_response({"message": "All notifications marked as read"}))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {e}"), status=500)


# ── Company notifications (for recruiter ATS view) ─────────────────────────────

# ── Seeker Company & Bookmark APIs ─────────────────────────────────────────────

@csrf_exempt
@require_seeker_jwt
def list_companies(request):
    """GET /api/v1/seeker/companies - List all registered companies."""
    if request.method != "GET":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        companies_list = Company.objects.filter(is_active=True).order_by("name")
        data = []
        for c in companies_list:
            # Self-healing slug logic
            if not c.slug:
                from django.utils.text import slugify
                base_slug = slugify(c.name)
                if not base_slug:
                    base_slug = "company"
                slug = base_slug
                counter = 1
                while Company.objects.filter(slug=slug).exists():
                    slug = f"{base_slug}-{counter}"
                    counter += 1
                c.slug = slug
                c.save(update_fields=["slug"])

            openings_count = Session.objects.filter(company_id=c.id, status="active").count()
            data.append({
                "id": str(c.id),
                "name": c.name,
                "slug": c.slug,
                "industry": c.industry or "Technology",
                "hq_location": c.hq_location or "Remote",
                "company_size": c.company_size or "50-200",
                "founded_year": c.founded_year or 2020,
                "website_url": c.website_url,
                "about": c.about or "",
                "logo_path": c.logo_path,
                "openings": openings_count,
                "rating": 4.5,
            })
        return JsonResponse(success_response({"companies": data}))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {e}"), status=500)


@csrf_exempt
@require_seeker_jwt
def company_detail(request, company_id):
    """GET /api/v1/seeker/companies/<company_id> - Single company detail with posted jobs."""
    if request.method != "GET":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        import uuid
        c = None
        try:
            val = uuid.UUID(company_id)
            c = Company.objects.filter(id=val).first()
        except (ValueError, TypeError):
            pass

        if not c:
            c = Company.objects.filter(slug=company_id).first()

        if not c:
            return JsonResponse(error_response("Company not found"), status=404)

        # Self-healing slug logic
        if not c.slug:
            from django.utils.text import slugify
            base_slug = slugify(c.name)
            if not base_slug:
                base_slug = "company"
            slug = base_slug
            counter = 1
            while Company.objects.filter(slug=slug).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            c.slug = slug
            c.save(update_fields=["slug"])

        open_jobs = Session.objects.filter(company_id=c.id, status="active").order_by("-created_at")
        jobs_data = []
        seeker = request.seeker
        
        # Get seeker's applied session IDs
        applied_ids = set(
            str(sid) for sid in
            JobApplication.objects.filter(seeker=seeker).values_list("session_id", flat=True)
        )

        for s in open_jobs:
            score = _compute_match_score(seeker.skills, s.inferred_skills)
            jobs_data.append(_session_to_job(s, match_score=score, applied=str(s.id) in applied_ids))

        # Check if user follows this company
        followed_ids = seeker.followed_companies or []
        is_following = str(c.id) in followed_ids

        company_data = {
            "id": str(c.id),
            "name": c.name,
            "slug": c.slug,
            "industry": c.industry or "Technology",
            "hq_location": c.hq_location or "Remote",
            "company_size": c.company_size or "50-200",
            "founded_year": c.founded_year or 2020,
            "website_url": c.website_url,
            "about": c.about or "",
            "logo_path": c.logo_path,
            "open_jobs": jobs_data,
            "openings": len(jobs_data),
            "rating": 4.5,
            "is_following": is_following,
        }
        return JsonResponse(success_response(company_data))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {e}"), status=500)


@csrf_exempt
@require_seeker_jwt
def follow_company(request, company_id):
    """POST /api/v1/seeker/companies/<company_id>/follow - Follow/unfollow a company."""
    if request.method not in ["POST", "DELETE"]:
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        c = Company.objects.filter(id=company_id).first()
        if not c:
            return JsonResponse(error_response("Company not found"), status=404)

        seeker = request.seeker
        followed = list(seeker.followed_companies or [])

        if request.method == "POST":
            if str(c.id) not in followed:
                followed.append(str(c.id))
                seeker.followed_companies = followed
                seeker.save(update_fields=["followed_companies"])
            message = f"Following {c.name}"
            is_following = True
        else: # DELETE
            if str(c.id) in followed:
                followed.remove(str(c.id))
                seeker.followed_companies = followed
                seeker.save(update_fields=["followed_companies"])
            message = f"Unfollowed {c.name}"
            is_following = False

        return JsonResponse(success_response({
            "message": message,
            "is_following": is_following
        }))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {e}"), status=500)


# ── Bookmark (Save) Job APIs ───────────────────────────────────────────────────

@csrf_exempt
@require_seeker_jwt
def save_job(request, session_id):
    """
    POST /api/v1/seeker/jobs/<session_id>/save - Save/bookmark a job.
    DELETE /api/v1/seeker/jobs/<session_id>/save - Unsave/remove bookmark.
    """
    if request.method not in ["POST", "DELETE"]:
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        session = Session.objects.filter(id=session_id).first()
        if not session:
            return JsonResponse(error_response("Job not found"), status=404)

        seeker = request.seeker
        from api.models import SavedJob
        
        if request.method == "POST":
            saved_job, created = SavedJob.objects.get_or_create(seeker=seeker, session=session)
            message = "Job saved successfully"
            is_saved = True
        else: # DELETE
            SavedJob.objects.filter(seeker=seeker, session=session).delete()
            message = "Job removed from bookmarks"
            is_saved = False

        return JsonResponse(success_response({
            "message": message,
            "is_saved": is_saved
        }))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {e}"), status=500)


@csrf_exempt
@require_seeker_jwt
def get_saved_jobs(request):
    """GET /api/v1/seeker/jobs/saved - List all saved jobs for the seeker."""
    if request.method != "GET":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        seeker = request.seeker
        from api.models import SavedJob
        saved = SavedJob.objects.filter(seeker=seeker).select_related("session").order_by("-saved_at")

        result = []
        # Get seeker's applied session IDs
        applied_ids = set(
            str(sid) for sid in
            JobApplication.objects.filter(seeker=seeker).values_list("session_id", flat=True)
        )

        for item in saved:
            s = item.session
            score = _compute_match_score(seeker.skills, s.inferred_skills)
            result.append(_session_to_job(s, match_score=score, applied=str(s.id) in applied_ids))

        return JsonResponse(success_response({
            "jobs": result,
            "total": len(result)
        }))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {e}"), status=500)


def get_company_notifications(company, limit=20):
    """Helper used by company dashboard to fetch their notifications."""
    notifs = Notification.objects.filter(company=company).order_by("-created_at")[:limit]
    return [{
        "id": str(n.id),
        "type": n.type,
        "title": n.title,
        "message": n.message,
        "is_read": n.is_read,
        "link": n.link,
        "created_at": n.created_at.isoformat(),
    } for n in notifs]


# ── Public Browse APIs (NO authentication required) ────────────────────────────

@csrf_exempt
def public_list_companies(request):
    """GET /api/v1/public/companies - List all companies (no auth)."""
    if request.method != "GET":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        q = request.GET.get("q", "").strip().lower()
        companies_list = Company.objects.filter(is_active=True).order_by("name")

        if q:
            companies_list = companies_list.filter(name__icontains=q)

        data = []
        for c in companies_list:
            # Self-healing slug logic
            if not c.slug:
                from django.utils.text import slugify
                base_slug = slugify(c.name)
                if not base_slug:
                    base_slug = "company"
                slug = base_slug
                counter = 1
                while Company.objects.filter(slug=slug).exists():
                    slug = f"{base_slug}-{counter}"
                    counter += 1
                c.slug = slug
                c.save(update_fields=["slug"])

            openings_count = Session.objects.filter(company_id=c.id, status="active").count()
            data.append({
                "id": str(c.id),
                "name": c.name,
                "slug": c.slug,
                "industry": c.industry or "Technology",
                "hq_location": c.hq_location or "Remote",
                "company_size": c.company_size or "50-200",
                "founded_year": c.founded_year or 2020,
                "website_url": c.website_url,
                "about": c.about or "",
                "logo_path": c.logo_path,
                "openings": openings_count,
                "rating": 4.5,
            })
        return JsonResponse(success_response({"companies": data}))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {e}"), status=500)


@csrf_exempt
def public_company_detail(request, company_id):
    """GET /api/v1/public/companies/<company_id> - Single company detail (no auth)."""
    if request.method != "GET":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        import uuid
        c = None
        try:
            val = uuid.UUID(company_id)
            c = Company.objects.filter(id=val, is_active=True).first()
        except (ValueError, TypeError):
            pass

        if not c:
            c = Company.objects.filter(slug=company_id, is_active=True).first()

        if not c:
            return JsonResponse(error_response("Company not found"), status=404)

        # Self-healing slug logic
        if not c.slug:
            from django.utils.text import slugify
            base_slug = slugify(c.name)
            if not base_slug:
                base_slug = "company"
            slug = base_slug
            counter = 1
            while Company.objects.filter(slug=slug).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            c.slug = slug
            c.save(update_fields=["slug"])

        open_jobs = Session.objects.filter(company_id=c.id, status="active").order_by("-created_at")
        jobs_data = []
        for s in open_jobs:
            jobs_data.append({
                "id": str(s.id),
                "company_id": str(s.company_id),
                "job_title": s.job_title,
                "company_name": c.name,
                "job_description": s.job_description[:500] + "..." if len(s.job_description) > 500 else s.job_description,
                "full_description": s.job_description,
                "status": s.status,
                "inferred_skills": s.inferred_skills or [],
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "applicant_count": s.seeker_applications.count(),
                "location": s.location or "Remote",
                "employment_type": s.employment_type or "Full-time",
                "salary_range": s.salary_range or "Competitive",
                "experience_level": s.experience_level or "Mid-Level",
            })

        company_data = {
            "id": str(c.id),
            "name": c.name,
            "slug": c.slug,
            "industry": c.industry or "Technology",
            "hq_location": c.hq_location or "Remote",
            "company_size": c.company_size or "50-200",
            "founded_year": c.founded_year or 2020,
            "website_url": c.website_url,
            "about": c.about or "",
            "logo_path": c.logo_path,
            "open_jobs": jobs_data,
            "openings": len(jobs_data),
            "rating": 4.5,
        }
        return JsonResponse(success_response(company_data))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {e}"), status=500)


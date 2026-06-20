import os
import json
import logging
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Q, F
from django.utils import timezone

from api.models import Company, Session, Candidate, JobApplication, Notification
from api.decorators import require_api_key
from models.schemas import success_response, error_response
from api.services.email_service import send_status_update_to_seeker

logger = logging.getLogger(__name__)

def _serialize_candidate_summary(c):
    match_details = c.match_details or {}
    norm_skills = c.normalized_skills or []
    raw_data = c.raw_resume_data or {}
    
    # Check if raw_resume_data contains 'parsed' key
    parsed = raw_data.get("parsed", raw_data)

    experience = parsed.get("experience", [])
    education = parsed.get("education", [])
    current_role = parsed.get("current_role")
    linkedin_url = parsed.get("linkedin_url")
    github_url = parsed.get("github_url")

    matched_set = set(s.lower() for s in match_details.get("matched_skills", []))
    missing_set = set(s.lower() for s in match_details.get("missing_skills", []))
    
    other_skills = [
        s.get("canonical_skill", s.get("raw_skill", ""))
        for s in norm_skills
        if s.get("canonical_skill", s.get("raw_skill", "")).lower() not in matched_set
        and s.get("canonical_skill", s.get("raw_skill", "")).lower() not in missing_set
    ]

    upload_root = os.getenv("UPLOAD_DIR", "uploads")
    photo_root = os.getenv("PHOTO_DIR", "photos")
    
    photo_url = None
    if c.resume_photo_path:
        try:
            rel = os.path.relpath(c.resume_photo_path, photo_root).replace("\\", "/")
            photo_url = f"/photos/{rel}"
        except:
            photo_url = None
        
    resume_url = None
    if c.resume_file_path:
        try:
            rel = os.path.relpath(c.resume_file_path, upload_root).replace("\\", "/")
            resume_url = f"/uploads/{rel}"
        except:
            resume_url = None

    return {
        "id": str(c.id),
        "name": c.name,
        "email": c.email,
        "phone": c.phone,
        "location": c.location,
        "photo_url": photo_url,
        "resume_url": resume_url,
        "match_score": c.match_score,
        "skill_score": match_details.get("skill_score"),
        "experience_score": match_details.get("experience_score"),
        "location_score": match_details.get("location_score"),
        "matched_skills": match_details.get("matched_skills", []),
        "missing_skills": match_details.get("missing_skills", []),
        "other_skills": other_skills[:10],
        "recommendation": c.recommendation,
        "total_experience_years": c.total_experience_years,
        "experience_years": c.total_experience_years,
        "current_role": current_role,
        "linkedin_url": linkedin_url,
        "github_url": github_url,
        "experience": experience,
        "education": education,
        "normalized_skills": [s.get("canonical_skill", s) for s in norm_skills] if norm_skills else [],
        "current_round_index": c.current_round_index,
        "round_index": c.current_round_index,
        "raw_resume_data": parsed,
        "status": c.status,
        "source": c.source,
        "created_at": c.created_at.isoformat() if c.created_at else None
    }

@csrf_exempt
@require_api_key
def list_candidates(request, session_id):
    if request.method != "GET":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        round_index_val = request.GET.get("round_index")
        round_index = int(round_index_val) if round_index_val is not None else None
        
        status = request.GET.get("status")
        
        min_score_val = request.GET.get("min_score")
        min_score = float(min_score_val) if min_score_val is not None else None
        
        max_score_val = request.GET.get("max_score")
        max_score = float(max_score_val) if max_score_val is not None else None
        
        location = request.GET.get("location")
        search = request.GET.get("search")
        
        sort_by = request.GET.get("sort_by", "match_score")
        sort_order = request.GET.get("sort_order", "desc")
        
        page = int(request.GET.get("page", 1))
        per_page = int(request.GET.get("per_page", 50))

        query = Candidate.objects.filter(session_id=session_id)

        if round_index is not None:
            if round_index <= 1:
                query = query.filter(current_round_index__in=[0, round_index])
            else:
                query = query.filter(current_round_index=round_index)
        
        if status:
            status_list = [s.strip() for s in status.split(",") if s.strip()]
            if len(status_list) == 1:
                query = query.filter(status=status_list[0])
            else:
                query = query.filter(status__in=status_list)
                
        if min_score is not None:
            query = query.filter(match_score__gte=min_score)
        if max_score is not None:
            query = query.filter(match_score__lte=max_score)
        if location:
            query = query.filter(location__icontains=location)
        if search:
            query = query.filter(Q(name__icontains=search) | Q(email__icontains=search))

        # Check sorting field
        if not hasattr(Candidate, sort_by):
            sort_by = "match_score"
            
        if sort_order == "asc":
            query = query.order_by(F(sort_by).asc(nulls_last=True))
        else:
            query = query.order_by(F(sort_by).desc(nulls_last=True))

        total = query.count()
        
        # Pagination
        offset = (page - 1) * per_page
        candidates = query[offset:offset+per_page]

        total_hired = Candidate.objects.filter(session_id=session_id, status="hired").count()
        total_rejected = Candidate.objects.filter(session_id=session_id, status="rejected").count()

        return JsonResponse(success_response({
            "candidates": [_serialize_candidate_summary(c) for c in candidates],
            "total": total,
            "total_hired": total_hired,
            "total_rejected": total_rejected,
            "page": page,
            "per_page": per_page,
            "pages": (total + per_page - 1) // per_page if per_page > 0 else 0
        }))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

@csrf_exempt
@require_api_key
def get_candidate(request, session_id, cand_id):
    """Handles GET (retrieve) and DELETE (delete) for a single candidate."""
    try:
        candidate = Candidate.objects.filter(id=cand_id, session_id=session_id).first()
        if not candidate:
            return JsonResponse(error_response("Candidate not found"), status=404)

        if request.method == "DELETE":
            candidate.delete()
            return JsonResponse(success_response({"message": "Candidate deleted"}))

        if request.method == "GET":
            parsed = candidate.raw_resume_data or {}
            inner_parsed = parsed.get("parsed", parsed)
            return JsonResponse(success_response({
                "id": str(candidate.id),
                "name": candidate.name,
                "email": candidate.email,
                "phone": candidate.phone,
                "location": candidate.location,
                "photo_url": candidate.resume_photo_path,
                "match_score": candidate.match_score,
                "match_details": candidate.match_details,
                "recommendation": candidate.recommendation,
                "total_experience_years": candidate.total_experience_years,
                "normalized_skills": candidate.normalized_skills,
                "raw_resume_data": inner_parsed,
                "resume_file_path": candidate.resume_file_path,
                "current_round_index": candidate.current_round_index,
                "status": candidate.status,
                "source": candidate.source,
                "created_at": candidate.created_at.isoformat() if candidate.created_at else None
            }))

        return JsonResponse(error_response("Method not allowed"), status=405)
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

@csrf_exempt
@require_api_key
def candidate_action(request, session_id, cand_id):
    if request.method != "PATCH":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        session = Session.objects.filter(id=session_id).first()
        if not session:
            return JsonResponse(error_response("Session not found"), status=404)

        candidate = Candidate.objects.filter(id=cand_id, session_id=session_id).first()
        if not candidate:
            return JsonResponse(error_response("Candidate not found"), status=404)

        data = json.loads(request.body)
        action = data.get("action")
        if not action:
            return JsonResponse(error_response("action is required"), status=400)

        rounds = session.rounds or []
        max_round = max([r.get("order", 1) for r in rounds]) if rounds else 1

        if action == "forward":
            if candidate.current_round_index >= max_round:
                return JsonResponse(error_response("Already at last round"), status=400)
            candidate.current_round_index += 1
            candidate.status = "forwarded"

        elif action == "reject":
            candidate.status = "rejected"

        elif action == "hire":
            if rounds and candidate.current_round_index < max_round:
                return JsonResponse(error_response("Can only hire from last round"), status=400)
            candidate.status = "hired"

        else:
            return JsonResponse(error_response("Invalid action. Use: forward, reject, hire"), status=400)

        candidate.save(update_fields=['current_round_index', 'status'])

        # ── Notify job seeker if this candidate came from platform apply ──────
        try:
            app = JobApplication.objects.filter(candidate=candidate).select_related('seeker').first()
            if app and app.seeker:
                seeker = app.seeker
                
                # Check if notification should be delayed
                completed_round_order = candidate.current_round_index
                if action == "forward":
                    completed_round_order = candidate.current_round_index - 1
                
                # Safe int conversion helper
                def _safe_int(val, default=1):
                    if val is None:
                        return default
                    try:
                        return int(val)
                    except (ValueError, TypeError):
                        return default

                completed_round = None
                for r in (session.rounds or []):
                    if _safe_int(r.get("order")) == _safe_int(completed_round_order):
                        completed_round = r
                        break
                
                r_date_str = completed_round.get("result_announcement_date") if completed_round else None
                r_date = None
                if r_date_str:
                    from django.utils.dateparse import parse_datetime
                    from datetime import datetime
                    if isinstance(r_date_str, datetime):
                        if timezone.is_naive(r_date_str):
                            try:
                                r_date = timezone.make_aware(r_date_str, timezone.get_current_timezone())
                            except Exception:
                                r_date = None
                        else:
                            r_date = r_date_str
                    elif isinstance(r_date_str, str):
                        try:
                            r_date = parse_datetime(r_date_str)
                            if r_date and timezone.is_naive(r_date):
                                r_date = timezone.make_aware(r_date, timezone.get_current_timezone())
                        except Exception:
                            r_date = None
                
                is_delayed = r_date and timezone.now() < r_date
                
                if not is_delayed:
                    status_map = {
                        'hired': 'hired',
                        'rejected': 'rejected',
                        'forwarded': 'shortlisted',
                    }
                    notify_status = status_map.get(action) or status_map.get(candidate.status)
                    if notify_status:
                        # Update application status
                        app.status = notify_status
                        app.last_notified_round_index = completed_round_order
                        app.save(update_fields=['status', 'last_notified_round_index'])

                        # Create in-app notification
                        Notification.objects.create(
                            seeker=seeker,
                            type='status_updated',
                            title=f'Application Update — {session.job_title}',
                            message=f'Your application at {session.company.name if session.company else "Unknown Company"} has been updated to: {notify_status.title()}.',
                            link='/applications',
                        )

                        # Send email (non-blocking)
                        send_status_update_to_seeker(
                            seeker_email=seeker.email,
                            seeker_name=seeker.full_name,
                            job_title=session.job_title,
                            company_name=session.company.name if session.company else "Unknown Company",
                            new_status=notify_status,
                        )
        except Exception as notify_err:
            logger.warning('Notification error for candidate action: %s', notify_err)
        # ─────────────────────────────────────────────────────────────────────

        return JsonResponse(success_response({
            "id": str(candidate.id),
            "name": candidate.name,
            "status": candidate.status,
            "current_round_index": candidate.current_round_index
        }))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

# delete_candidate is now handled inside get_candidate (DELETE method dispatch)

@csrf_exempt
@require_api_key
def bulk_reject(request, session_id):
    if request.method != "DELETE":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        data = json.loads(request.body)
        candidate_ids = data.get("candidate_ids", [])
        if not candidate_ids:
            return JsonResponse(error_response("candidate_ids list is required"), status=400)

        # Bulk reject candidates
        updated = Candidate.objects.filter(
            id__in=candidate_ids, 
            session_id=session_id
        ).update(status="rejected")

        return JsonResponse(success_response({"rejected_count": updated}))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

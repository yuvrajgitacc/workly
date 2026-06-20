import json
import logging
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Count
from django.utils import timezone
from asgiref.sync import async_to_sync

from api.models import Company, Session, Candidate, IngestJob, JobSeekerAccount, Notification
from api.decorators import require_api_key, check_rate_limit
from models.schemas import success_response, error_response
from agents.inference_agent import SkillInferenceAgent
from workers.celery_worker import match_all_candidates

logger = logging.getLogger(__name__)

def _get_skill_name(s):
    if isinstance(s, dict):
        return s.get("canonical_skill") or s.get("raw_skill") or ""
    return str(s)


def _run_task_safe(task, *args, **kwargs):
    try:
        task.delay(*args, **kwargs)
    except Exception as e:
        logger.warning("Celery dispatch failed for task %s, running synchronously: %s", getattr(task, '__name__', str(task)), e)
        try:
            task.apply(args=args, kwargs=kwargs)
        except Exception as inner_err:
            logger.error("Synchronous task execution failed: %s", inner_err)


def _verify_session_ownership(session, company):
    if str(session.company_id) != str(company.id):
        raise PermissionError("Access denied")

@csrf_exempt
@require_api_key
def session_root(request):
    """Handles GET /api/v1/sessions/ (list) and POST /api/v1/sessions/ (create)"""
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            name = data.get("name")
            job_title = data.get("job_title")
            job_description = data.get("job_description")
            if not name or not job_title or not job_description:
                return JsonResponse(error_response("name, job_title, job_description are required"), status=400)

            rounds_req = data.get("rounds") or []
            rounds_data = []
            for r in rounds_req:
                rounds_data.append({
                    "name": r.get("name"),
                    "interviewer": r.get("interviewer"),
                    "order": r.get("order"),
                    "result_announcement_date": r.get("result_announcement_date")
                })

            location = data.get("location") or "Remote"
            employment_type = data.get("employment_type") or "Full-time"
            salary_range = data.get("salary_range") or "Competitive"
            experience_level = data.get("experience_level") or "Mid-Level"
            required_skills = data.get("required_skills") or []

            # Setup default criteria
            criteria = {
                "required_skills": required_skills,
                "nice_to_have": data.get("nice_to_have", []),
                "preferred_locations": [location] if location != "Remote" else [],
                "min_experience": data.get("min_experience", 0),
                "min_match_score": data.get("min_match_score", 0),
                "weights": data.get("weights", {"skills": 0.5, "experience": 0.3, "location": 0.2})
            }

            new_session = Session.objects.create(
                company=request.company,
                name=name,
                job_title=job_title,
                job_description=job_description,
                rounds=rounds_data,
                status="active",
                location=location,
                employment_type=employment_type,
                salary_range=salary_range,
                experience_level=experience_level,
                inferred_skills=required_skills,
                criteria=criteria
            )

            # Create matching notifications for job seekers
            try:
                seekers = JobSeekerAccount.objects.filter(is_active=True)
                job_skills_lower = {str(_get_skill_name(s)).lower().strip() for s in required_skills if s}
                for seeker in seekers:
                    seeker_skills = seeker.skills or []
                    seeker_skills_lower = {str(_get_skill_name(s)).lower().strip() for s in seeker_skills if s}
                    if seeker_skills_lower & job_skills_lower:
                        Notification.objects.create(
                            seeker=seeker,
                            type="new_match",
                            title=f"New job match: {new_session.job_title} at {new_session.company.name if new_session.company else 'Unknown Company'}",
                            message=f"A new role matching your skills has been posted: {new_session.job_title} at {new_session.company.name if new_session.company else 'Unknown Company'}.",
                            link=f"/jobs/{new_session.id}"
                        )
            except Exception as notify_err:
                logger.warning("Failed to create match notifications: %s", notify_err)

            return JsonResponse(success_response({
                "id": str(new_session.id),
                "name": new_session.name,
                "job_title": new_session.job_title,
                "job_description": new_session.job_description,
                "rounds": new_session.rounds,
                "status": new_session.status,
                "location": new_session.location,
                "employment_type": new_session.employment_type,
                "salary_range": new_session.salary_range,
                "experience_level": new_session.experience_level,
                "inferred_skills": new_session.inferred_skills,
                "created_at": new_session.created_at.isoformat() if new_session.created_at else None
            }))
        except Exception as e:
            return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

    elif request.method == "GET":
        try:
            status = request.GET.get("status")
            page = int(request.GET.get("page", 1))
            per_page = int(request.GET.get("per_page", 20))

            qs = Session.objects.filter(company_id=request.company.id)
            if status:
                qs = qs.filter(status=status)

            qs = qs.order_by("-created_at")
            
            # Pagination
            offset = (page - 1) * per_page
            sessions = qs[offset:offset+per_page]

            result = []
            for s in sessions:
                status_counts_qs = Candidate.objects.filter(session_id=s.id).values('status').annotate(count=Count('id'))
                status_counts = {item['status']: item['count'] for item in status_counts_qs}

                result.append({
                    "id": str(s.id),
                    "name": s.name,
                    "job_title": s.job_title,
                    "status": s.status,
                    "rounds": s.rounds,
                    "candidate_counts": status_counts,
                    "total_candidates": sum(status_counts.values()),
                    "hired": status_counts.get("hired", 0),
                    "rejected": status_counts.get("rejected", 0),
                    "location": s.location,
                    "employment_type": s.employment_type,
                    "salary_range": s.salary_range,
                    "experience_level": s.experience_level,
                    "inferred_skills": s.inferred_skills,
                    "created_at": s.created_at.isoformat() if s.created_at else None,
                    "updated_at": s.updated_at.isoformat() if s.updated_at else None
                })

            return JsonResponse(success_response(result))
        except Exception as e:
            return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)
    else:
        return JsonResponse(error_response("Method not allowed"), status=405)

@csrf_exempt
@require_api_key
def session_detail(request, session_id):
    """Handles GET, PATCH, DELETE /api/v1/sessions/{session_id}"""
    try:
        session = Session.objects.filter(id=session_id).first()
        if not session:
            return JsonResponse(error_response("Session not found"), status=404)

        try:
            _verify_session_ownership(session, request.company)
        except PermissionError:
            return JsonResponse(error_response("Access denied"), status=403)

        if request.method == "GET":
            # Count candidates per round (excluding hired/rejected)
            round_counts_qs = Candidate.objects.filter(
                session_id=session.id
            ).exclude(
                status__in=["hired", "rejected"]
            ).values('current_round_index').annotate(count=Count('id'))
            round_counts = {str(item['current_round_index']): item['count'] for item in round_counts_qs}

            # Merge legacy round_index=0 into the first round
            if "0" in round_counts and session.rounds:
                first_order = str(session.rounds[0].get("order", 1))
                round_counts[first_order] = round_counts.get(first_order, 0) + round_counts.pop("0")

            total_hired = Candidate.objects.filter(session_id=session.id, status="hired").count()
            total_rejected = Candidate.objects.filter(session_id=session.id, status="rejected").count()

            return JsonResponse(success_response({
                "id": str(session.id),
                "name": session.name,
                "job_title": session.job_title,
                "job_description": session.job_description,
                "rounds": session.rounds,
                "criteria": session.criteria,
                "inferred_skills": session.inferred_skills,
                "status": session.status,
                "current_round": session.current_round_index,
                "candidate_counts_per_round": round_counts,
                "total_hired": total_hired,
                "total_rejected": total_rejected,
                "gmail_address": session.gmail_address,
                "location": session.location,
                "employment_type": session.employment_type,
                "salary_range": session.salary_range,
                "experience_level": session.experience_level,
                "created_at": session.created_at.isoformat() if session.created_at else None,
                "updated_at": session.updated_at.isoformat() if session.updated_at else None
            }))

        elif request.method == "PATCH":
            data = json.loads(request.body)
            if "name" in data and data["name"] is not None:
                session.name = data["name"]
            if "job_title" in data and data["job_title"] is not None:
                session.job_title = data["job_title"]
            if "job_description" in data and data["job_description"] is not None:
                session.job_description = data["job_description"]
            if "rounds" in data and data["rounds"] is not None:
                session.rounds = [{
                    "name": r.get("name"),
                    "interviewer": r.get("interviewer"),
                    "order": r.get("order"),
                    "result_announcement_date": r.get("result_announcement_date")
                } for r in data["rounds"]]
            if "status" in data and data["status"] is not None:
                session.status = data["status"]
            if "location" in data and data["location"] is not None:
                session.location = data["location"]
            if "employment_type" in data and data["employment_type"] is not None:
                session.employment_type = data["employment_type"]
            if "salary_range" in data and data["salary_range"] is not None:
                session.salary_range = data["salary_range"]
            if "experience_level" in data and data["experience_level"] is not None:
                session.experience_level = data["experience_level"]

            session.updated_at = timezone.now()
            session.save()

            return JsonResponse(success_response({
                "message": "Session updated",
                "id": str(session.id),
                "name": session.name,
                "updated_at": session.updated_at.isoformat()
            }))

        elif request.method == "DELETE":
            # Check delete_candidates or hard_delete flag
            data = {}
            if request.body:
                try:
                    data = json.loads(request.body)
                except ValueError:
                    pass

            hard_delete = data.get("hard_delete", False) or request.GET.get("hard", "false").lower() == "true" or request.GET.get("hard_delete", "false").lower() == "true"
            delete_candidates = data.get("delete_candidates", False)

            if hard_delete:
                session.delete()
                return JsonResponse(success_response({"message": "Session deleted"}))

            if delete_candidates:
                Candidate.objects.filter(session_id=session.id).delete()

            session.status = "archived"
            session.save(update_fields=['status'])

            return JsonResponse(success_response({"message": "Session archived"}))

        else:
            return JsonResponse(error_response("Method not allowed"), status=405)
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

@csrf_exempt
@require_api_key
def set_criteria(request, session_id):
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        session = Session.objects.filter(id=session_id).first()
        if not session:
            return JsonResponse(error_response("Session not found"), status=404)

        try:
            _verify_session_ownership(session, request.company)
        except PermissionError:
            return JsonResponse(error_response("Access denied"), status=403)

        data = json.loads(request.body)
        weights = data.get("weights", {"skills": 0.5, "experience": 0.3, "location": 0.2})
        if weights:
            total = sum(weights.values())
            if not 0.98 <= total <= 1.02:
                return JsonResponse(error_response(f"Weights must sum to 1.0, got {total:.2f}"), status=400)

        criteria = {
            "required_skills": data.get("required_skills", []),
            "nice_to_have": data.get("nice_to_have", []),
            "preferred_locations": data.get("preferred_locations", []),
            "min_experience": data.get("min_experience", 0),
            "min_match_score": data.get("min_match_score", 0),
            "weights": weights
        }
        session.criteria = criteria
        session.updated_at = timezone.now()
        session.save()

        candidate_count = Candidate.objects.filter(session_id=session.id).count()
        if candidate_count > 0:
            job = IngestJob.objects.create(
                session=session,
                type="match_all",
                status="pending",
                total_files=candidate_count
            )

            _run_task_safe(match_all_candidates, str(session.id), str(job.id))

            return JsonResponse(success_response({
                "updated": True,
                "criteria": criteria,
                "rematching": True,
                "job_id": str(job.id)
            }))

        return JsonResponse(success_response({"updated": True, "criteria": criteria}))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

@csrf_exempt
@require_api_key
def infer_skills(request, session_id):
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        session = Session.objects.filter(id=session_id).first()
        if not session:
            return JsonResponse(error_response("Session not found"), status=404)

        try:
            _verify_session_ownership(session, request.company)
        except PermissionError:
            return JsonResponse(error_response("Access denied"), status=403)

        data = json.loads(request.body)
        job_description = data.get("job_description")
        if not job_description:
            return JsonResponse(error_response("job_description is required"), status=400)

        agent = SkillInferenceAgent()
        # Call the async agent function in a synchronous context using async_to_sync
        result = async_to_sync(agent.infer_from_jd)(job_description)

        session.inferred_skills = result
        if result.get("salary_range"):
            session.salary_range = result.get("salary_range")
        if result.get("preferred_locations"):
            locs = result.get("preferred_locations")
            if locs and len(locs) > 0:
                session.location = locs[0]
        if result.get("employment_type"):
            session.employment_type = result.get("employment_type")
        if result.get("seniority_level"):
            session.experience_level = result.get("seniority_level").capitalize() + " Level"

        session.updated_at = timezone.now()
        session.save()

        return JsonResponse(success_response(result))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

@csrf_exempt
@require_api_key
@check_rate_limit("match")
def trigger_match_all(request, session_id):
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        session = Session.objects.filter(id=session_id).first()
        if not session:
            return JsonResponse(error_response("Session not found"), status=404)

        try:
            _verify_session_ownership(session, request.company)
        except PermissionError:
            return JsonResponse(error_response("Access denied"), status=403)

        job = IngestJob.objects.create(
            session=session,
            type="match_all",
            status="pending"
        )

        _run_task_safe(match_all_candidates, str(session.id), str(job.id))

        return JsonResponse(success_response({"job_id": str(job.id), "status": "pending"}))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)


@csrf_exempt
@require_api_key
def session_analytics(request, session_id):
    """GET /api/v1/sessions/<session_id>/analytics"""
    if request.method != "GET":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        session = Session.objects.filter(id=session_id).first()
        if not session:
            return JsonResponse(error_response("Session not found"), status=404)
        
        try:
            _verify_session_ownership(session, request.company)
        except PermissionError:
            return JsonResponse(error_response("Access denied"), status=403)

        candidates = Candidate.objects.filter(session_id=session_id)
        total_applicants = candidates.count()
        
        # Sources split
        portal_count = candidates.filter(application_source="portal").count()
        manual_count = candidates.filter(application_source="manual").count()
        
        # Avg match score
        from django.db.models import Avg
        avg_score_res = candidates.aggregate(Avg('match_score'))
        avg_match_score = round(avg_score_res['match_score__avg'] or 0, 1)

        # Funnel stage counts
        rounds = session.rounds or []
        funnel = []
        for r in sorted(rounds, key=lambda x: x.get("order", 1)):
            order = r.get("order", 1)
            name = r.get("name", f"Round {order}")
            
            # Active in this round
            active_count = candidates.filter(current_round_index=order).exclude(status__in=["rejected", "hired"]).count()
            if order == 1:
                active_count += candidates.filter(current_round_index=0).exclude(status__in=["rejected", "hired"]).count()
            
            rejected_count = candidates.filter(current_round_index=order, status="rejected").count()
            hired_count = candidates.filter(current_round_index=order, status="hired").count()
            reached_count = candidates.filter(current_round_index__gte=order).count()
            
            funnel.append({
                "round_index": order,
                "name": name,
                "active": active_count,
                "rejected": rejected_count,
                "hired": hired_count,
                "reached": reached_count
            })

        hired_total = candidates.filter(status="hired").count()
        rejected_total = candidates.filter(status="rejected").count()
        
        return JsonResponse(success_response({
            "total_applicants": total_applicants,
            "sources": {
                "portal": portal_count,
                "manual": manual_count
            },
            "avg_match_score": avg_match_score,
            "hired_count": hired_total,
            "rejected_count": rejected_total,
            "funnel": funnel
        }))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)


@csrf_exempt
@require_api_key
def session_applicants(request, session_id):
    """GET /api/v1/sessions/<session_id>/applicants"""
    if request.method != "GET":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        session = Session.objects.filter(id=session_id).first()
        if not session:
            return JsonResponse(error_response("Session not found"), status=404)
        
        try:
            _verify_session_ownership(session, request.company)
        except PermissionError:
            return JsonResponse(error_response("Access denied"), status=403)

        query = Candidate.objects.filter(session_id=session_id)

        # Filters
        search = request.GET.get("search", "").strip()
        source = request.GET.get("source", "").strip()
        status = request.GET.get("status", "").strip()
        sort_by = request.GET.get("sort_by", "created_at").strip()
        sort_order = request.GET.get("sort_order", "desc").strip()
        
        if search:
            from django.db.models import Q
            query = query.filter(Q(name__icontains=search) | Q(email__icontains=search))
        if source:
            query = query.filter(application_source=source)
        if status:
            query = query.filter(status=status)

        # Sort order
        if sort_by not in ["match_score", "name", "created_at"]:
            sort_by = "created_at"
        
        if sort_order == "asc":
            query = query.order_by(sort_by)
        else:
            query = query.order_by(f"-{sort_by}")

        page_val = request.GET.get("page", "1")
        if page_val.lower() == "all":
            candidates_list = query
            page = 1
            per_page = query.count()
            total = per_page
            pages = 1
        else:
            try:
                page = int(page_val)
            except ValueError:
                page = 1
            try:
                per_page = int(request.GET.get("per_page", 20))
            except ValueError:
                per_page = 20

            total = query.count()
            pages = (total + per_page - 1) // per_page if per_page > 0 else 0
            offset = (page - 1) * per_page
            candidates_list = query[offset:offset+per_page]

        rounds = session.rounds or []
        rounds_map = {r.get("order", 1): r.get("name", f"Round {r.get('order')}") for r in rounds}

        data = []
        for c in candidates_list:
            current_round_name = rounds_map.get(c.current_round_index, f"Round {c.current_round_index}")
            if c.current_round_index == 0:
                current_round_name = rounds_map.get(1, "Round 1")
                
            data.append({
                "id": str(c.id),
                "name": c.name,
                "email": c.email,
                "phone": c.phone,
                "location": c.location,
                "match_score": c.match_score,
                "current_round_index": c.current_round_index,
                "current_round_name": current_round_name,
                "status": c.status,
                "application_source": c.application_source,
                "created_at": c.created_at.isoformat() if c.created_at else None
            })

        return JsonResponse(success_response({
            "applicants": data,
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": pages
        }))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

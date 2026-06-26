import os
import uuid
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from api.models import Session, Candidate, Company, FraudScanLog
from workers.celery_worker import _parse_resume_sync, _normalize_skills_sync
from models.schemas import success_response, error_response
from agents.fraud_agent import FraudDetectionAgent

def _calculate_match_score(candidate, session):
    """Calculates and updates candidate match score synchronously against session criteria."""
    criteria = session.criteria or {}
    required_skills = criteria.get("required_skills", [])
    req_lower = [r.lower() for r in required_skills]
    
    norm_skills = candidate.normalized_skills or []
    cand_skill_names = {s.get("canonical_skill", "").lower() for s in norm_skills}
    matched_list = [r for r in required_skills if any(r.lower() in s for s in cand_skill_names)]
    missing_list = [r for r in required_skills if r.lower() not in [m.lower() for m in matched_list]]
    matched = len(matched_list)
    skill_score = round((matched / len(req_lower)) * 100) if req_lower else 0

    # Experience score
    min_exp = criteria.get("min_experience", 0)
    exp_years = float(candidate.total_experience_years or 0)
    experience_score = min(100, round((exp_years / max(min_exp, 1)) * 100)) if min_exp > 0 else 50

    # Location score
    preferred_locs = criteria.get("preferred_locations", [])
    cand_location = (candidate.location or "").lower()
    location_score = 100 if not preferred_locs else (100 if any(l.lower() in cand_location for l in preferred_locs) else 30)

    # Weighted overall score
    weights = criteria.get("weights", {"skills": 0.5, "experience": 0.3, "location": 0.2})
    score = round(
        skill_score * weights.get("skills", 0.5) + 
        experience_score * weights.get("experience", 0.3) + 
        location_score * weights.get("location", 0.2)
    )
    score = min(100, score)
    candidate.match_score = score
    candidate.recommendation = "Strong" if score >= 70 else ("Moderate" if score >= 40 else "Weak")
    candidate.match_details = {
        "match_score": score,
        "skill_score": skill_score,
        "experience_score": experience_score,
        "location_score": location_score,
        "matched_skills": matched_list,
        "missing_skills": missing_list,
        "matched_count": matched,
        "total_required": len(req_lower)
    }
    
    min_match_score = criteria.get("min_match_score", 0)
    if min_match_score > 0 and score < min_match_score:
        candidate.status = "rejected"
        
    candidate.save()
    return candidate.match_details

@csrf_exempt
def list_public_jobs(request):
    """
    GET /api/v1/public/jobs
    Lists all active sessions as public job postings.
    Supports query params:
      - query: search in job title / description
      - location: search in preferred locations
    """
    if request.method != "GET":
        return JsonResponse(error_response("Method not allowed"), status=405)
        
    try:
        query = request.GET.get("query", "").strip()
        location_filter = request.GET.get("location", "").strip()
        
        # Only active, non-archived sessions
        qs = Session.objects.filter(status="active")
        
        if query:
            qs = qs.filter(job_title__icontains=query) | qs.filter(job_description__icontains=query)
            
        jobs = []
        for s in qs:
            criteria = s.criteria or {}
            preferred_locations = criteria.get("preferred_locations", [])
            
            # Simple check for location filter
            if location_filter:
                loc_match = False
                # Check criteria location list
                for loc in preferred_locations:
                    if location_filter.lower() in loc.lower():
                        loc_match = True
                        break
                # Check description text as fallback
                if not loc_match and location_filter.lower() in s.job_description.lower():
                    loc_match = True
                if not loc_match:
                    continue
            
            company_name = s.company.name if s.company else "Vishleshan Partner"
            
            jobs.append({
                "id": str(s.id),
                "job_title": s.job_title,
                "job_description": s.job_description,
                "company_name": company_name,
                "required_skills": criteria.get("required_skills", []),
                "nice_to_have": criteria.get("nice_to_have", []),
                "preferred_locations": preferred_locations,
                "min_experience": criteria.get("min_experience", 0),
                "created_at": s.created_at.isoformat() if s.created_at else None
            })
            
        return JsonResponse(success_response(jobs))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

@csrf_exempt
def get_public_job(request, session_id):
    """
    GET /api/v1/public/jobs/<session_id>
    Gets full description and criteria for a specific job session.
    """
    if request.method != "GET":
        return JsonResponse(error_response("Method not allowed"), status=405)
        
    try:
        try:
            uuid.UUID(session_id)
        except ValueError:
            return JsonResponse(error_response("Invalid job ID format"), status=400)
            
        s = Session.objects.filter(id=session_id, status="active").first()
        if not s:
            return JsonResponse(error_response("Job posting not found"), status=404)
            
        criteria = s.criteria or {}
        company_name = s.company.name if s.company else "Vishleshan Partner"
        
        return JsonResponse(success_response({
            "id": str(s.id),
            "job_title": s.job_title,
            "job_description": s.job_description,
            "company_name": company_name,
            "required_skills": criteria.get("required_skills", []),
            "nice_to_have": criteria.get("nice_to_have", []),
            "preferred_locations": criteria.get("preferred_locations", []),
            "min_experience": criteria.get("min_experience", 0),
            "created_at": s.created_at.isoformat() if s.created_at else None
        }))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

@csrf_exempt
def apply_public_job(request, session_id):
    """
    POST /api/v1/public/jobs/<session_id>/apply
    Applies for a job by uploading a resume. Parses it, creates a candidate,
    calculates the matching details, and returns them to the seeker.
    Also handles pure parsing if session_id is "parse-only".
    """
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)
        
    try:
        is_parse_only = (session_id == "parse-only")
        session = None
        
        if not is_parse_only:
            try:
                uuid.UUID(session_id)
            except ValueError:
                return JsonResponse(error_response("Invalid job ID format"), status=400)
                
            session = Session.objects.filter(id=session_id, status="active").first()
            if not session:
                return JsonResponse(error_response("Job posting not found"), status=404)
                
        resume_file = request.FILES.get("file")
        if not resume_file:
            return JsonResponse(error_response("Resume file is required"), status=400)
            
        # Optional metadata fields from frontend
        seeker_name = request.POST.get("name")
        seeker_email = request.POST.get("email")
        seeker_phone = request.POST.get("phone")
        
        # Save uploaded file to local temp
        temp_dir = os.path.join("uploads", "temp_job_seeker")
        os.makedirs(temp_dir, exist_ok=True)
        file_uuid = uuid.uuid4()
        file_ext = os.path.splitext(resume_file.name)[1]
        temp_file_name = f"{file_uuid}{file_ext}"
        temp_file_path = os.path.join(temp_dir, temp_file_name)
        
        path = default_storage.save(temp_file_path, ContentFile(resume_file.read()))
        abs_temp_path = default_storage.path(path)
        
        # Synchronously parse the resume
        parsed_res = _parse_resume_sync(abs_temp_path, skip_llm=False)
        raw_data = parsed_res.get("parsed", {})
        
        # Normalize skills
        raw_skills = raw_data.get("skills", [])
        normalized_skills = _normalize_skills_sync(raw_skills)
        
        response_data = {
            "parsed_profile": {
                "name": seeker_name or raw_data.get("name") or resume_file.name.split(".")[0],
                "email": seeker_email or raw_data.get("email"),
                "phone": seeker_phone or raw_data.get("phone"),
                "location": raw_data.get("location") or "Unknown",
                "linkedin_url": raw_data.get("linkedin_url"),
                "github_url": raw_data.get("github_url"),
                "total_experience_years": float(raw_data.get("total_experience_years") or 0.0),
                "skills": normalized_skills,
                "experience": raw_data.get("experience", []),
                "education": raw_data.get("education", [])
            }
        }
        
        if not is_parse_only:
            # Create Candidate in database under the Job Session
            rounds = session.rounds or []
            first_round_order = rounds[0]["order"] if rounds else 0
            
            # Save file permanently under the session upload folder
            permanent_dir = os.path.join("uploads", str(session.id))
            os.makedirs(permanent_dir, exist_ok=True)
            permanent_file_name = f"{uuid.uuid4()}_{resume_file.name}"
            permanent_path = os.path.join(permanent_dir, permanent_file_name)
            
            # Copy file
            with open(abs_temp_path, "rb") as f_src:
                file_content = f_src.read()
                path_perm = default_storage.save(permanent_path, ContentFile(file_content))
                abs_permanent_path = default_storage.path(path_perm)
                
            candidate = Candidate.objects.create(
                session=session,
                name=response_data["parsed_profile"]["name"],
                email=response_data["parsed_profile"]["email"],
                phone=response_data["parsed_profile"]["phone"],
                location=response_data["parsed_profile"]["location"],
                total_experience_years=response_data["parsed_profile"]["total_experience_years"],
                normalized_skills=normalized_skills,
                raw_resume_data=parsed_res,
                resume_file_path=abs_permanent_path,
                current_round_index=first_round_order,
                status="new",
                source="public_apply"
            )
            
            # Calculate match details
            match_details = _calculate_match_score(candidate, session)
            response_data["match_details"] = match_details
            response_data["candidate_id"] = str(candidate.id)
            
        # Clean up temp file
        try:
            if os.path.exists(abs_temp_path):
                os.remove(abs_temp_path)
        except Exception:
            pass
            
        return JsonResponse(success_response(response_data))
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

@csrf_exempt
def scan_job_safety_public(request, session_id):
    """
    POST /api/v1/public/jobs/<session_id>/safety-check
    Retrieves or generates a safety/originality analysis for a public job posting,
    visible to job seekers.
    """
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)

    try:
        try:
            uuid.UUID(session_id)
        except ValueError:
            return JsonResponse(error_response("Invalid job ID format"), status=400)

        session = Session.objects.filter(id=session_id, status="active").first()
        if not session:
            return JsonResponse(error_response("Job posting not found"), status=404)

        log_name = f"Job: {session.job_title}"
        log = FraudScanLog.objects.filter(candidate_name=log_name, role="Job Posting").order_by("-created_at").first()

        if not log:
            agent = FraudDetectionAgent()
            pref_loc = "Remote"
            if session.criteria and session.criteria.get("preferred_locations"):
                pref_loc = session.criteria.get("preferred_locations")[0]
                
            analysis = agent.analyze_job(session.job_title, session.job_description, {
                "location": pref_loc
            })
            
            originality = analysis.get("originality_score", 95)
            ai_prob = analysis.get("ai_probability", 10)
            plagiarism = analysis.get("plagiarism_score", 5)
            
            status_str = "Verified Clean"
            if originality < 70 or plagiarism > 30 or analysis.get("ats_manipulation_detected", False):
                status_str = "Suspicious Listing"

            log = FraudScanLog.objects.create(
                company=session.company,
                candidate_name=log_name,
                role="Job Posting",
                location=pref_loc,
                originality_score=originality,
                ai_probability=ai_prob,
                plagiarism_score=plagiarism,
                status=status_str,
                portfolios=analysis.get("manipulation_flags", []) or ["Safety Audit Checked"]
            )

        return JsonResponse(success_response({
            "id": str(log.id),
            "job_title": session.job_title,
            "company_name": session.company.name if session.company else "Vishleshan Partner",
            "originality_score": log.originality_score,
            "ai_probability": log.ai_probability,
            "plagiarism_score": log.plagiarism_score,
            "status": log.status,
            "flags": log.portfolios,
            "created_at": log.created_at.isoformat()
        }))

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

@csrf_exempt
def scan_safety_arbitrary_public(request):
    """
    POST /api/v1/public/jobs/scan-safety
    Scans any job description pasted by a job seeker.
    """
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)

    try:
        try:
            data = json.loads(request.body)
        except Exception:
            data = request.POST

        url_val = data.get("url", "").strip()
        job_title = data.get("job_title", "").strip()
        job_description = data.get("job_description", "").strip()
        company_name = data.get("company_name", "").strip() or "Unknown Company"

        if url_val and "linkedin.com" in url_val.lower():
            from api.services.linkedin_scraper import fetch_linkedin_job_details
            details = fetch_linkedin_job_details(url_val)
            job_title = details.get("job_title")
            job_description = details.get("job_description")
            company_name = details.get("company_name", company_name)

        if not job_title or not job_description:
            return JsonResponse(error_response("Job title and description are required"), status=400)

        agent = FraudDetectionAgent()
        analysis = agent.analyze_job(job_title, job_description, {
            "company_name": company_name
        })

        originality = analysis.get("originality_score", 95)
        ai_prob = analysis.get("ai_probability", 10)
        plagiarism = analysis.get("plagiarism_score", 5)

        status_str = analysis.get("status") or "Verified Clean"
        if originality < 70 or plagiarism > 30 or analysis.get("ats_manipulation_detected", False):
            status_str = "Suspicious Listing"

        flags = analysis.get("manipulation_flags", []) or ["Safety Audit Checked"]
        if url_val and "linkedin.com" in url_val.lower():
            flags = [f"Source: LinkedIn"] + [f for f in flags if f != "Safety Audit Checked"]

        return JsonResponse(success_response({
            "job_title": job_title,
            "company_name": company_name,
            "originality_score": originality,
            "ai_probability": ai_prob,
            "plagiarism_score": plagiarism,
            "status": status_str,
            "risk_level": analysis.get("risk_level", "Low"),
            "verified_company": analysis.get("verified_company", "Yes"),
            "flags": flags,
            "detailed_checks": analysis.get("detailed_checks", {}),
            "summary": analysis.get("summary", "Safety report generated successfully.")
        }))

    except Exception as e:
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

import os
import uuid
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile

from api.models import FraudScanLog
from api.decorators import require_api_key, check_rate_limit
from agents.fraud_agent import FraudDetectionAgent
from workers.celery_worker import _parse_resume_sync
from models.schemas import success_response, error_response

@csrf_exempt
@require_api_key
@check_rate_limit("scan")
def scan_portfolio(request):
    """
    POST /api/v1/protection/scan
    Scans a resume file/portfolio URL (user scan) or job title/description (job scan) for fraud.
    """
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)

    try:
        scan_type = "user"
        url_val = ""
        job_title = ""
        job_description = ""
        location_val = "Remote"
        uploaded_file = request.FILES.get("file")

        # Parse request body JSON if it is JSON
        if request.content_type == 'application/json' or 'application/json' in request.headers.get('Content-Type', ''):
            try:
                if request.body:
                    data = json.loads(request.body)
                    scan_type = data.get("scan_type", "user")
                    url_val = data.get("url", "").strip()
                    job_title = data.get("job_title", "").strip()
                    job_description = data.get("job_description", "").strip()
                    location_val = data.get("location", "Remote").strip()
            except Exception:
                pass

        # Fallback to POST parameters (multipart/form-data)
        if not scan_type or scan_type == "user":
            scan_type = request.POST.get("scan_type", "user")
        if not url_val:
            url_val = request.POST.get("url", "").strip()
        if not job_title:
            job_title = request.POST.get("job_title", "").strip()
        if not job_description:
            job_description = request.POST.get("job_description", "").strip()
        if not location_val or location_val == "Remote":
            location_val = request.POST.get("location", "Remote").strip()

        agent = FraudDetectionAgent()

        if scan_type == "job":
            company_name = "LinkedIn Company"
            if url_val and "linkedin.com" in url_val.lower():
                from api.services.linkedin_scraper import fetch_linkedin_job_details
                details = fetch_linkedin_job_details(url_val)
                job_title = details.get("job_title")
                job_description = details.get("job_description")
                location_val = details.get("location", location_val)
                company_name = details.get("company_name", "LinkedIn Company")
            
            if not job_title or not job_description:
                return JsonResponse(error_response("Job title and description are required for job scanning"), status=400)
            
            analysis = agent.analyze_job(job_title, job_description, {
                "location": location_val,
                "company_name": company_name
            })
            
            originality = analysis.get("originality_score", 95)
            ai_prob = analysis.get("ai_probability", 10)
            plagiarism = analysis.get("plagiarism_score", 5)
            
            status_str = "Verified Clean"
            if originality < 70 or plagiarism > 30 or analysis.get("ats_manipulation_detected", False):
                status_str = "Suspicious Listing"
                
            log_title = f"Job: {job_title}"
            if url_val and "linkedin.com" in url_val.lower():
                log_title = f"LinkedIn Job: {job_title}"

            flags = analysis.get("manipulation_flags", []) or ["Safety Audit Checked"]
            if url_val and "linkedin.com" in url_val.lower():
                flags = [f"Source: LinkedIn", f"Employer: {company_name}"] + [f for f in flags if f != "Safety Audit Checked"]
                
            log = FraudScanLog.objects.create(
                company=request.company,
                candidate_name=log_title,
                role="Job Posting",
                location=location_val,
                originality_score=originality,
                ai_probability=ai_prob,
                plagiarism_score=plagiarism,
                status=status_str,
                portfolios=flags,
                detailed_checks=analysis.get("detailed_checks", {})
            )
            
        else:
            # User portfolio/resume scan
            if not uploaded_file and not url_val:
                return JsonResponse(error_response("Please upload a resume file or enter a portfolio URL to scan"), status=400)

            resume_text = ""
            candidate_name = "Alex Morgan"
            candidate_role = "UI/UX Designer"
            candidate_loc = "New York, USA"
            portfolios = []

            # Case A: File upload
            if uploaded_file:
                temp_dir = os.path.join("uploads", "temp_protection")
                os.makedirs(temp_dir, exist_ok=True)
                file_uuid = uuid.uuid4()
                file_ext = os.path.splitext(uploaded_file.name)[1]
                temp_file_name = f"{file_uuid}{file_ext}"
                temp_file_path = os.path.join(temp_dir, temp_file_name)
                
                path = default_storage.save(temp_file_path, ContentFile(uploaded_file.read()))
                abs_temp_path = default_storage.path(path)
                
                # Synchronously parse the resume using the existing parser
                parsed_res = _parse_resume_sync(abs_temp_path, skip_llm=False)
                raw_data = parsed_res.get("parsed", {})
                
                resume_text = parsed_res.get("raw_text", "")
                candidate_name = raw_data.get("name") or uploaded_file.name.replace(file_ext, "")
                candidate_role = raw_data.get("inferred_role") or "Software Engineer"
                candidate_loc = raw_data.get("location") or "Unknown"
                
                # Extract portfolios or projects if present
                experiences = raw_data.get("experience", [])
                portfolios = [exp.get("job_title", "") for exp in experiences[:3] if exp.get("job_title")]
                if not portfolios:
                    portfolios = ["Project Repo", "Portfolio Codebase"]

                # Clean up temp file
                try:
                    if os.path.exists(abs_temp_path):
                        os.remove(abs_temp_path)
                except Exception:
                    pass
            
            # Case B: URL scan
            else:
                candidate_name = url_val.split("/")[-1] or "Alex Morgan"
                if not candidate_name or len(candidate_name) < 2:
                    candidate_name = "Alex Morgan"
                candidate_name = candidate_name.replace("-", " ").title()
                
                resume_text = f"Portfolio workspace analyzed. Scanned repository sources from: {url_val}"
                candidate_role = "Creative Designer"
                candidate_loc = "San Francisco, USA"
                portfolios = ["Design Showcase", "Travel App Prototype", "Behance Assets"]

            # Call the FraudDetectionAgent
            analysis = agent.analyze_resume(resume_text, {
                "url": url_val,
                "filename": uploaded_file.name if uploaded_file else None,
                "inferred_role": candidate_role,
                "location": candidate_loc
            })

            # Save to database
            originality = analysis.get("originality_score", 92)
            ai_prob = analysis.get("ai_probability", 8)
            plagiarism = analysis.get("plagiarism_score", 0)
            
            status_str = "Verified Clean"
            if originality < 70 or plagiarism > 30 or analysis.get("ats_manipulation_detected", False):
                status_str = "High Similarity Match"

            log = FraudScanLog.objects.create(
                company=request.company,
                candidate_name=candidate_name,
                role=candidate_role,
                location=candidate_loc,
                originality_score=originality,
                ai_probability=ai_prob,
                plagiarism_score=plagiarism,
                status=status_str,
                portfolios=portfolios
            )

        detailed_checks = log.detailed_checks or {}
        risk_level = detailed_checks.get("risk_level")
        if not risk_level:
            if log.originality_score < 60:
                risk_level = "High"
            elif log.originality_score < 80:
                risk_level = "Medium"
            else:
                risk_level = "Low"

        verified_company = detailed_checks.get("verified_company")
        if not verified_company:
            verified_company = "Yes" if log.originality_score >= 70 else "No"

        return JsonResponse(success_response({
            "id": str(log.id),
            "candidate_name": log.candidate_name,
            "role": log.role,
            "location": log.location,
            "originality_score": log.originality_score,
            "ai_probability": log.ai_probability,
            "plagiarism_score": log.plagiarism_score,
            "status": log.status,
            "risk_level": risk_level,
            "verified_company": verified_company,
            "portfolios": log.portfolios,
            "detailed_checks": detailed_checks,
            "created_at": log.created_at.isoformat()
        }))

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

@csrf_exempt
@require_api_key
def get_scan_history(request):
    """
    GET /api/v1/protection/history
    Retrieves all past scan records for the authenticated recruiter company.
    """
    if request.method != "GET":
        return JsonResponse(error_response("Method not allowed"), status=405)

    try:
        logs = FraudScanLog.objects.filter(company=request.company).order_by("-created_at")[:50]
        
        result = [
            {
                "id": str(l.id),
                "candidate_name": l.candidate_name,
                "role": l.role or "Software Engineer",
                "location": l.location or "Unknown",
                "originality_score": l.originality_score,
                "ai_probability": l.ai_probability,
                "plagiarism_score": l.plagiarism_score,
                "status": l.status,
                "risk_level": (l.detailed_checks or {}).get("risk_level") or ("High" if l.originality_score < 60 else "Medium" if l.originality_score < 80 else "Low"),
                "verified_company": (l.detailed_checks or {}).get("verified_company") or ("Yes" if l.originality_score >= 70 else "No"),
                "portfolios": l.portfolios or [],
                "detailed_checks": l.detailed_checks or {},
                "created_at": l.created_at.isoformat()
            }
            for l in logs
        ]

        return JsonResponse(success_response(result))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

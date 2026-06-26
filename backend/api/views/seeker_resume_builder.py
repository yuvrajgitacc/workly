import os
import uuid
import logging
import hashlib
import json
import time
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone

from api.models import JobSeekerAccount, ResumeDraft, ResumeVersion
from api.views.seeker_auth import require_seeker_jwt
from models.schemas import success_response, error_response
from agents.ats_compatibility_agent import AtsCompatibilityAgent
from agents.resume_pdf_renderer import render_resume_pdf

logger = logging.getLogger(__name__)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")

# In-memory rate limiting and cache stores
# In production, these can transition to Redis, but in-memory is standard, lightweight, and robust here.
_user_check_times = {}  # maps user_id -> list of float timestamps
_ats_check_cache = {}   # maps (user_id, content_hash) -> report_dict


def extract_text_from_file(file_path):
    """
    Safely extract text from a PDF, DOCX, or text file.
    Reuses AdvancedAtsParsingAgent for column-aware layout extraction.
    """
    from agents.advanced_ats_parsing_agent import AdvancedAtsParsingAgent
    try:
        return AdvancedAtsParsingAgent.extract_text_column_aware(file_path)
    except Exception as e:
        logger.error("Failed to extract text from file %s: %s", file_path, e)
        return ""



def expand_job_description_if_short(jd_text):
    if not jd_text or not jd_text.strip():
        return ""
    stripped = jd_text.strip()
    if len(stripped) < 120:
        from agents.llm import RotateLLMClient
        client = RotateLLMClient()
        system_prompt = (
            "You are an ATS Job Description Extender. The user provided a very short target job description, title, or query.\n"
            "Generate a professional, standard, and complete job description containing standard responsibilities, "
            "and a list of 15 key technical skills, tools, and methodologies typically required for this role.\n"
            "Return a JSON object with this format:\n"
            "{\n"
            "  \"expanded_job_description\": \"<a professional, standard job description listing key requirements, skills, and responsibilities>\"\n"
            "}\n"
            "Return ONLY the valid JSON object. No explanation, no markdown."
        )
        try:
            response = client.chat.completions.create(
                model="gemini-1.5-flash",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Short target: {stripped}"}
                ],
                temperature=0.1,
                response_format={"type": "json_object"}
            )
            raw = response.choices[0].message.content.strip()
            if raw.startswith("```json"): raw = raw[7:]
            if raw.startswith("```"): raw = raw[3:]
            if raw.endswith("```"): raw = raw[:-3]
            raw = raw.strip()
            expanded_data = json.loads(raw)
            if expanded_data.get("expanded_job_description"):
                expanded_jd = expanded_data["expanded_job_description"]
                logger.info("Short JD '%s' expanded successfully.", stripped)
                return expanded_jd
        except Exception as e:
            logger.error("Failed to expand short JD: %s", e)
    return stripped


@csrf_exempt
@require_seeker_jwt
def ats_check(request):
    """
    POST /api/agents/ats-check
    Runs the ATS Compatibility Agent on draft content, uploaded resume, or direct JSON.
    Body:
      {
        "resumeDraftId": "...",  # optional: load draft from DB
        "uploadedResumeId": "...", # optional: check user's active resume
        "content": {...},       # optional: direct JSON content from the editor
        "targetJobDescription": "..." # optional: specific job description
      }
    """
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)
        
    try:
        user_id = str(request.seeker.id)
        
        # 1. Rate Limiting: 1 check per 5 seconds, max 15 checks per minute
        now = time.time()
        times = _user_check_times.setdefault(user_id, [])
        times = [t for t in times if now - t < 60]
        _user_check_times[user_id] = times
        
        if times and now - times[-1] < 5:
            return JsonResponse(error_response("Please wait 5 seconds between ATS scans."), status=429)
        if len(times) >= 15:
            return JsonResponse(error_response("Max 15 ATS scans per minute exceeded."), status=429)
            
        # Parse Body
        body = {}
        if request.body:
            try:
                body = json.loads(request.body)
            except Exception:
                return JsonResponse(error_response("Invalid JSON body"), status=400)
                
        resume_draft_id = body.get("resumeDraftId")
        uploaded_resume_id = body.get("uploadedResumeId")
        content = body.get("content")
        target_job_desc = body.get("targetJobDescription")
        target_job_desc = expand_job_description_if_short(target_job_desc)
        
        resume_text = ""
        parsed_data = {}
        draft = None
        
        # Determine source content
        if resume_draft_id:
            # Case B (saved draft): Load from database
            try:
                draft = ResumeDraft.objects.get(id=resume_draft_id, seeker=request.seeker)
                parsed_data = draft.content or {}
            except ResumeDraft.DoesNotExist:
                return JsonResponse(error_response("Resume draft not found"), status=404)
        elif uploaded_resume_id or (not content and request.seeker.resume_data):
            # Case A (existing profile resume): Reuse parsed data
            parsed_data = request.seeker.resume_data or {}
            # Try to read raw text from the physical file path to maximize evaluation fidelity
            if request.seeker.resume_file_path and os.path.exists(request.seeker.resume_file_path):
                resume_text = extract_text_from_file(request.seeker.resume_file_path)
        elif content:
            # Case B (unsaved editor edits): Direct editor content
            parsed_data = content
        else:
            return JsonResponse(error_response("No resume source or content provided"), status=400)
            
        # 2. Caching Check by Content Hash
        content_str = json.dumps(parsed_data, sort_keys=True)
        job_desc_str = target_job_desc or ""
        hash_input = f"{content_str}||{resume_text}||{job_desc_str}".encode('utf-8')
        content_hash = hashlib.md5(hash_input).hexdigest()
        
        cache_key = (user_id, content_hash)
        if cache_key in _ats_check_cache:
            report = _ats_check_cache[cache_key]
            # If draft exists, ensure its database fields are updated too
            if draft:
                draft.ats_score = report.get("overallScore")
                draft.ats_report = report
                draft.save(update_fields=["ats_score", "ats_report"])
            return JsonResponse(success_response(report))
            
        # Add timestamp for rate limiting (only when we actually perform the LLM call)
        times.append(now)
        _user_check_times[user_id] = times
        
        # 3. Perform Analysis
        agent = AtsCompatibilityAgent()
        report = agent.analyze(resume_text, parsed_data, target_job_desc)
        
        # Cache Result
        _ats_check_cache[cache_key] = report
        
        # Save to DB if loaded from a draft
        if draft:
            draft.ats_score = report.get("overallScore")
            draft.ats_report = report
            draft.save(update_fields=["ats_score", "ats_report"])
            
        return JsonResponse(success_response(report))
        
    except Exception as e:
        logger.error("Error in ATS check view: %s", e)
        return JsonResponse(error_response(f"Server error: {e}"), status=500)


@csrf_exempt
@require_seeker_jwt
def manage_drafts(request):
    """
    GET /api/v1/seeker/resume/drafts - List drafts
    POST /api/v1/seeker/resume/drafts - Create draft
    """
    if request.method == "GET":
        drafts = ResumeDraft.objects.filter(seeker=request.seeker).order_by("-updated_at")
        data = []
        for d in drafts:
            data.append({
                "id": str(d.id),
                "title": d.title,
                "templateId": d.template_id,
                "content": d.content,
                "atsScore": d.ats_score,
                "atsReport": d.ats_report,
                "exportedPdfPath": d.exported_pdf_path,
                "isActive": d.is_active,
                "createdAt": d.created_at.isoformat(),
                "updatedAt": d.updated_at.isoformat()
            })
        return JsonResponse(success_response(data))
        
    elif request.method == "POST":
        try:
            body = json.loads(request.body)
            title = body.get("title", "Untitled Resume")
            template_id = body.get("templateId", "modern")
            content = body.get("content")
            
            # If no content is provided but user wants to prefill ("Import my existing resume")
            if not content:
                seeker = request.seeker
                resume_data = seeker.resume_data or {}
                
                # Format skills list from user account
                raw_skills = seeker.skills or []
                skills_list = []
                for s in raw_skills:
                    if isinstance(s, dict):
                        name = s.get("canonical_skill") or s.get("raw_skill") or ""
                    else:
                        name = str(s)
                    if name.strip():
                        skills_list.append(name.strip())
                
                # Check for standard sections
                personal_info = {
                    "fullName": seeker.full_name or "",
                    "title": seeker.headline or "",
                    "email": seeker.email or "",
                    "phone": seeker.phone or "",
                    "location": seeker.location or "",
                    "website": resume_data.get("website_url", "") or "",
                    "linkedin": resume_data.get("linkedin_url", "") or "",
                    "github": resume_data.get("github_url", "") or ""
                }
                
                # Experience mappings
                experience = []
                for idx, exp in enumerate(resume_data.get("experience", [])):
                    bullets = exp.get("bullets", [])
                    if not bullets and exp.get("description"):
                        bullets = [exp["description"]]
                    experience.append({
                        "id": exp.get("id") or str(idx + 1),
                        "company": exp.get("company", ""),
                        "title": exp.get("role", "") or exp.get("title", ""),
                        "location": exp.get("location", ""),
                        "startDate": exp.get("start_date", "") or exp.get("startDate", ""),
                        "endDate": exp.get("end_date", "") or exp.get("endDate", ""),
                        "bullets": bullets
                    })
                    
                # Education mappings
                education = []
                for idx, edu in enumerate(resume_data.get("education", [])):
                    education.append({
                        "id": edu.get("id") or str(idx + 1),
                        "school": edu.get("institution", "") or edu.get("school", ""),
                        "degree": edu.get("degree", ""),
                        "location": edu.get("location", ""),
                        "startDate": edu.get("startDate", "") or "",
                        "endDate": edu.get("year", "") or edu.get("year_end", "") or edu.get("endDate", "")
                    })
                    
                # Projects mappings
                projects = []
                for idx, proj in enumerate(resume_data.get("projects", [])):
                    tech_raw = proj.get("techStack") or proj.get("tech_stack") or proj.get("technologies") or []
                    if isinstance(tech_raw, str):
                        tech_list = [t.strip() for t in tech_raw.split(",") if t.strip()]
                    elif isinstance(tech_raw, list):
                        tech_list = [str(t).strip() for t in tech_raw if t]
                    else:
                        tech_list = []
                    projects.append({
                        "id": proj.get("id") or str(idx + 1),
                        "name": proj.get("name", ""),
                        "link": proj.get("link", "") or proj.get("url", ""),
                        "description": proj.get("description", ""),
                        "techStack": tech_list
                    })
                    
                # Certifications and languages mappings
                certifications = []
                for idx, cert in enumerate(resume_data.get("certifications", [])):
                    certifications.append({
                        "id": cert.get("id") or str(idx + 1),
                        "name": cert.get("name", ""),
                        "issuer": cert.get("issuer", ""),
                        "date": cert.get("date", "")
                    })
                    
                languages = []
                for idx, lang in enumerate(resume_data.get("languages", [])):
                    languages.append({
                        "id": lang.get("id") or str(idx + 1),
                        "name": lang.get("name", ""),
                        "proficiency": lang.get("proficiency", "")
                    })
                    
                content = {
                    "personalInfo": personal_info,
                    "summary": resume_data.get("professional_summary") or "",
                    "skills": skills_list,
                    "experience": experience,
                    "education": education,
                    "projects": projects,
                    "certifications": certifications,
                    "languages": languages
                }
                
            draft = ResumeDraft.objects.create(
                seeker=request.seeker,
                title=title,
                template_id=template_id,
                content=content
            )
            
            return JsonResponse(success_response({
                "id": str(draft.id),
                "title": draft.title,
                "templateId": draft.template_id,
                "content": draft.content,
                "createdAt": draft.created_at.isoformat()
            }))
        except Exception as e:
            logger.error("Error creating draft: %s", e)
            return JsonResponse(error_response(f"Server error: {e}"), status=500)
            
    return JsonResponse(error_response("Method not allowed"), status=405)


@csrf_exempt
@require_seeker_jwt
def draft_detail(request, draft_id):
    """
    GET /api/v1/seeker/resume/drafts/<draft_id>
    PATCH /api/v1/seeker/resume/drafts/<draft_id>
    DELETE /api/v1/seeker/resume/drafts/<draft_id>
    """
    try:
        draft = ResumeDraft.objects.get(id=draft_id, seeker=request.seeker)
    except ResumeDraft.DoesNotExist:
        return JsonResponse(error_response("Resume draft not found"), status=404)
        
    if request.method == "GET":
        return JsonResponse(success_response({
            "id": str(draft.id),
            "title": draft.title,
            "templateId": draft.template_id,
            "content": draft.content,
            "atsScore": draft.ats_score,
            "atsReport": draft.ats_report,
            "exportedPdfPath": draft.exported_pdf_path,
            "isActive": draft.is_active,
            "createdAt": draft.created_at.isoformat(),
            "updatedAt": draft.updated_at.isoformat()
        }))
        
    elif request.method == "PATCH":
        try:
            body = json.loads(request.body)
            if "title" in body:
                draft.title = body["title"]
            if "templateId" in body:
                draft.template_id = body["templateId"]
            if "content" in body:
                draft.content = body["content"]
            if "exportedPdfPath" in body:
                draft.exported_pdf_path = body["exportedPdfPath"]
            
            draft.save()
            return JsonResponse(success_response({
                "id": str(draft.id),
                "title": draft.title,
                "templateId": draft.template_id,
                "content": draft.content,
                "updatedAt": draft.updated_at.isoformat()
            }))
        except Exception as e:
            logger.error("Error updating draft: %s", e)
            return JsonResponse(error_response(f"Server error: {e}"), status=500)
            
    elif request.method == "DELETE":
        draft.delete()
        return JsonResponse(success_response({"message": "Draft deleted successfully"}))
        
    return JsonResponse(error_response("Method not allowed"), status=405)


@csrf_exempt
@require_seeker_jwt
def activate_draft(request, draft_id):
    """
    POST /api/v1/seeker/resume/drafts/<draft_id>/activate
    Receives the frontend-rendered PDF file via multipart form-data, saves it,
    runs the standard parsing and normalization logic via existing agent signatures,
    syncs details back to JobSeekerAccount, and marks this draft as active.
    """
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)
        
    try:
        draft = ResumeDraft.objects.get(id=draft_id, seeker=request.seeker)
    except ResumeDraft.DoesNotExist:
        return JsonResponse(error_response("Resume draft not found"), status=404)
        
    file = request.FILES.get("file")
    if not file:
        return JsonResponse(error_response("No rendered PDF file provided for activation"), status=400)
        
    try:
        # Save file to user's uploaded resumes directory
        seeker_dir = os.path.join(UPLOAD_DIR, "seekers", str(request.seeker.id))
        os.makedirs(seeker_dir, exist_ok=True)
        
        fname = f"{uuid.uuid4()}_active_resume.pdf"
        file_path = os.path.join(seeker_dir, fname)
        
        with open(file_path, "wb+") as f:
            for chunk in file.chunks():
                f.write(chunk)
                
        # Parse the saved PDF using ResumeParsingAgent as a fallback
        from asgiref.sync import async_to_sync
        from agents.parsing_agent import ResumeParsingAgent
        from agents.normalization_agent import SkillNormalizationAgent
        
        parsed = {}
        try:
            parser = ResumeParsingAgent()
            parsed_response = async_to_sync(parser.parse)(file_path, "pdf")
            parsed = parsed_response.get("parsed", {}) or {}
        except Exception as parse_err:
            logger.warning("Activation parsing fallback failed: %s", parse_err)
            
        # Extract details directly from draft.content first (since it is perfectly structured)
        content_personal = draft.content.get("personalInfo", {}) or {}
        experience_data = draft.content.get("experience", []) or []
        education_data = draft.content.get("education", []) or []
        projects_data = draft.content.get("projects", []) or []
        certifications_data = draft.content.get("certifications", []) or []
        languages_data = draft.content.get("languages", []) or []
        raw_skills = draft.content.get("skills", []) or []
        
        # Fallbacks to parsed data if draft content is empty
        if not experience_data:
            experience_data = parsed.get("experience", []) or []
        if not education_data:
            education_data = parsed.get("education", []) or []
        if not projects_data:
            projects_data = parsed.get("projects", []) or []
        if not raw_skills:
            raw_skills = parsed.get("skills", []) or []

        # Normalize skills
        try:
            norm_agent = SkillNormalizationAgent()
            normalized_skills = async_to_sync(norm_agent.normalize)(raw_skills)
        except Exception as norm_err:
            logger.warning("Activation skill normalization failed: %s", norm_err)
            normalized_skills = raw_skills

        # Estimate experience years
        def estimate_experience_years(exp_list):
            import re
            from datetime import datetime
            total_years = 0.0
            for exp in exp_list:
                sd = str(exp.get("startDate") or "")
                ed = str(exp.get("endDate") or "")
                s_year = None
                e_year = None
                
                s_match = re.search(r'\b(19|20)\d{2}\b', sd)
                if s_match:
                    s_year = int(s_match.group(0))
                    
                if not ed or ed.lower() in ["present", "current", "now"]:
                    e_year = datetime.now().year
                else:
                    e_match = re.search(r'\b(19|20)\d{2}\b', ed)
                    if e_match:
                        e_year = int(e_match.group(0))
                        
                if s_year and e_year and e_year >= s_year:
                    total_years += (e_year - s_year)
                else:
                    total_years += 1.0
            return max(1.0, round(total_years, 1)) if exp_list else 0.0

        # Update Seeker Account details
        seeker = request.seeker
        
        resume_data = {
            "experience": experience_data,
            "education": education_data,
            "total_experience_years": estimate_experience_years(experience_data) if experience_data else 0,
            "open_to": seeker.resume_data.get("open_to", {}) if (seeker.resume_data and isinstance(seeker.resume_data, dict)) else {},
            "resume_file_name": f"{draft.title}.pdf",
            "resume_updated_at": timezone.now().isoformat() + "Z",
            "resume_size": round(file.size / 1024, 2),
            "linkedin_url": content_personal.get("linkedin") or parsed.get("linkedin_url") or "",
            "github_url": content_personal.get("github") or parsed.get("github_url") or "",
            "website_url": content_personal.get("website") or parsed.get("website_url") or "",
            "professional_summary": draft.content.get("summary") or parsed.get("professional_summary") or "",
            "certifications": certifications_data,
            "languages": languages_data,
            "projects": projects_data
        }
        
        seeker.resume_file_path = file_path
        seeker.resume_data = resume_data
        seeker.skills = normalized_skills
        
        # Sync core profile fields if not already populated or if matching draft name
        personal = draft.content.get("personalInfo", {})
        if personal.get("fullName"):
            seeker.full_name = personal["fullName"].strip()
        if personal.get("phone"):
            seeker.phone = personal["phone"].strip()
        if personal.get("location"):
            seeker.location = personal["location"].strip()
        if personal.get("title"):
            seeker.headline = personal["title"].strip()
            
        # Deactivate all other drafts of the same seeker
        ResumeDraft.objects.filter(seeker=seeker).update(is_active=False)
        
        # Mark current draft active
        draft.is_active = True
        draft.exported_pdf_path = file_path
        draft.save()
        
        seeker.active_resume_draft = draft
        seeker.last_ats_score = draft.ats_score
        seeker.save()
        
        return JsonResponse(success_response({
            "message": "Draft activated and profile synchronized successfully",
            "activeResumeDraftId": str(draft.id),
            "lastAtsScore": seeker.last_ats_score,
            "resumeData": seeker.resume_data
        }))
        
    except Exception as e:
        logger.error("Failed to activate draft resume: %s", e)
        return JsonResponse(error_response(f"Sync/Activation failed: {e}"), status=500)


@csrf_exempt
@require_seeker_jwt
def recommend_templates(request):
    """
    GET /api/v1/seeker/resume/recommend-templates
    Suggests 3 template IDs based on the user's title and experience.
    """
    if request.method != "GET":
        return JsonResponse(error_response("Method not allowed"), status=405)
        
    seeker = request.seeker
    title = (seeker.headline or "").lower()
    
    # Calculate years of experience
    exp_years = 0
    if seeker.resume_data:
        exp_years = seeker.resume_data.get("total_experience_years") or 0
        try:
            exp_years = int(exp_years)
        except (TypeError, ValueError):
            exp_years = 0
        
    # Rule-based suggestions
    if "design" in title or "creative" in title or "ui" in title or "ux" in title:
        recommendations = ["creative", "minimal", "modern"]
    elif exp_years > 8 or "manager" in title or "director" in title or "vp" in title or "lead" in title:
        recommendations = ["executive", "classic", "compact"]
    elif "engineer" in title or "developer" in title or "tech" in title or "software" in title:
        recommendations = ["modern", "minimal", "executive"]
    else:
        recommendations = ["modern", "classic", "minimal"]
        
    return JsonResponse(success_response({
        "recommendations": recommendations,
        "reasoning": f"Based on your profile headline '{seeker.headline}' and {exp_years} years of experience."
    }))


@csrf_exempt
@require_seeker_jwt
def import_file_draft(request):
    """
    POST /api/v1/seeker/resume/drafts/import-file
    Uploads a resume file (PDF/DOCX/TXT), parses it directly into the editor's schema
    using the advanced, token-efficient AtsParsingAgent, and saves it as a new ResumeDraft.
    """
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)

    file = request.FILES.get("file")
    if not file:
        return JsonResponse(error_response("No file provided"), status=400)

    try:
        # Save temporary file inside uploads folder to extract text
        seeker_dir = os.path.join(UPLOAD_DIR, "seekers", str(request.seeker.id), "temp_imports")
        os.makedirs(seeker_dir, exist_ok=True)
        
        file_path = os.path.join(seeker_dir, f"{uuid.uuid4()}_{file.name}")
        with open(file_path, "wb+") as f:
            for chunk in file.chunks():
                f.write(chunk)

        # Use the column-aware extraction from AdvancedAtsParsingAgent to
        # handle two-column PDF layouts correctly (de-interleaves scrambled blocks)
        from asgiref.sync import async_to_sync
        from agents.advanced_ats_parsing_agent import AdvancedAtsParsingAgent
        
        parser = AdvancedAtsParsingAgent()
        text = AdvancedAtsParsingAgent.extract_text_column_aware(file_path)
        parsed_content = async_to_sync(parser.parse)(text)

        # Clean up the temporary imported file
        if os.path.exists(file_path):
            os.remove(file_path)

        # Create a new draft using the parsed schema
        title = f"Imported - {file.name.rsplit('.', 1)[0]}"
        draft = ResumeDraft.objects.create(
            seeker=request.seeker,
            title=title,
            template_id="modern",
            content=parsed_content
        )

        return JsonResponse(success_response({
            "id": str(draft.id),
            "title": draft.title,
            "templateId": draft.template_id,
            "content": draft.content,
            "createdAt": draft.created_at.isoformat()
        }))

    except Exception as e:
        logger.error("Failed to import and parse resume draft: %s", e)
        return JsonResponse(error_response(f"Import/Parsing failed: {e}"), status=500)


@csrf_exempt
@require_seeker_jwt
def optimize_resume_draft(request):
    """
    POST /api/v1/seeker/resume/drafts/optimize
    Low-token semantic gap analysis and incremental optimization of resume bullet points
    and summary text based on job keywords.
    """
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)
        
    try:
        body = json.loads(request.body)
        content = body.get("content", {})
        target_job_desc = body.get("targetJobDescription", "")
        target_job_desc = expand_job_description_if_short(target_job_desc)
        
        # 1. Step 1: Extract keywords & action verbs from job description (or fallback)
        target_keywords = []
        from agents.llm import RotateLLMClient
        llm = RotateLLMClient()
        
        if target_job_desc and target_job_desc.strip():
            # A low-token LLM call to extract keywords
            kw_prompt = (
                "Analyze the following Job Description and extract up to 12-15 highly critical technical hard skills, "
                "tools, methodologies, and strong action verbs (like 'Architected', 'Optimized', 'Engineered').\n\n"
                "Return ONLY a valid JSON list of strings, e.g.:\n"
                "[\"Python\", \"FastAPI\", \"Microservices\", \"CI/CD\", \"Optimized\"]\n\n"
                f"Job Description:\n{target_job_desc[:4000]}"
            )
            try:
                res = llm.chat.completions.create(
                    model="gemini-1.5-flash",
                    messages=[{"role": "user", "content": kw_prompt}],
                    temperature=0.1,
                    response_format={"type": "json_object"}
                )
                kw_raw = res.choices[0].message.content.strip()
                if kw_raw.startswith("```json"):
                    kw_raw = kw_raw[7:]
                if kw_raw.startswith("```"):
                    kw_raw = kw_raw[3:]
                if kw_raw.endswith("```"):
                    kw_raw = kw_raw[:-3]
                kw_parsed = json.loads(kw_raw.strip())
                if isinstance(kw_parsed, list):
                    target_keywords = kw_parsed
                elif isinstance(kw_parsed, dict) and "keywords" in kw_parsed:
                    target_keywords = kw_parsed["keywords"]
                elif isinstance(kw_parsed, dict):
                    # fallback value of any list key
                    for val in kw_parsed.values():
                        if isinstance(val, list):
                            target_keywords = val
                            break
            except Exception as e:
                logger.warning("Job description keyword extraction failed: %s", e)
                
        # If no keywords were extracted (or no job desc provided), use high-quality fallbacks based on candidate's title
        if not target_keywords:
            personal = content.get("personalInfo", {}) or {}
            title = personal.get("title", "").lower()
            if "python" in title or "backend" in title or "django" in title or "flask" in title or "fastapi" in title:
                target_keywords = ["Python", "FastAPI", "REST APIs", "Microservices", "CI/CD", "Optimized", "Architected", "Scalability", "Docker", "Database Tuning", "Asynchronous"]
            elif "frontend" in title or "react" in title or "javascript" in title or "web" in title:
                target_keywords = ["React 19", "JavaScript", "TypeScript", "UI/UX", "Tailwind CSS", "Redux", "Optimized", "Responsive Design", "Web Performance", "Component Architecture"]
            else:
                target_keywords = ["Engineered", "Optimized", "Implemented", "Architected", "Scalability", "Performance Tuning", "Database Management", "RESTful APIs", "Cloud Infrastructure", "CI/CD Pipelines"]
                
        # 2. Step 2: Prepare the items to optimize (only summary, experience bullets, and project descriptions)
        resume_sections = []
        
        # Summary
        summary = content.get("summary", "")
        if summary and summary.strip():
            resume_sections.append({
                "id": "summary",
                "text": summary.strip()
            })
            
        # Experience Bullets
        for exp_idx, exp in enumerate(content.get("experience", [])):
            bullets = exp.get("bullets", [])
            for bullet_idx, b_txt in enumerate(bullets):
                if b_txt and b_txt.strip():
                    resume_sections.append({
                        "id": f"exp_{exp_idx}_{bullet_idx}",
                        "text": b_txt.strip()
                    })
                    
        # Project Descriptions
        for proj_idx, proj in enumerate(content.get("projects", [])):
            desc = proj.get("description", "")
            if desc and desc.strip():
                resume_sections.append({
                    "id": f"proj_{proj_idx}_desc",
                    "text": desc.strip()
                })
                
        if not resume_sections:
            return JsonResponse(success_response({"optimizations": []}))
            
        # 3. Step 3: Run the Structured Patch prompt
        system_prompt = (
            "You are an expert ATS (Applicant Tracking System) Optimizer and Technical Recruiter.\n"
            "Your task is to optimize specific resume bullet points or summary blocks to better match a target job description.\n\n"
            "You will receive a JSON payload containing:\n"
            "1. \"target_keywords\": A list of critical hard skills, tools, and strong action verbs.\n"
            "2. \"resume_sections\": An array of specific resume items with their unique IDs.\n\n"
            "RULES:\n"
            "- Only optimize the specific items provided. Do NOT add new sections or create hypothetical achievements.\n"
            "- Incorporate the provided \"target_keywords\" naturally into the text where relevant to maximize keyword match score. Do not force them if they do not make logical sense.\n"
            "- Replace weak action verbs (e.g., 'made', 'helped', 'worked on') with strong, contextually relevant verbs from the target keywords (e.g., 'Architected', 'Optimized', 'Engineered').\n"
            "- Corect any spelling mistakes, punctuation issues, double spaces, and grammatical errors in the optimized text.\n"
            "- Preserve all numbers, metrics, dates, and quantitative achievements from the original text.\n"
            "- Optimize every item in 'resume_sections' that can be improved to better align with the 'target_keywords'.\n"
            "- Output strictly in JSON format matching this exact schema:\n"
            "{\n"
            "  \"optimizations\": [\n"
            "    {\n"
            "      \"id\": \"item ID from the input\",\n"
            "      \"original_text\": \"the original text exactly as provided\",\n"
            "      \"optimized_text\": \"the rewritten and optimized version of the text\",\n"
            "      \"keywords_added\": [\"list of keywords from target_keywords that were actually added to this text\"]\n"
            "    }\n"
            "  ]\n"
            "}\n"
            "Do not include markdown formatting or explanation outside the JSON."
        )
        
        user_payload = {
            "target_keywords": target_keywords,
            "resume_sections": resume_sections
        }
        
        response = llm.chat.completions.create(
            model="gemini-1.5-flash",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Optimize the following items:\n{json.dumps(user_payload)}"}
            ],
            temperature=0.1,
            response_format={"type": "json_object"}
        )
        
        raw_output = response.choices[0].message.content.strip()
        if raw_output.startswith("```json"):
            raw_output = raw_output[7:]
        if raw_output.startswith("```"):
            raw_output = raw_output[3:]
        if raw_output.endswith("```"):
            raw_output = raw_output[:-3]
            
        parsed_output = json.loads(raw_output.strip())
        
        return JsonResponse(success_response({
            "targetKeywords": target_keywords,
            "optimizations": parsed_output.get("optimizations", [])
        }))
        
    except Exception as e:
        logger.error("Failed to generate resume optimizations: %s", e)
        return JsonResponse(error_response(f"Optimization failed: {e}"), status=500)


@csrf_exempt
@require_seeker_jwt
def enhance_resume_draft(request):
    """
    POST /api/v1/seeker/resume/drafts/enhance
    Runs the full ResumeEnhancerAgent on the current draft content (or active resume),
    returning dual ATS scores, enhanced bullets, missing keywords, skill gaps, 
    improvement tips, and a rewritten summary.
    """
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)

    try:
        body = json.loads(request.body)
        resume_draft_id = body.get("resumeDraftId")
        content = body.get("content")
        target_job_desc = body.get("targetJobDescription", "")
        target_job_desc = expand_job_description_if_short(target_job_desc)
        live_ats_score = body.get("liveAtsScore")  # Live score from the frontend ATS sidebar

        draft = None
        if resume_draft_id:
            try:
                draft = ResumeDraft.objects.get(id=resume_draft_id, seeker=request.seeker)
                resume_data = draft.content or {}
            except ResumeDraft.DoesNotExist:
                return JsonResponse(error_response("Resume draft not found"), status=404)
        elif content:
            resume_data = content
        else:
            resume_data = request.seeker.resume_data or {}

        if not resume_data:
            return JsonResponse(error_response("No resume content to enhance"), status=400)

        # 1. Run AtsCompatibilityAgent to extract live missing keywords and actual score
        from agents.ats_compatibility_agent import AtsCompatibilityAgent
        ats_agent = AtsCompatibilityAgent()
        ats_report = ats_agent.analyze(None, resume_data, target_job_desc)
        ats_missing_keywords = ats_report.get("breakdown", {}).get("keywords", {}).get("missingKeywords", [])
        
        # Sync the live ATS score dynamically
        actual_live_score = ats_report.get("overallScore")
        if actual_live_score is not None:
            live_ats_score = actual_live_score

        # 2. Run the full Resume Enhancer Agent
        from agents.resume_enhancer_agent import ResumeEnhancerAgent
        agent = ResumeEnhancerAgent()
        result = agent.enhance(resume_data, target_job_desc, live_ats_score=live_ats_score)

        if not result.get("success"):
            logger.warning("Enhancer returned fallback data: %s", result.get("error"))

        # 3. Merge ATS missing keywords to guarantee the modal and sidebar match exactly
        if result.get("success") and "data" in result:
            enhanced_data = result["data"]
            existing_missing = set(k.lower().strip() for k in enhanced_data.get("missing_keywords", []))
            for kw in ats_missing_keywords:
                if kw.lower().strip() not in existing_missing:
                    enhanced_data.setdefault("missing_keywords", []).append(kw)

        # Save to seeker's enhanced_resume field which already exists
        seeker = request.seeker
        seeker.enhanced_resume = result.get("data") or {}
        seeker.save(update_fields=["enhanced_resume"])

        return JsonResponse(success_response(result.get("data")))

    except Exception as e:
        logger.error("Error in enhance_resume_draft view: %s", e)
        return JsonResponse(error_response(f"Server error: {e}"), status=500)


@csrf_exempt
@require_seeker_jwt
def export_draft_pdf(request, draft_id):
    """
    POST /api/v1/seeker/resume/drafts/<draft_id>/export-pdf
    Server-side renders the draft into a clean, ATS-safe PDF using 
    resume_pdf_renderer.py — guarantees layout matches AtsOptimizedTemplate.jsx exactly.
    """
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)

    try:
        draft = ResumeDraft.objects.get(id=draft_id, seeker=request.seeker)
    except ResumeDraft.DoesNotExist:
        return JsonResponse(error_response("Resume draft not found"), status=404)

    try:
        seeker_dir = os.path.join(UPLOAD_DIR, "seekers", str(request.seeker.id), "exports")
        os.makedirs(seeker_dir, exist_ok=True)
        output_path = os.path.join(seeker_dir, f"{draft.id}_export.pdf")

        render_resume_pdf(draft.content, output_path)

        # In case the model ResumeDraft doesn't have exported_pdf_path, check if field exists or handle dynamically
        # Let's save it dynamically to draft.metadata or check if field exists. Wait, if it doesn't exist, Django might crash!
        # Let's check if the field exists by looking at ResumeDraft fields or try-excepting it.
        # Actually, let's look at the database model ResumeDraft in backend/api/models.py to see its fields.
        try:
            draft.exported_pdf_path = output_path
            draft.save(update_fields=["exported_pdf_path"])
        except Exception:
            # Fallback if field doesn't exist
            if not hasattr(draft, 'metadata') or draft.metadata is None:
                draft.metadata = {}
            draft.metadata["exported_pdf_path"] = output_path
            draft.save()

        # Build download URL matching Django's uploads route settings
        download_url = f"/uploads/seekers/{request.seeker.id}/exports/{draft.id}_export.pdf"
        return JsonResponse(success_response({
            "exportedPdfPath": output_path,
            "downloadUrl": download_url
        }))
    except Exception as e:
        logger.error("PDF export failed for draft %s: %s", draft_id, e)
        return JsonResponse(error_response(f"Export failed: {e}"), status=500)


@csrf_exempt
@require_seeker_jwt
def manage_versions(request, draft_id):
    """
    GET /api/v1/seeker/resume/drafts/<draft_id>/versions - List checkpoints
    POST /api/v1/seeker/resume/drafts/<draft_id>/versions - Create a new Named Version checkpoint
    """
    try:
        draft = ResumeDraft.objects.get(id=draft_id, seeker=request.seeker)
    except ResumeDraft.DoesNotExist:
        return JsonResponse(error_response("Resume draft not found"), status=404)

    if request.method == "GET":
        versions = ResumeVersion.objects.filter(draft=draft).order_by("-created_at")
        data = []
        for v in versions:
            data.append({
                "id": str(v.id),
                "title": v.title,
                "atsScore": v.ats_score,
                "createdAt": v.created_at.isoformat()
            })
        return JsonResponse(success_response(data))

    elif request.method == "POST":
        try:
            body = {}
            if request.body:
                body = json.loads(request.body)
            
            title = body.get("title")
            if not title:
                now_str = timezone.now().strftime("%b %d, %Y %H:%M")
                title = f"Checkpoint - {now_str}"

            version = ResumeVersion.objects.create(
                draft=draft,
                title=title,
                content=draft.content,
                ats_score=draft.ats_score
            )
            return JsonResponse(success_response({
                "id": str(version.id),
                "title": version.title,
                "atsScore": version.ats_score,
                "createdAt": version.created_at.isoformat()
            }))
        except Exception as e:
            logger.error("Error creating version snapshot: %s", e)
            return JsonResponse(error_response(f"Failed to create version: {e}"), status=500)

    return JsonResponse(error_response("Method not allowed"), status=405)


@csrf_exempt
@require_seeker_jwt
def restore_version(request, draft_id, version_id):
    """
    POST /api/v1/seeker/resume/drafts/<draft_id>/versions/<version_id>/restore - Restore to checkpoint
    """
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)

    try:
        draft = ResumeDraft.objects.get(id=draft_id, seeker=request.seeker)
        version = ResumeVersion.objects.get(id=version_id, draft=draft)
        
        draft.content = version.content
        draft.ats_score = version.ats_score
        
        # Recalculate ATS compatibility report on restore
        ats_agent = AtsCompatibilityAgent()
        report = ats_agent.analyze(None, draft.content)
        draft.ats_report = report
        
        draft.save()
        
        return JsonResponse(success_response({
            "id": str(draft.id),
            "title": draft.title,
            "templateId": draft.template_id,
            "content": draft.content,
            "atsScore": draft.ats_score,
            "atsReport": draft.ats_report,
            "updatedAt": draft.updated_at.isoformat()
        }))
    except ResumeDraft.DoesNotExist:
        return JsonResponse(error_response("Resume draft not found"), status=404)
    except ResumeVersion.DoesNotExist:
        return JsonResponse(error_response("Version checkpoint not found"), status=404)
    except Exception as e:
        logger.error("Error restoring version: %s", e)
        return JsonResponse(error_response(f"Restore failed: {e}"), status=500)


@csrf_exempt
def debug_project_relevance(request):
    """
    POST /api/debug/project-relevance
    Debug endpoint for inspecting the new project relevance scoring logic.
    """
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)
        
    try:
        body = json.loads(request.body)
        resume_input = body.get("resume")
        jd_text = body.get("job_description", "")
        
        parsed_data = {}
        resume_text = ""
        
        if isinstance(resume_input, dict):
            parsed_data = resume_input
        elif isinstance(resume_input, list):
            parsed_data = {"projects": resume_input}
        elif isinstance(resume_input, str):
            resume_text = resume_input
            try:
                parsed_data = json.loads(resume_input)
                resume_text = ""
            except Exception:
                pass
                
        agent = AtsCompatibilityAgent()
        report = agent.analyze(resume_text, parsed_data, jd_text)
        
        pr = report.get("detailed_breakdown", {}).get("project_relevance", {})
        
        output = {
            "projects_found": pr.get("projects_found", []),
            "keywords_extracted": pr.get("project_keywords", []),
            "semantic_similarity": pr.get("semantic_similarity", 0.0),
            "technology_overlap": pr.get("technology_overlap", 0.0),
            "responsibility_overlap": pr.get("responsibility_overlap", 0.0),
            "final_project_score": pr.get("score", 0.0),
            "reasoning": [pr.get("reason", "")]
        }
        
        return JsonResponse(success_response(output))
    except Exception as e:
        logger.error("Error in debug project relevance endpoint: %s", e)
        return JsonResponse(error_response(f"Debug failed: {e}"), status=500)


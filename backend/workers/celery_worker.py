import socket
# Patch socket to force IPv4 and avoid IPv6 resolution hangs
orig_getaddrinfo = socket.getaddrinfo
def getaddrinfo_ipv4(host, port, family=0, type=0, proto=0, flags=0):
    return orig_getaddrinfo(host, port, socket.AF_INET, type, proto, flags)
socket.getaddrinfo = getaddrinfo_ipv4

import os
import sys

# Ensure the backend directory is in the Python pathway
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import django
# Initialize Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vishleshan_backend.settings')
django.setup()

from celery import Celery
import asyncio
import threading
from pathlib import Path
import json
from datetime import datetime, timezone
import concurrent.futures
import fitz  # PyMuPDF
from docx import Document
import re
import uuid

pymupdf_lock = threading.Lock()

from api.models import Candidate, Session as SessionModel, IngestJob, SkillTaxonomy
from api.services.matching_service import calculate_match

celery_app = Celery(
    "vishleshan",
    broker=os.getenv("REDIS_URL", "redis://localhost:6379"),
    backend=os.getenv("REDIS_URL", "redis://localhost:6379")
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    timezone="Asia/Kolkata",
    task_track_started=True,
    broker_connection_retry_on_startup=True
)

celery_app.conf.beat_schedule = {
    'release-scheduled-results-every-minute': {
        'task': 'release_scheduled_results',
        'schedule': 60.0,
    },
}

def _parse_resume_sync(file_path: str, skip_llm: bool = False) -> dict:
    """Synchronously extract text and parse a resume file using AI logic."""
    upload_dir = os.getenv("UPLOAD_DIR", "uploads")
    photo_dir = os.getenv("PHOTO_DIR", "photos")
    os.makedirs(photo_dir, exist_ok=True)

    ext = Path(file_path).suffix.lower()
    text = ""
    photo_path = None

    try:
        if ext == ".pdf":
            # Using PyMuPDF (fitz) instead of pdfplumber for blazing fast C++ extraction that avoids GIL lock
            with pymupdf_lock:
                doc = fitz.open(file_path)
                text_pages = []
                for page in doc:
                    text_pages.append(page.get_text())
                text = "\n".join(text_pages)
                
            # --- GEMINI OCR FALLBACK FOR IMAGE-BASED PDFS ---
            if len(text.strip()) < 50:
                gemini_key = os.getenv("GEMINI_API_KEY")
                if gemini_key:
                    try:
                        import google.generativeai as genai
                        from PIL import Image
                        import io
                        
                        genai.configure(api_key=gemini_key)
                        model = genai.GenerativeModel('gemini-1.5-flash')
                        
                        with pymupdf_lock:
                            doc = fitz.open(file_path)
                            ocr_text = []
                            for i in range(min(len(doc), 1)): # Only first page for speed (<10s budget)
                                page = doc[i]
                                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
                                img_data = pix.tobytes("png")
                                img = Image.open(io.BytesIO(img_data))
                            
                            response = model.generate_content([
                                "Extract all standard text from this resume image exactly as written. Do not add markdown or conversational wrappers.", 
                                img
                            ])
                            ocr_text.append(response.text)
                        
                        if ocr_text:
                            text = "\n".join(ocr_text)
                    except Exception as e:
                        print("Gemini OCR Failed:", str(e))
            try:
                with pymupdf_lock:
                    doc = fitz.open(file_path)
                    for page in doc:
                        for img in page.get_images():
                            xref = img[0]
                            base = doc.extract_image(xref)
                            photo_path = f"{photo_dir}/{uuid.uuid4()}.jpg"
                            with open(photo_path, "wb") as f:
                                f.write(base["image"])
                            break
            except Exception:
                photo_path = None
        elif ext in [".docx", ".doc"]:
            doc = Document(file_path)
            parts = [para.text for para in doc.paragraphs if para.text.strip()]
            text = "\n".join(parts)
        else:
            with open(file_path, "r", errors="ignore") as f:
                text = f.read()

        # ── FAST REGEX EXTRACTION (always runs, <0.5s) ──────────────────
        email_re = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
        phone_re = r'[\+\(]?[0-9][0-9\s\-\(\)]{8,14}[0-9]'
        url_re = r'https?://(?:www\.)?linkedin\.com/in/[\w\-]+'
        github_re = r'https?://(?:www\.)?github\.com/[\w\-]+'
        exp_re = r'(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:experience|exp)'

        emails = re.findall(email_re, text)
        phones = re.findall(phone_re, text)
        linkedin = re.search(url_re, text, re.IGNORECASE)
        github = re.search(github_re, text, re.IGNORECASE)
        exp_match = re.search(exp_re, text, re.IGNORECASE)

        # Extract name: first non-empty line that looks like a name (2 cap words)
        name = Path(file_path).stem
        for line in text.split("\n")[:10]:
            line = line.strip()
            words = line.split()
            if 1 < len(words) <= 6 and all(w[0].isupper() if w else True for w in words if w.isalpha()):
                name = line
                break

        # Extract skills: common tech stack keywords
        SKILL_KEYWORDS = [
            "Python","Java","JavaScript","TypeScript","C\\+\\+","C#","Go","Rust","Ruby","PHP","Swift","Kotlin",
            "React","Angular","Vue","Next\\.js","Node\\.js","Django","Flask","FastAPI","Spring","Laravel",
            "PostgreSQL","MySQL","MongoDB","Redis","SQLite","Oracle","Cassandra","DynamoDB",
            "AWS","GCP","Azure","Docker","Kubernetes","Terraform","Ansible","Jenkins","GitHub Actions",
            "TensorFlow","PyTorch","Scikit-learn","Pandas","NumPy","OpenCV","Hugging Face",
            "HTML","CSS","SCSS","Tailwind","Bootstrap","REST","GraphQL","gRPC","Kafka","RabbitMQ",
            "Git","Linux","Bash","PowerShell","Agile","Scrum","Jira","Figma","Photoshop"
        ]
        found_skills = []
        for sk in SKILL_KEYWORDS:
            if re.search(r'\b' + sk + r'\b', text, re.IGNORECASE):
                found_skills.append({"skill": sk.replace("\\", ""), "years": None, "level": None})

        # Simple location detection
        location_keywords = ["Bengaluru","Bangalore","Mumbai","Delhi","Hyderabad","Chennai","Pune","Remote","Kolkata",
                             "Noida","Gurgaon","Gurugram","Kochi","Kerala","New York","San Francisco","London","Singapore","Dubai"]
        location = None
        for loc in location_keywords:
            if loc.lower() in text.lower():
                location = loc
                break

        # Fallback Mock Data for UI presentation if LLM fails
        regex_parsed = {
            "name": name,
            "email": emails[0] if emails else None,
            "phone": phones[0].strip() if phones else None,
            "location": location or "Unknown",
            "linkedin_url": linkedin.group(0) if linkedin else None,
            "github_url": github.group(0) if github else None,
            "total_experience_years": float(exp_match.group(1)) if exp_match else 0.0,
            "skills": found_skills if found_skills else [],
            "experience": [],
            "education": [],
            "current_role": None
        }

        if skip_llm:
            return {
                "parsed": regex_parsed,
                "photo_path": photo_path,
                "raw_text_length": len(text),
                "parsing_method": "regex",
                "confidence": 0.7
            }

        # ── OPTIONAL LLM ENRICHMENT (skip on failure) ────────
        try:
            from agents.llm import RotateLLMClient
            import threading
            from dotenv import load_dotenv
            
            load_dotenv() # Load environment variables so keys exist

            client = RotateLLMClient()
            model_to_use = "gemini-1.5-flash"
            
            llm_result = [None]
            llm_error = [None]

            def call_llm():
                try:
                    SCHEMA = """{"name":str,"email":str|null,"phone":str|null,"location":str|null,
"summary":str|null,"gender":str|null,"date_of_birth":str|null,
"current_role":str|null,"linkedin_url":str|null,"github_url":str|null,
"total_experience_years":float,"skills":[{"skill":str,"years":float|null}],
"experience":[{"company":str,"role":str,"start_date":str,"end_date":str,"duration":str,"description":str}],
"education":[{"institution":str,"degree":str,"field":str,"year":str}],
"projects":[{"name":str,"description":str,"technologies":[str],"link":str}],
"certifications":[{"name":str,"issuer":str,"date":str}],
"awards":[str],"languages":[str]}"""
                    resp = client.chat.completions.create(
                        model=model_to_use,
                        response_format={"type": "json_object"},
                        messages=[
                            {"role": "system", "content": "You are an elite Resume parser. Extract EVERYTHING accurately. If unsure, leave as null but don't skip existing data. Projects, Certifications, and Summary are CRITICAL."},
                            {"role": "user", "content": f"Parse this resume into rich JSON. Schema:\n{SCHEMA}\n\nResume:\n{text[:4000]}"}
                        ],
                        temperature=0.0,
                        timeout=8
                    )
                    raw = resp.choices[0].message.content.strip().strip("```json").strip("```").strip()
                    llm_result[0] = json.loads(raw)
                except Exception as ex:
                    llm_error[0] = str(ex)

            t = threading.Thread(target=call_llm)
            t.start()
            t.join(timeout=7)  # hard cap: 7s so total stays <10s with overhead

            if llm_error[0]:
                print("LLM Error:", llm_error[0])

            if llm_result[0]:
                # Merge: LLM wins on fields it has, regex fills gaps
                parsed = llm_result[0]
                for field in ["email", "phone", "location", "linkedin_url", "github_url"]:
                    if not parsed.get(field) and regex_parsed.get(field):
                        parsed[field] = regex_parsed[field]
                if not parsed.get("skills"):
                    parsed["skills"] = regex_parsed["skills"]
                return {
                    "parsed": parsed,
                    "photo_path": photo_path,
                    "raw_text_length": len(text),
                    "parsing_method": "llm",
                    "confidence": 0.9
                }
        except Exception:
            pass

        # Fallback to regex result
        return {
            "parsed": regex_parsed,
            "photo_path": photo_path,
            "raw_text_length": len(text),
            "parsing_method": "regex",
            "confidence": 0.7
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            "parsed": {"name": Path(file_path).stem, "email": None, "phone": None, "location": "Unknown",
                       "skills": [], "experience": [], "education": [], "total_experience_years": 0.0, "current_role": None},
            "photo_path": photo_path,
            "parsing_method": "error_fallback",
            "confidence": 0.1
        }

def _normalize_skills_sync(raw_skills: list, db=None) -> list:
    """Delegates to the highly optimized V2 flat lookup normalization agent."""
    from agents.normalization_agent import _normalize_skills_sync as fast_normalize
    return fast_normalize(raw_skills, db)

@celery_app.task(bind=True, max_retries=2, name="process_resume_batch")
def process_resume_batch(self, job_id: str, file_paths: list, session_id: str, source: str = "upload", use_llm: bool = True):
    """Process resume files. Two-phase approach for speed:
       Phase 1: Fast regex-only parsing (all files, <0.3s each)
       Phase 2: Background LLM enrichment (if use_llm=True, staggered)
    """
    if not file_paths:
        try:
            job = IngestJob.objects.get(id=job_id)
            job.status = "done"
            job.completed_at = datetime.now(timezone.utc)
            job.save()
        except IngestJob.DoesNotExist:
            pass
        return

    try:
        job = IngestJob.objects.get(id=job_id)
        session_row = SessionModel.objects.get(id=session_id)
    except (IngestJob.DoesNotExist, SessionModel.DoesNotExist):
        return

    try:
        is_bulk = len(file_paths) > 10

        job.status = "processing"
        job.save()

        # Phase 1: For bulk uploads → regex-only (fast, <0.3s/file)
        # For small batches (<=10) and LLM enabled → full LLM parsing
        do_llm_inline = (not is_bulk) and use_llm

        def _process_one(path):
            return path, _parse_resume_sync(path, skip_llm=(not do_llm_inline))

        candidate_ids_for_enrichment = []

        criteria = session_row.criteria or {}
        min_match_score = criteria.get("min_match_score", 0)
        required_skills = criteria.get("required_skills", [])
        rounds = session_row.rounds or []
        first_round_order = rounds[0]["order"] if rounds else 0
        req_lower = [r.lower() for r in required_skills]

        with concurrent.futures.ThreadPoolExecutor(max_workers=min(len(file_paths), 30)) as executor:
            future_to_path = {executor.submit(_process_one, p): p for p in file_paths}
            
            for future in concurrent.futures.as_completed(future_to_path):
                path = future_to_path[future]
                try:
                    _, parsed_res = future.result()
                except Exception as e:
                    try:
                        active_job = IngestJob.objects.get(id=job_id)
                        active_job.failed_files = (active_job.failed_files or 0) + 1
                        errs = list(active_job.error_log or [])
                        errs.append(f"{Path(path).name}: {str(e)[:200]}")
                        active_job.error_log = errs
                        active_job.save()
                    except IngestJob.DoesNotExist:
                        pass
                    continue

                raw_data = parsed_res["parsed"]
                raw_skills = raw_data.get("skills", [])
                normalized_skills = _normalize_skills_sync(raw_skills)

                new_cand = Candidate(
                    session=session_row,
                    name=raw_data.get("name") or Path(path).stem,
                    email=raw_data.get("email"),
                    phone=raw_data.get("phone"),
                    location=raw_data.get("location"),
                    total_experience_years=float(raw_data.get("total_experience_years") or 0),
                    normalized_skills=normalized_skills,
                    raw_resume_data=parsed_res,
                    resume_file_path=path,
                    resume_photo_path=parsed_res.get("photo_path"),
                    current_round_index=first_round_order,
                    status="new",
                    source=source
                )

                # Unified match scoring using criteria
                match_res = calculate_match(
                    normalized_skills=normalized_skills,
                    total_experience_years=new_cand.total_experience_years,
                    location=new_cand.location,
                    criteria=criteria,
                    parsing_method=parsed_res.get("parsing_method", "llm")
                )
                new_cand.match_score = match_res["match_score"]
                new_cand.recommendation = match_res["recommendation"]
                new_cand.match_details = match_res["match_details"]
                
                if min_match_score > 0 and new_cand.match_score < min_match_score:
                    new_cand.status = "rejected"

                new_cand.save()

                # Track candidates that need background LLM enrichment
                if is_bulk and use_llm and parsed_res.get("parsing_method") == "regex":
                    candidate_ids_for_enrichment.append(str(new_cand.id))

                try:
                    active_job = IngestJob.objects.get(id=job_id)
                    active_job.processed_files = (active_job.processed_files or 0) + 1
                    active_job.save()
                except IngestJob.DoesNotExist:
                    pass

        try:
            active_job = IngestJob.objects.get(id=job_id)
            active_job.status = "done"
            active_job.completed_at = datetime.now(timezone.utc)
            active_job.save()
        except IngestJob.DoesNotExist:
            pass

        # Phase 2: Fire background LLM enrichment for bulk-parsed candidates
        if candidate_ids_for_enrichment:
            # Stagger: process 5 at a time with 2s delay between batches
            for i in range(0, len(candidate_ids_for_enrichment), 5):
                batch = candidate_ids_for_enrichment[i:i+5]
                enrich_candidates_llm.apply_async(
                    args=[batch],
                    countdown=i // 5 * 2  # 0s, 2s, 4s, 6s...
                )

    except Exception as e:
        import traceback
        try:
            active_job = IngestJob.objects.get(id=job_id)
            active_job.status = "failed"
            active_job.error_log = [str(e), traceback.format_exc()]
            active_job.completed_at = datetime.now(timezone.utc)
            active_job.save()
        except IngestJob.DoesNotExist:
            pass
        raise e

@celery_app.task(name="enrich_candidates_llm", max_retries=1)
def enrich_candidates_llm(candidate_ids: list):
    """Phase 2: Background LLM enrichment for candidates that were parsed with regex-only.
    Re-parses the resume file through the full LLM pipeline and merges richer data back.
    """
    for cid in candidate_ids:
        try:
            cand = Candidate.objects.get(id=cid)
            if not cand.resume_file_path:
                continue

            # Check if already enriched
            raw = cand.raw_resume_data or {}
            if raw.get("parsing_method") == "llm":
                continue

            # Re-parse with LLM
            enriched = _parse_resume_sync(cand.resume_file_path, skip_llm=False)
            if enriched.get("parsing_method") != "llm":
                continue  # LLM failed, keep regex data

            parsed = enriched["parsed"]

            # Merge: update candidate fields with richer LLM data
            if parsed.get("name") and parsed["name"] != Path(cand.resume_file_path).stem:
                cand.name = parsed["name"]
            if parsed.get("email"):
                cand.email = parsed["email"]
            if parsed.get("phone"):
                cand.phone = parsed["phone"]
            if parsed.get("location") and parsed["location"] != "Unknown":
                cand.location = parsed["location"]
            if parsed.get("total_experience_years"):
                cand.total_experience_years = float(parsed["total_experience_years"])

            # Re-normalize skills from LLM output
            llm_skills = parsed.get("skills", [])
            if llm_skills:
                cand.normalized_skills = _normalize_skills_sync(llm_skills)

            # Update raw_resume_data with enriched version
            cand.raw_resume_data = enriched
            cand.save()
        except Candidate.DoesNotExist:
            continue
        except Exception as e:
            print(f"[LLM Enrich] Failed for {cid}: {e}")

@celery_app.task(name="sync_gmail_resumes")
def sync_gmail_resumes(session_id: str, job_id: str):
    try:
        session_row = SessionModel.objects.get(id=session_id)
        job = IngestJob.objects.get(id=job_id)
    except (SessionModel.DoesNotExist, IngestJob.DoesNotExist):
        return

    if not session_row.gmail_tokens:
        job.status = "failed"
        job.error_log = ["Gmail not connected"]
        job.save()
        return

    try:
        import google.oauth2.credentials
        from googleapiclient.discovery import build
        creds = google.oauth2.credentials.Credentials(**session_row.gmail_tokens)
        service = build('gmail', 'v1', credentials=creds)

        query = "has:attachment filename:(pdf OR docx) subject:(resume OR CV OR application)"
        results = service.users().messages().list(userId='me', q=query, maxResults=50).execute()
        messages = results.get('messages', [])

        save_dir = os.path.join(os.getenv("UPLOAD_DIR", "uploads"), session_id)
        os.makedirs(save_dir, exist_ok=True)
        downloaded = []

        for msg in messages:
            msg_id = msg['id']
            message_data = service.users().messages().get(userId='me', id=msg_id).execute()
            parts = message_data.get('payload', {}).get('parts', [])
            for part in parts:
                filename = part.get('filename', '')
                if filename and (filename.lower().endswith('.pdf') or filename.lower().endswith('.docx')):
                    att_id = part['body'].get('attachmentId')
                    if att_id:
                        import base64
                        att = service.users().messages().attachments().get(userId='me', messageId=msg_id, id=att_id).execute()
                        file_data = base64.urlsafe_b64decode(att['data'].encode('UTF-8'))
                        file_path = os.path.join(save_dir, f"{msg_id}_{filename}")
                        with open(file_path, 'wb') as f:
                            f.write(file_data)
                        downloaded.append(file_path)

        if downloaded:
            job.total_files = len(downloaded)
            job.save()
            process_resume_batch.delay(job_id, downloaded, session_id, "gmail")
        else:
            job.status = "done"
            job.completed_at = datetime.now(timezone.utc)
            job.save()

    except Exception as e:
        job.status = "failed"
        job.error_log = [str(e)]
        job.completed_at = datetime.now(timezone.utc)
        job.save()

@celery_app.task(name="sync_gdrive_resumes")
def sync_gdrive_resumes(session_id: str, job_id: str):
    try:
        session_row = SessionModel.objects.get(id=session_id)
        job = IngestJob.objects.get(id=job_id)
    except (SessionModel.DoesNotExist, IngestJob.DoesNotExist):
        return

    if not session_row.gdrive_tokens:
        job.status = "failed"
        job.error_log = ["Google Drive not connected"]
        job.save()
        return

    try:
        import google.oauth2.credentials
        from googleapiclient.discovery import build
        creds = google.oauth2.credentials.Credentials(**session_row.gdrive_tokens)
        service = build('drive', 'v3', credentials=creds)

        save_dir = os.path.join(os.getenv("UPLOAD_DIR", "uploads"), session_id)
        os.makedirs(save_dir, exist_ok=True)

        query = "mimeType='application/pdf' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document'"
        if session_row.gdrive_folder_id:
            query = f"'{session_row.gdrive_folder_id}' in parents and ({query})"

        results = service.files().list(q=query, pageSize=100, fields="files(id, name)").execute()
        files = results.get('files', [])

        downloaded = []
        for f in files:
            try:
                import io
                from googleapiclient.http import MediaIoBaseDownload
                request = service.files().get_media(fileId=f['id'])
                file_path = os.path.join(save_dir, f"{f['id']}_{f['name']}")
                fh = io.FileIO(file_path, 'wb')
                downloader = MediaIoBaseDownload(fh, request)
                done = False
                while not done:
                    _, done = downloader.next_chunk()
                fh.close()
                downloaded.append(file_path)
            except Exception:
                pass

        if downloaded:
            job.total_files = len(downloaded)
            job.save()
            process_resume_batch.delay(job_id, downloaded, session_id, "gdrive")
        else:
            job.status = "done"
            job.completed_at = datetime.now(timezone.utc)
            job.save()

    except Exception as e:
        job.status = "failed"
        job.error_log = [str(e)]
        job.completed_at = datetime.now(timezone.utc)
        job.save()

@celery_app.task(name="match_all_candidates")
def match_all_candidates(session_id: str, job_id: str):
    try:
        session_row = SessionModel.objects.get(id=session_id)
        job = IngestJob.objects.get(id=job_id)
    except (SessionModel.DoesNotExist, IngestJob.DoesNotExist):
        return

    criteria = session_row.criteria or {}
    min_match_score = criteria.get("min_match_score", 0)
    required_skills = criteria.get("required_skills", [])
    req_lower = [r.lower() for r in required_skills]

    candidates = Candidate.objects.filter(session_id=session_id)
    total_count = candidates.count()
    job.total_files = total_count
    job.processed_files = 0
    job.status = "processing"
    job.save()

    processed_count = 0
    for cand in candidates:
        match_res = calculate_match(
            normalized_skills=cand.normalized_skills,
            total_experience_years=cand.total_experience_years,
            location=cand.location,
            criteria=criteria,
            parsing_method=cand.raw_resume_data.get("parsing_method", "llm") if isinstance(cand.raw_resume_data, dict) else "llm"
        )
        cand.match_score = match_res["match_score"]
        cand.recommendation = match_res["recommendation"]
        cand.match_details = match_res["match_details"]
        
        if min_match_score > 0 and cand.match_score < min_match_score:
            cand.status = "rejected"
        
        cand.save()
        processed_count += 1
        job.processed_files = processed_count
        job.save()

    job.status = "done"
    job.completed_at = datetime.now(timezone.utc)
    job.save()

@celery_app.task(name="parse_seeker_resume")
def parse_seeker_resume(seeker_id: str, file_path: str, file_name: str, file_size: int):
    """
    Asynchronously parse a job seeker's resume and update their account.
    Also updates the status in Redis.
    """
    import os
    import json
    import logging
    from datetime import datetime, timezone as dt_timezone
    import redis
    from asgiref.sync import async_to_sync
    from api.models import JobSeekerAccount
    from agents.parsing_agent import ResumeParsingAgent
    from agents.normalization_agent import SkillNormalizationAgent

    logger = logging.getLogger(__name__)
    redis_client = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))
    redis_key = f"seeker:resume_parse_status:{seeker_id}"

    def set_status(status_str, progress_int, error_str=None):
        try:
            status_data = {
                "status": status_str,
                "progress": progress_int,
                "error": error_str,
                "updated_at": datetime.now(dt_timezone.utc).isoformat() + "Z"
            }
            redis_client.set(redis_key, json.dumps(status_data), ex=3600)  # expires in 1 hour
        except Exception as re_err:
            logger.warning("Failed to write parser status to Redis: %s", re_err)

    set_status("processing", 20)

    try:
        # Determine file extension
        file_ext = file_name.split('.')[-1].lower()
        if file_ext == "doc":
            file_ext = "docx"
        elif file_ext not in ["pdf", "docx", "txt"]:
            file_ext = "txt"

        set_status("processing", 40)

        # Parse with ResumeParsingAgent
        parser = ResumeParsingAgent()
        parsed_response = async_to_sync(parser.parse)(file_path, file_ext)
        parsed = parsed_response.get("parsed", {})

        set_status("processing", 70)

        # Normalize skills
        raw_skills = parsed.get("skills", [])
        try:
            norm_agent = SkillNormalizationAgent()
            normalized_skills = async_to_sync(norm_agent.normalize)(raw_skills)
        except Exception as norm_err:
            logger.warning("Skill normalization failed: %s", norm_err)
            normalized_skills = raw_skills

        set_status("processing", 90)

        # Update JobSeekerAccount
        seeker = JobSeekerAccount.objects.get(id=seeker_id)
        
        # Prepare resume_data schema matching what seeker expects
        existing_resume = seeker.resume_data or {}
        resume_data = {
            "experience": parsed.get("experience", []),
            "education": parsed.get("education", []),
            "total_experience_years": parsed.get("total_experience_years", 0),
            "open_to": existing_resume.get("open_to", {}) or existing_resume.get("openTo", {}),
            "resume_file_name": file_name,
            "resume_updated_at": datetime.utcnow().isoformat() + "Z",
            "resume_size": round(file_size / 1024, 2),
            "linkedin_url": parsed.get("linkedin_url"),
            "github_url": parsed.get("github_url"),
            "professional_summary": parsed.get("professional_summary")
        }

        seeker.resume_file_path = file_path
        seeker.resume_data = resume_data
        seeker.skills = normalized_skills

        # Auto-fill/update personal fields if parsed
        if parsed.get("name") and (not seeker.full_name or seeker.full_name.strip() in ["", "New User"]):
            seeker.full_name = parsed["name"].strip()
        if parsed.get("phone") and (not seeker.phone or seeker.phone.strip() == ""):
            seeker.phone = parsed["phone"].strip()
        if parsed.get("location") and (not seeker.location or seeker.location.strip() == ""):
            seeker.location = parsed["location"].strip()
        
        # Headline extraction priority
        if parsed.get("current_role"):
            seeker.headline = parsed["current_role"].strip()
        elif parsed.get("professional_summary"):
            seeker.headline = parsed["professional_summary"][:255].strip()

        seeker.save()
        set_status("success", 100)
        logger.info("Seeker %s resume parsed successfully", seeker_id)
        
    except Exception as e:
        logger.error("Error in parse_seeker_resume task: %s", e)
        set_status("failed", 100, error_str=str(e))
        raise e

# Celery app alias
app = celery_app


@celery_app.task(name="release_scheduled_results")
def release_scheduled_results():
    """
    Sweeper task running periodically to release results whose scheduled dates have passed.
    Checks JobApplication records and triggers notification/email if:
      - The candidate's round status/action was finalized
      - The round's result_announcement_date has passed
      - The seeker has not yet been notified
    """
    import logging
    from django.utils import timezone
    from django.db import transaction
    from api.models import JobApplication, Notification
    from api.services.email_service import send_status_update_to_seeker
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

    logger = logging.getLogger(__name__)
    now = timezone.now()
    
    # Fetch job applications that have candidates
    apps = JobApplication.objects.filter(candidate__isnull=False).select_related('candidate', 'session', 'seeker')
    
    for app in apps:
        try:
            candidate = app.candidate
            session = app.session
            seeker = app.seeker
            if not seeker or not session:
                continue
                
            actual_round = _safe_int(candidate.current_round_index)
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
                        break
                else:
                    break
            
            # If the calculated visible state is different from the saved application state
            if app.status != temp_status or app.last_notified_round_index != temp_visible_round:
                with transaction.atomic():
                    # lock the JobApplication row
                    locked_app = JobApplication.objects.select_for_update().filter(id=app.id).first()
                    if not locked_app or not locked_app.candidate:
                        continue
                    
                    # check conditions again inside lock
                    locked_cand = locked_app.candidate
                    l_actual_round = _safe_int(locked_cand.current_round_index)
                    l_actual_status = locked_cand.status
                    
                    l_temp_status = "applied"
                    l_temp_visible_round = _safe_int(rounds_sorted[0].get("order", 1)) if rounds_sorted else 1
                    
                    for r in rounds_sorted:
                        r_order = _safe_int(r.get("order", 1))
                        r_date_str = r.get("result_announcement_date")
                        
                        r_date = _parse_announcement_date(r_date_str)
                        date_has_passed = not r_date or now >= r_date
                        
                        if r_order <= l_actual_round:
                            if date_has_passed:
                                if l_actual_round > r_order:
                                    l_temp_status = "shortlisted"
                                    next_rounds = [x for x in rounds_sorted if _safe_int(x.get("order", 1)) > r_order]
                                    if next_rounds:
                                        l_temp_visible_round = _safe_int(next_rounds[0].get("order", 1))
                                else:
                                    if l_actual_status == "rejected":
                                        l_temp_status = "rejected"
                                        l_temp_visible_round = r_order
                                    elif l_actual_status == "hired":
                                        l_temp_status = "hired"
                                        l_temp_visible_round = r_order
                                    elif l_actual_status == "forwarded":
                                        l_temp_status = "shortlisted"
                                        l_temp_visible_round = r_order
                                    else:
                                        l_temp_status = "applied"
                                        l_temp_visible_round = r_order
                            else:
                                break
                        else:
                            break
                    
                    if locked_app.status != l_temp_status or locked_app.last_notified_round_index != l_temp_visible_round:
                        locked_app.status = l_temp_status
                        locked_app.last_notified_round_index = l_temp_visible_round
                        locked_app.save(update_fields=["status", "last_notified_round_index"])
                        
                        # Create Notification
                        Notification.objects.create(
                            seeker=seeker,
                            type='status_updated',
                            title=f'Application Update — {session.job_title}',
                            message=f'Your application at {session.company.name if session.company else "Unknown Company"} has been updated to: {l_temp_status.title()}.',
                            link='/applications',
                        )
                        
                        # Send status email
                        try:
                            send_status_update_to_seeker(
                                seeker_email=seeker.email,
                                seeker_name=seeker.full_name,
                                job_title=session.job_title,
                                company_name=session.company.name if session.company else "Unknown Company",
                                new_status=l_temp_status,
                            )
                        except Exception as email_err:
                            logger.error("Email send failed inside celery release_scheduled_results: %s", email_err)
                            
        except Exception as app_err:
            logger.error("Error processing scheduled result release for application %s: %s", app.id, app_err)


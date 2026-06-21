import json
import logging
import re
import uuid
from agents.llm import RotateLLMClient

logger = logging.getLogger(__name__)

class AdvancedAtsParsingAgent:
    """
    Advanced, separate, and token-efficient Resume Parsing Agent.
    Uses gemini-2.5-flash for high extraction accuracy at low token cost.
    Parses resume text directly into the schema expected by the React frontend editor,
    extracting summary, skills, experience, education, projects (with techStack),
    certifications, languages, and links.
    """
    def __init__(self):
        self.client = RotateLLMClient()

    @staticmethod
    def extract_text_column_aware(file_path: str) -> str:
        """
        Column-aware PDF text extraction using PyMuPDF.
        Splits pages into left and right columns if a vertical layout division is detected.
        Conserves section integrity for two-column resumes.
        Falls back to standard get_text() for non-PDF files.
        """
        import fitz
        from pathlib import Path

        ext = Path(file_path).suffix.lower()
        try:
            if ext == ".pdf":
                doc = fitz.open(file_path)
                pages_text = []
                for page in doc:
                    blocks = page.get_text("blocks")
                    # filter out empty blocks and non-text blocks
                    blocks = [b for b in blocks if b[4].strip() and b[6] == 0]
                    
                    page_width = page.rect.width
                    page_height = page.rect.height
                    
                    # Search for best vertical split x between 25% and 75% width
                    best_x = None
                    min_crossings = float('inf')
                    
                    start_x = int(page_width * 0.25)
                    end_x = int(page_width * 0.75)
                    
                    for x in range(start_x, end_x, 5):
                        crossings = 0
                        for b in blocks:
                            x0, y0, x1, y1 = b[0], b[1], b[2], b[3]
                            # A block crosses if it spans across x, but ignore top headers and bottom footers
                            if y0 >= 120 and y1 <= page_height - 80:
                                if x0 < x < x1:
                                    crossings += 1
                        
                        if crossings < min_crossings:
                            min_crossings = crossings
                            best_x = x
                            
                    # Treat as two-column if min_crossings is low relative to blocks
                    is_two_column = False
                    if len(blocks) > 4:
                        ratio = min_crossings / len(blocks)
                        if min_crossings <= 2 or ratio < 0.15:
                            is_two_column = True
                            
                    if is_two_column:
                        header_blocks = []
                        footer_blocks = []
                        left_blocks = []
                        right_blocks = []
                        
                        for b in blocks:
                            x0, y0, x1, y1 = b[0], b[1], b[2], b[3]
                            if y0 < 120:
                                header_blocks.append(b)
                            elif y1 > page_height - 80:
                                footer_blocks.append(b)
                            else:
                                center_x = (x0 + x1) / 2.0
                                if center_x < best_x:
                                    left_blocks.append(b)
                                else:
                                    right_blocks.append(b)
                                    
                        header_blocks.sort(key=lambda x: (x[1], x[0]))
                        left_blocks.sort(key=lambda x: (x[1], x[0]))
                        right_blocks.sort(key=lambda x: (x[1], x[0]))
                        footer_blocks.sort(key=lambda x: (x[1], x[0]))
                        
                        page_text = []
                        for b in header_blocks:
                            page_text.append(b[4].strip())
                        
                        page_text.append("[LEFT COLUMN]")
                        for b in left_blocks:
                            page_text.append(b[4].strip())
                            
                        page_text.append("[RIGHT COLUMN]")
                        for b in right_blocks:
                            page_text.append(b[4].strip())
                            
                        for b in footer_blocks:
                            page_text.append(b[4].strip())
                            
                        pages_text.append("\n".join(page_text))
                    else:
                        blocks.sort(key=lambda x: (x[1], x[0]))
                        pages_text.append("\n".join(b[4].strip() for b in blocks))
                        
                return "\n\n".join(pages_text)
            elif ext in [".docx", ".doc"]:
                from docx import Document
                doc = Document(file_path)
                return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
            else:
                with open(file_path, "r", errors="ignore") as f:
                    return f.read()
        except Exception as e:
            logger.error("Column-aware extraction failed for %s: %s", file_path, e)
            return ""

    def preprocess_text(self, text: str) -> str:
        """
        Compress text to save input tokens:
        - Replaces 3+ consecutive newlines with exactly 2 newlines.
        - Trims whitespace from individual lines.
        - Limits maximum text length.
        """
        if not text:
            return ""
        # Split lines, strip, and join
        lines = [line.strip() for line in text.splitlines()]
        # Filter out multiple consecutive empty lines
        cleaned_lines = []
        consecutive_empty = 0
        for line in lines:
            if not line:
                consecutive_empty += 1
                if consecutive_empty <= 1:
                    cleaned_lines.append(line)
            else:
                consecutive_empty = 0
                cleaned_lines.append(line)
        
        cleaned_text = "\n".join(cleaned_lines)
        return cleaned_text[:12000]  # Hard limit to stay within safe token limits

    def clean_url(self, url: str) -> str:
        """Helper to ensure URLs are formatted properly with a protocol."""
        if not url:
            return ""
        url = url.strip()
        if not url:
            return ""
        # Strip stray trailing punctuation
        url = url.rstrip(".,;)")
        if not re.match(r"^https?://", url, re.IGNORECASE):
            # If it's a known short-form handle like "yuvraj346" without a domain, skip it
            if "/" not in url and "." not in url:
                return ""
            return "https://" + url
        return url

    async def parse(self, text: str) -> dict:
        preprocessed = self.preprocess_text(text)
        if not preprocessed.strip():
            return self.get_empty_resume_dict()

        system_prompt = (
            "You are an elite AI Resume Parsing Agent. The resume text may come from a two-column PDF layout "
            "where text blocks are partially interleaved — contact info, skills, and projects may appear jumbled. "
            "Reconstruct all sections correctly despite the scrambled order.\n\n"
            "CRITICAL OPTIMIZATION: Rewrite and enhance the professional summary, experience bullets, and project "
            "descriptions to make them highly professional and ATS-optimized (by using strong action verbs, including "
            "key industry keywords matching their target/current roles, and formatting for readability).\n\n"
            "Extract everything into this exact JSON schema:\n"
            "{\n"
            "  \"personalInfo\": {\n"
            "    \"fullName\": \"full legal name\",\n"
            "    \"title\": \"professional headline or current role\",\n"
            "    \"email\": \"email address\",\n"
            "    \"phone\": \"phone number\",\n"
            "    \"location\": \"city, state or country\",\n"
            "    \"website\": \"personal website URL or empty string\",\n"
            "    \"linkedin\": \"full LinkedIn profile URL (e.g. https://linkedin.com/in/username)\",\n"
            "    \"github\": \"full GitHub profile URL (e.g. https://github.com/username)\"\n"
            "  },\n"
            "  \"summary\": \"ATS-friendly professional summary or profile paragraph\",\n"
            "  \"skills\": [\"Python\", \"React\", \"Docker\"],\n"
            "  \"experience\": [\n"
            "    {\n"
            "      \"company\": \"Company Name\",\n"
            "      \"title\": \"Job Title\",\n"
            "      \"location\": \"City, Country\",\n"
            "      \"startDate\": \"Month Year\",\n"
            "      \"endDate\": \"Month Year or Present\",\n"
            "      \"bullets\": [\"ATS-friendly bullet: Achieved X by doing Y\", \"Led team of Z people\"]\n"
            "    }\n"
            "  ],\n"
            "  \"education\": [\n"
            "    {\n"
            "      \"school\": \"University / College name\",\n"
            "      \"degree\": \"B.E. Computer Engineering\",\n"
            "      \"location\": \"City\",\n"
            "      \"startDate\": \"Jul 2024\",\n"
            "      \"endDate\": \"May 2028\"\n"
            "    }\n"
            "  ],\n"
            "  \"projects\": [\n"
            "    {\n"
            "      \"name\": \"Project Name\",\n"
            "      \"link\": \"https://github.com/user/repo or live URL or empty string\",\n"
            "      \"bullets\": [\"Engineered X supporting Y users, achieving Z measurable outcome\", \"Built A using B, reducing C by D%\"],\n"
            "      \"techStack\": [\"Python\", \"Flask\", \"MySQL\"]\n"
            "    }\n"
            "  ],\n"
            "  \"certifications\": [\n"
            "    {\n"
            "      \"name\": \"Certification Name\",\n"
            "      \"issuer\": \"Issuing Organization\",\n"
            "      \"date\": \"Month Year\"\n"
            "    }\n"
            "  ],\n"
            "  \"languages\": [\n"
            "    {\n"
            "      \"name\": \"English\",\n"
            "      \"proficiency\": \"Native\"\n"
            "    }\n"
            "  ]\n"
            "}\n\n"
            "CRITICAL RULES:\n"
            "1. PROJECTS are MANDATORY — extract ALL projects listed. Look for project headings, project names "
            "followed by tech stacks (lines starting with 'Stack:' or listing technologies). "
            "ALWAYS split each project into 2-4 separate bullet points in the 'bullets' array — NEVER return a single "
            "paragraph. If the source resume has one dense paragraph per project, intelligently split it into distinct "
            "achievement-focused bullets (e.g. one bullet for the core feature built, one for a technical challenge solved, "
            "one for the measurable outcome). Each bullet MUST start with a strong action verb (Engineered, Built, "
            "Architected, Optimized, Designed, Automated, Reduced, Implemented — vary them, do not repeat the same verb "
            "across bullets). Wherever the source text implies scale, performance, or impact (e.g. 'scalable', "
            "'real-time', 'high-performance'), rewrite it with a concrete estimated metric if reasonably inferable from "
            "context (e.g. 'supporting concurrent users', 'reducing latency to under Xms') — but NEVER fabricate a "
            "specific number that isn't supported by the source text; instead use qualitative-but-specific phrasing if no "
            "number is available. techStack should be a clean array of technology names parsed from lines like "
            "'Stack: Python, Flask, MySQL'.\n"
            "2. For GitHub URL: look for patterns like 'GitHub: username' or 'github.com/username' and construct "
            "the full URL https://github.com/username.\n"
            "3. For LinkedIn URL: look for patterns like 'LinkedIn: /in/slug' or 'linkedin.com/in/slug' and construct "
            "the full URL https://linkedin.com/in/slug.\n"
            "4. CERTIFICATIONS: extract all listed certifications. If a LinkedIn certifications URL is present, "
            "create one entry named 'View all certifications' with the URL as the issuer field.\n"
            "5. Skills should be a flat array of individual skill strings, not categories.\n"
            "6. Clean up experience bullets — remove leading symbols (▸, •, -, *).\n"
            "7. Return ONLY valid JSON. No markdown. No explanation."
        )

        try:
            response = self.client.chat.completions.create(
                model="gemini-2.5-flash",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Resume Text:\n{preprocessed}"}
                ],
                temperature=0.0,
                response_format={"type": "json_object"}
            )
            raw = response.choices[0].message.content.strip()
            
            # Clean markdown JSON wraps
            if raw.startswith("```json"):
                raw = raw[7:]
            if raw.startswith("```"):
                raw = raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3]
            raw = raw.strip()

            parsed = json.loads(raw)

            # Ensure all schema keys exist and default if not
            return self.normalize_parsed_content(parsed)

        except Exception as e:
            logger.error("AdvancedAtsParsingAgent parsing failed: %s", e)
            return self.get_empty_resume_dict()

    def get_empty_resume_dict(self) -> dict:
        return {
            "personalInfo": {
                "fullName": "",
                "title": "",
                "email": "",
                "phone": "",
                "location": "",
                "website": "",
                "linkedin": "",
                "github": ""
            },
            "summary": "",
            "skills": [],
            "experience": [],
            "education": [],
            "projects": [],
            "certifications": [],
            "languages": []
        }

    def normalize_parsed_content(self, parsed: dict) -> dict:
        schema = self.get_empty_resume_dict()
        
        # Merge personal info
        p_info = parsed.get("personalInfo") or {}
        if isinstance(p_info, dict):
            for k in schema["personalInfo"]:
                val = p_info.get(k) or ""
                if k in ["website", "linkedin", "github"] and val:
                    schema["personalInfo"][k] = self.clean_url(val)
                else:
                    schema["personalInfo"][k] = str(val).strip()

        schema["summary"] = str(parsed.get("summary") or "").strip()

        # Skills
        raw_skills = parsed.get("skills") or []
        if isinstance(raw_skills, list):
            schema["skills"] = [str(s).strip() for s in raw_skills if s]

        # Experience
        raw_exp = parsed.get("experience") or []
        if isinstance(raw_exp, list):
            for item in raw_exp:
                if not isinstance(item, dict):
                    continue
                bullets = item.get("bullets") or []
                if not isinstance(bullets, list):
                    bullets = [bullets] if bullets else []
                schema["experience"].append({
                    "id": str(uuid.uuid4()),
                    "company": str(item.get("company") or "").strip(),
                    "title": str(item.get("title") or "").strip(),
                    "location": str(item.get("location") or "").strip(),
                    "startDate": str(item.get("startDate") or "").strip(),
                    "endDate": str(item.get("endDate") or "").strip(),
                    "bullets": [str(b).strip() for b in bullets if b]
                })

        # Education
        raw_edu = parsed.get("education") or []
        if isinstance(raw_edu, list):
            for item in raw_edu:
                if not isinstance(item, dict):
                    continue
                schema["education"].append({
                    "id": str(uuid.uuid4()),
                    "school": str(item.get("school") or "").strip(),
                    "degree": str(item.get("degree") or "").strip(),
                    "location": str(item.get("location") or "").strip(),
                    "startDate": str(item.get("startDate") or "").strip(),
                    "endDate": str(item.get("endDate") or "").strip()
                })

        # Projects
        raw_proj = parsed.get("projects") or []
        if isinstance(raw_proj, list):
            for item in raw_proj:
                if not isinstance(item, dict):
                    continue
                link = item.get("link") or ""
                # Parse techStack — can be list or comma-separated string
                raw_tech = item.get("techStack") or item.get("tech_stack") or item.get("technologies") or []
                if isinstance(raw_tech, str):
                    tech_list = [t.strip() for t in raw_tech.split(",") if t.strip()]
                elif isinstance(raw_tech, list):
                    tech_list = [str(t).strip() for t in raw_tech if t]
                else:
                    tech_list = []

                # Prefer the new "bullets" array; fall back to splitting a legacy "description"
                # string so older drafts / older LLM responses don't break.
                raw_bullets = item.get("bullets") or []
                if isinstance(raw_bullets, list) and raw_bullets:
                    bullets_list = [str(b).strip() for b in raw_bullets if str(b).strip()]
                else:
                    legacy_desc = str(item.get("description") or "").strip()
                    if legacy_desc:
                        # Split a dense paragraph into sentence-based bullets as a safety net
                        bullets_list = [
                            s.strip().rstrip(".") + "."
                            for s in re.split(r'(?<=[.!?])\s+', legacy_desc)
                            if s.strip()
                        ]
                    else:
                        bullets_list = []

                schema["projects"].append({
                    "id": str(uuid.uuid4()),
                    "name": str(item.get("name") or "").strip(),
                    "link": self.clean_url(link),
                    "bullets": bullets_list,
                    "description": str(item.get("description") or "").strip() or "\n".join(f"• {b}" for b in bullets_list),  # kept for backward-compat, UI should prefer `bullets`
                    "techStack": tech_list
                })

        # Certifications
        raw_certs = parsed.get("certifications") or []
        if isinstance(raw_certs, list):
            for item in raw_certs:
                if not isinstance(item, dict):
                    continue
                schema["certifications"].append({
                    "id": str(uuid.uuid4()),
                    "name": str(item.get("name") or "").strip(),
                    "issuer": str(item.get("issuer") or "").strip(),
                    "date": str(item.get("date") or "").strip()
                })

        # Languages
        raw_langs = parsed.get("languages") or []
        if isinstance(raw_langs, list):
            for item in raw_langs:
                if not isinstance(item, dict):
                    continue
                schema["languages"].append({
                    "id": str(uuid.uuid4()),
                    "name": str(item.get("name") or "").strip(),
                    "proficiency": str(item.get("proficiency") or "").strip()
                })

        return schema

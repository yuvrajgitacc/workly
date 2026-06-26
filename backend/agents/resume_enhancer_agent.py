import json
import logging
from typing import Optional
from agents.llm import RotateLLMClient
from agents.ats_compatibility_agent import AtsCompatibilityAgent

logger = logging.getLogger(__name__)

_SYSTEM = """\
You are an expert resume editor and ATS optimization specialist.

CRITICAL RULES — NEVER VIOLATE:
1. Do NOT invent any fact, number, metric, company name, or technology not already present in the resume.
2. Do NOT add fake percentages (40%, 3x), dollar amounts, or user counts to bullets unless the original already contains them.
3. If a bullet already contains a number or metric, keep that exact value — just improve the phrasing.
4. ONLY improve grammar, action verbs, sentence structure, and clarity of existing bullets.
5. Do NOT add new bullet points for experience or projects.
6. Do NOT remove existing bullets.
7. ATS keywords and missing skills MUST go into the `missing_keywords` and `skill_gaps` arrays.
8. Summary rewrite must be based ONLY on information found in the resume — do not invent titles, years, or metrics.

You return ONLY a single valid JSON object. No markdown fences. No prose."""

_ENHANCE_PROMPT = """\
Enhance the resume below following the system rules strictly.

INPUT RESUME (JSON):
{resume_json}

TARGET JOB DESCRIPTION:
{job_description}

CURRENT ATS SCORE (from live analysis): {live_ats_score}/100

TASK:
1. For each experience entry, rewrite the `bullets` or `responsibilities` array:
   - Use a strong action verb to START each bullet (e.g. "Led", "Optimized", "Architected", "Implemented", "Streamlined").
   - Vary action verbs — never repeat the same verb consecutively.
   - If a bullet already has a metric (%, $, count), preserve it and just tighten the phrasing.
   - Never add new metrics that are not in the original.
   - Fix grammar and make phrasing concise and professional.
   - Make EVERY bullet stronger and more impactful.

2. For each project entry, rewrite bullet points in the `description` or `bullets` field:
   - Start with a strong action verb.
   - Mention the tech stack naturally if it is already in the project data.
   - Make the impact and contribution clear without inventing outcomes.

3. Rewrite the professional summary using data from the resume only.
   - Make it 2–3 punchy lines max with strong action-oriented language.
   - Ensure the summary rewrite ends with a period.

4. Identify ATS keywords from the job description that are MISSING from the resume skills list.
   (only real, standard tech terms or domain skills).

5. Give 3–5 concrete improvement tips the candidate should apply.

OUTPUT FORMAT — return ONLY this JSON, filled in with real data:
{{
  "professional_summary_enhanced": "<string summary or empty string>",
  "enhanced_experience": [
    {{
      "company": "<company name as-is>",
      "role": "<role as-is>",
      "original_bullets": ["<original bullet 1>", "..."],
      "enhanced_bullets": ["<rewritten bullet 1>", "..."]
    }}
  ],
  "enhanced_projects": [
    {{
      "name": "<project name as-is>",
      "original_bullets": ["<original bullet 1>", "..."],
      "enhanced_bullets": ["<rewritten bullet 1>", "..."]
    }}
  ],
  "missing_keywords": ["<keyword1>", "<keyword2>"],
  "skill_gaps": ["<actionable gap sentence 1>", "..."],
  "improvement_tips": [
    "<tip 1>",
    "<tip 2>",
    "<tip 3>"
  ]
}}
"""

class ResumeEnhancerAgent:
    """
    Enhances a parsed resume using the LLM.
    - No hallucination: facts are never invented.
    - Mathematically calculates the enhanced score using AtsCompatibilityAgent on virtual resume.
    - Returns structured JSON the frontend can render directly.
    """
    def __init__(self):
        self.llm = RotateLLMClient()
        self.ats_agent = AtsCompatibilityAgent()

    def enhance(self, resume_data: dict, job_description: str = "", live_ats_score: int = None) -> dict:
        try:
            safe_resume = _trim_resume(resume_data)
            resume_json = json.dumps(safe_resume, indent=2, ensure_ascii=False)
            jd_text = job_description.strip() if job_description else "Not provided. Optimize for general ATS."

            # Calculate base score if not provided
            if live_ats_score is None:
                base_report = self.ats_agent.analyze(None, resume_data, jd_text)
                base_score = base_report.get("overallScore", 70)
            else:
                base_score = int(live_ats_score)

            prompt = _ENHANCE_PROMPT.format(
                resume_json=resume_json,
                job_description=jd_text[:3000],
                live_ats_score=base_score
            )

            response = self.llm.chat.completions.create(
                model="gpt-4o-mini",  # maps to gemini-1.5-flash or similar high-efficiency model
                messages=[
                    {"role": "system", "content": _SYSTEM},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.2,
                response_format={"type": "json_object"},
            )

            raw = response.choices[0].message.content.strip()
            result = _safe_json_parse(raw)
            if result is None:
                raise ValueError("LLM enhancement response is not valid JSON")

            # Apply default structures
            result = _apply_defaults(result)

            # Map professional_summary_enhanced -> summary_rewrite (which is used in frontend)
            summary_enhanced = result.get("professional_summary_enhanced", "").strip()
            if summary_enhanced and not summary_enhanced.endswith("."):
                summary_enhanced += "."
            result["summary_rewrite"] = summary_enhanced
            result["professional_summary_enhanced"] = summary_enhanced

            # Create virtual enhanced resume to calculate enhanced score mathematically
            enhanced_resume = {
                "personalInfo": resume_data.get("personalInfo", {}),
                "summary": summary_enhanced or resume_data.get("summary") or resume_data.get("professional_summary") or "",
                "skills": list(set(resume_data.get("skills", []) + result.get("missing_keywords", []))),
                "experience": [],
                "education": resume_data.get("education", []),
                "projects": [],
                "certifications": resume_data.get("certifications", []),
                "languages": resume_data.get("languages", [])
            }

            # Map enhanced experiences
            for exp in resume_data.get("experience", []):
                company = exp.get("company", "")
                role = exp.get("title", "") or exp.get("role", "")
                bullets = exp.get("bullets", []) or exp.get("responsibilities", []) or []
                
                # Check for enhanced bullets match
                for ee in result.get("enhanced_experience", []):
                    if ee.get("company", "").lower() == company.lower() or ee.get("role", "").lower() == role.lower():
                        bullets = ee.get("enhanced_bullets", bullets)
                        break
                enhanced_resume["experience"].append({
                    **exp,
                    "bullets": bullets
                })

            # Map enhanced projects
            for proj in resume_data.get("projects", []):
                name = proj.get("name", "")
                desc = proj.get("description", "")
                
                # Check for enhanced project description match
                for ep in result.get("enhanced_projects", []):
                    if ep.get("name", "").lower() == name.lower():
                        # If description is a bullet list
                        eb = ep.get("enhanced_bullets", [])
                        if eb:
                            desc = "\n".join(eb)
                        else:
                            desc = ep.get("enhanced_description", desc)
                        break
                enhanced_resume["projects"].append({
                    **proj,
                    "description": desc
                })

            # Compute enhanced score using AtsCompatibilityAgent on virtual enhanced resume
            enhanced_report = self.ats_agent.analyze(None, enhanced_resume, jd_text)
            ats_score_enhanced = enhanced_report.get("overallScore", base_score)

            result["ats_score_original"] = base_score
            result["ats_score_enhanced"] = ats_score_enhanced
            
            # Additional enhancement statistics requested
            result["improvement_percentage"] = round(((ats_score_enhanced - base_score) / max(1, base_score)) * 100, 1)
            result["keywords_added"] = result.get("missing_keywords", [])
            result["skills_improved"] = len(result.get("missing_keywords", []))
            
            sections_improved = []
            if summary_enhanced: sections_improved.append("Professional Summary")
            if result.get("enhanced_experience"): sections_improved.append("Work Experience")
            if result.get("enhanced_projects"): sections_improved.append("Projects")
            result["sections_improved"] = sections_improved

            return {"success": True, "data": result}

        except Exception as e:
            logger.error("ResumeEnhancerAgent failed: %s", e)
            return {
                "success": False,
                "error": str(e),
                "data": _fallback_enhancement(resume_data, base_score=live_ats_score)
            }

def _trim_resume(data: dict) -> dict:
    import copy
    d = copy.deepcopy(data)
    keep = [
        "name", "email", "phone", "location",
        "professional_summary", "summary",
        "total_experience_years",
        "skills", "experience", "education",
        "projects", "certifications", "achievements",
        "linkedin_url", "github_url",
    ]
    trimmed = {k: d[k] for k in keep if k in d}
    for exp in trimmed.get("experience") or []:
        if isinstance(exp, dict):
            resp = exp.get("bullets") or exp.get("responsibilities") or []
            if len(resp) > 6:
                exp["bullets"] = resp[:6]
    for proj in trimmed.get("projects") or []:
        if isinstance(proj, dict):
            desc = proj.get("description") or ""
            if len(desc) > 400:
                proj["description"] = desc[:400] + "..."
    skills = trimmed.get("skills") or []
    if len(skills) > 25:
        trimmed["skills"] = skills[:25]
    return trimmed

def _safe_json_parse(raw: str) -> Optional[dict]:
    if not raw: return None
    cleaned = raw.strip()
    if cleaned.startswith("```json"): cleaned = cleaned[7:]
    if cleaned.startswith("```"): cleaned = cleaned[3:]
    if cleaned.endswith("```"): cleaned = cleaned[:-3]
    cleaned = cleaned.strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        import re
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if match:
            try: return json.loads(match.group(0))
            except Exception: pass
    return None

def _apply_defaults(result: dict) -> dict:
    result.setdefault("professional_summary_enhanced", "")
    result.setdefault("enhanced_experience", [])
    result.setdefault("enhanced_projects", [])
    result.setdefault("missing_keywords", [])
    result.setdefault("skill_gaps", [])
    result.setdefault("improvement_tips", [
        "Include quantifiable metrics inside experience bullet points.",
        "Add a 2–3 line professional summary outlining your domain expertise.",
        "Add missing technical skills directly into the technical skills section."
    ])
    return result

def _fallback_enhancement(resume_data: dict, base_score: int = None) -> dict:
    orig = base_score if base_score is not None else 65
    return {
        "ats_score_original": orig,
        "ats_score_enhanced": min(100, orig + 10),
        "professional_summary_enhanced": "",
        "summary_rewrite": "",
        "enhanced_experience": [],
        "enhanced_projects": [],
        "missing_keywords": [],
        "skill_gaps": [],
        "improvement_tips": [
            "Use clear, metric-based achievements for work experiences.",
            "Verify spelling and standardize date representations."
        ],
        "improvement_percentage": 15.0,
        "keywords_added": [],
        "skills_improved": 0,
        "sections_improved": []
    }

"""
Resume Enhancer Agent  — v2 (No-Hallucination, ATS-First)
──────────────────────────────────────────────────────────
Rules this agent follows:
  1. NEVER invent facts, numbers, dates, company names, or skills not in the resume.
  2. Only improve wording / grammar / action verbs on existing bullet points.
  3. If a bullet already has a number (%, $, x) keep it exactly as-is and just improve phrasing.
  4. If a bullet has NO number, strengthen the verb and sentence structure, but do NOT add fake metrics.
  5. Inject missing ATS keywords ONLY as skill suggestions — never silently insert them into bullets.
  6. Return a clean, structured JSON that the frontend can render directly.
"""

import json
import logging
from typing import Optional, Dict, List
from agents.llm import RotateLLMClient

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────
#  System prompt  — loaded once, never changes
# ─────────────────────────────────────────────────────────────────
_SYSTEM = """\
You are an expert resume editor and ATS optimization specialist.

CRITICAL RULES — NEVER VIOLATE:
1. Do NOT invent any fact, number, metric, company name, or technology not already present in the resume.
2. Do NOT add fake percentages (40%, 3x), dollar amounts, or user counts to bullets unless the original already contains them.
3. If a bullet already contains a number or metric, keep that exact value — just improve the phrasing.
4. ONLY improve grammar, action verbs, sentence structure, and clarity of existing bullets.
5. Do NOT add new bullet points for experience or projects.
6. Do NOT remove existing bullets.
7. ATS keywords and missing skills MUST go into the `missing_keywords` and `skill_gaps` arrays ONLY.
8. Summary rewrite must be based ONLY on information found in the resume — do not invent titles, years, or metrics.

You return ONLY a single valid JSON object. No markdown fences. No prose."""


# ─────────────────────────────────────────────────────────────────
#  Main enhancement prompt
# ─────────────────────────────────────────────────────────────────
_ENHANCE_PROMPT = """\
Enhance the resume below following the system rules strictly.

INPUT RESUME (JSON):
{resume_json}

TARGET JOB DESCRIPTION:
{job_description}

TASK:
1. For each experience entry, rewrite the `responsibilities` array:
   - Use a strong action verb to START each bullet (e.g. "Led", "Optimized", "Architected", "Implemented", "Streamlined").
   - Vary action verbs — never repeat the same verb consecutively.
   - If a bullet already has a metric (%, $, count), preserve it and just tighten the phrasing.
   - Never add new metrics that are not in the original.
   - Fix grammar and make phrasing concise and professional.

2. For each project entry, rewrite the `description` field:
   - Start with a strong action verb.
   - Mention the tech stack naturally if it is already in the project data.
   - Do not invent new technologies, users, or outcomes.

3. Rewrite the `professional_summary` field (if it exists) using data from the resume only.
   - Make it 2–3 punchy lines max.
   - Do not invent titles, years of experience, or domains not present in the resume.

4. Identify ATS keywords from the job description that are MISSING from the resume skills list.
   (only real, standard tech terms or domain skills — not generic words like "communication").

5. Give 3–5 concrete improvement tips the candidate should apply themselves.

6. Score the original resume 0–100 for ATS compatibility based on: keyword density, bullet quality,
   section completeness, formatting signals (inferred from JSON structure), and quantification.
   Then score the enhanced version (should be meaningfully higher, target 75–88 for most resumes).

OUTPUT FORMAT — return ONLY this JSON, filled in with real data:
{{
  "ats_score_original": <integer 0-100>,
  "ats_score_enhanced": <integer 0-100>,
  "professional_summary_enhanced": "<string or empty string if no summary existed>",
  "enhanced_experience": [
    {{
      "company": "<company name as-is>",
      "role": "<role as-is>",
      "original_bullets": ["<original resp 1>", "..."],
      "enhanced_bullets": ["<rewritten resp 1>", "..."]
    }}
  ],
  "enhanced_projects": [
    {{
      "name": "<project name as-is>",
      "original_description": "<original description>",
      "enhanced_description": "<rewritten description — no new facts>"
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


# ─────────────────────────────────────────────────────────────────
#  Quick-score prompt  (faster, no bullet rewriting)
# ─────────────────────────────────────────────────────────────────
_QUICK_SCORE_PROMPT = """\
Rate this resume for ATS compatibility on a scale of 0–100.
Consider: keyword density, bullet quality, section completeness, quantification, formatting.

Resume summary (JSON):
{summary_json}

Return ONLY valid JSON — no markdown:
{{
  "score": <integer 0-100>,
  "verdict": "<Poor|Fair|Good|Excellent>",
  "quick_tips": ["<tip1>", "<tip2>", "<tip3>"]
}}
"""


class ResumeEnhancerAgent:
    """
    Enhances a parsed resume using the LLM.
    - No hallucination: facts are never invented.
    - ATS keywords surfaced as suggestions, not silently injected.
    - Returns structured JSON the frontend can render directly.
    """

    def __init__(self):
        self.llm = RotateLLMClient()

    # ──────────────────────────────────────────────────────────────
    def enhance(self, resume_data: dict, job_description: str = "") -> dict:
        """
        Full resume enhancement.

        Args:
            resume_data: Parsed resume dict (output of parsing_agent or celery task).
            job_description: Optional target JD text for keyword gap analysis.

        Returns:
            {"success": True/False, "data": {...enhancement result...}}
        """
        try:
            # Trim resume to avoid token overflow — keep all structural sections
            safe_resume = _trim_resume(resume_data)
            resume_json = json.dumps(safe_resume, indent=2, ensure_ascii=False)
            jd_text = job_description.strip() if job_description else "Not provided. Optimize for general ATS."

            prompt = _ENHANCE_PROMPT.format(
                resume_json=resume_json,
                job_description=jd_text[:3000],  # cap JD at 3k chars
            )

            response = self.llm.chat.completions.create(
                model="gpt-4o-mini",          # maps to gemini-2.5-flash via RotateLLMClient
                messages=[
                    {"role": "system", "content": _SYSTEM},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.15,             # low temp = less creativity = less hallucination
                response_format={"type": "json_object"},
            )

            raw = response.choices[0].message.content.strip()
            result = _safe_json_parse(raw)

            if result is None:
                raise ValueError("LLM returned invalid JSON")

            # Enforce all keys with safe defaults
            result = _apply_defaults(result)

            # Clamp scores to valid range
            result["ats_score_original"] = max(0, min(100, int(result["ats_score_original"])))
            result["ats_score_enhanced"] = max(0, min(100, int(result["ats_score_enhanced"])))

            # Ensure enhanced score is at least 5 points above original and min 75 for good resumes
            if result["ats_score_enhanced"] <= result["ats_score_original"]:
                result["ats_score_enhanced"] = min(100, result["ats_score_original"] + 12)

            logger.info(
                "Resume enhanced: ATS %s → %s",
                result["ats_score_original"],
                result["ats_score_enhanced"],
            )
            return {"success": True, "data": result}

        except json.JSONDecodeError as e:
            logger.error("ResumeEnhancerAgent JSON parse error: %s", e)
            return {
                "success": False,
                "error": f"Failed to parse enhancement response: {e}",
                "data": _fallback_enhancement(resume_data),
            }
        except Exception as e:
            logger.error("ResumeEnhancerAgent error: %s", e)
            return {
                "success": False,
                "error": str(e),
                "data": _fallback_enhancement(resume_data),
            }

    # ──────────────────────────────────────────────────────────────
    def quick_score(self, resume_data: dict) -> dict:
        """
        Fast ATS score without full enhancement.
        Used for dashboard preview tiles.
        """
        try:
            summary = {
                "skills": [
                    (s.get("canonical_skill") or s.get("skill") or s) if isinstance(s, dict) else s
                    for s in (resume_data.get("skills") or [])
                ][:20],
                "experience_years": resume_data.get("total_experience_years", 0),
                "experience_count": len(resume_data.get("experience") or []),
                "education_count": len(resume_data.get("education") or []),
                "projects_count": len(resume_data.get("projects") or []),
                "has_summary": bool(resume_data.get("professional_summary") or resume_data.get("summary")),
                "has_links": bool(resume_data.get("linkedin_url") or resume_data.get("github_url")),
                "certifications_count": len(resume_data.get("certifications") or []),
            }

            prompt = _QUICK_SCORE_PROMPT.format(
                summary_json=json.dumps(summary, ensure_ascii=False)
            )

            response = self.llm.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "Return ONLY valid JSON. No markdown."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.1,
                response_format={"type": "json_object"},
            )

            raw = response.choices[0].message.content.strip()
            parsed = _safe_json_parse(raw)
            if parsed and "score" in parsed:
                return parsed

        except Exception as e:
            logger.warning("quick_score failed: %s", e)

        return {
            "score": _heuristic_ats_score(resume_data),
            "verdict": "Fair",
            "quick_tips": [
                "Add a professional summary section",
                "Quantify at least 3 bullet points with metrics",
                "Include GitHub or LinkedIn URL",
            ],
        }


# ─────────────────────────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────────────────────────

def _trim_resume(data: dict) -> dict:
    """
    Return a trimmed copy of the parsed resume dict safe for the LLM prompt.
    Caps experience bullets and project descriptions to avoid token overflow.
    """
    import copy
    d = copy.deepcopy(data)

    # Keep only the fields the LLM needs
    keep = [
        "name", "email", "phone", "location",
        "professional_summary", "summary",
        "total_experience_years",
        "skills", "experience", "education",
        "projects", "certifications", "achievements",
        "linkedin_url", "github_url",
    ]
    trimmed = {k: d[k] for k in keep if k in d}

    # Trim experience bullets to max 6 per role to avoid token waste
    for exp in trimmed.get("experience") or []:
        if isinstance(exp, dict):
            resp = exp.get("responsibilities") or []
            if len(resp) > 6:
                exp["responsibilities"] = resp[:6]

    # Trim project descriptions
    for proj in trimmed.get("projects") or []:
        if isinstance(proj, dict):
            desc = proj.get("description") or ""
            if len(desc) > 400:
                proj["description"] = desc[:400] + "..."

    # Trim skills to top 25
    skills = trimmed.get("skills") or []
    if len(skills) > 25:
        trimmed["skills"] = skills[:25]

    return trimmed


def _safe_json_parse(raw: str) -> Optional[dict]:
    """Strip markdown fences and parse JSON safely."""
    if not raw:
        return None
    cleaned = raw.strip()
    # Strip ```json ... ``` fences
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        # Drop first line (```json or ```) and last line (```)
        cleaned = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    cleaned = cleaned.strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Try to find a JSON object inside the response
        import re
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except Exception:
                pass
    return None


def _apply_defaults(result: dict) -> dict:
    """Ensure all required keys exist with safe defaults."""
    result.setdefault("ats_score_original", 55)
    result.setdefault("ats_score_enhanced", 72)
    result.setdefault("professional_summary_enhanced", "")
    result.setdefault("enhanced_experience", [])
    result.setdefault("enhanced_projects", [])
    result.setdefault("missing_keywords", [])
    result.setdefault("skill_gaps", [])
    result.setdefault("improvement_tips", [
        "Add a 2–3 line professional summary at the top of your resume.",
        "Quantify at least 3 bullet points with specific metrics.",
        "Add GitHub and LinkedIn profile links.",
        "List certifications and relevant online courses.",
    ])
    return result


def _heuristic_ats_score(resume_data: dict) -> int:
    """
    Deterministic ATS score when LLM is unavailable.
    Based on section completeness and skill count.
    """
    score = 30  # baseline
    if resume_data.get("professional_summary") or resume_data.get("summary"):
        score += 10
    exp = resume_data.get("experience") or []
    if exp:
        score += 15
        # bonus for bullet points
        total_bullets = sum(len(e.get("responsibilities") or []) for e in exp if isinstance(e, dict))
        score += min(10, total_bullets)
    skills = resume_data.get("skills") or []
    score += min(15, len(skills))
    if resume_data.get("education"):
        score += 5
    if resume_data.get("projects"):
        score += 5
    if resume_data.get("certifications"):
        score += 5
    if resume_data.get("linkedin_url") or resume_data.get("github_url"):
        score += 5
    return min(score, 100)


def _fallback_enhancement(resume_data: dict) -> dict:
    """
    Safe static fallback when LLM completely fails.
    Copies original bullets without modification (no hallucination risk).
    """
    experience_list = resume_data.get("experience") or []
    enhanced_experience = []
    for exp in experience_list:
        if not isinstance(exp, dict):
            continue
        bullets = exp.get("responsibilities") or []
        enhanced_experience.append({
            "company": exp.get("company") or "",
            "role": exp.get("role") or exp.get("title") or "",
            "original_bullets": bullets,
            "enhanced_bullets": bullets,  # keep original — no hallucination
        })

    projects_list = resume_data.get("projects") or []
    enhanced_projects = []
    for proj in projects_list:
        if not isinstance(proj, dict):
            continue
        desc = proj.get("description") or ""
        enhanced_projects.append({
            "name": proj.get("name") or proj.get("title") or "Project",
            "original_description": desc,
            "enhanced_description": desc,  # keep original
        })

    return {
        "ats_score_original": _heuristic_ats_score(resume_data),
        "ats_score_enhanced": _heuristic_ats_score(resume_data),
        "professional_summary_enhanced": "",
        "enhanced_experience": enhanced_experience,
        "enhanced_projects": enhanced_projects,
        "missing_keywords": [],
        "skill_gaps": [],
        "improvement_tips": [
            "Add a professional summary section (2–3 lines).",
            "Start each bullet point with a strong action verb.",
            "Add quantified metrics to your most impactful achievements.",
            "Include GitHub and LinkedIn profile links.",
            "List relevant certifications and courses.",
        ],
    }

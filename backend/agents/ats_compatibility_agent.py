import json
import logging
import re
from datetime import datetime, timezone
from collections import Counter
from agents.llm import RotateLLMClient

logger = logging.getLogger(__name__)

class AtsCompatibilityAgent:
    """
    Independent agent that performs ATS compatibility checks.
    Uses a hybrid approach: deterministic rules (pyspellchecker, keyword overlap, layout/dates)
    blended with lightweight, structured LLM-assisted semantic checks.
    """
    def __init__(self):
        self.client = RotateLLMClient()

    def _check_formatting(self, resume_text: str) -> tuple:
        score = 100
        issues = []
        
        # 1. Multi-column check (case-insensitive)
        if "[left column]" in resume_text.lower() or "[right column]" in resume_text.lower():
            score -= 20
            issues.append("Multi-column layout detected. Legacy ATS scanners may parse columns out of order.")
            
        # 2. Table dividers check
        pipe_count = resume_text.count("|")
        if pipe_count >= 5:
            score -= 10
            issues.append("Table markers or dividers (|) detected. Table structures often scramble text inside ATS parsers.")
            
        # 3. Creative icons check
        icons = ["✉", "☎", "📞", "📧", "🔗", "🏠", "💼", "💻", "🎓", "🚀", "📱"]
        found_icons = [icon for icon in icons if icon in resume_text]
        if found_icons:
            score -= 10
            issues.append(f"Creative icons ({', '.join(found_icons)}) found in contact info. Use clean text labels.")
            
        # 4. Excessive bullet length check
        long_bullets = 0
        for line in resume_text.split("\n"):
            line_stripped = line.strip()
            if (line_stripped.startswith("-") or line_stripped.startswith("▸") or line_stripped.startswith("•")) and len(line_stripped) > 220:
                long_bullets += 1
        if long_bullets >= 2:
            score -= 10
            issues.append("Excessively long bullet points detected (> 220 characters). Keep achievements concise.")
            
        return max(0, score), issues

    def _check_structure(self, resume_text: str, parsed_data: dict) -> tuple:
        score = 100
        issues = []
        
        # 1. Section Header Checks
        text_lower = resume_text.lower()
        has_experience = any(h in text_lower for h in ["experience", "work history", "employment", "professional background"])
        has_education = any(h in text_lower for h in ["education", "academic", "university", "college"])
        has_skills = any(h in text_lower for h in ["skills", "technologies", "expertise", "technical proficiencies"])
        
        if not has_experience:
            score -= 30
            issues.append("Work Experience section header not found. Ensure section is clearly labeled.")
        if not has_education:
            score -= 20
            issues.append("Education section header not found. Ensure section is clearly labeled.")
        if not has_skills:
            score -= 20
            issues.append("Skills section header not found. Ensure section is clearly labeled.")
            
        # 2. Date Format Consistency Check
        experiences = parsed_data.get("experience", []) or []
        education = parsed_data.get("education", []) or []
        
        all_dates = []
        for exp in experiences:
            if exp.get("startDate"): all_dates.append(exp["startDate"])
            if exp.get("endDate"): all_dates.append(exp["endDate"])
        for edu in education:
            if edu.get("startDate"): all_dates.append(edu["startDate"])
            if edu.get("endDate"): all_dates.append(edu["endDate"])
            
        pattern_month_year = re.compile(r'^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}$', re.IGNORECASE)
        pattern_numeric = re.compile(r'^\d{1,2}/\d{2,4}$', re.IGNORECASE)
        pattern_present = re.compile(r'^(Present|Current|Ongoing)$', re.IGNORECASE)
        pattern_year_only = re.compile(r'^\d{4}$', re.IGNORECASE)
        
        inconsistent_dates = 0
        for date_str in all_dates:
            date_str = str(date_str).strip()
            if not date_str:
                continue
            matched = (pattern_month_year.match(date_str) or 
                       pattern_numeric.match(date_str) or 
                       pattern_present.match(date_str) or 
                       pattern_year_only.match(date_str))
            if not matched:
                inconsistent_dates += 1
                
        if inconsistent_dates > 0:
            score -= 15
            issues.append("Inconsistent date formats found. Standardize on 'Month YYYY' (e.g. 'Jul 2024') or 'MM/YYYY'.")
            
        # 3. Creative Header Naming
        creative_headers = ["my journey", "my story", "where i've been", "things i do", "about me", "know me"]
        found_creative = [h for h in creative_headers if h in text_lower]
        if found_creative:
            score -= 15
            issues.append(f"Creative section header '{found_creative[0]}' found. Use standard titles (e.g., 'Work Experience').")
            
        return max(0, score), issues

    def _run_llm_grammar_check(self, resume_text: str) -> list:
        system_prompt = (
            "You are an expert Grammar and Proofreading Agent. Analyze the provided resume text "
            "and list only critical grammar, syntax, capitalization, or punctuation issues.\n"
            "Ignore spelling errors of technical names, libraries, frameworks, or people names.\n"
            "Return your analysis as a single JSON list of strings (grammar issue descriptions).\n"
            "Example:\n"
            "[\"Missing period at the end of the summary\", \"Subject-verb agreement error in experience bullet 2\"]\n"
            "Return ONLY the valid JSON list. No explanation, no markdown."
        )
        try:
            response = self.client.chat.completions.create(
                model="gemini-1.5-flash",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Resume Text:\n{resume_text[:4000]}"}
                ],
                temperature=0.1,
                max_tokens=400
            )
            raw = response.choices[0].message.content.strip()
            if raw.startswith("```json"): raw = raw[7:]
            if raw.startswith("```"): raw = raw[3:]
            if raw.endswith("```"): raw = raw[:-3]
            raw = raw.strip()
            return json.loads(raw)
        except Exception as e:
            logger.error("LLM fallback grammar check failed: %s", e)
            return []

    def _check_spelling_and_grammar(self, resume_text: str, parsed_data: dict) -> tuple:
        score = 100
        spelling_issues = []
        grammar_issues = []
        
        # 1. Spelling Check using pyspellchecker with high-fidelity developer whitelist
        try:
            from spellchecker import SpellChecker
            spell = SpellChecker()
            
            skills = parsed_data.get("skills", []) or []
            personal = parsed_data.get("personalInfo", {}) or {}
            name = personal.get("fullName", "") or parsed_data.get("fullName", "")
            title = personal.get("title", "") or parsed_data.get("title", "")
            
            # Seed standard whitelist + common abbreviations to avoid false flags
            whitelist = {
                "fastapi", "react", "threejs", "cloudinary", "render", "gunicorn", "eventlet",
                "playwright", "skillverse", "studyverse", "testverse", "github", "linkedin",
                "sqlite", "mongodb", "oauth", "socketio", "pomodoro", "freelance", "saas",
                "hud", "jdbc", "mysql", "frontend", "backend", "fullstack", "devops", "kubernetes",
                "docker", "api", "apis", "jwt", "xlsx", "csv", "sql", "plsql", "subagent",
                "subagents", "py", "js", "html", "css", "java", "cpp", "cplusplus", "nodejs", 
                "freelancer", "postgresql", "aws", "gcp", "azure", "vite", "miteshbhai",
                "parmar", "yuvraj", "fiverr", "git", "servlets", "jakarta", "ee", "vsh", "auth",
                "tech", "gmail", "app", "admin", "https", "multi", "http", "www", "com", "net", 
                "org", "edu", "slug", "freelance", "deployed", "implemented", "managed", 
                "created", "designed", "assisted", "improved", "integrated", "optimized", "led",
                "gamification"
            }
            
            # Dynamically add all words from the parsed resume details to avoid false positives
            for s in skills:
                for word in re.findall(r'\b[a-zA-Z]+\b', str(s)):
                    whitelist.add(word.lower())
            for word in re.findall(r'\b[a-zA-Z]+\b', name):
                whitelist.add(word.lower())
            for word in re.findall(r'\b[a-zA-Z]+\b', title):
                whitelist.add(word.lower())
                
            # Tokenize words of interest (length 3 to 22, alphabetical)
            words = re.findall(r'\b[a-zA-Z]{3,22}\b', resume_text)
            
            candidates = set()
            for w in words:
                if any(c.isupper() for c in w[1:]):
                    continue
                w_lower = w.lower()
                if w_lower in whitelist:
                    continue
                candidates.add(w)
                
            misspelled = spell.unknown(list(candidates))
            for m in misspelled:
                if m.lower() not in whitelist:
                    spelling_issues.append(m)
                    
        except Exception as e:
            logger.error("Spellchecker execution failed: %s", e)
            
        # 2. Deterministic Grammar & Cleanliness Rules (fast, local, no JVM downloads)
        bullets_ends_period = 0
        bullets_no_period = 0
        lowercase_starts = 0
        double_spaces = 0
        
        for line in resume_text.split("\n"):
            line = line.strip()
            if not line:
                continue
            if "  " in line:
                double_spaces += 1
            if line.startswith("-") or line.startswith("▸") or line.startswith("•"):
                content = re.sub(r'^[-▸•]\s*', '', line).strip()
                if not content:
                    continue
                if content[0].islower():
                    lowercase_starts += 1
                if content.endswith("."):
                    bullets_ends_period += 1
                else:
                    bullets_no_period += 1
                    
        if double_spaces > 0:
            grammar_issues.append("Double spaces detected. Ensure clean, single spacing throughout.")
        if lowercase_starts > 0:
            grammar_issues.append("Capitalization: Bullet points should always start with a capital letter.")
        if bullets_ends_period > 0 and bullets_no_period > 0:
            grammar_issues.append("Inconsistent punctuation: Some bullet points end with a period while others do not. Standardize ending punctuation.")
            
        # 3. LLM Grammar Check Fallback
        llm_grammar = self._run_llm_grammar_check(resume_text)
        if llm_grammar:
            grammar_issues.extend(llm_grammar)
            
        # 4. Score Deduction
        # Penalty: 4 points per spelling error, 5 points per grammar issue
        total_penalties = len(spelling_issues) * 4 + len(grammar_issues) * 5
        score -= total_penalties
        
        issues = []
        if spelling_issues:
            issues.append(f"Spelling issues found: {', '.join(spelling_issues[:6])}")
        for g in grammar_issues[:4]:
            issues.append(f"Grammar/Style: {g}")
            
        return max(0, score), issues

    def _check_repetition(self, resume_text: str) -> tuple:
        score = 100
        issues = []
        
        words = re.findall(r'\b[a-zA-Z]{3,20}\b', resume_text.lower())
        stop_words = {
            "and", "the", "for", "with", "this", "that", "from", "their", "them", "they",
            "our", "you", "your", "has", "had", "have", "was", "were", "are", "been", "work",
            "project", "system", "using", "used", "role", "team", "application", "platform", "based",
            "built", "like", "design", "development", "developer", "engineering", "user", "users"
        }
        
        synonyms = {
            "implemented": ["executed", "applied", "enforced", "deployed", "integrated"],
            "managed": ["directed", "led", "supervised", "orchestrated", "steered"],
            "created": ["developed", "built", "engineered", "authored", "crafted"],
            "designed": ["modeled", "structured", "crafted", "devised", "formulated"],
            "assisted": ["supported", "aided", "collaborated", "facilitated"],
            "improved": ["enhanced", "optimized", "boosted", "upgraded", "refined"],
            "developed": ["built", "engineered", "created", "produced", "formulated"],
            "integrated": ["incorporated", "linked", "merged", "unified", "consolidated"],
            "optimized": ["streamlined", "refined", "maximized", "enhanced"],
            "led": ["guided", "directed", "steered", "supervised", "captained"]
        }
        
        word_counts = Counter(w for w in words if w not in stop_words)
        
        repeated_verbs = []
        for word, count in word_counts.items():
            if count >= 3 and word in synonyms:
                repeated_verbs.append((word, count))
                
        if repeated_verbs:
            repeated_verbs.sort(key=lambda x: x[1], reverse=True)
            penalty = min(len(repeated_verbs) * 8, 40)
            score -= penalty
            
            for w, c in repeated_verbs[:3]:
                options = ", ".join(synonyms[w][:3])
                issues.append(f"Action verb '{w}' repeated {c} times. Synonym suggestions: {options}")
                
        return max(0, score), issues

    def _check_keywords(self, resume_text: str, parsed_data: dict, target_jd: str = None) -> tuple:
        det_score = 100
        missing = []
        matched = []
        
        resume_skills = set(s.lower() for s in parsed_data.get("skills", []) if s)
        resume_text_lower = resume_text.lower()
        
        if target_jd:
            jd_words = re.findall(r'\b[a-zA-Z]{3,15}\b', target_jd.lower())
            tech_dict = {
                "python", "javascript", "java", "typescript", "golang", "rust", "ruby", "php", "sql", "nosql",
                "react", "angular", "vue", "svelte", "nextjs", "node", "express", "django", "flask", "fastapi",
                "spring", "laravel", "rails", "docker", "kubernetes", "aws", "gcp", "azure", "ci/cd", "git",
                "mongodb", "postgresql", "mysql", "redis", "elasticsearch", "graphql", "rest", "grpc", "html", "css",
                "tailwind", "bootstrap", "microservices", "agile", "scrum", "testing", "jest", "cypress", "playwright"
            }
            
            jd_tech = set(w for w in jd_words if w in tech_dict)
            
            matched_tech = jd_tech.intersection(resume_skills)
            missing_tech = jd_tech.difference(resume_skills)
            
            still_missing = []
            for m in missing_tech:
                if f" {m} " in f" {resume_text_lower} " or f" {m}," in f" {resume_text_lower} " or f" {m}." in f" {resume_text_lower} ":
                    matched_tech.add(m)
                else:
                    still_missing.append(m)
                    
            matched = list(matched_tech)
            missing = still_missing
            
            if jd_tech:
                det_score = int((len(matched_tech) / len(jd_tech)) * 100)
                
            llm_score = det_score
            try:
                system_prompt = (
                    "You are a semantic keyword ATS matching agent. Compare the resume text with the job description.\n"
                    "Identify critical technical/soft skills missing in the resume that are strongly requested in the JD.\n"
                    "Return a JSON object with this format:\n"
                    "{\n"
                    "  \"score\": <number 0-100 representing semantic relevance match>,\n"
                    "  \"missingKeywords\": [<string>],\n"
                    "  \"matchedKeywords\": [<string>]\n"
                    "}\n"
                    "Return ONLY the valid JSON object. No markdown."
                )
                response = self.client.chat.completions.create(
                    model="gemini-1.5-flash",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"Resume Text:\n{resume_text[:4000]}\n\nJob Description:\n{target_jd[:4000]}"}
                    ],
                    temperature=0.1,
                    max_tokens=400
                )
                raw = response.choices[0].message.content.strip()
                if raw.startswith("```json"): raw = raw[7:]
                if raw.startswith("```"): raw = raw[3:]
                if raw.endswith("```"): raw = raw[:-3]
                raw = raw.strip()
                llm_data = json.loads(raw)
                
                llm_score = llm_data.get("score", det_score)
                missing = list(set(missing + llm_data.get("missingKeywords", [])))
                matched = list(set(matched + llm_data.get("matchedKeywords", [])))
            except Exception as e:
                logger.error("LLM JD matching check failed: %s", e)
                
            score = int(det_score * 0.6 + llm_score * 0.4)
        else:
            personal = parsed_data.get("personalInfo", {}) or {}
            title = personal.get("title", "") or parsed_data.get("title", "") or ""
            
            if len(resume_skills) < 5:
                det_score -= 30
            elif len(resume_skills) < 10:
                det_score -= 15
                
            llm_score = det_score
            try:
                system_prompt = (
                    "You are an ATS skills completeness analyzer. Evaluate the resume's skills list and title.\n"
                    "Determine if they have a healthy density and keyword breadth for their target industry.\n"
                    "Identify key industry terms that are missing.\n"
                    "Return a JSON object with this format:\n"
                    "{\n"
                    "  \"score\": <number 0-100 general completeness score>,\n"
                    "  \"missingKeywords\": [<string>],\n"
                    "  \"matchedKeywords\": [<string>]\n"
                    "}\n"
                    "Return ONLY the valid JSON object. No markdown."
                )
                response = self.client.chat.completions.create(
                    model="gemini-1.5-flash",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"Title: {title}\nSkills: {', '.join(resume_skills)}"}
                    ],
                    temperature=0.1,
                    max_tokens=400
                )
                raw = response.choices[0].message.content.strip()
                if raw.startswith("```json"): raw = raw[7:]
                if raw.startswith("```"): raw = raw[3:]
                if raw.endswith("```"): raw = raw[:-3]
                raw = raw.strip()
                llm_data = json.loads(raw)
                
                llm_score = llm_data.get("score", det_score)
                missing = llm_data.get("missingKeywords", [])
                matched = llm_data.get("matchedKeywords", []) or list(resume_skills)
            except Exception as e:
                logger.error("LLM general keywords check failed: %s", e)
                
            score = int(det_score * 0.6 + llm_score * 0.4)
            
        return max(0, min(score, 100)), missing[:8], matched[:15]

    def _check_content_quality(self, parsed_data: dict) -> tuple:
        score = 100
        weak_bullets = []
        
        bullets = []
        experiences = parsed_data.get("experience", []) or []
        for exp in experiences:
            for b in exp.get("bullets", []) or []:
                if b.strip():
                    bullets.append(b.strip())
                    
        projects = parsed_data.get("projects", []) or []
        for proj in projects:
            desc = proj.get("description", "")
            if desc.strip():
                for b in desc.splitlines():
                    if b.strip():
                        bullets.append(b.strip())
                        
        if not bullets:
            return 40, ["No work experience or project bullets found. Please add achievements."]
            
        # Programmatic check for metrics/quantification
        quantified_count = 0
        metric_pattern = re.compile(r'\b(\d+|first|second|third|percent|%|\$)\b', re.IGNORECASE)
        for b in bullets:
            if metric_pattern.search(b):
                quantified_count += 1
                
        quant_ratio = quantified_count / len(bullets) if bullets else 0
        det_score = 100
        if quant_ratio < 0.20:
            det_score -= 30
            weak_bullets.append("Very few quantified achievements found. Add numbers, percentages, or metrics to at least 45% of bullets.")
        elif quant_ratio < 0.45:
            det_score -= 15
            weak_bullets.append("Add more numbers or percentages to your experience bullets to show measurable impact.")
            
        llm_score = det_score
        try:
            system_prompt = (
                "You are an expert resume coach. Analyze the bullet points from a resume.\n"
                "Identify bullets that are vague, lack action verbs, or have zero impact.\n"
                "Return a JSON object of this schema:\n"
                "{\n"
                "  \"score\": <number 0-100 representing content quality>,\n"
                "  \"weakBullets\": [<string weak bullet points with suggestions>]\n"
                "}\n"
                "Return ONLY the valid JSON object. No explanation, no markdown."
            )
            response = self.client.chat.completions.create(
                model="gemini-1.5-flash",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": json.dumps(bullets[:15])}
                ],
                temperature=0.1,
                max_tokens=400
            )
            raw = response.choices[0].message.content.strip()
            if raw.startswith("```json"): raw = raw[7:]
            if raw.startswith("```"): raw = raw[3:]
            if raw.endswith("```"): raw = raw[:-3]
            raw = raw.strip()
            
            llm_data = json.loads(raw)
            llm_score = llm_data.get("score", det_score)
            weak_bullets.extend(llm_data.get("weakBullets", []))
        except Exception as e:
            logger.error("LLM content quality check failed: %s", e)
            
        score = int(det_score * 0.5 + llm_score * 0.5)
        return max(0, score), weak_bullets[:5]

    def _check_integrity(self, resume_text: str) -> tuple:
        score = 100
        flags = []
        
        hidden_prompts = ["ignore previous instructions", "system prompt", "you are now", "override instruction"]
        for p in hidden_prompts:
            if p in resume_text.lower():
                score -= 40
                flags.append(f"Hidden instructions or prompt override attempts detected: '{p}'")
                
        words = re.findall(r'\b[a-zA-Z]{3,20}\b', resume_text.lower())
        word_counts = Counter(words)
        for w, c in word_counts.items():
            if c > 20:
                if w not in {"and", "the", "for", "with", "this", "that", "from", "python", "flask", "react", "mysql", "java"}:
                    score -= 10
                    flags.append(f"Potential keyword stuffing: Word '{w}' appears {c} times.")
                    break
                    
        return max(0, score), flags

    def analyze(self, resume_text: str, parsed_data: dict, target_job_description: str = None) -> dict:
        if not resume_text:
            lines = []
            personal = parsed_data.get("personalInfo", {}) or {}
            name = personal.get("fullName", "") or parsed_data.get("fullName", "")
            title = personal.get("title", "") or parsed_data.get("title", "")
            email = personal.get("email", "") or parsed_data.get("email", "")
            phone = personal.get("phone", "") or parsed_data.get("phone", "")
            location = personal.get("location", "") or parsed_data.get("location", "")
            summary = parsed_data.get("summary", "") or parsed_data.get("professional_summary", "")
            
            if name: lines.append(f"Name: {name}")
            if title: lines.append(f"Title: {title}")
            if email or phone or location:
                lines.append(f"Contact: {email} | {phone} | {location}")
            if summary:
                lines.append(f"Summary: {summary}")
            
            skills = parsed_data.get("skills", [])
            if skills:
                lines.append("Skills: " + ", ".join(skills))
                
            lines.append("\nWork Experience:")
            for exp in parsed_data.get("experience", []):
                company = exp.get("company", "")
                role = exp.get("title", "") or exp.get("role", "")
                start = exp.get("startDate", "") or exp.get("start_date", "")
                end = exp.get("endDate", "") or exp.get("end_date", "")
                bullets = "\n".join(f"- {b}" for b in exp.get("bullets", []) if b)
                lines.append(f"{role} at {company} ({start} - {end})\n{bullets}")
                
            lines.append("\nEducation:")
            for edu in parsed_data.get("education", []):
                inst = edu.get("school", "") or edu.get("institution", "")
                deg = edu.get("degree", "")
                start = edu.get("startDate", "") or edu.get("start_date", "")
                end = edu.get("endDate", "") or edu.get("end_date", "")
                lines.append(f"{deg} from {inst} ({start} - {end})")
                
            lines.append("\nProjects:")
            for proj in parsed_data.get("projects", []):
                pname = proj.get("name", "") or proj.get("title", "")
                desc = proj.get("description", "")
                link = proj.get("link", "") or proj.get("url", "")
                lines.append(f"{pname} ({link}): {desc}")
                
            resume_text = "\n".join(lines)

        resume_text = resume_text[:8000]
        
        # 1. Run all sub-checks deterministically
        formatting_score, formatting_issues = self._check_formatting(resume_text)
        structure_score, structure_issues = self._check_structure(resume_text, parsed_data)
        spelling_score, spelling_issues = self._check_spelling_and_grammar(resume_text, parsed_data)
        repetition_score, repetition_issues = self._check_repetition(resume_text)
        keywords_score, missing_keywords, matched_keywords = self._check_keywords(resume_text, parsed_data, target_job_description)
        content_score, weak_bullets = self._check_content_quality(parsed_data)
        integrity_score, flags = self._check_integrity(resume_text)
        
        # Count total issues to evaluate strictness penalty
        total_issues_count = (
            len(formatting_issues) +
            len(structure_issues) +
            len(spelling_issues) +
            len(repetition_issues) +
            len(missing_keywords) +
            len(weak_bullets) +
            len(flags)
        )
        
        # Blend spelling, repetition, and bullet quality scores under "content" (Achievement Quality) for frontend display
        blended_content_score = round(
            (spelling_score * 0.15 + repetition_score * 0.10 + content_score * 0.15) / 0.40
        )
        
        # Calculate overall score based on the weighted components
        overall_score = round(
            formatting_score * 0.20 +
            structure_score * 0.15 +
            keywords_score * 0.20 +
            blended_content_score * 0.40 +
            integrity_score * 0.05
        )
        
        # Apply a mild overall penalty ONLY when the total issue count is high.
        # This reflects that having many small issues degrades overall quality,
        # but keeps individual sub-check progress bars clean and interpretable.
        if total_issues_count >= 15:
            overall_score = round(overall_score * 0.82)
        elif total_issues_count >= 10:
            overall_score = round(overall_score * 0.88)
        elif total_issues_count >= 5:
            overall_score = round(overall_score * 0.94)
            
        overall_score = max(5, min(overall_score, 100))
        
        # Merge issues lists for Achievement Quality to display in frontend
        blended_weak_bullets = []
        if spelling_issues:
            blended_weak_bullets.extend(spelling_issues)
        if repetition_issues:
            blended_weak_bullets.extend(repetition_issues)
        if weak_bullets:
            blended_weak_bullets.extend(weak_bullets)
            
        # Compile dynamic top suggestions
        top_suggestions = []
        if spelling_issues:
            top_suggestions.append(spelling_issues[0])
        if repetition_issues:
            top_suggestions.append(repetition_issues[0])
        if formatting_issues:
            top_suggestions.append(formatting_issues[0])
        if len(missing_keywords) > 0:
            top_suggestions.append(f"Add critical missing keywords: {', '.join(missing_keywords[:3])}")
        if weak_bullets:
            top_suggestions.append(weak_bullets[0])
        if structure_issues:
            top_suggestions.append(structure_issues[0])
            
        if not top_suggestions:
            top_suggestions.append("Your resume is well optimized! Try tailoring it to another job description to further match keywords.")

        report = {
            "overallScore": overall_score,
            "breakdown": {
                "formatting": {
                    "score": formatting_score,
                    "issues": formatting_issues
                },
                "structure": {
                    "score": structure_score,
                    "issues": structure_issues
                },
                "keywords": {
                    "score": keywords_score,
                    "missingKeywords": missing_keywords,
                    "matchedKeywords": matched_keywords
                },
                "content": {
                    "score": blended_content_score,
                    "weakBullets": blended_weak_bullets
                },
                "integrity": {
                    "score": integrity_score,
                    "flags": flags
                }
            },
            "topSuggestions": top_suggestions[:4],
            "computedAt": datetime.now(timezone.utc).isoformat() + "Z"
        }
        return report

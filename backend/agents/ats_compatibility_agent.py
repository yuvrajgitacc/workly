import json
import logging
import re
from datetime import datetime, timezone
from collections import Counter
from agents.llm import RotateLLMClient
import numpy as np
from agents.embeddings import get_embedding_model

def compute_semantic_similarity(queries, candidates):
    model = get_embedding_model()
    if not model or not queries or not candidates:
        return 0.0, []
        
    try:
        # Encode lists of sentences
        query_embs = model.encode(queries, convert_to_numpy=True)
        cand_embs = model.encode(candidates, convert_to_numpy=True)
        
        # Normalize embeddings
        query_embs = query_embs / (np.linalg.norm(query_embs, axis=1, keepdims=True) + 1e-8)
        cand_embs = cand_embs / (np.linalg.norm(cand_embs, axis=1, keepdims=True) + 1e-8)
        
        # Compute cosine similarities matrix (shape: num_queries, num_candidates)
        sim_matrix = np.dot(query_embs, cand_embs.T)
        
        # For each query, find the best matching candidate sentence
        max_sims = np.max(sim_matrix, axis=1)
        mean_similarity = float(np.mean(max_sims))
        
        # Also return detail mapping
        details = []
        for i, q in enumerate(queries):
            best_idx = int(np.argmax(sim_matrix[i]))
            best_sim = float(max_sims[i])
            details.append({
                "query": q,
                "best_match": candidates[best_idx],
                "similarity": best_sim
            })
            
        return mean_similarity, details
    except Exception as e:
        logger.error("Error in compute_semantic_similarity: %s", e)
        return 0.0, []

logger = logging.getLogger(__name__)

TECH_DICT = {
    # Languages
    "python", "javascript", "java", "typescript", "golang", "rust", "ruby", "php", "sql", "nosql", "cplusplus", "cpp", "csharp", "bash", "scala", "kotlin", "swift", "dart",
    # Frontend
    "react", "angular", "vue", "svelte", "nextjs", "nuxt", "gatsby", "html", "css", "tailwind", "tailwindcss", "bootstrap", "sass", "less", "webpack", "vite", "redux", "graphql", "apollo",
    # Backend & Frameworks
    "node", "express", "django", "flask", "fastapi", "spring", "laravel", "rails", "nest", "nestjs", "asp", "dotnet",
    # Databases
    "mongodb", "postgresql", "mysql", "redis", "elasticsearch", "sqlite", "mariadb", "oracle", "dynamodb", "cassandra", "firebase", "supabase",
    # DevOps & Cloud
    "docker", "kubernetes", "aws", "gcp", "azure", "ci", "cd", "cicd", "jenkins", "gitlab", "github", "bitbucket", "ansible", "terraform", "prometheus", "grafana", "opentelemetry", "elk", "nginx", "apache",
    # Testing & Tools
    "jest", "cypress", "playwright", "selenium", "pytest", "junit", "mocha", "chai",
    # Concepts
    "microservices", "agile", "scrum", "rest", "grpc", "soap", "mvc", "tdd", "bdd", "ci/cd"
}

class AtsCompatibilityAgent:
    """
    Independent agent that performs production-grade ATS compatibility checks.
    Scores are strictly calculated using 6 weighted components:
      - Keyword Match (35%)
      - Skills Match (25%)
      - Experience Relevance (15%)
      - Project Relevance (10%)
      - Education Match (5%)
      - ATS Formatting (10%)
    """
    def __init__(self):
        self.client = RotateLLMClient()

    def _extract_techs_from_text(self, text: str) -> set:
        if not text:
            return set()
        # Clean text preserving some special chars like +, #, .
        cleaned = re.sub(r'[^a-zA-Z0-9+#.\s-]', ' ', text.lower())
        # Replace common occurrences of node.js, react.js etc.
        cleaned = cleaned.replace("react.js", "react").replace("reactjs", "react")
        cleaned = cleaned.replace("node.js", "node").replace("nodejs", "node")
        cleaned = cleaned.replace("next.js", "nextjs").replace("nextjs", "nextjs")
        cleaned = cleaned.replace("vue.js", "vue").replace("vuejs", "vue")
        # Tokenize and look up in TECH_DICT
        words = cleaned.split()
        found = set()
        for w in words:
            if w in TECH_DICT:
                found.add(w)
            elif w in ["c++", "cpp", "cplusplus"]:
                found.add("cpp")
            elif w in ["c#", "csharp"]:
                found.add("csharp")
            elif w in ["ci/cd", "cicd"]:
                found.add("ci/cd")
            elif w in ["dotnet", ".net"]:
                found.add("dotnet")
        return found

    def _is_partial_match(self, jd_item: str, proj_item: str) -> bool:
        """Determines if a JD technology/keyword partially matches a project technology/keyword."""
        j = jd_item.lower().strip()
        p = proj_item.lower().strip()
        if j == p:
            return True
            
        j_clean = re.sub(r'[^a-z0-9]', '', j)
        p_clean = re.sub(r'[^a-z0-9]', '', p)
        if j_clean == p_clean:
            return True
            
        if len(j_clean) > 2 and len(p_clean) > 2:
            if j_clean in p_clean or p_clean in j_clean:
                return True
                
        aliases = {
            "ci/cd": ["cicd", "continuous integration", "continuous deployment", "github actions", "gitlab ci", "jenkins"],
            "rest api": ["restful api", "rest apis", "restful apis", "restful", "apis"],
            "cloud": ["aws", "gcp", "azure", "cloud native", "cloud infrastructure"],
            "react": ["reactjs", "react.js"],
            "node": ["nodejs", "node.js"],
            "next": ["nextjs", "next.js"],
            "vue": ["vuejs", "vue.js"],
            "c++": ["cpp", "cplusplus"],
            "c#": ["csharp"]
        }
        for main_name, list_aliases in aliases.items():
            if (j == main_name or j in list_aliases) and (p == main_name or p in list_aliases):
                return True
        return False

    def _extract_jd_requirements(self, jd_text: str) -> dict:
        """Extract key components from target job description using LLM."""
        if not jd_text or not jd_text.strip():
            return {
                "required_skills": [],
                "preferred_skills": [],
                "technologies": [],
                "frameworks": [],
                "responsibilities": [],
                "min_experience_years": 0,
                "preferred_degree": ""
            }

        system_prompt = (
            "You are an ATS Job Description Parser. Analyze the job description and extract details into a JSON object.\n"
            "Include:\n"
            "1. 'required_skills': List of required hard and soft skills (limit 15).\n"
            "2. 'preferred_skills': List of preferred or nice-to-have skills (limit 10).\n"
            "3. 'technologies': Programming languages, tools, cloud services, and software systems mentioned.\n"
            "4. 'frameworks': Software frameworks and libraries.\n"
            "5. 'responsibilities': Primary responsibilities (short bullet strings).\n"
            "6. 'min_experience_years': Minimum years of experience required (extract integer, default to 0).\n"
            "7. 'preferred_degree': Preferred education (e.g. 'Bachelor', 'Master', 'PhD', or empty string).\n\n"
            "Return ONLY a valid JSON object matching this schema. No markdown prose or explanation."
        )

        try:
            response = self.client.chat.completions.create(
                model="gemini-1.5-flash",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Job Description:\n{jd_text[:4000]}"}
                ],
                temperature=0.1,
                response_format={"type": "json_object"}
            )
            raw = response.choices[0].message.content.strip()
            if raw.startswith("```json"): raw = raw[7:]
            if raw.startswith("```"): raw = raw[3:]
            if raw.endswith("```"): raw = raw[:-3]
            raw = raw.strip()
            parsed = json.loads(raw)
            # Safe parsing ensure fields are present
            parsed.setdefault("required_skills", [])
            parsed.setdefault("preferred_skills", [])
            parsed.setdefault("technologies", [])
            parsed.setdefault("frameworks", [])
            parsed.setdefault("responsibilities", [])
            parsed.setdefault("min_experience_years", 0)
            parsed.setdefault("preferred_degree", "")
            return parsed
        except Exception as e:
            logger.error("JD Parsing agent failed: %s", e)
            return {
                "required_skills": [],
                "preferred_skills": [],
                "technologies": [],
                "frameworks": [],
                "responsibilities": [],
                "min_experience_years": 0,
                "preferred_degree": ""
            }

    def _calculate_experience_years(self, parsed_data: dict) -> float:
        """Parse work experience dates and calculate total experience years."""
        total_years = 0.0
        experiences = parsed_data.get("experience", []) or []
        for exp in experiences:
            sd = str(exp.get("startDate") or "")
            ed = str(exp.get("endDate") or "")
            s_year = None
            e_year = None
            
            s_match = re.search(r'\b(19|20)\d{2}\b', sd)
            if s_match:
                s_year = int(s_match.group(0))
                
            if not ed or ed.lower() in ["present", "current", "now", "ongoing"]:
                e_year = datetime.now().year
            else:
                e_match = re.search(r'\b(19|20)\d{2}\b', ed)
                if e_match:
                    e_year = int(e_match.group(0))
                    
            if s_year and e_year and e_year >= s_year:
                diff = e_year - s_year
                total_years += max(1.0, float(diff))
            else:
                total_years += 1.0
        return round(total_years, 1)

    def _get_degree_level(self, degree_str: str) -> int:
        """Helper to get a numeric level representing a degree for comparison."""
        deg = str(degree_str).lower()
        if any(x in deg for x in ["phd", "doctorate", "ph.d"]):
            return 4
        if any(x in deg for x in ["master", "ms", "mtech", "m.tech", "mba", "m.s."]):
            return 3
        if any(x in deg for x in ["bachelor", "bs", "btech", "b.tech", "ba", "b.s.", "b.a."]):
            return 2
        if any(x in deg for x in ["associate", "diploma"]):
            return 1
        return 0

    def _check_formatting(self, resume_text: str) -> tuple:
        score = 100
        issues = []
        
        # 1. Multi-column check
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
            issues.append(f"Creative icons ({', '.join(found_icons)}) found. Use clean text labels.")
            
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
            
        return max(0, score), issues

    def _check_spelling_and_grammar(self, resume_text: str, parsed_data: dict) -> tuple:
        score = 100
        spelling_issues = []
        grammar_issues = []
        
        # Local SpellChecker
        try:
            from spellchecker import SpellChecker
            spell = SpellChecker()
            
            skills = parsed_data.get("skills", []) or []
            personal = parsed_data.get("personalInfo", {}) or {}
            name = personal.get("fullName", "") or parsed_data.get("fullName", "")
            title = personal.get("title", "") or parsed_data.get("title", "")
            
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
                "gamification", "opentelemetry", "jenkins", "tailwind", "tailwindcss", "gitlab", 
                "ci", "cd", "cicd", "promql", "jaeger", "dockerfile", "microservices", "microservice",
                "bitbucket", "terraform", "k8s", "helm", "orchestrated", "streamlined", "configured", 
                "refactored", "containerized", "monitored", "automated", "provisioned", "redhat",
                "centos", "debian", "ubuntu", "linux", "graphql", "restful", "apis", "sdk", "sdks"
            }
            
            for s in skills:
                for word in re.findall(r'\b[a-zA-Z]+\b', str(s)):
                    whitelist.add(word.lower())
            for word in re.findall(r'\b[a-zA-Z]+\b', name):
                whitelist.add(word.lower())
            for word in re.findall(r'\b[a-zA-Z]+\b', title):
                whitelist.add(word.lower())
                
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
            
        # Capitalization and trailing punctuation
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
                if content and content[0].islower():
                    lowercase_starts += 1
                    
        if double_spaces > 0:
            grammar_issues.append("Double spaces detected. Ensure clean, single spacing throughout.")
        if lowercase_starts > 0:
            grammar_issues.append("Capitalization: Bullet points should start with a capital letter.")
            
        total_penalties = len(spelling_issues) * 4 + len(grammar_issues) * 5
        score -= total_penalties
        
        issues = []
        if spelling_issues:
            issues.append(f"Spelling issues found: {', '.join(spelling_issues[:6])}")
        for g in grammar_issues[:4]:
            issues.append(f"Grammar/Style: {g}")
            
        return max(0, score), issues

    def analyze(self, resume_text: str, parsed_data: dict, target_job_description: str = None) -> dict:
        # Build text description if not provided
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

        resume_text_lower = resume_text.lower()
        model = get_embedding_model()
        
        # 1. ATS Formatting (10%)
        fmt_score, fmt_issues = self._check_formatting(resume_text)
        
        # Candidate Experience Years and Degree details
        cand_years = self._calculate_experience_years(parsed_data)
        
        # Extract candidate skills for matching
        candidate_skills = list(set(str(s).lower().strip() for s in parsed_data.get("skills", []) if s))
        
        # Extract projects and populate diagnostic variables early
        parsed_projects = []
        for key in ["projects", "Projects", "PROJECTS"]:
            if key in parsed_data:
                parsed_projects = parsed_data[key] or []
                break
                
        proj_titles = []
        all_project_techs = set()
        proj_descriptions_bullets = []
        
        for proj in parsed_projects:
            pname = proj.get("name") or proj.get("title") or ""
            if pname:
                proj_titles.append(pname)
            pdesc = proj.get("description") or ""
            if pdesc:
                proj_descriptions_bullets.append(pdesc)
            pbullets = proj.get("bullets") or proj.get("responsibilities") or []
            if isinstance(pbullets, list):
                proj_descriptions_bullets.extend([str(b) for b in pbullets if b])
            elif isinstance(pbullets, str) and pbullets.strip():
                proj_descriptions_bullets.append(pbullets.strip())
            ptags = proj.get("techStack") or proj.get("tech_stack") or proj.get("technologies") or []
            if isinstance(ptags, str):
                ptags = [ptags]
            for tag in ptags:
                all_project_techs.update(self._extract_techs_from_text(str(tag)))
            all_project_techs.update(self._extract_techs_from_text(pname))
            all_project_techs.update(self._extract_techs_from_text(pdesc))
            for bullet in pbullets:
                all_project_techs.update(self._extract_techs_from_text(str(bullet)))
                
        jd_techs_all = set()
        matched_techs = []
        semantic_sim_score = 0.0
        technology_overlap_score = 0.0
        responsibility_overlap_score = 0.0
        
        # 2. Match calculations
        if target_job_description and target_job_description.strip():
            jd_req = self._extract_jd_requirements(target_job_description)
            
            # --- Keyword Match (35%) ---
            target_keywords = list(set(k.lower().strip() for k in (jd_req.get("technologies", []) + jd_req.get("frameworks", [])) if k))
            if not target_keywords:
                # Add backup words from technology dictionary matching the JD text
                jd_words = re.findall(r'\b[a-zA-Z]{3,18}\b', target_job_description.lower())
                target_keywords = list(set(w for w in jd_words if w in TECH_DICT))
                
            matched_keywords = []
            missing_keywords = []
            
            if target_keywords:
                # Precompute embeddings for semantic keyword match
                sim_matrix_kw = None
                if model and candidate_skills:
                    try:
                        kw_embs = model.encode(target_keywords, convert_to_numpy=True)
                        cand_embs = model.encode(candidate_skills, convert_to_numpy=True)
                        
                        kw_embs = kw_embs / (np.linalg.norm(kw_embs, axis=1, keepdims=True) + 1e-8)
                        cand_embs = cand_embs / (np.linalg.norm(cand_embs, axis=1, keepdims=True) + 1e-8)
                        
                        sim_matrix_kw = np.dot(kw_embs, cand_embs.T)
                    except Exception as e:
                        logger.warning("Failed to encode keyword/skills embeddings: %s", e)
                
                for i, kw in enumerate(target_keywords):
                    pattern = rf"\b{re.escape(kw)}\b"
                    if re.search(pattern, resume_text_lower):
                        matched_keywords.append(kw)
                    elif sim_matrix_kw is not None and candidate_skills:
                        max_sim = float(np.max(sim_matrix_kw[i]))
                        if max_sim > 0.82:
                            matched_keywords.append(kw)
                        else:
                            missing_keywords.append(kw)
                    else:
                        missing_keywords.append(kw)
                keyword_match_score = int((len(matched_keywords) / len(target_keywords)) * 100) if target_keywords else 100
            else:
                keyword_match_score = 100

            # --- Skills Match (25%) ---
            jd_skills = list(set(s.lower().strip() for s in (jd_req.get("required_skills", []) + jd_req.get("preferred_skills", [])) if s))
            matched_skills = []
            missing_skills = []
            
            if jd_skills:
                if candidate_skills and model:
                    try:
                        jd_embs = model.encode(jd_skills, convert_to_numpy=True)
                        cand_embs = model.encode(candidate_skills, convert_to_numpy=True)
                        
                        jd_embs = jd_embs / (np.linalg.norm(jd_embs, axis=1, keepdims=True) + 1e-8)
                        cand_embs = cand_embs / (np.linalg.norm(cand_embs, axis=1, keepdims=True) + 1e-8)
                        
                        sim_matrix_sk = np.dot(jd_embs, cand_embs.T)
                        for i, s in enumerate(jd_skills):
                            max_sim = float(np.max(sim_matrix_sk[i]))
                            if s in candidate_skills or max_sim > 0.82:
                                matched_skills.append(s)
                            else:
                                missing_skills.append(s)
                    except Exception:
                        for s in jd_skills:
                            if any(s in cs or cs in s for cs in candidate_skills):
                                matched_skills.append(s)
                            else:
                                missing_skills.append(s)
                elif candidate_skills:
                    # Embedding model unavailable (e.g. running on low-RAM host without
                    # HF_SPACE_EMBEDDING_URL configured) -> fall back to substring matching
                    # instead of marking every required skill as missing.
                    for s in jd_skills:
                        if any(s in cs or cs in s for cs in candidate_skills):
                            matched_skills.append(s)
                        else:
                            missing_skills.append(s)
                else:
                    missing_skills = jd_skills[:]
                skills_match_score = int((len(matched_skills) / len(jd_skills)) * 100) if jd_skills else 100
            else:
                skills_match_score = 100

            # --- Experience Relevance (15%) ---
            # Part A: Experience Years check
            req_years = int(jd_req.get("min_experience_years", 0))
            if req_years <= 0:
                years_score = 100
            else:
                years_score = min(100.0, (cand_years / req_years) * 100.0)
                
            # Part B: Semantic alignment of experience bullets using SentenceTransformer embeddings
            jd_responsibilities = [r.strip() for r in jd_req.get("responsibilities", []) if r.strip()]
            if not jd_responsibilities and target_job_description:
                # Fallback to lines of Job Description
                jd_responsibilities = [line.strip() for line in target_job_description.split("\n") if line.strip() and len(line.strip()) > 35][:12]
                
            cand_bullets = []
            for exp in parsed_data.get("experience", []):
                bullets = exp.get("bullets", []) or exp.get("responsibilities", []) or []
                if isinstance(bullets, list):
                    cand_bullets.extend([b.strip() for b in bullets if b.strip()])
                elif isinstance(bullets, str) and bullets.strip():
                    cand_bullets.append(bullets.strip())
                    
            if not jd_responsibilities or not cand_bullets:
                semantic_exp_score = 70.0
                exp_details = "Default experience relevance profile applied (no responsibilities or candidate experience bullets found)."
            else:
                mean_sim, _ = compute_semantic_similarity(jd_responsibilities, cand_bullets)
                # Map similarity [0.25, 0.75] -> [0.0, 100.0]
                semantic_exp_score = min(100.0, max(0.0, (mean_sim - 0.25) / 0.5 * 100.0))
                semantic_exp_score = round(semantic_exp_score)
                exp_details = f"Experience bullets exhibit {round(mean_sim*100, 1)}% semantic similarity with JD responsibilities."
                
            experience_relevance_score = round(0.4 * years_score + 0.6 * semantic_exp_score)
            
            # --- Project Relevance (10%) ---

            if not parsed_projects:
                project_relevance_score = 0.0
                technology_overlap_score = 0.0
                responsibility_overlap_score = 0.0
                semantic_sim_score = 0.0
                proj_details = "No projects listed on candidate's resume."
                matched_techs = []
                jd_techs_all = []
            else:
                # 1. 60% Semantic Similarity: Cosine Similarity between combined project text and full JD text
                proj_combined_parts = []
                for proj in parsed_projects:
                    pname = proj.get("name") or proj.get("title") or ""
                    pdesc = proj.get("description") or ""
                    ptags = ", ".join(str(t) for t in (proj.get("techStack") or proj.get("tech_stack") or proj.get("technologies") or []) if t)
                    pbullets = " ".join(str(b) for b in (proj.get("bullets") or proj.get("responsibilities") or []) if b)
                    proj_combined_parts.append(f"{pname} {pdesc} {ptags} {pbullets}")
                combined_project_text = " ".join(proj_combined_parts).strip()
                
                if model and combined_project_text and target_job_description:
                    try:
                        proj_emb = model.encode([combined_project_text], convert_to_numpy=True)
                        jd_emb = model.encode([target_job_description], convert_to_numpy=True)
                        proj_emb = proj_emb / (np.linalg.norm(proj_emb, axis=1, keepdims=True) + 1e-8)
                        jd_emb = jd_emb / (np.linalg.norm(jd_emb, axis=1, keepdims=True) + 1e-8)
                        cos_sim = float(np.dot(proj_emb, jd_emb.T)[0][0])
                        semantic_sim_score = min(100.0, max(0.0, (cos_sim - 0.2) / 0.45 * 100.0))
                    except Exception as e:
                        logger.error("Failed to compute combined project similarity: %s", e)
                        semantic_sim_score = 50.0
                        cos_sim = 0.5
                else:
                    semantic_sim_score = 50.0
                    cos_sim = 0.5
                    
                # 2. 30% Technology Overlap
                jd_techs_all = set(t.lower().strip() for t in (jd_req.get("technologies", []) + jd_req.get("frameworks", [])) if t)
                if not jd_techs_all and target_job_description:
                    jd_techs_all = self._extract_techs_from_text(target_job_description)
                
                matched_techs = []
                for jd_t in jd_techs_all:
                    matched = False
                    for p_t in all_project_techs:
                        if self._is_partial_match(jd_t, p_t):
                            matched = True
                            break
                    if matched:
                        matched_techs.append(jd_t)
                
                if not jd_techs_all:
                    technology_overlap_score = 100.0
                else:
                    technology_overlap_score = (len(matched_techs) / len(jd_techs_all)) * 100.0
                    
                # 3. 10% Responsibility Overlap
                jd_resps = jd_req.get("responsibilities", [])
                if not jd_resps and target_job_description:
                    jd_resps = [line.strip() for line in target_job_description.split("\n") if line.strip() and len(line.strip()) > 35][:12]
                
                if not jd_resps:
                    responsibility_overlap_score = 100.0
                elif not proj_descriptions_bullets:
                    responsibility_overlap_score = 0.0
                else:
                    mean_sim_resp, _ = compute_semantic_similarity(jd_resps, proj_descriptions_bullets)
                    responsibility_overlap_score = min(100.0, max(0.0, (mean_sim_resp - 0.15) / 0.5 * 100.0))
                    
                # Calculate Weighted Score
                calculated_score = (
                    0.60 * semantic_sim_score +
                    0.30 * technology_overlap_score +
                    0.10 * responsibility_overlap_score
                )
                
                # Apply Completeness Points
                completeness_points = 0
                total_projects = len(parsed_projects)
                for proj in parsed_projects:
                    has_title = bool(proj.get("name") or proj.get("title"))
                    has_desc = bool(proj.get("description"))
                    has_tech = bool(proj.get("techStack") or proj.get("tech_stack") or proj.get("technologies"))
                    proj_points = 0
                    if has_title: proj_points += 10
                    if has_desc: proj_points += 15
                    if has_tech: proj_points += 10
                    completeness_points += proj_points
                completeness_score = min(100.0, (completeness_points / total_projects) * (100.0 / 35.0))
                
                # Fail-safe minimum
                base_fail_safe = 30.0 + 0.10 * completeness_score
                project_relevance_score = max(base_fail_safe, calculated_score)
                project_relevance_score = round(project_relevance_score)
                
                proj_details = (
                    f"Project relevance scored {round(project_relevance_score)}% "
                    f"(60% semantic similarity: {round(semantic_sim_score, 1)}%, "
                    f"30% tech overlap: {round(technology_overlap_score, 1)}%, "
                    f"10% responsibility overlap: {round(responsibility_overlap_score, 1)}%)."
                )

            # --- Education Match (5%) ---
            req_degree = jd_req.get("preferred_degree", "")
            if not req_degree:
                education_match_score = 100
                edu_details = "No specific education requirements parsed from target job description."
            else:
                edu_list = parsed_data.get("education", []) or []
                if not edu_list:
                    education_match_score = 40
                    edu_details = "No education history listed on candidate's resume."
                else:
                    max_cand_level = 0
                    cand_degree_name = ""
                    for edu in edu_list:
                        level = self._get_degree_level(edu.get("degree", ""))
                        if level > max_cand_level:
                            max_cand_level = level
                            cand_degree_name = edu.get("degree", "")
                            
                    target_level = self._get_degree_level(req_degree)
                    if max_cand_level >= target_level:
                        education_match_score = 100
                        edu_details = f"Candidate degree ({cand_degree_name}) matches or exceeds requirement ({req_degree})."
                    else:
                        education_match_score = max(50, 100 - (target_level - max_cand_level) * 20)
                        edu_details = f"Candidate degree ({cand_degree_name}) is lower than preferred degree ({req_degree})."

        else:
            # Fallback general metrics when no job description is provided
            keyword_match_score = 80
            matched_keywords = list(parsed_data.get("skills", []))[:8]
            missing_keywords = []
            
            skills_count = len(parsed_data.get("skills", []))
            skills_match_score = min(100, skills_count * 8)
            matched_skills = list(parsed_data.get("skills", []))
            missing_skills = []
            
            if cand_years >= 5: experience_relevance_score = 100
            elif cand_years >= 2: experience_relevance_score = 85
            else: experience_relevance_score = 70
            semantic_exp_score = experience_relevance_score
            exp_details = f"General evaluation based on {cand_years} years of experience."
            req_years = 0
            
            proj_count = len(parsed_data.get("projects", []))
            if proj_count >= 2: project_relevance_score = 95
            elif proj_count == 1: project_relevance_score = 80
            else: project_relevance_score = 40
            proj_details = f"General evaluation based on {proj_count} listed projects."
            
            if parsed_data.get("education"):
                education_match_score = 100
                edu_details = "Education details present."
            else:
                education_match_score = 40
                edu_details = "No education details listed."
            req_degree = ""

        # Compile strengths & weaknesses based on sub-scores
        strengths = []
        weaknesses = []

        if keyword_match_score >= 80:
            strengths.append("High alignment with Job Description technical keywords.")
        else:
            weaknesses.append("Low density of target Job Description technical keywords.")

        if skills_match_score >= 85:
            strengths.append("Declared skills list fully covers the required competencies.")
        else:
            weaknesses.append("Missing core skills requested in the job description.")

        if experience_relevance_score >= 85:
            strengths.append("Past job roles and descriptions are highly relevant to this position.")
        else:
            weaknesses.append("Past work experience lacks specific domain relevance for this role.")

        if project_relevance_score >= 80:
            strengths.append("Project portfolio highlights relevant technologies and capabilities.")
        else:
            weaknesses.append("Project descriptions do not explicitly showcase job-aligned tech stack.")

        if education_match_score >= 90:
            strengths.append("Academic qualifications meet target specifications.")
        elif education_match_score < 70:
            weaknesses.append("Degree level does not match the preferred education requirement.")

        if fmt_score >= 90:
            strengths.append("Excellent, clean formatting layout that parses easily.")
        else:
            weaknesses.append("Formatting layout warnings detected (long bullet points, symbols, columns).")

        # Compile final calculated score
        overall_score = round(
            keyword_match_score * 0.35 +
            skills_match_score * 0.25 +
            experience_relevance_score * 0.15 +
            project_relevance_score * 0.10 +
            education_match_score * 0.05 +
            fmt_score * 0.10
        )
        overall_score = max(5, min(overall_score, 100))

        # Generate top coach suggestions
        top_suggestions = []
        if missing_keywords:
            top_suggestions.append(f"Incorporate target keywords: {', '.join(missing_keywords[:3])}")
        if missing_skills:
            top_suggestions.append(f"Add missing required skills: {', '.join(missing_skills[:3])}")
        if experience_relevance_score < 80:
            top_suggestions.append("Quantify experience impact statements to match JD responsibilities.")
        if project_relevance_score < 80:
            top_suggestions.append("Tailor projects to highlight frameworks mentioned in the Job Description.")
        if fmt_score < 90:
            top_suggestions.append("Use standard fonts, clean delimiters, and shorten long bullet points.")
            
        if not top_suggestions:
            top_suggestions.append("Your resume is well optimized! Tailor it to another job description to further match keywords.")

        # Local spelling & grammar check for achievements
        spelling_and_grammar_score, spelling_and_grammar_issues = self._check_spelling_and_grammar(resume_text, parsed_data)

        # Generate explanations explaining every point awarded or deducted
        explanations = [
            f"Keyword Match (35.0 pts max): Awarded {round(keyword_match_score * 0.35, 2)} pts ({keyword_match_score}% matching density). Detected {len(matched_keywords)} target keywords. Deducted {round(35.0 - (keyword_match_score * 0.35), 2)} pts for {len(missing_keywords)} missing keywords.",
            f"Skills Match (25.0 pts max): Awarded {round(skills_match_score * 0.25, 2)} pts ({skills_match_score}% competency matching). Detected {len(matched_skills)} core skills. Deducted {round(25.0 - (skills_match_score * 0.25), 2)} pts for {len(missing_skills)} missing skills.",
            f"Experience Relevance (15.0 pts max): Awarded {round(experience_relevance_score * 0.15, 2)} pts ({experience_relevance_score}% relevance). Experience: {cand_years} yrs vs. target {req_years} yrs. Semantic alignment similarity is {round(semantic_exp_score)}%.",
            f"Project Relevance (10.0 pts max): Awarded {round(project_relevance_score * 0.10, 2)} pts ({project_relevance_score}% score). Portfolio shows {len(parsed_data.get('projects', []))} project(s). {proj_details}",
            f"Education Match (5.0 pts max): Awarded {round(education_match_score * 0.05, 2)} pts ({education_match_score}% score). {edu_details}",
            f"ATS Formatting (10.0 pts max): Awarded {round(fmt_score * 0.10, 2)} pts ({fmt_score}% formatting layout score). Deducted {round(10.0 - (fmt_score * 0.10), 2)} pts due to formatting warnings: {'; '.join(fmt_issues) or 'None'}."
        ]

        # Build full report
        report = {
            "overallScore": overall_score,
            "strengths": strengths[:4],
            "weaknesses": weaknesses[:4],
            "topSuggestions": top_suggestions[:4],
            "computedAt": datetime.now(timezone.utc).isoformat() + "Z",
            "explanations": explanations,
            
            # Upgraded detailed sub-scores
            "detailed_breakdown": {
                "keyword_match": {
                    "score": keyword_match_score,
                    "matched": matched_keywords[:15],
                    "missing": missing_keywords[:12]
                },
                "skills_match": {
                    "score": skills_match_score,
                    "matched": matched_skills[:15],
                    "missing": missing_skills[:12]
                },
                "experience_relevance": {
                    "score": experience_relevance_score,
                    "details": exp_details,
                    "years": cand_years,
                    "required_years": req_years
                },
                "project_relevance": {
                    "score": project_relevance_score,
                    "projects_found": proj_titles,
                    "project_keywords": sorted(list(all_project_techs)),
                    "jd_keywords": sorted(list(jd_techs_all)),
                    "matched_keywords": sorted(list(matched_techs)),
                    "semantic_similarity": round(semantic_sim_score, 1),
                    "technology_overlap": round(technology_overlap_score, 1),
                    "responsibility_overlap": round(responsibility_overlap_score, 1),
                    "reason": proj_details
                },
                "education_match": {
                    "score": education_match_score,
                    "details": edu_details
                },
                "ats_formatting": {
                    "score": fmt_score,
                    "issues": fmt_issues
                },
                "explanations": explanations
            },
            
            # Map legacy keys to prevent frontend crashes
            "breakdown": {
                "formatting": {
                    "score": fmt_score,
                    "issues": fmt_issues
                },
                "structure": {
                    "score": education_match_score,
                    "issues": [edu_details] if education_match_score < 100 else []
                },
                "keywords": {
                    "score": keyword_match_score,
                    "missingKeywords": missing_keywords[:12],
                    "matchedKeywords": matched_keywords[:15]
                },
                "content": {
                    "score": round((experience_relevance_score * 0.6) + (project_relevance_score * 0.4)),
                    "weakBullets": spelling_and_grammar_issues
                },
                "integrity": {
                    "score": skills_match_score,
                    "flags": []
                }
            }
        }
        return report

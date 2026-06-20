import logging

logger = logging.getLogger(__name__)

def calculate_match(normalized_skills, total_experience_years, location, criteria, parsing_method="llm"):
    """
    Computes matching score and details for a candidate against session criteria.
    Standardized logic shared by both manual recruiter uploads and portal self-applies.
    """
    if not isinstance(criteria, dict):
        criteria = {}
        
    required_skills = criteria.get("required_skills") or []
    if not isinstance(required_skills, list):
        required_skills = []
        
    min_match_score = criteria.get("min_match_score") or 0
    try:
        min_match_score = float(min_match_score)
    except (ValueError, TypeError):
        min_match_score = 0.0
        
    req_lower = [str(r).lower().strip() for r in required_skills if r]
    
    # Skills score
    matched_list = []
    missing_list = [str(r) for r in required_skills if r]
    skill_score = 50.0  # Default if no requirements specified
    
    if req_lower:
        cand_skill_names = set()
        for s in (normalized_skills or []):
            if isinstance(s, dict):
                val = s.get("canonical_skill") or s.get("raw_skill") or ""
                if val:
                    cand_skill_names.add(str(val).lower().strip())
            else:
                cand_skill_names.add(str(s).lower().strip())
                
        matched_list = [r for r in required_skills if r and any(str(r).lower().strip() in s for s in cand_skill_names)]
        missing_list = [r for r in required_skills if r and str(r).lower().strip() not in [str(m).lower().strip() for m in matched_list]]
        matched_count = len(matched_list)
        skill_score = (matched_count / len(req_lower)) * 100 if req_lower else 0.0

    # Experience score
    try:
        min_exp = float(criteria.get("min_experience") or 0)
    except (ValueError, TypeError):
        min_exp = 0.0
        
    try:
        exp_years = float(total_experience_years or 0)
    except (ValueError, TypeError):
        exp_years = 0.0
        
    experience_score = min(100.0, (exp_years / max(min_exp, 1.0)) * 100) if min_exp > 0 else 50.0

    # Location score
    preferred_locs = criteria.get("preferred_locations") or []
    if not isinstance(preferred_locs, list):
        preferred_locs = []
    cand_location = str(location or "").lower().strip()
    
    location_score = 100.0
    if preferred_locs:
        pref_locs_lower = [str(l).lower().strip() for l in preferred_locs if l]
        if pref_locs_lower:
            location_score = 100.0 if any(l in cand_location for l in pref_locs_lower) else 30.0

    # Weighted overall score
    weights = criteria.get("weights") or {}
    if not isinstance(weights, dict):
        weights = {}
        
    def _safe_float(v, default=0.0):
        try:
            return float(v) if v is not None else default
        except (ValueError, TypeError):
            return default
            
    w_skills = _safe_float(weights.get("skills"), 0.5)
    w_exp = _safe_float(weights.get("experience"), 0.3)
    w_loc = _safe_float(weights.get("location"), 0.2)
    
    score = (
        skill_score * w_skills + 
        experience_score * w_exp + 
        location_score * w_loc
    )
    score = round(score)
    
    # Fallback boost for regex parsers (retains behavior of existing system)
    if parsing_method in ("regex", "error_fallback"):
        score = max(score, min_match_score + 10) if min_match_score else 85
        
    score = min(100, score)
    recommendation = "Strong" if score >= 70 else ("Moderate" if score >= 40 else "Weak")
    
    return {
        "match_score": float(score),
        "recommendation": recommendation,
        "match_details": {
            "match_score": float(score),
            "skill_score": round(skill_score, 1),
            "experience_score": round(experience_score, 1),
            "location_score": round(location_score, 1),
            "matched_skills": matched_list,
            "missing_skills": missing_list,
            "matched_count": len(matched_list),
            "total_required": len(req_lower)
        }
    }


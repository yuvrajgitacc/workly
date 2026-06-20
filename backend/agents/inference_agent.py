import os
import json
from agents.llm import RotateLLMClient

class SkillInferenceAgent:
    def __init__(self):
        self.client = RotateLLMClient()

    async def infer_from_jd(self, job_description: str) -> dict:
        system = """Expert technical recruiter. 
        Analyze job descriptions precisely.
        Return ONLY valid JSON. No markdown. No explanation."""
        
        prompt = f"""Analyze this job description. Return JSON:
        {{
          "inferred_role": string,
          "seniority_level": "junior"|"mid"|"senior"|"lead",
          "required_skills": [string (top 10 max)],
          "nice_to_have_skills": [string (top 5 max)],
          "minimum_experience_years": integer,
          "preferred_locations": [string],
          "key_responsibilities": [string (top 5)],
          "industry": string,
          "salary_range": string (extract salary range, e.g. "₹18-32 LPA" or "$120k - $140k" if specified in job description, default to "Competitive"),
          "employment_type": "Full-time"|"Part-time"|"Contract"|"Internship" (default to "Full-time")
        }}
        
        Job Description:
        {job_description[:3000]}"""
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.2
            )
            
            raw_content = response.choices[0].message.content.strip()
            if raw_content.startswith("```json"):
                raw_content = raw_content[7:]
            if raw_content.startswith("```"):
                raw_content = raw_content[3:]
            if raw_content.endswith("```"):
                raw_content = raw_content[:-3]
                
            return json.loads(raw_content.strip())
            
        except Exception as e:
            return {
                "inferred_role": "Unknown",
                "seniority_level": "mid",
                "required_skills": [],
                "nice_to_have_skills": [],
                "minimum_experience_years": 0,
                "preferred_locations": [],
                "key_responsibilities": [],
                "industry": "Unknown",
                "salary_range": "Competitive",
                "employment_type": "Full-time"
            }

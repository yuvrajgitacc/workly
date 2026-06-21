import json
import logging
from agents.llm import RotateLLMClient

logger = logging.getLogger(__name__)

class AtsParsingAgent:
    """
    Brand-new, advanced, and token-efficient Resume Parsing Agent.
    
    Uses gemini-1.5-flash for maximum parsing accuracy at minimal token billing cost.
    Parses resume text directly into the schema expected by the React frontend editor,
    eliminating translation mismatch bugs and supporting projects, summaries, and clickable links.
    """
    def __init__(self):
        self.client = RotateLLMClient()

    async def parse(self, text: str) -> dict:
        if not text or not text.strip():
            return {
                "personalInfo": {"fullName": "", "title": "", "email": "", "phone": "", "location": "", "website": "", "linkedin": "", "github": ""},
                "summary": "",
                "skills": [],
                "experience": [],
                "education": [],
                "projects": []
            }

        # Keep within input token limits
        text = text[:9000]

        system_prompt = (
            "You are an expert AI Resume Parsing Agent. Your task is to analyze raw resume text and extract "
            "all sections into a structured JSON format.\n\n"
            "You must return ONLY a single, valid JSON object matching the exact schema below:\n"
            "{\n"
            "  \"personalInfo\": {\n"
            "    \"fullName\": \"<candidate name or empty string>\",\n"
            "    \"title\": \"<current professional headline/title or empty string>\",\n"
            "    \"email\": \"<email address or empty string>\",\n"
            "    \"phone\": \"<phone number or empty string>\",\n"
            "    \"location\": \"<city, state/country or empty string>\",\n"
            "    \"website\": \"<personal website URL or empty string>\",\n"
            "    \"linkedin\": \"<LinkedIn profile URL or empty string>\",\n"
            "    \"github\": \"<GitHub profile URL or empty string>\"\n"
            "  },\n"
            "  \"summary\": \"<professional summary paragraph or empty string>\",\n"
            "  \"skills\": [\"<skill string 1>\", \"<skill string 2>\", ...],\n"
            "  \"experience\": [\n"
            "    {\n"
            "      \"company\": \"<company name>\",\n"
            "      \"title\": \"<job title/role>\",\n"
            "      \"location\": \"<work location or empty string>\",\n"
            "      \"startDate\": \"<start date, e.g. Mar 2022>\",\n"
            "      \"endDate\": \"<end date, e.g. Present or Dec 2023>\",\n"
            "      \"bullets\": [\"<quantified achievement bullet point 1>\", ...]\n"
            "    }\n"
            "  ],\n"
            "  \"education\": [\n"
            "    {\n"
            "      \"school\": \"<institution/university name>\",\n"
            "      \"degree\": \"<degree earned, e.g. B.S. Computer Science>\",\n"
            "      \"location\": \"<school location or empty string>\",\n"
            "      \"startDate\": \"<start date or empty string>\",\n"
            "      \"endDate\": \"<graduation year or date>\"\n"
            "    }\n"
            "  ],\n"
            "  \"projects\": [\n"
            "    {\n"
            "      \"name\": \"<project title>\",\n"
            "      \"link\": \"<project repository or live URL or empty string>\",\n"
            "      \"description\": \"<description of project and technologies used>\"\n"
            "    }\n"
            "  ]\n"
            "}\n\n"
            "Rules:\n"
            "1. Extract all projects, descriptions, and clickable repository links correctly.\n"
            "2. Make sure date representations use clear MM/YYYY or short month format (e.g. 'Oct 2021').\n"
            "3. Clean up bullet points: remove leading hyphens, bullet characters, or tabs from string values.\n"
            "4. Return ONLY valid JSON. No conversational remarks, no markdown formatting (no ```json code blocks)."
        )

        try:
            response = self.client.chat.completions.create(
                model="gemini-1.5-flash",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Resume Text:\n{text}"}
                ],
                temperature=0.1
            )
            raw = response.choices[0].message.content.strip()
            
            # Safe strip potential code block wrapper
            if raw.startswith("```json"):
                raw = raw[7:]
            if raw.startswith("```"):
                raw = raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3]
            raw = raw.strip()

            parsed = json.loads(raw)
            
            # Post-parse integrity check
            if not isinstance(parsed.get("personalInfo"), dict):
                parsed["personalInfo"] = {}
            if not isinstance(parsed.get("skills"), list):
                parsed["skills"] = []
            if not isinstance(parsed.get("experience"), list):
                parsed["experience"] = []
            if not isinstance(parsed.get("education"), list):
                parsed["education"] = []
            if not isinstance(parsed.get("projects"), list):
                parsed["projects"] = []
                
            # Add unique IDs to experience, education, and projects so key-index renders properly in React
            import uuid
            for item in parsed["experience"]:
                item["id"] = str(uuid.uuid4())
            for item in parsed["education"]:
                item["id"] = str(uuid.uuid4())
            for item in parsed["projects"]:
                item["id"] = str(uuid.uuid4())
                
            return parsed

        except Exception as e:
            logger.error("AtsParsingAgent parsing failed: %s", e)
            return {
                "personalInfo": {"fullName": "", "title": "", "email": "", "phone": "", "location": "", "website": "", "linkedin": "", "github": ""},
                "summary": "",
                "skills": [],
                "experience": [],
                "education": [],
                "projects": [],
                "error": str(e)
            }

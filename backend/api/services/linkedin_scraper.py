import re
import json
import httpx
from agents.llm import RotateLLMClient

def extract_linkedin_slug_info(url: str) -> dict:
    """
    Parses a LinkedIn Job URL to extract fallback Job Title, Company, and Job ID.
    Supports formats:
      - https://www.linkedin.com/jobs/view/software-engineer-at-google-3958210344
      - https://www.linkedin.com/jobs/view/3958210344
      - https://www.linkedin.com/jobs/collections/recommended/?currentJobId=3958210344
    """
    result = {
        "job_id": None,
        "fallback_title": "Job Posting Target",
        "fallback_company": "LinkedIn Company",
        "fallback_location": "Remote"
    }

    # 1. Try to extract currentJobId from query parameters
    job_id_match = re.search(r"currentJobId=(\d+)", url)
    if job_id_match:
        result["job_id"] = job_id_match.group(1)

    # 2. Try to match /jobs/view/ slug and ID
    # Pattern matches optional slug text followed by the numeric ID
    view_match = re.search(r"linkedin\.com/jobs/view/(?:([a-zA-Z0-9\-]+)-)?(\d+)", url)
    if view_match:
        slug_text = view_match.group(1)
        job_id = view_match.group(2)
        if job_id:
            result["job_id"] = job_id
        
        if slug_text:
            # Check for "-at-" separator in slug
            if "-at-" in slug_text.lower():
                parts = re.split(r"-at-", slug_text, flags=re.IGNORECASE)
                if len(parts) >= 2:
                    result["fallback_title"] = parts[0].replace("-", " ").title()
                    result["fallback_company"] = parts[1].replace("-", " ").title()
            else:
                result["fallback_title"] = slug_text.replace("-", " ").title()

    return result

def fetch_linkedin_job_details(url: str) -> dict:
    """
    Fetches job details from LinkedIn job post URL.
    Returns:
      {
        "job_title": str,
        "company_name": str,
        "location": str,
        "job_description": str,
        "source_url": str,
        "scraped_successfully": bool
      }
    """
    slug_info = extract_linkedin_slug_info(url)
    fallback_title = slug_info["fallback_title"]
    fallback_company = slug_info["fallback_company"]
    fallback_location = slug_info["fallback_location"]

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "max-age=0",
    }

    html_content = ""
    scraped_successfully = False

    try:
        # Fetch target URL with 5 seconds timeout
        print(f"[LINKEDIN SCRAPER] Fetching URL: {url}", flush=True)
        with httpx.Client(follow_redirects=True, headers=headers, timeout=5.0) as client:
            response = client.get(url)
            
            # Check if it was redirected to login or captcha pages
            if response.status_code == 200 and "login" not in response.url.path.lower():
                html_content = response.text
                # Simple check if page actually contains typical job body or meta tags
                if "og:title" in html_content or "og:description" in html_content:
                    scraped_successfully = True
                    print("[LINKEDIN SCRAPER] Successfully retrieved HTML content.", flush=True)
            else:
                print(f"[LINKEDIN SCRAPER] Request blocked or redirected (status={response.status_code}, url={response.url})", flush=True)
    except Exception as e:
        print(f"[LINKEDIN SCRAPER] Failed to fetch URL due to: {e}", flush=True)

    llm = RotateLLMClient()

    if scraped_successfully and len(html_content) > 200:
        # Extract headers and body tag contents (to fit inside context limit)
        # Grab head and a part of body
        head_match = re.search(r"<head>([\s\S]*?)</head>", html_content)
        body_match = re.search(r"<body>([\s\S]*?)</body>", html_content)
        
        extracted_html = ""
        if head_match:
            extracted_html += head_match.group(1)
        if body_match:
            # Get up to 5000 characters from body to extract description
            extracted_html += "\n" + body_match.group(1)[:5000]
        else:
            extracted_html += "\n" + html_content[:6000]

        system_prompt = (
            "You are an expert LinkedIn job description extractor.\n"
            "Analyze the HTML metadata, page titles, and body to extract job listing details.\n"
            "Return ONLY valid JSON. No markdown codeblocks, no extra explanations."
        )
        prompt = f"""Extract the Job Title, Company Name, Location, and full Job Description from the following HTML context.
If some details are missing, construct them logically based on the HTML metadata.

HTML context:
{extracted_html[:8000]}

Return JSON format:
{{
  "job_title": "string",
  "company_name": "string",
  "location": "string",
  "job_description": "string"
}}"""
        try:
            res_content = llm.generate(prompt=prompt, system_prompt=system_prompt).strip()
            if res_content.startswith("```json"):
                res_content = res_content[7:]
            if res_content.startswith("```"):
                res_content = res_content[3:]
            if res_content.endswith("```"):
                res_content = res_content[:-3]
            
            parsed_data = json.loads(res_content.strip())
            return {
                "job_title": parsed_data.get("job_title") or fallback_title,
                "company_name": parsed_data.get("company_name") or fallback_company,
                "location": parsed_data.get("location") or fallback_location,
                "job_description": parsed_data.get("job_description") or "Details could not be parsed.",
                "source_url": url,
                "scraped_successfully": True
            }
        except Exception as e:
            print(f"[LINKEDIN SCRAPER] LLM extraction from HTML failed: {e}", flush=True)

    # Fallback mode: Slug-based info & LLM generated mockup
    print(f"[LINKEDIN SCRAPER] Falling back to AI mockup generation for {fallback_title} at {fallback_company}", flush=True)
    system_prompt = (
        "You are an expert recruitment system AI.\n"
        "Your job is to simulate a realistic job posting description based on a job title and company.\n"
        "Return ONLY valid JSON. No markdown codeblocks, no extra explanations."
    )
    prompt = f"""Generate a realistic, typical job posting description and requirements list for safety audit purposes.
Job Title: {fallback_title}
Company Name: {fallback_company}
Location: {fallback_location}

Include typical responsibilities, required skills, and clear parameters. Make it look like a real job description.
Return JSON format:
{{
  "job_title": "{fallback_title}",
  "company_name": "{fallback_company}",
  "location": "{fallback_location}",
  "job_description": "string"
}}"""
    try:
        res_content = llm.generate(prompt=prompt, system_prompt=system_prompt).strip()
        if res_content.startswith("```json"):
            res_content = res_content[7:]
        if res_content.startswith("```"):
            res_content = res_content[3:]
        if res_content.endswith("```"):
            res_content = res_content[:-3]
        
        parsed_data = json.loads(res_content.strip())
        return {
            "job_title": parsed_data.get("job_title") or fallback_title,
            "company_name": parsed_data.get("company_name") or fallback_company,
            "location": parsed_data.get("location") or fallback_location,
            "job_description": parsed_data.get("job_description") or f"We are hiring a {fallback_title}.",
            "source_url": url,
            "scraped_successfully": False
        }
    except Exception as e:
        print(f"[LINKEDIN SCRAPER] LLM fallback mockup generation failed: {e}", flush=True)
        return {
            "job_title": fallback_title,
            "company_name": fallback_company,
            "location": fallback_location,
            "job_description": f"Typical listing for a {fallback_title} at {fallback_company}. Location: {fallback_location}.",
            "source_url": url,
            "scraped_successfully": False
        }

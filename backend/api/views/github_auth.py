import os
import json
import secrets
import logging
import urllib.request
import urllib.parse
from datetime import datetime, timedelta
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from passlib.context import CryptContext
from jose import jwt

from api.models import Company, APIKey, JobSeekerAccount, DeveloperAccount, DeveloperAPIKey, BillingSubscription
from api.decorators import JWT_SECRET, JWT_ALGORITHM
from models.schemas import success_response, error_response

logger = logging.getLogger(__name__)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

CLIENT_ID = os.getenv("GITHUB_CLIENT_ID")
CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")

def verify_github_code(code):
    if not CLIENT_ID or not CLIENT_SECRET:
        raise ValueError("GitHub client credentials not configured on backend")
        
    try:
        # Step 1: Exchange code for access token
        token_data = urllib.parse.urlencode({
            'client_id': CLIENT_ID,
            'client_secret': CLIENT_SECRET,
            'code': code
        }).encode('utf-8')
        
        token_req = urllib.request.Request(
            'https://github.com/login/oauth/access_token',
            data=token_data,
            headers={'Accept': 'application/json'}
        )
        
        with urllib.request.urlopen(token_req) as response:
            token_res = json.loads(response.read().decode())
            access_token = token_res.get('access_token')
            
        if not access_token:
            error_msg = token_res.get('error_description') or token_res.get('error') or "Failed to exchange authorization code"
            raise ValueError(error_msg)
            
        # Step 2: Fetch user profile
        profile_req = urllib.request.Request(
            'https://api.github.com/user',
            headers={
                'Authorization': f'token {access_token}',
                'User-Agent': 'Vishleshan-Backend'
            }
        )
        
        with urllib.request.urlopen(profile_req) as response:
            user_profile = json.loads(response.read().decode())
            
        # Step 3: Fetch emails (emails can be null in profile if private)
        emails_req = urllib.request.Request(
            'https://api.github.com/user/emails',
            headers={
                'Authorization': f'token {access_token}',
                'User-Agent': 'Vishleshan-Backend'
            }
        )
        
        primary_email = None
        try:
            with urllib.request.urlopen(emails_req) as response:
                emails_res = json.loads(response.read().decode())
                for item in emails_res:
                    if item.get('primary') and item.get('verified'):
                        primary_email = item.get('email')
                        break
                if not primary_email and emails_res:
                    primary_email = emails_res[0].get('email')
        except Exception as email_err:
            logger.warning("Failed to fetch GitHub emails: %s", email_err)
            
        email = primary_email or user_profile.get('email')
        if not email:
            raise ValueError("No verified email associated with this GitHub account")
            
        return {
            'email': email.strip().lower(),
            'name': user_profile.get('name') or user_profile.get('login') or 'GitHub User'
        }
    except Exception as e:
        logger.error("GitHub verification error: %s", e)
        raise ValueError(str(e))

@csrf_exempt
def recruiter_auth_github(request):
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        data = json.loads(request.body)
        code = data.get("code")
        if not code:
            return JsonResponse(error_response("code is required"), status=400)

        user_info = verify_github_code(code)
        email = user_info["email"]
        name = user_info["name"]

        company = Company.objects.filter(email=email).first()
        if not company:
            # Auto register
            company = Company.objects.create(
                name=name,
                email=email,
                password_hash=pwd_context.hash(secrets.token_urlsafe(16)),
                tier="free"
            )
            # Create default API key
            APIKey.objects.create(
                company=company,
                key_name="Default Key",
                secret_key="vish_live_" + secrets.token_urlsafe(24),
                public_key="vish_pub_" + secrets.token_urlsafe(24),
                environment="production"
            )

        api_key_obj = APIKey.objects.filter(company_id=company.id, is_active=True).first()
        masked_secret = None
        if api_key_obj:
            masked_secret = api_key_obj.secret_key[:12] + "••••"

        payload = {
            "company_id": str(company.id),
            "email": company.email,
            "tier": company.tier,
            "exp": datetime.utcnow() + timedelta(days=7)
        }
        token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

        return JsonResponse(success_response({
            "jwt_token": token,
            "company_id": str(company.id),
            "name": company.name,
            "email": company.email,
            "tier": company.tier,
            "api_key": masked_secret
        }))
    except ValueError as e:
        return JsonResponse(error_response(str(e)), status=400)
    except Exception as e:
        logger.error("Recruiter GitHub login error: %s", e)
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

@csrf_exempt
def seeker_auth_github(request):
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        data = json.loads(request.body)
        code = data.get("code")
        if not code:
            return JsonResponse(error_response("code is required"), status=400)

        user_info = verify_github_code(code)
        email = user_info["email"]
        name = user_info["name"]

        seeker = JobSeekerAccount.objects.filter(email=email, is_active=True).first()
        if not seeker:
            # Auto register
            seeker = JobSeekerAccount.objects.create(
                full_name=name,
                email=email,
                password_hash=pwd_context.hash(secrets.token_urlsafe(16)),
                tier="free"
            )

        payload = {
            "seeker_id": str(seeker.id),
            "email": seeker.email,
            "tier": seeker.tier,
            "exp": datetime.utcnow() + timedelta(days=7),
        }
        token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

        seeker_dict = {
            "id": str(seeker.id),
            "full_name": seeker.full_name,
            "email": seeker.email,
            "phone": seeker.phone,
            "location": seeker.location,
            "headline": seeker.headline,
            "tier": seeker.tier,
            "has_resume": bool(seeker.resume_file_path or seeker.resume_data),
            "skills": seeker.skills,
            "created_at": seeker.created_at.isoformat() if seeker.created_at else None,
        }

        return JsonResponse(success_response({
            "seeker_token": token,
            "seeker": seeker_dict
        }))
    except ValueError as e:
        return JsonResponse(error_response(str(e)), status=400)
    except Exception as e:
        logger.error("Seeker GitHub login error: %s", e)
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

@csrf_exempt
def developer_auth_github(request):
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        data = json.loads(request.body)
        code = data.get("code")
        if not code:
            return JsonResponse(error_response("code is required"), status=400)

        user_info = verify_github_code(code)
        email = user_info["email"]
        name = user_info["name"]

        dev = DeveloperAccount.objects.filter(email=email).first()
        is_new = False
        test_secret = None
        test_public = None
        live_secret = None
        live_public = None

        if not dev:
            is_new = True
            # Auto register
            dev = DeveloperAccount.objects.create(
                company_name=name,
                email=email,
                password_hash=pwd_context.hash(secrets.token_urlsafe(16)),
                tier="free",
                is_verified=True
            )
            # Create default API keys
            test_secret = "vish_test_" + secrets.token_urlsafe(24)
            test_public = "vish_pub_test_" + secrets.token_urlsafe(24)
            live_secret = "vish_live_" + secrets.token_urlsafe(24)
            live_public = "vish_pub_" + secrets.token_urlsafe(24)

            DeveloperAPIKey.objects.create(
                developer=dev,
                key_name="Test Key",
                secret_key=test_secret,
                public_key=test_public,
                environment="test"
            )
            DeveloperAPIKey.objects.create(
                developer=dev,
                key_name="Production Key",
                secret_key=live_secret,
                public_key=live_public,
                environment="production"
            )
            # Create subscription
            BillingSubscription.objects.create(
                developer=dev,
                plan="free",
                status="active"
            )

        payload = {
            "developer_id": str(dev.id),
            "email": dev.email,
            "tier": dev.tier,
            "exp": datetime.utcnow() + timedelta(days=7)
        }
        token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

        resp = {
            "jwt_token": token,
            "developer_id": str(dev.id),
            "email": dev.email,
            "tier": dev.tier,
            "company_name": dev.company_name
        }
        if is_new:
            resp.update({
                "test_secret_key": test_secret,
                "test_public_key": test_public,
                "secret_key": live_secret,
                "public_key": live_public,
                "is_new": True
            })

        return JsonResponse(success_response(resp))
    except ValueError as e:
        return JsonResponse(error_response(str(e)), status=400)
    except Exception as e:
        logger.error("Developer GitHub login error: %s", e)
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

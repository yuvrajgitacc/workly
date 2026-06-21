import os
import json
import secrets
import logging
import urllib.request
from datetime import datetime, timedelta
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from passlib.context import CryptContext
from jose import jwt
from google.oauth2 import id_token
from google.auth.transport import requests

from api.models import Company, APIKey, JobSeekerAccount, DeveloperAccount, DeveloperAPIKey, BillingSubscription
from api.decorators import JWT_SECRET, JWT_ALGORITHM
from models.schemas import success_response, error_response

logger = logging.getLogger(__name__)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

CLIENT_ID = os.getenv("GOOGLE_OAUTH_CLIENT_ID")
CLIENT_SECRET = os.getenv("GOOGLE_OAUTH_CLIENT_SECRET")

def verify_google_token(token):
    # Method 1: Verify as ID token (JWT)
    try:
        idinfo = id_token.verify_oauth2_token(token, requests.Request(), CLIENT_ID)
        return {
            "email": idinfo["email"].strip().lower(),
            "name": idinfo.get("name", "Google User")
        }
    except Exception as e:
        logger.info("Google token not verified as ID token, trying as access token: %s", e)

    # Method 2: Verify as Access token
    try:
        url = f"https://www.googleapis.com/oauth2/v3/userinfo?access_token={token}"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            if "email" in data:
                return {
                    "email": data["email"].strip().lower(),
                    "name": data.get("name") or data.get("given_name") or "Google User"
                }
    except Exception as e:
        logger.error("Failed to verify Google token: %s", e)

    raise ValueError("Invalid Google credentials")

@csrf_exempt
def recruiter_auth_google(request):
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        data = json.loads(request.body)
        credential = data.get("credential")
        if not credential:
            return JsonResponse(error_response("credential is required"), status=400)

        user_info = verify_google_token(credential)
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
        logger.error("Recruiter Google login error: %s", e)
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

@csrf_exempt
def seeker_auth_google(request):
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        data = json.loads(request.body)
        credential = data.get("credential")
        if not credential:
            return JsonResponse(error_response("credential is required"), status=400)

        user_info = verify_google_token(credential)
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
        logger.error("Seeker Google login error: %s", e)
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

@csrf_exempt
def developer_auth_google(request):
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        data = json.loads(request.body)
        credential = data.get("credential")
        if not credential:
            return JsonResponse(error_response("credential is required"), status=400)

        user_info = verify_google_token(credential)
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
        logger.error("Developer Google login error: %s", e)
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

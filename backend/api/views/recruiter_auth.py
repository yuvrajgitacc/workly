import os
import json
import secrets
from datetime import datetime, timedelta, timezone
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from passlib.context import CryptContext
from jose import jwt

from api.models import Company, APIKey
from api.decorators import require_recruiter_jwt, JWT_SECRET, JWT_ALGORITHM, redis_client
from models.schemas import success_response, error_response

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

@csrf_exempt
def register(request):
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        # Check if the request is JSON or multipart/form-data
        content_type = request.META.get('CONTENT_TYPE', '')
        if 'application/json' in content_type:
            data = json.loads(request.body)
            email = data.get("email")
            password = data.get("password")
            company_name = data.get("name") or data.get("company_name") or "Unnamed Company"
            industry = data.get("industry")
            hq_location = data.get("hq_location") or data.get("location")
            company_size = data.get("company_size") or data.get("size")
            try:
                founded_year = int(data.get("founded_year") or data.get("founded")) if (data.get("founded_year") or data.get("founded")) else None
            except (ValueError, TypeError):
                founded_year = None
            website_url = data.get("website_url") or data.get("website")
            about = data.get("about") or data.get("description")
            logo_file = None
        else:
            email = request.POST.get("email")
            password = request.POST.get("password")
            company_name = request.POST.get("name") or request.POST.get("company_name") or "Unnamed Company"
            industry = request.POST.get("industry")
            hq_location = request.POST.get("hq_location") or request.POST.get("location")
            company_size = request.POST.get("company_size") or request.POST.get("size")
            try:
                founded_year = int(request.POST.get("founded_year") or request.POST.get("founded")) if (request.POST.get("founded_year") or request.POST.get("founded")) else None
            except (ValueError, TypeError):
                founded_year = None
            website_url = request.POST.get("website_url") or request.POST.get("website")
            about = request.POST.get("about") or request.POST.get("description")
            logo_file = request.FILES.get("logo")

        if not email or not password:
            return JsonResponse(error_response("Email and password are required"), status=400)

        if Company.objects.filter(email=email).exists():
            return JsonResponse(error_response("Email already registered"), status=400)

        hashed_pwd = pwd_context.hash(password[:72])

        # Generate slug from company name
        from django.utils.text import slugify
        base_slug = slugify(company_name)
        if not base_slug:
            base_slug = "company"
        slug = base_slug
        counter = 1
        while Company.objects.filter(slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1

        new_company = Company.objects.create(
            name=company_name,
            email=email,
            password_hash=hashed_pwd,
            tier="free",
            industry=industry,
            hq_location=hq_location,
            company_size=company_size,
            founded_year=founded_year,
            website_url=website_url,
            about=about,
            slug=slug
        )

        if logo_file:
            import uuid
            upload_dir = os.getenv("UPLOAD_DIR", "uploads")
            comp_dir = os.path.join(upload_dir, "companies", str(new_company.id))
            os.makedirs(comp_dir, exist_ok=True)
            ext = os.path.splitext(logo_file.name)[1]
            fname = f"logo_{uuid.uuid4().hex}{ext}"
            file_path = os.path.join(comp_dir, fname)
            with open(file_path, "wb+") as f:
                for chunk in logo_file.chunks():
                    f.write(chunk)
            new_company.logo_path = f"/uploads/companies/{new_company.id}/{fname}"
            new_company.save(update_fields=["logo_path"])

        secret = "vish_live_" + secrets.token_urlsafe(24)
        public = "vish_pub_" + secrets.token_urlsafe(24)

        new_key = APIKey.objects.create(
            company=new_company,
            key_name="Default Key",
            secret_key=secret,
            public_key=public,
            environment="production"
        )

        payload = {
            "company_id": str(new_company.id),
            "email": new_company.email,
            "tier": new_company.tier,
            "exp": datetime.utcnow() + timedelta(days=7)
        }
        token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

        return JsonResponse(success_response({
            "jwt_token": token,
            "company_id": str(new_company.id),
            "name": new_company.name,
            "email": new_company.email,
            "tier": new_company.tier,
            "secret_key": secret,
            "api_key": public,
            "public_key": public,
            "message": "Save your secret key — shown only once"
        }))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

@csrf_exempt
def login(request):
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        data = json.loads(request.body)
        email = data.get("email")
        password = data.get("password")
        if not email or not password:
            return JsonResponse(error_response("Email and password are required"), status=400)

        company = Company.objects.filter(email=email).first()
        if not company:
            return JsonResponse(error_response("Invalid credentials"), status=401)

        if not pwd_context.verify(password[:72], company.password_hash):
            return JsonResponse(error_response("Invalid credentials"), status=401)

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
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

@csrf_exempt
@require_recruiter_jwt
def generate_api_key(request):
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        data = {}
        if request.body:
            try:
                data = json.loads(request.body)
            except ValueError:
                pass
        
        resolved_key_name = data.get("name") or data.get("key_name") or "Unnamed Key"
        secret = "vish_live_" + secrets.token_urlsafe(24)
        public = "vish_pub_" + secrets.token_urlsafe(24)

        new_key = APIKey.objects.create(
            company=request.company,
            key_name=resolved_key_name,
            secret_key=secret,
            public_key=public,
            environment="production"
        )

        return JsonResponse(success_response({
            "id": str(new_key.id),
            "key_name": new_key.key_name,
            "secret_key": secret,
            "public_key": public,
            "message": "Save your new secret key — shown only once"
        }))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

@csrf_exempt
@require_recruiter_jwt
def get_api_keys(request):
    if request.method != "GET":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        keys = APIKey.objects.filter(company_id=request.company.id, is_active=True)
        result = []
        year_month = datetime.now().strftime("%Y-%m")

        for k in keys:
            this_month_calls = 0
            for action in ["parse", "match", "chat"]:
                redis_key = f"rl:{k.secret_key}:{year_month}:{action}"
                try:
                    val = redis_client.get(redis_key)
                    if val:
                        this_month_calls += int(val)
                except Exception:
                    pass

            result.append({
                "id": str(k.id),
                "key_name": k.key_name,
                "environment": k.environment,
                "secret_key_masked": k.secret_key[:12] + "••••••••",
                "public_key": k.public_key,
                "last_used_at": k.last_used_at.isoformat() if k.last_used_at else None,
                "created_at": k.created_at.isoformat() if k.created_at else None,
                "this_month_calls": this_month_calls
            })

        return JsonResponse(success_response(result))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

@csrf_exempt
@require_recruiter_jwt
def revoke_api_key(request, key_id):
    if request.method != "DELETE":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        import uuid
        try:
            parsed_key_id = uuid.UUID(key_id)
        except ValueError:
            return JsonResponse(error_response("Invalid API Key ID format"), status=400)

        api_key_obj = APIKey.objects.filter(id=parsed_key_id, company_id=request.company.id).first()
        if not api_key_obj:
            return JsonResponse(error_response("API Key not found"), status=404)

        api_key_obj.is_active = False
        api_key_obj.save(update_fields=['is_active'])
        return JsonResponse(success_response({"message": "Key revoked"}))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

@csrf_exempt
@require_recruiter_jwt
def me(request):
    if request.method != "GET":
        return JsonResponse(error_response("Method not allowed"), status=405)
    return JsonResponse(success_response({
        "id": str(request.company.id),
        "name": request.company.name,
        "email": request.company.email,
        "tier": request.company.tier,
        "created_at": request.company.created_at.isoformat() if request.company.created_at else None,
        "industry": request.company.industry,
        "hq_location": request.company.hq_location,
        "company_size": request.company.company_size,
        "founded_year": request.company.founded_year,
        "website_url": request.company.website_url,
        "about": request.company.about,
        "logo_path": request.company.logo_path,
    }))

@csrf_exempt
def health_check(request):
    if request.method != "GET":
        return JsonResponse(error_response("Method not allowed"), status=405)
    return JsonResponse(success_response({
        "status": "ok",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }))

@csrf_exempt
def logout(request):
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)
    return JsonResponse(success_response({"message": "Successfully logged out"}))

@csrf_exempt
@require_recruiter_jwt
def change_password(request):
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        data = json.loads(request.body)
        old_password = data.get("old_password")
        new_password = data.get("new_password")
        if not old_password or not new_password:
            return JsonResponse(error_response("old_password and new_password are required"), status=400)

        company = request.company
        if not pwd_context.verify(old_password[:72], company.password_hash):
            return JsonResponse(error_response("Invalid current password"), status=401)

        company.password_hash = pwd_context.hash(new_password[:72])
        company.save(update_fields=["password_hash"])
        return JsonResponse(success_response({"message": "Password updated successfully"}))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

@csrf_exempt
@require_recruiter_jwt
def update_profile(request):
    if request.method not in ["POST", "PUT"]:
        return JsonResponse(error_response("Method not allowed"), status=405)
    try:
        data = json.loads(request.body)
        name = data.get("name") or data.get("company_name")
        email = data.get("email")
        logo_base64 = data.get("logo")

        company = request.company
        if name:
            company.name = name
        if email:
            if Company.objects.filter(email=email).exclude(id=company.id).exists():
                return JsonResponse(error_response("Email already registered by another account"), status=400)
            company.email = email

        # Handle company logo Base64 upload
        if logo_base64:
            import base64
            import uuid
            if logo_base64.startswith("data:"):
                # format: data:image/png;base64,iVBORw0KGgoAAA...
                header, base64_data = logo_base64.split(";base64,")
                ext = "." + header.split("/")[1].split("+")[0]
                if ext == ".jpeg":
                    ext = ".jpg"
            else:
                base64_data = logo_base64
                ext = ".png"

            img_data = base64.b64decode(base64_data)
            upload_dir = os.getenv("UPLOAD_DIR", "uploads")
            comp_dir = os.path.join(upload_dir, "companies", str(company.id))
            os.makedirs(comp_dir, exist_ok=True)

            fname = f"logo_{uuid.uuid4().hex}{ext}"
            file_path = os.path.join(comp_dir, fname)

            with open(file_path, "wb") as f:
                f.write(img_data)

            company.logo_path = f"/uploads/companies/{company.id}/{fname}"
        elif "logo" in data and not data.get("logo"):
            company.logo_path = None

        company.save()
        return JsonResponse(success_response({
            "id": str(company.id),
            "name": company.name,
            "email": company.email,
            "tier": company.tier,
            "logo_path": company.logo_path,
            "created_at": company.created_at.isoformat() if company.created_at else None
        }))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)



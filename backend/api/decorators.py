import os
import calendar
import redis
import logging
from datetime import datetime
from functools import wraps
from django.http import JsonResponse
from django.utils import timezone
from jose import jwt, JWTError

logger = logging.getLogger(__name__)

from api.models import Company, APIKey, DeveloperAccount, DeveloperAPIKey

TIER_LIMITS = {
  "free":       {"parse": 100,   "match": 50,    "chat": 20,    "scan": 0},
  "starter":    {"parse": 1000,  "match": 500,   "chat": 200,   "scan": 100},
  "business":   {"parse": 10000, "match": -1,    "chat": -1,    "scan": 1000},
  "enterprise": {"parse": -1,    "match": -1,    "chat": -1,    "scan": -1}
}

TIER_ORDER = {"free": 0, "starter": 1, "business": 2, "enterprise": 3}

JWT_SECRET = os.getenv("JWT_SECRET", "supersecret")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

redis_client = redis.from_url(
  os.getenv("REDIS_URL", "redis://localhost:6379")
)

def verify_api_key_helper(request):
    """
    Authenticates via X-API-Key header, query param, or Bearer JWT token.
    Stashes the validated company on request.company.
    Stashes the resolved api_key object on request.company._api_key_obj for rate limits.
    """
    # 1. API Key from header or query param
    x_api_key = request.headers.get("X-API-Key", "")
    if not x_api_key:
        x_api_key = request.GET.get("x_api_key", "")
        
    if x_api_key:
        # Check standard recruiter keys
        api_key_obj = APIKey.objects.filter(secret_key=x_api_key, is_active=True).first()
        if api_key_obj:
            company = Company.objects.filter(id=api_key_obj.company_id, is_active=True).first()
            if company:
                api_key_obj.last_used_at = timezone.now()
                api_key_obj.save(update_fields=['last_used_at'])
                company._api_key_obj = api_key_obj
                request.company = company
                return True

        # Check developer keys
        dev_key_obj = DeveloperAPIKey.objects.filter(secret_key=x_api_key, is_active=True).first()
        if dev_key_obj:
            dev_acc = dev_key_obj.developer
            company, created = Company.objects.get_or_create(
                email=dev_acc.email,
                defaults={
                    "name": dev_acc.company_name,
                    "password_hash": dev_acc.password_hash,
                    "tier": dev_acc.tier,
                    "is_active": True
                }
            )
            if not created and company.tier != dev_acc.tier:
                company.tier = dev_acc.tier
                company.save(update_fields=['tier'])
            dev_key_obj.last_used_at = timezone.now()
            dev_key_obj.save(update_fields=['last_used_at'])
            company._api_key_obj = dev_key_obj
            request.company = company
            return True

    # 2. JWT Bearer token
    auth_header = request.headers.get("Authorization", "")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            company_id = payload.get("company_id")
            if company_id:
                company = Company.objects.filter(id=company_id, is_active=True).first()
                if company:
                    # Try to find default api key for rate-limit tracking
                    api_key_obj = APIKey.objects.filter(company_id=company.id, is_active=True).first()
                    company._api_key_obj = api_key_obj
                    request.company = company
                    return True
        except JWTError:
            pass

    return False


def require_api_key(view_func):
    """Decorator to enforce API Key or JWT authentication."""
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        if not verify_api_key_helper(request):
            return JsonResponse({
                "success": False,
                "data": None,
                "error": "Invalid or missing authentication"
            }, status=401)
        return view_func(request, *args, **kwargs)
    return _wrapped_view


def require_recruiter_jwt(view_func):
    """Decorator to enforce JWT Bearer token (recruiter dashboard)."""
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header or not auth_header.startswith("Bearer "):
            return JsonResponse({
                "success": False,
                "data": None,
                "error": "Invalid token format"
            }, status=401)
            
        token = auth_header.split(" ")[1]
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            company_id = payload.get("company_id")
            if not company_id:
                return JsonResponse({
                    "success": False,
                    "data": None,
                    "error": "Invalid token payload"
                }, status=401)
        except JWTError:
            return JsonResponse({
                "success": False,
                "data": None,
                "error": "Invalid or expired token"
            }, status=401)

        company = Company.objects.filter(id=company_id, is_active=True).first()
        if not company:
            return JsonResponse({
                "success": False,
                "data": None,
                "error": "Company not found or inactive"
            }, status=401)

        request.company = company
        return view_func(request, *args, **kwargs)
    return _wrapped_view


def require_developer_jwt(view_func):
    """Decorator to enforce Developer JWT (developer portal)."""
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header or not auth_header.startswith("Bearer "):
            return JsonResponse({
                "success": False,
                "data": None,
                "error": "Invalid token format"
            }, status=401)
            
        token = auth_header.split(" ")[1]
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            developer_id = payload.get("developer_id")
            if not developer_id:
                return JsonResponse({
                    "success": False,
                    "data": None,
                    "error": "Invalid token payload"
                }, status=401)
        except JWTError:
            return JsonResponse({
                "success": False,
                "data": None,
                "error": "Invalid or expired token"
            }, status=401)

        developer = DeveloperAccount.objects.filter(id=developer_id).first()
        if not developer:
            return JsonResponse({
                "success": False,
                "data": None,
                "error": "Developer not found"
            }, status=401)

        request.developer = developer
        return view_func(request, *args, **kwargs)
    return _wrapped_view


def check_rate_limit(action: str):
    """Decorator factory to check Redis API usage rate limits."""
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            # Assumes require_api_key decorator has run or we verify it now
            if not hasattr(request, 'company'):
                if not verify_api_key_helper(request):
                    return JsonResponse({
                        "success": False,
                        "data": None,
                        "error": "Invalid or missing authentication"
                    }, status=401)

            company = request.company
            api_key = getattr(company, '_api_key_obj', None)
            if not api_key:
                return view_func(request, *args, **kwargs)  # skip rate limit if no API key object stashed

            tier = company.tier or "free"
            limits = TIER_LIMITS.get(tier, TIER_LIMITS["free"])
            action_limit = limits.get(action, 0)
            
            if action_limit == -1:
                return view_func(request, *args, **kwargs)

            now = datetime.now()
            year_month = now.strftime("%Y-%m")
            redis_key = f"rl:{api_key.secret_key}:{year_month}:{action}"
            
            try:
                used = redis_client.incr(redis_key)
                
                if used == 1:
                    last_day = calendar.monthrange(now.year, now.month)[1]
                    end_of_month = datetime(now.year, now.month, last_day, 23, 59, 59)
                    ttl = int((end_of_month - now).total_seconds())
                    redis_client.expire(redis_key, ttl)
                    
                if used > action_limit:
                    redis_client.decr(redis_key)
                    return JsonResponse({
                        "success": False,
                        "error": f"Monthly {action} limit reached",
                        "data": {
                            "limit": action_limit,
                            "used": used - 1,
                            "tier": tier,
                            "resets_on": "first of next month",
                            "upgrade_url": "/developer/portal/billing"
                        }
                    }, status=429)
            except Exception as redis_err:
                logger.warning("Redis rate limit check failed, bypassing: %s", redis_err)
                
            return view_func(request, *args, **kwargs)
        return _wrapped_view
    return decorator


def require_tier(minimum_tier: str):
    """Decorator factory to enforce a minimum developer tier."""
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            if not hasattr(request, 'developer'):
                # Call developer jwt validator if not already run
                auth_header = request.headers.get("Authorization", "")
                if not auth_header or not auth_header.startswith("Bearer "):
                    return JsonResponse({"success": False, "error": "Invalid token format"}, status=401)
                token = auth_header.split(" ")[1]
                try:
                    payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
                    developer_id = payload.get("developer_id")
                    developer = DeveloperAccount.objects.filter(id=developer_id).first()
                    if not developer:
                        return JsonResponse({"success": False, "error": "Developer not found"}, status=401)
                    request.developer = developer
                except JWTError:
                    return JsonResponse({"success": False, "error": "Invalid or expired token"}, status=401)

            developer = request.developer
            minimum_rank = TIER_ORDER.get(minimum_tier, 0)
            current_rank = TIER_ORDER.get(developer.tier or "free", 0)
            
            if current_rank < minimum_rank:
                return JsonResponse({
                    "success": False,
                    "error": "Insufficient tier level"
                }, status=403)
                
            return view_func(request, *args, **kwargs)
        return _wrapped_view
    return decorator

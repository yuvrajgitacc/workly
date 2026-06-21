import json
import secrets
from datetime import datetime, timezone, timedelta
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from api.models import DeveloperAccount, DeveloperAPIKey, APIUsageLog, MonthlyUsageSummary
from api.decorators import require_developer_jwt
from models.schemas import success_response, error_response

TIER_KEY_LIMITS = {
    "free": 2,
    "starter": 5,
    "business": -1,
    "enterprise": -1
}

@csrf_exempt
@require_developer_jwt
def keys_root(request):
    """Handles GET / (list keys) and POST /generate (generate key)"""
    dev = request.developer
    
    if request.method == "GET":
        try:
            keys = DeveloperAPIKey.objects.filter(developer_id=dev.id, is_active=True)
            year_month = datetime.now().strftime("%Y-%m")

            test_keys = []
            production_keys = []

            for k in keys:
                usage = MonthlyUsageSummary.objects.filter(
                    developer_id=dev.id,
                    year_month=year_month
                ).first()
                
                this_month_calls = 0
                if usage:
                    this_month_calls = (usage.parse_count or 0) + (usage.match_count or 0) + (usage.chat_count or 0) + (getattr(usage, 'scan_count', 0) or 0)

                key_data = {
                    "id": str(k.id),
                    "key_name": k.key_name,
                    "environment": k.environment,
                    "secret_key": k.secret_key,
                    "secret_key_masked": k.secret_key[:12] + "••••••••",
                    "public_key": k.public_key,
                    "is_active": k.is_active,
                    "last_used_at": k.last_used_at.isoformat() if k.last_used_at else None,
                    "created_at": k.created_at.isoformat() if k.created_at else None,
                    "this_month_calls": this_month_calls
                }

                if k.environment == "test":
                    test_keys.append(key_data)
                else:
                    production_keys.append(key_data)

            return JsonResponse(success_response({
                "test_keys": test_keys,
                "production_keys": production_keys
            }))
        except Exception as e:
            return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

    elif request.method == "POST":
        try:
            data = json.loads(request.body)
            key_name = data.get("key_name")
            env = data.get("environment", "test")
            if not key_name:
                return JsonResponse(error_response("key_name is required"), status=400)

            current_count = DeveloperAPIKey.objects.filter(developer_id=dev.id, is_active=True).count()
            limit = TIER_KEY_LIMITS.get(dev.tier, 2)

            if limit != -1 and current_count >= limit:
                return JsonResponse(error_response(f"Key limit reached for {dev.tier} plan"), status=400)

            if env == "test":
                secret = "vish_test_" + secrets.token_urlsafe(24)
            else:
                secret = "vish_live_" + secrets.token_urlsafe(24)
            public = "vish_pub_" + secrets.token_urlsafe(24)

            new_key = DeveloperAPIKey.objects.create(
                developer=dev,
                key_name=key_name,
                secret_key=secret,
                public_key=public,
                environment=env
            )

            return JsonResponse(success_response({
                "id": str(new_key.id),
                "key_name": new_key.key_name,
                "environment": new_key.environment,
                "secret_key": secret,
                "public_key": public,
                "message": "Save your secret key — shown only once"
            }))
        except Exception as e:
            return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)
    else:
        return JsonResponse(error_response("Method not allowed"), status=405)

@csrf_exempt
@require_developer_jwt
def key_operations(request, key_id):
    """Handles PATCH (rename) and DELETE (revoke) api-key"""
    dev = request.developer
    try:
        key = DeveloperAPIKey.objects.filter(id=key_id, developer_id=dev.id).first()
        if not key:
            return JsonResponse(error_response("API Key not found"), status=404)

        if request.method == "PATCH":
            data = json.loads(request.body)
            key_name = data.get("key_name")
            if not key_name:
                return JsonResponse(error_response("key_name is required"), status=400)
            
            key.key_name = key_name
            key.save(update_fields=['key_name'])
            return JsonResponse(success_response({"message": "Key renamed", "key_name": key.key_name}))

        elif request.method == "DELETE":
            key.is_active = False
            key.save(update_fields=['is_active'])
            return JsonResponse(success_response({"message": "Key revoked"}))

        else:
            return JsonResponse(error_response("Method not allowed"), status=405)
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

@csrf_exempt
@require_developer_jwt
def rotate_key(request, key_id):
    if request.method != "POST":
        return JsonResponse(error_response("Method not allowed"), status=405)
    dev = request.developer
    try:
        key = DeveloperAPIKey.objects.filter(id=key_id, developer_id=dev.id).first()
        if not key:
            return JsonResponse(error_response("API Key not found"), status=404)

        if key.environment == "test":
            new_secret = "vish_test_" + secrets.token_urlsafe(24)
        else:
            new_secret = "vish_live_" + secrets.token_urlsafe(24)

        key.secret_key = new_secret
        key.save(update_fields=['secret_key'])

        return JsonResponse(success_response({
            "id": str(key.id),
            "secret_key": new_secret,
            "message": "Key rotated. Old secret is now invalid. Save this — shown only once"
        }))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

@csrf_exempt
@require_developer_jwt
def key_usage(request, key_id):
    if request.method != "GET":
        return JsonResponse(error_response("Method not allowed"), status=405)
    dev = request.developer
    try:
        key = DeveloperAPIKey.objects.filter(id=key_id, developer_id=dev.id).first()
        if not key:
            return JsonResponse(error_response("API Key not found"), status=404)

        period = request.GET.get("period", "7d")
        days = int(period.replace("d", ""))
        cutoff = datetime.utcnow() - timedelta(days=days)

        logs = APIUsageLog.objects.filter(
            api_key_id=key.id,
            timestamp__gte=cutoff
        )

        daily = {}
        endpoint_counts = {}
        total_latency = 0
        total_calls = logs.count()

        for log in logs:
            day_str = log.timestamp.strftime("%Y-%m-%d") if log.timestamp else "unknown"
            daily[day_str] = daily.get(day_str, 0) + 1

            ep = log.endpoint or "unknown"
            endpoint_counts[ep] = endpoint_counts.get(ep, 0) + 1

            total_latency += log.latency_ms or 0

        # Top 10 endpoints
        top_endpoints = sorted(endpoint_counts.items(), key=lambda x: x[1], reverse=True)[:10]

        avg_latency = round(total_latency / total_calls, 1) if total_calls > 0 else 0

        return JsonResponse(success_response({
            "daily_breakdown": daily,
            "total_calls": total_calls,
            "top_endpoints": [{"endpoint": ep, "count": cnt} for ep, cnt in top_endpoints],
            "avg_latency_ms": avg_latency
        }))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

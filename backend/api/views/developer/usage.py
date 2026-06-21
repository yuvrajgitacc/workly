import math
from datetime import datetime, timedelta, timezone
from django.http import JsonResponse
from django.db.models import Avg, Count
from django.views.decorators.csrf import csrf_exempt

from api.models import DeveloperAccount, DeveloperAPIKey, APIUsageLog, MonthlyUsageSummary
from api.decorators import require_developer_jwt
from models.schemas import success_response, error_response

TIER_LIMITS_MAP = {
    "free": {"parse": 100, "match": 50, "chat": 20, "scan": 0},
    "starter": {"parse": 1000, "match": 500, "chat": 200, "scan": 100},
    "business": {"parse": 10000, "match": -1, "chat": -1, "scan": 1000},
    "enterprise": {"parse": -1, "match": -1, "chat": -1, "scan": -1}
}

@csrf_exempt
@require_developer_jwt
def usage_summary(request):
    if request.method != "GET":
        return JsonResponse(error_response("Method not allowed"), status=405)
    dev = request.developer
    try:
        year_month = datetime.now().strftime("%Y-%m")

        summary = MonthlyUsageSummary.objects.filter(
            developer_id=dev.id,
            year_month=year_month
        ).first()

        parse_count = summary.parse_count if summary else 0
        match_count = summary.match_count if summary else 0
        chat_count = summary.chat_count if summary else 0
        scan_count = getattr(summary, 'scan_count', 0) if summary else 0
        
        total_calls = 0
        if summary:
            if hasattr(summary, 'total_api_calls') and summary.total_api_calls:
                total_calls = summary.total_api_calls
            else:
                total_calls = parse_count + match_count + chat_count + scan_count

        limits_map = TIER_LIMITS_MAP.get(dev.tier, TIER_LIMITS_MAP["free"])

        def calc_pct(count, limit):
            if limit == -1:
                return 0
            return min(round(count / limit * 100, 1), 100) if limit > 0 else 0

        percentages = {
            "parse": calc_pct(parse_count, limits_map["parse"]),
            "match": calc_pct(match_count, limits_map["match"]),
            "chat": calc_pct(chat_count, limits_map["chat"]),
            "scan": calc_pct(scan_count, limits_map.get("scan", 0))
        }

        limits = {
            "parse": {"count": parse_count, "limit": limits_map["parse"]},
            "match": {"count": match_count, "limit": limits_map["match"]},
            "chat": {"count": chat_count, "limit": limits_map["chat"]},
            "scan": {"count": scan_count, "limit": limits_map.get("scan", 0)}
        }

        overage = any(p > 100 for p in percentages.values())
        
        active_keys = DeveloperAPIKey.objects.filter(developer_id=dev.id, is_active=True).count()

        cutoff = datetime.utcnow() - timedelta(days=30)
        avg_latency_val = APIUsageLog.objects.filter(
            developer_id=dev.id,
            timestamp__gte=cutoff
        ).aggregate(Avg('latency_ms'))['latency_ms__avg']
        
        avg_latency = float(avg_latency_val or 0)

        logs = APIUsageLog.objects.filter(developer_id=dev.id).order_by("-timestamp")[:5]
        recent_logs = []
        
        def time_ago(dt):
            if not dt: 
                return "unknown"
            # Handle timezone naive vs aware
            now = timezone.now() if dt.tzinfo else datetime.utcnow()
            diff = now - dt
            s = diff.total_seconds()
            if s < 60: 
                return "just now"
            if s < 3600: 
                return f"{math.floor(s/60)}m ago"
            if s < 86400: 
                return f"{math.floor(s/3600)}h ago"
            return f"{math.floor(s/86400)}d ago"
            
        for log in logs:
            recent_logs.append({
                "method": "POST" if log.action_type in ("parse", "match", "chat", "scan") else "GET",
                "endpoint": log.endpoint,
                "latency_ms": log.latency_ms,
                "status": log.status_code,
                "time_ago": time_ago(log.timestamp)
            })
            
        calls_by_type = {
            "parse": parse_count,
            "match": match_count,
            "chat": chat_count,
            "scan": scan_count,
            "export": summary.export_count if summary else 0
        }

        return JsonResponse(success_response({
            "current_month": year_month,
            "parse_count": parse_count,
            "resumes_parsed": parse_count,
            "match_count": match_count,
            "chat_count": chat_count,
            "total_calls": total_calls,
            "limits": limits,
            "percentages": percentages,
            "overage": overage,
            "active_keys": active_keys,
            "avg_latency_ms": avg_latency,
            "calls_by_type": calls_by_type,
            "recent_logs": recent_logs
        }))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

@csrf_exempt
@require_developer_jwt
def usage_timeline(request):
    if request.method != "GET":
        return JsonResponse(error_response("Method not allowed"), status=405)
    dev = request.developer
    try:
        days = int(request.GET.get("days", 30))
        action_type = request.GET.get("action_type")

        cutoff = datetime.utcnow() - timedelta(days=days)
        logs = APIUsageLog.objects.filter(developer_id=dev.id, timestamp__gte=cutoff)
        
        if action_type:
            logs = logs.filter(action_type=action_type)

        daily_data = {}
        for log in logs:
            day_str = log.timestamp.strftime("%Y-%m-%d") if log.timestamp else "unknown"
            if day_str not in daily_data:
                daily_data[day_str] = {"parse": 0, "match": 0, "chat": 0, "scan": 0, "total": 0}
            action = log.action_type or "other"
            if action in daily_data[day_str]:
                daily_data[day_str][action] += 1
            daily_data[day_str]["total"] += 1

        timeline = []
        current = datetime.utcnow() - timedelta(days=days)
        # Handle timezone naive
        while current <= datetime.utcnow():
            day_str = current.strftime("%Y-%m-%d")
            entry = daily_data.get(day_str, {"parse": 0, "match": 0, "chat": 0, "scan": 0, "total": 0})
            timeline.append({"date": day_str, **entry})
            current += timedelta(days=1)

        return JsonResponse(success_response({"timeline": timeline}))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

@csrf_exempt
@require_developer_jwt
def usage_endpoints(request):
    if request.method != "GET":
        return JsonResponse(error_response("Method not allowed"), status=405)
    dev = request.developer
    try:
        period = request.GET.get("period", "30d")
        days = int(period.replace("d", ""))
        cutoff = datetime.utcnow() - timedelta(days=days)

        logs = APIUsageLog.objects.filter(developer_id=dev.id, timestamp__gte=cutoff)

        endpoint_data = {}
        for log in logs:
            ep = log.endpoint or "unknown"
            if ep not in endpoint_data:
                endpoint_data[ep] = {"count": 0, "total_latency": 0, "errors": 0}
            endpoint_data[ep]["count"] += 1
            endpoint_data[ep]["total_latency"] += log.latency_ms or 0
            status = log.status_code or 200
            if status >= 400:
                endpoint_data[ep]["errors"] += 1

        endpoints = []
        for ep, data in sorted(endpoint_data.items(), key=lambda x: x[1]["count"], reverse=True)[:10]:
            avg_latency = round(data["total_latency"] / data["count"], 1) if data["count"] > 0 else 0
            error_rate = round(data["errors"] / data["count"] * 100, 1) if data["count"] > 0 else 0
            endpoints.append({
                "endpoint": ep,
                "count": data["count"],
                "avg_latency_ms": avg_latency,
                "error_rate": error_rate
            })

        return JsonResponse(success_response({"endpoints": endpoints}))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

@csrf_exempt
@require_developer_jwt
def usage_history(request):
    if request.method != "GET":
        return JsonResponse(error_response("Method not allowed"), status=405)
    dev = request.developer
    try:
        months = int(request.GET.get("months", 6))
        summaries = MonthlyUsageSummary.objects.filter(developer_id=dev.id).order_by("-year_month")[:months]

        result = []
        for r in summaries:
            scan_c = getattr(r, 'scan_count', 0) or 0
            result.append({
                "year_month": r.year_month,
                "parse": r.parse_count or 0,
                "match": r.match_count or 0,
                "chat": r.chat_count or 0,
                "scan": scan_c,
                "total": (r.parse_count or 0) + (r.match_count or 0) + (r.chat_count or 0) + scan_c
            })

        return JsonResponse(success_response({"months": result}))
    except Exception as e:
        return JsonResponse(error_response(f"Server error: {str(e)}"), status=500)

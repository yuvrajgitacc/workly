"""
API URL Configuration
Wires all Django views to their HTTP routes,
mirroring the original FastAPI router layout.
"""
from django.urls import path
from api.views import (
    recruiter_auth,
    sessions,
    candidates,
    chat,
    export,
    ingest,
    apikey_auth,
    jobs,
    protection,
    seeker_auth,
    seeker_resume,
    seeker_jobs,
    google_auth,
    github_auth,
    seeker_resume_builder,
    parse,
)
from api.views.developer import (
    auth as dev_auth,
    keys as dev_keys,
    usage as dev_usage,
    billing as dev_billing,
    webhooks as dev_webhooks,
    embed as dev_embed,
)

urlpatterns = [
    # ── Health Check ──────────────────────────────────────────────────────────
    path('health', recruiter_auth.health_check, name='health-check'),

    # ── Recruiter Auth ─────────────────────────────────────────────────────────
    path('api/v1/auth/register', recruiter_auth.register, name='auth-register'),
    path('api/v1/auth/login', recruiter_auth.login, name='auth-login'),
    path('api/v1/auth/login-google', google_auth.recruiter_auth_google, name='auth-login-google'),
    path('api/v1/auth/login-github', github_auth.recruiter_auth_github, name='auth-login-github'),
    path('api/v1/auth/me', recruiter_auth.me, name='auth-me'),
    path('api/v1/auth/logout', recruiter_auth.logout, name='auth-logout'),
    path('api/v1/auth/change-password', recruiter_auth.change_password, name='auth-change-password'),
    path('api/v1/auth/update-profile', recruiter_auth.update_profile, name='auth-update-profile'),

    # Recruiter portal API-key management
    # Frontend calls: POST /auth/api-keys/generate, GET /auth/api-keys, DELETE /auth/api-keys/{id}
    path('api/v1/auth/api-keys/generate', recruiter_auth.generate_api_key, name='auth-api-keys-generate'),
    path('api/v1/auth/api-keys', recruiter_auth.get_api_keys, name='auth-get-api-keys'),
    path('api/v1/auth/api-keys/<str:key_id>', recruiter_auth.revoke_api_key, name='auth-revoke-api-key'),

    # ── API Key ↔ JWT Auth ─────────────────────────────────────────────────────
    path('api/v1/auth/generate-key', apikey_auth.generate_key_endpoint, name='auth-generate-key'),
    path('api/v1/auth/token-from-key', apikey_auth.token_from_key, name='auth-token-from-key'),
    path('api/v1/auth/verify', apikey_auth.verify_token, name='auth-verify-token'),

    # ── Sessions ───────────────────────────────────────────────────────────────
    # session_root handles both GET (list) and POST (create)
    path('api/v1/sessions', sessions.session_root, name='sessions-root'),
    # session_detail handles GET (retrieve), PATCH (update), DELETE (archive)
    path('api/v1/sessions/<str:session_id>', sessions.session_detail, name='sessions-detail'),
    path('api/v1/sessions/<str:session_id>/criteria', sessions.set_criteria, name='sessions-criteria'),
    path('api/v1/sessions/<str:session_id>/infer-skills', sessions.infer_skills, name='sessions-infer-skills'),
    # Frontend calls: POST /sessions/{id}/match-all
    path('api/v1/sessions/<str:session_id>/match-all', sessions.trigger_match_all, name='sessions-match-all'),
    path('api/v1/sessions/<str:session_id>/analytics', sessions.session_analytics, name='sessions-analytics'),
    path('api/v1/sessions/<str:session_id>/applicants', sessions.session_applicants, name='sessions-applicants'),

    # ── Candidates ─────────────────────────────────────────────────────────────
    path('api/v1/sessions/<str:session_id>/candidates',
         candidates.list_candidates, name='candidates-list'),
    path('api/v1/sessions/<str:session_id>/candidates/bulk-reject',
         candidates.bulk_reject, name='candidates-bulk-reject'),
    # Frontend: GET /candidates/{id} → get_candidate, DELETE /candidates/{id} → delete_candidate
    # Both handled in get_candidate view (dispatches by method)
    path('api/v1/sessions/<str:session_id>/candidates/<str:cand_id>',
         candidates.get_candidate, name='candidates-get'),
    path('api/v1/sessions/<str:session_id>/candidates/<str:cand_id>/action',
         candidates.candidate_action, name='candidates-action'),

    # ── Chat ───────────────────────────────────────────────────────────────────
    path('api/v1/sessions/<str:session_id>/chat', chat.chat, name='chat'),
    # Frontend: GET /chat/history → get history, DELETE /chat/history → clear history
    # Both handled in get_chat_history view (dispatches by method)
    path('api/v1/sessions/<str:session_id>/chat/history', chat.get_chat_history, name='chat-history'),

    # ── Export ─────────────────────────────────────────────────────────────────
    # Frontend calls: /sessions/{id}/export/candidates and /sessions/{id}/export/report
    path('api/v1/sessions/<str:session_id>/export/candidates', export.export_candidates, name='export-candidates'),
    path('api/v1/sessions/<str:session_id>/export/report', export.export_report, name='export-report'),

    # ── Ingest / Upload ────────────────────────────────────────────────────────
    path('api/v1/ingest/upload', ingest.upload_resumes, name='ingest-upload'),
    path('api/v1/ingest/zip', ingest.upload_zip, name='ingest-zip'),
    path('api/v1/ingest/gmail/connect', ingest.gmail_connect, name='ingest-gmail-connect'),
    path('api/v1/ingest/gmail/sync', ingest.gmail_sync, name='ingest-gmail-sync'),
    path('api/v1/ingest/gdrive/connect', ingest.gdrive_connect, name='ingest-gdrive-connect'),
    path('api/v1/ingest/gdrive/sync', ingest.gdrive_sync, name='ingest-gdrive-sync'),
    path('api/v1/ingest/google-form', ingest.google_form, name='ingest-google-form'),
    path('api/v1/ingest/ats-import', ingest.ats_import, name='ingest-ats-import'),
    path('api/v1/ingest/oauth/google/url', ingest.get_google_oauth_url, name='ingest-oauth-url'),
    path('api/v1/ingest/status/<str:job_id>', ingest.get_job_status, name='ingest-status'),

    # ── Developer Portal — Auth ────────────────────────────────────────────────
    path('api/developer/auth/register', dev_auth.register, name='dev-auth-register'),
    path('api/developer/auth/login', dev_auth.login, name='dev-auth-login'),
    path('api/developer/auth/login-google', google_auth.developer_auth_google, name='dev-auth-login-google'),
    path('api/developer/auth/login-github', github_auth.developer_auth_github, name='dev-auth-login-github'),
    path('api/developer/auth/me', dev_auth.get_me, name='dev-auth-me'),
    path('api/developer/auth/profile', dev_auth.patch_me, name='dev-auth-patch-me'),

    # ── Developer Portal — API Keys ────────────────────────────────────────────
    path('api/developer/keys', dev_keys.keys_root, name='dev-keys-root'),
    path('api/developer/keys/generate', dev_keys.keys_root, name='dev-keys-generate'),
    path('api/developer/keys/<str:key_id>', dev_keys.key_operations, name='dev-keys-ops'),
    path('api/developer/keys/<str:key_id>/rotate', dev_keys.rotate_key, name='dev-keys-rotate'),
    path('api/developer/keys/<str:key_id>/usage', dev_keys.key_usage, name='dev-keys-usage'),

    # ── Developer Portal — Usage ───────────────────────────────────────────────
    path('api/developer/usage', dev_usage.usage_summary, name='dev-usage-summary'),
    path('api/developer/usage/summary', dev_usage.usage_summary, name='dev-usage-summary-alias'),
    path('api/developer/usage/timeline', dev_usage.usage_timeline, name='dev-usage-timeline'),
    path('api/developer/usage/endpoints', dev_usage.usage_endpoints, name='dev-usage-endpoints'),
    path('api/developer/usage/history', dev_usage.usage_history, name='dev-usage-history'),

    # ── Developer Portal — Billing ─────────────────────────────────────────────
    path('api/developer/billing/plans', dev_billing.get_plans, name='dev-billing-plans'),
    path('api/developer/billing/subscribe', dev_billing.subscribe, name='dev-billing-subscribe'),
    path('api/developer/billing/verify-payment', dev_billing.verify_payment, name='dev-billing-verify'),
    path('api/developer/billing/subscription', dev_billing.current_subscription, name='dev-billing-subscription'),
    path('api/developer/billing/current', dev_billing.current_subscription, name='dev-billing-current'),

    # ── Developer Portal — Webhooks ────────────────────────────────────────────
    path('api/developer/webhooks', dev_webhooks.webhooks_root, name='dev-webhooks-root'),
    path('api/developer/webhooks/<str:webhook_id>', dev_webhooks.webhook_operations, name='dev-webhooks-ops'),
    path('api/developer/webhooks/<str:webhook_id>/test', dev_webhooks.test_webhook, name='dev-webhooks-test'),
    path('api/developer/webhooks/<str:webhook_id>/logs', dev_webhooks.webhook_logs, name='dev-webhooks-logs'),

    # ── Developer Portal — Embed ───────────────────────────────────────────────
    path('api/developer/embed/tokens', dev_embed.tokens_root, name='dev-embed-tokens'),
    path('api/developer/embed/tokens/<str:token_id>', dev_embed.revoke_embed_token, name='dev-embed-revoke-direct'),
    path('api/developer/embed/tokens/<str:token_id>/revoke', dev_embed.revoke_embed_token, name='dev-embed-revoke'),
    path('api/developer/embed/validate', dev_embed.validate_embed_token, name='dev-embed-validate'),

    # ── Public Job Seeker Portal ───────────────────────────────────────────────
    path('api/v1/public/jobs', jobs.list_public_jobs, name='public-jobs-list'),
    path('api/v1/public/jobs/scan-safety', jobs.scan_safety_arbitrary_public, name='public-jobs-scan-safety'),
    path('api/v1/public/jobs/<str:session_id>', jobs.get_public_job, name='public-jobs-detail'),
    path('api/v1/public/jobs/<str:session_id>/apply', jobs.apply_public_job, name='public-jobs-apply'),
    path('api/v1/public/jobs/<str:session_id>/safety-check', jobs.scan_job_safety_public, name='public-jobs-safety-check'),

    # ── Public Company Browse (no auth required) ──────────────────────────────
    path('api/v1/public/companies', seeker_jobs.public_list_companies, name='public-companies-list'),
    path('api/v1/public/companies/<str:company_id>', seeker_jobs.public_company_detail, name='public-company-detail'),

    # ── Protection & Fraud Detection ──────────────────────────────────────────
    path('api/v1/parse', parse.parse_resume, name='api-parse'),
    path('api/v1/match', parse.global_match, name='api-global-match'),
    path('api/v1/chat', parse.global_chat, name='api-global-chat'),
    path('api/v1/protection/scan', protection.scan_portfolio, name='protection-scan'),
    path('api/v1/protection/history', protection.get_scan_history, name='protection-history'),

    # ── Job Seeker Auth ────────────────────────────────────────────────────────
    path('api/v1/seeker/auth/register', seeker_auth.register, name='seeker-auth-register'),
    path('api/v1/seeker/auth/login', seeker_auth.login, name='seeker-auth-login'),
    path('api/v1/seeker/auth/login-google', google_auth.seeker_auth_google, name='seeker-auth-login-google'),
    path('api/v1/seeker/auth/login-github', github_auth.seeker_auth_github, name='seeker-auth-login-github'),
    path('api/v1/seeker/auth/me', seeker_auth.me, name='seeker-auth-me'),
    path('api/v1/seeker/auth/profile', seeker_auth.update_profile, name='seeker-auth-profile'),

    # ── Job Seeker Resume ──────────────────────────────────────────────────────
    path('api/v1/public/parse-resume', seeker_resume.public_parse_resume, name='public-resume-parse'),
    path('api/v1/seeker/resume', seeker_resume.get_resume, name='seeker-resume-get'),
    path('api/v1/seeker/resume/upload', seeker_resume.upload_resume, name='seeker-resume-upload'),
    path('api/v1/seeker/resume/parse-status', seeker_resume.get_parse_status, name='seeker-resume-parse-status'),
    path('api/v1/seeker/resume/enhance', seeker_resume.enhance_resume, name='seeker-resume-enhance'),

    # Seeker Resume Builder Additions
    path('api/agents/ats-check', seeker_resume_builder.ats_check, name='seeker-ats-check'),
    path('api/v1/seeker/resume/drafts', seeker_resume_builder.manage_drafts, name='seeker-drafts-root'),
    path('api/v1/seeker/resume/drafts/optimize', seeker_resume_builder.optimize_resume_draft, name='seeker-draft-optimize'),
    path('api/v1/seeker/resume/drafts/enhance', seeker_resume_builder.enhance_resume_draft, name='seeker-resume-enhance'),
    path('api/v1/seeker/resume/drafts/import-file', seeker_resume_builder.import_file_draft, name='seeker-draft-import-file'),
    path('api/v1/seeker/resume/drafts/<str:draft_id>', seeker_resume_builder.draft_detail, name='seeker-drafts-detail'),
    path('api/v1/seeker/resume/drafts/<str:draft_id>/activate', seeker_resume_builder.activate_draft, name='seeker-draft-activate'),
    path('api/v1/seeker/resume/drafts/<str:draft_id>/export-pdf', seeker_resume_builder.export_draft_pdf, name='seeker-draft-export-pdf'),
    path('api/v1/seeker/resume/drafts/<str:draft_id>/versions', seeker_resume_builder.manage_versions, name='seeker-draft-versions'),
    path('api/v1/seeker/resume/drafts/<str:draft_id>/versions/<str:version_id>/restore', seeker_resume_builder.restore_version, name='seeker-draft-version-restore'),
    path('api/v1/seeker/resume/recommend-templates', seeker_resume_builder.recommend_templates, name='seeker-recommend-templates'),
    path('api/debug/project-relevance', seeker_resume_builder.debug_project_relevance, name='debug-project-relevance'),

    # ── Job Seeker Jobs & Applications ─────────────────────────────────────────
    path('api/v1/seeker/jobs', seeker_jobs.list_jobs, name='seeker-jobs-list'),
    path('api/v1/seeker/jobs/saved', seeker_jobs.get_saved_jobs, name='seeker-jobs-saved'),
    path('api/v1/seeker/jobs/<str:session_id>', seeker_jobs.job_detail, name='seeker-jobs-detail'),
    path('api/v1/seeker/jobs/<str:session_id>/save', seeker_jobs.save_job, name='seeker-job-save'),
    path('api/v1/seeker/jobs/<str:session_id>/apply', seeker_jobs.apply_job, name='seeker-jobs-apply'),
    path('api/v1/seeker/applications', seeker_jobs.my_applications, name='seeker-applications'),
    path('api/v1/seeker/companies', seeker_jobs.list_companies, name='seeker-companies-list'),
    path('api/v1/seeker/companies/<str:company_id>', seeker_jobs.company_detail, name='seeker-company-detail'),
    path('api/v1/seeker/companies/<str:company_id>/follow', seeker_jobs.follow_company, name='seeker-company-follow'),

    # ── Job Seeker Notifications ───────────────────────────────────────────────
    path('api/v1/seeker/notifications', seeker_jobs.get_notifications, name='seeker-notifications'),
    path('api/v1/seeker/notifications/read-all', seeker_jobs.mark_all_notifications_read, name='seeker-notifications-read-all'),
    path('api/v1/seeker/notifications/<str:notif_id>/read', seeker_jobs.mark_notification_read, name='seeker-notification-read'),
]

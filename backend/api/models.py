import uuid
from django.db import models
from django.utils import timezone

class Company(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    email = models.CharField(max_length=255, unique=True)
    password_hash = models.CharField(max_length=500)
    tier = models.CharField(max_length=50, default="free")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    industry = models.CharField(max_length=255, null=True, blank=True)
    hq_location = models.CharField(max_length=255, null=True, blank=True)
    company_size = models.CharField(max_length=50, null=True, blank=True)
    founded_year = models.IntegerField(null=True, blank=True)
    website_url = models.CharField(max_length=500, null=True, blank=True)
    about = models.TextField(null=True, blank=True)
    logo_path = models.CharField(max_length=500, null=True, blank=True)
    slug = models.CharField(max_length=255, null=True, blank=True, unique=True)

    class Meta:
        db_table = "companies"

class APIKey(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, db_column="company_id")
    key_name = models.CharField(max_length=255, default="Default Key")
    secret_key = models.CharField(max_length=500, unique=True)
    public_key = models.CharField(max_length=500, unique=True)
    environment = models.CharField(max_length=20, default="production")
    is_active = models.BooleanField(default=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "api_keys"

class Session(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, db_column="company_id")
    name = models.CharField(max_length=255)
    job_title = models.CharField(max_length=255)
    job_description = models.TextField()
    rounds = models.JSONField(default=list)
    current_round_index = models.IntegerField(default=0)
    status = models.CharField(max_length=50, default="active")
    criteria = models.JSONField(default=dict)
    inferred_skills = models.JSONField(default=list)
    gmail_tokens = models.JSONField(null=True, blank=True)
    gdrive_tokens = models.JSONField(null=True, blank=True)
    gdrive_folder_id = models.CharField(max_length=255, null=True, blank=True)
    gmail_address = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    location = models.CharField(max_length=255, null=True, blank=True, default="Remote")
    employment_type = models.CharField(max_length=50, default="Full-time")
    salary_range = models.CharField(max_length=100, default="Competitive")
    experience_level = models.CharField(max_length=50, default="Mid-Level")

    class Meta:
        db_table = "sessions"

class Candidate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(Session, on_delete=models.CASCADE, db_column="session_id")
    name = models.CharField(max_length=255, null=True, blank=True)
    email = models.CharField(max_length=255, null=True, blank=True)
    phone = models.CharField(max_length=50, null=True, blank=True)
    location = models.CharField(max_length=255, null=True, blank=True)
    resume_photo_path = models.CharField(max_length=500, null=True, blank=True)
    resume_file_path = models.CharField(max_length=500, null=True, blank=True)
    raw_resume_data = models.JSONField(default=dict)
    normalized_skills = models.JSONField(default=list)
    match_score = models.FloatField(null=True, blank=True)
    match_details = models.JSONField(default=dict)
    recommendation = models.CharField(max_length=100, null=True, blank=True)
    total_experience_years = models.FloatField(default=0.0)
    current_round_index = models.IntegerField(default=0)
    status = models.CharField(max_length=50, default="new")
    source = models.CharField(max_length=50, default="upload")
    application_source = models.CharField(max_length=50, default="manual")
    agent_processing_status = models.CharField(max_length=50, default="completed")
    agent_error_message = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "candidates"

class SkillTaxonomy(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    skill_name = models.CharField(max_length=255)
    canonical_name = models.CharField(max_length=255)
    category = models.CharField(max_length=255, null=True, blank=True)
    parent_category = models.CharField(max_length=255, null=True, blank=True)
    synonyms = models.JSONField(default=list)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "skill_taxonomy"

class ChatHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(Session, on_delete=models.CASCADE, db_column="session_id")
    role = models.CharField(max_length=20)
    content = models.TextField()
    referenced_candidate_ids = models.JSONField(default=list)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "chat_history"

class IngestJob(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(Session, on_delete=models.CASCADE, db_column="session_id")
    type = models.CharField(max_length=50)
    status = models.CharField(max_length=50, default="pending")
    total_files = models.IntegerField(default=0)
    processed_files = models.IntegerField(default=0)
    failed_files = models.IntegerField(default=0)
    error_log = models.JSONField(default=list)
    created_at = models.DateTimeField(default=timezone.now)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "ingest_jobs"

class DeveloperAccount(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company_name = models.CharField(max_length=255)
    email = models.CharField(max_length=255, unique=True)
    password_hash = models.CharField(max_length=500)
    tier = models.CharField(max_length=50, default="free")
    is_verified = models.BooleanField(default=False)
    verification_token = models.CharField(max_length=500, null=True, blank=True)
    billing_customer_id = models.CharField(max_length=255, null=True, blank=True)
    website_url = models.CharField(max_length=500, null=True, blank=True)
    allowed_domains = models.JSONField(default=list)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "developer_accounts"

class DeveloperAPIKey(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    developer = models.ForeignKey(DeveloperAccount, on_delete=models.CASCADE, db_column="developer_id")
    key_name = models.CharField(max_length=255)
    secret_key = models.CharField(max_length=500, unique=True)
    public_key = models.CharField(max_length=500, unique=True)
    environment = models.CharField(max_length=20, default="test")
    is_active = models.BooleanField(default=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "developer_api_keys"

class APIUsageLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    developer = models.ForeignKey(DeveloperAccount, on_delete=models.SET_NULL, null=True, blank=True, db_column="developer_id")
    api_key = models.ForeignKey(DeveloperAPIKey, on_delete=models.SET_NULL, null=True, blank=True, db_column="api_key_id")
    endpoint = models.CharField(max_length=255, null=True, blank=True)
    action_type = models.CharField(max_length=50, null=True, blank=True)
    status_code = models.IntegerField(null=True, blank=True)
    latency_ms = models.IntegerField(null=True, blank=True)
    timestamp = models.DateTimeField(default=timezone.now)
    metadata = models.JSONField(db_column="metadata", null=True, blank=True)

    class Meta:
        db_table = "api_usage_logs"

class MonthlyUsageSummary(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    developer = models.ForeignKey(DeveloperAccount, on_delete=models.CASCADE, db_column="developer_id")
    year_month = models.CharField(max_length=7)
    parse_count = models.IntegerField(default=0)
    match_count = models.IntegerField(default=0)
    chat_count = models.IntegerField(default=0)
    export_count = models.IntegerField(default=0)
    scan_count = models.IntegerField(default=0)
    total_api_calls = models.IntegerField(default=0)

    class Meta:
        db_table = "monthly_usage_summary"
        unique_together = (("developer", "year_month"),)

class Webhook(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    developer = models.ForeignKey(DeveloperAccount, on_delete=models.CASCADE, db_column="developer_id")
    url = models.CharField(max_length=500)
    events = models.JSONField(default=list)
    secret = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    last_triggered_at = models.DateTimeField(null=True, blank=True)
    failure_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "webhooks"

class WebhookDeliveryLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    webhook = models.ForeignKey(Webhook, on_delete=models.CASCADE, db_column="webhook_id")
    event_type = models.CharField(max_length=255, null=True, blank=True)
    payload = models.JSONField(null=True, blank=True)
    status_code = models.IntegerField(null=True, blank=True)
    response_body = models.TextField(null=True, blank=True)
    error = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "webhook_delivery_logs"

class BillingSubscription(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    developer = models.ForeignKey(DeveloperAccount, on_delete=models.CASCADE, db_column="developer_id")
    plan = models.CharField(max_length=50, default="free")
    payment_id = models.CharField(max_length=255, null=True, blank=True)
    status = models.CharField(max_length=50, default="active")
    current_period_start = models.DateTimeField(null=True, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "billing_subscriptions"

class EmbedToken(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    developer = models.ForeignKey(DeveloperAccount, on_delete=models.CASCADE, db_column="developer_id")
    token = models.CharField(max_length=500, unique=True)
    allowed_domain = models.CharField(max_length=255)
    permissions = models.JSONField(default=list)
    is_active = models.BooleanField(default=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "embed_tokens"

class FraudScanLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, db_column="company_id")
    candidate_name = models.CharField(max_length=255)
    role = models.CharField(max_length=255, null=True, blank=True)
    location = models.CharField(max_length=255, null=True, blank=True)
    originality_score = models.IntegerField(default=100)
    ai_probability = models.IntegerField(default=0)
    plagiarism_score = models.IntegerField(default=0)
    status = models.CharField(max_length=100, default="Verified Clean")
    portfolios = models.JSONField(default=list)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "fraud_scan_logs"


# ─── Job Seeker Portal Models ──────────────────────────────────────────────────

class JobSeekerAccount(models.Model):
    id                = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    full_name         = models.CharField(max_length=255)
    email             = models.CharField(max_length=255, unique=True)
    password_hash     = models.CharField(max_length=500)
    phone             = models.CharField(max_length=50, null=True, blank=True)
    location          = models.CharField(max_length=255, null=True, blank=True)
    headline          = models.CharField(max_length=255, null=True, blank=True)  # e.g. "Frontend Developer"
    resume_file_path  = models.CharField(max_length=500, null=True, blank=True)
    resume_data       = models.JSONField(default=dict)    # parsed resume JSON
    enhanced_resume   = models.JSONField(default=dict)    # AI-enhanced version
    skills            = models.JSONField(default=list)    # normalized skills list
    tier              = models.CharField(max_length=50, default="free")  # free | premium
    is_active         = models.BooleanField(default=True)
    created_at        = models.DateTimeField(default=timezone.now)
    updated_at        = models.DateTimeField(auto_now=True)
    followed_companies = models.JSONField(default=list)
    active_resume_draft = models.ForeignKey("ResumeDraft", on_delete=models.SET_NULL, null=True, blank=True, db_column="active_resume_draft_id", related_name="active_seeker_account")
    last_ats_score = models.FloatField(null=True, blank=True)

    class Meta:
        db_table = "job_seeker_accounts"

    def __str__(self):
        return f"{self.full_name} <{self.email}>"


class ResumeDraft(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    seeker = models.ForeignKey(JobSeekerAccount, on_delete=models.CASCADE, db_column="seeker_id", related_name="resume_drafts")
    title = models.CharField(max_length=255)
    template_id = models.CharField(max_length=50, default="modern")
    content = models.JSONField(default=dict)
    ats_score = models.FloatField(null=True, blank=True)
    ats_report = models.JSONField(null=True, blank=True)
    exported_pdf_path = models.CharField(max_length=500, null=True, blank=True)
    is_active = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "resume_drafts"

    def __str__(self):
        return f"Draft '{self.title}' for {self.seeker.full_name}"


class JobApplication(models.Model):
    STATUS_CHOICES = [
        ("applied",     "Applied"),
        ("shortlisted", "Shortlisted"),
        ("rejected",    "Rejected"),
        ("hired",       "Hired"),
    ]

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    seeker      = models.ForeignKey(JobSeekerAccount, on_delete=models.CASCADE, db_column="seeker_id", related_name="applications")
    session     = models.ForeignKey(Session, on_delete=models.CASCADE, db_column="session_id", related_name="seeker_applications")
    candidate   = models.ForeignKey(Candidate, on_delete=models.SET_NULL, null=True, blank=True, db_column="candidate_id", related_name="seeker_application")
    cover_note  = models.TextField(null=True, blank=True)
    status      = models.CharField(max_length=50, choices=STATUS_CHOICES, default="applied")
    last_notified_round_index = models.IntegerField(null=True, blank=True)
    applied_at  = models.DateTimeField(default=timezone.now)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "job_applications"
        unique_together = (("seeker", "session"),)  # one application per job per seeker

    def __str__(self):
        return f"{self.seeker.full_name} → {self.session.job_title} [{self.status}]"


class Notification(models.Model):
    TYPE_CHOICES = [
        ("application_received", "Application Received"),
        ("status_updated",       "Status Updated"),
        ("new_match",            "New Job Match"),
        ("general",              "General"),
    ]

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    seeker     = models.ForeignKey(JobSeekerAccount, on_delete=models.CASCADE, null=True, blank=True, db_column="seeker_id", related_name="notifications")
    company    = models.ForeignKey(Company, on_delete=models.CASCADE, null=True, blank=True, db_column="company_id", related_name="notifications")
    type       = models.CharField(max_length=50, choices=TYPE_CHOICES, default="general")
    title      = models.CharField(max_length=255)
    message    = models.TextField()
    is_read    = models.BooleanField(default=False)
    link       = models.CharField(max_length=500, null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "notifications"
        ordering = ["-created_at"]

    def __str__(self):
        target = self.seeker or self.company
        return f"[{self.type}] → {target}: {self.title}"


class SavedJob(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    seeker = models.ForeignKey(JobSeekerAccount, on_delete=models.CASCADE, db_column="seeker_id", related_name="saved_jobs")
    session = models.ForeignKey(Session, on_delete=models.CASCADE, db_column="session_id", related_name="saved_by")
    saved_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "saved_jobs"
        unique_together = (("seeker", "session"),)

    def __str__(self):
        return f"{self.seeker.full_name} bookmarked {self.session.job_title}"

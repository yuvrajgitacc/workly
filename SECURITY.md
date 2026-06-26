# Security Policy — Vishleshan

**Vishleshan** is a Multi-Agent Recruitment Intelligence Platform that processes sensitive personal data (resumes, contact details, employment history) and provides fraud detection services. We take security seriously and appreciate responsible disclosure from the community.

---

## Supported Versions

The following versions of Vishleshan are actively maintained and receive security updates:

| Version | Supported          | Notes                              |
| ------- | ------------------ | ---------------------------------- |
| `1.x`   | :white_check_mark: | Current stable — actively patched  |
| `< 1.0` | :x:                | Pre-release builds — not supported |

We strongly recommend always running the latest `1.x` release.

---

## Scope

The following components are in scope for security reports:

| Component | Description |
|-----------|-------------|
| **Django REST Backend** | All API endpoints under `/api/v1/` |
| **Authentication** | JWT token flow (recruiter), Token authentication (seeker), and API Key auth (`X-API-Key`) |
| **Multi-Agent Pipeline** | Resume parsing, matching, fraud detection, and chatbot agents |
| **Developer Portal APIs** | Key management, subscription billing, rate limiting, webhooks |
| **Fraud Detection Engine** | Resume and job posting scanning endpoints |
| **LLM Router** | Gemini API key rotation and failover logic |
| **File Upload Handling** | PDF/DOCX/TXT resume ingestion via Celery workers |
| **Redis Rate Limiter** | Per-key monthly quota enforcement |

The following are **out of scope**:

- Third-party services (Supabase, Razorpay, Google Gemini API)
- Social engineering attacks against team members
- Denial-of-service attacks on the dev server
- Issues found only in unsupported / pre-release versions

---

## Sensitive Data Handled

Vishleshan processes and stores the following sensitive information. Any vulnerability affecting these assets is considered **high priority**:

- **PII** — Candidate names, email addresses, phone numbers, LinkedIn/GitHub profiles
- **Resume Contents** — Employment history, education records, project details
- **API Keys** — Developer-issued `vish_live_*` and `vish_test_*` keys
- **JWT Tokens & Seeker Tokens** — Recruiter session JWTs and seeker session tokens (`vish_seeker_token`)
- **Fraud Analysis Audits** — Detailed scan logs, website validation outcomes, and recruiter email verification metadata stored in the audit trail database
- **Payment Data** — Razorpay subscription metadata (no raw card data stored)
- **LLM API Keys & Google OAuth Credentials** — Gemini API keys, Google client ID, and Google client secret stored in the environment configuration

---

## Reporting a Vulnerability

If you discover a security vulnerability in Vishleshan, **please do not open a public GitHub Issue**. Instead, report it privately using one of the following channels:

### Option 1 — GitHub Private Security Advisory (Preferred)
Use GitHub's built-in [Private Vulnerability Reporting](https://github.com/DakshBhavsar007/Multi-Agent-Resume-Project/security/advisories/new) to submit a confidential advisory directly to the maintainers.

### Option 2 — Email
Send a detailed report to the project maintainers. Include the following information in your report:

```
Subject: [SECURITY] Vishleshan — <brief description>

- Component affected (e.g., "Resume Upload endpoint", "API Key auth")
- Steps to reproduce the vulnerability
- Potential impact (data exposure, privilege escalation, etc.)
- Proof of concept (code, curl commands, screenshots — if available)
- Suggested fix (optional)
```

---

## What to Expect After Reporting

| Timeline | Action |
|----------|--------|
| **Within 48 hours** | Acknowledgement of your report |
| **Within 7 days** | Initial triage — confirmed or declined with reasoning |
| **Within 30 days** | Patch released for confirmed vulnerabilities (critical issues prioritised) |
| **After patch release** | Public disclosure coordinated with the reporter |

We follow a **coordinated disclosure** policy. We ask that you give us reasonable time to patch before publicly disclosing the issue.

---

## Vulnerability Severity Classification

We use the following severity levels to prioritise reported issues:

| Severity | Examples |
|----------|---------|
| **Critical** | Unauthenticated access to candidate PII, API key leakage, RCE via file upload |
| **High** | Broken authentication, IDOR exposing other recruiters' data, JWT forgery |
| **Medium** | Rate limit bypass, excessive data exposure in API responses, SSRF |
| **Low** | Missing security headers, verbose error messages, minor info disclosure |

---

## Security Best Practices for Self-Hosting

If you are running Vishleshan locally or in your own infrastructure, follow these guidelines:

- **Never commit `.env` or `.env.local` to version control** — they contain Gemini API keys, DB credentials, JWT secrets, and Google Client IDs/Secrets.
- Use `.env.example` and `.env.local.example` as templates and populate secrets securely.
- Rotate `GEMINI_API_KEYS` and `GOOGLE_OAUTH_CLIENT_SECRET` regularly and revoke any compromised credentials immediately.

### API Keys
- Generate separate `vish_test_*` keys for development — never use production keys in testing.
- Revoke unused developer API keys from the Developer Portal dashboard.
- Set appropriate monthly quotas on all API keys to limit blast radius.

### Authentication
- Set a strong, unique `SECRET_KEY` in Django settings (minimum 50 random characters).
- Ensure JWT tokens have a short expiry (`ACCESS_TOKEN_LIFETIME`).
- Enable HTTPS in production — do not run with `DEBUG=True`.

### File Uploads
- Only `.pdf`, `.docx`, and `.txt` files are accepted by the resume parser — validate MIME types server-side.
- Uploaded files are processed by Celery workers in isolated threads; do not expose the `uploads/` directory publicly.

### Database & Redis
- Restrict PostgreSQL and Redis access to internal network only — do not expose ports publicly.
- Use strong credentials for both services and rotate them periodically.

---

## Known Security Features

Vishleshan includes the following built-in security controls:

- **API Key Authentication** — All developer API endpoints require a valid `X-API-Key` header
- **JWT Auth** — Recruiter sessions use short-lived JWT access tokens with refresh rotation
- **Redis Rate Limiting** — Per-key monthly quota enforcement prevents abuse
- **Fraud Detection Agent** — Scans uploaded resumes for AI-generated content, plagiarism, and ATS keyword stuffing
- **LinkedIn Job Post & Legitimacy Scanner** — Integrates scraping with 6-point AI verification audits (website validation, recruiter email domain checks, salary realism, LinkedIn presence, cloned post templates, and duplicate posting detection) to protect seekers from phishing and recruitment fraud.
- **LLM Key Rotation** — The `RotateLLMClient` rotates across multiple Gemini API keys to prevent single-key exposure
- **CORS Configuration** — Restrict allowed origins to your frontend domain in production

---

## Acknowledgements

We are grateful to security researchers who help make Vishleshan safer. Responsible disclosures will be credited in release notes (with your permission).

---

*Built as a Sem-IV Project — Multi-Agent Recruitment Intelligence Platform*

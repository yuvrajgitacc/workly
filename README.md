<div align="center">
  <img src="./assets/hero_banner.png" alt="Workly API Banner" width="100%" />

  <h1 align="center">Workly — Multi-Agent Recruitment Intelligence Platform</h1>

  <p align="center">
    <strong>A multi-agent AI system for semantic resume parsing, candidate matching, fraud detection, and recruitment automation — built for enterprise HR teams and developer integrations.</strong>
  </p>

  <p align="center">
    <a href="#architecture">Architecture</a> •
    <a href="#multi-agent-system">Agents</a> •
    <a href="#features">Features</a> •
    <a href="#quick-start">Quick Start</a> •
    <a href="#developer-portal">Developer Portal</a> •
    <a href="#api-reference">API Reference</a>
  </p>
</div>

---

## Overview

**Workly** is a production-grade, multi-agent AI platform that automates the entire recruitment pipeline — from resume ingestion and skill extraction to candidate ranking, AI-powered interviews, and fraud detection. It uses a coordinated system of specialized LLM agents, vector databases, and asynchronous workers to transform unstructured documents into actionable intelligence.

The platform serves three distinct user groups:
- **Recruiters** — A full-featured Applicant Tracking System (ATS) with AI screening, matching, and analytics
- **Job Seekers** — A job discovery portal with safety verification and legitimacy checks
- **Developers** — A SaaS API portal with subscription billing, rate limiting, and usage dashboards

---

## Multi-Agent System

Workly's core intelligence is powered by a coordinated system of **7 specialized AI agents**, each responsible for a distinct task in the recruitment pipeline:

| Agent | File | Responsibility |
|-------|------|---------------|
| **Resume Parsing Agent** | `agents/parsing_agent.py` | Extracts structured data (skills, experience, education, projects) from PDF/DOCX/TXT files using LLM-guided extraction |
| **Skill Normalization Agent** | `agents/normalization_agent.py` | Maps raw extracted skills to a canonical taxonomy of 1,000+ technical and soft skills with synonym resolution |
| **Matching Agent** | `agents/matching_agent.py` | Computes semantic match scores between candidate profiles and job descriptions using vector similarity and weighted criteria |
| **Inference Agent** | `agents/inference_agent.py` | Infers missing candidate attributes (seniority level, role category, domain expertise) from available resume data |
| **AI Chatbot Agent** | `agents/chatbot_agent.py` | Powers natural language candidate queries — ask questions like "Find Python developers with 3+ years in fintech" |
| **Fraud Detection Agent** | `agents/fraud_agent.py` | Scans resumes and job postings for plagiarism, AI-generated content, ATS keyword stuffing, and phishing patterns |
| **LLM Router** | `agents/llm.py` | Manages API key rotation across multiple Gemini keys with automatic failover, rate-limit recovery, and load balancing |

All agents communicate through the `RotateLLMClient`, which distributes requests across a pool of API keys and automatically handles quota exhaustion, retries, and model selection.

---

## Features

### Recruiter Dashboard (ATS)
- **Batch Resume Upload** — Drag-and-drop PDF/DOCX files with async Celery processing
- **AI Skill Extraction** — Multi-agent pipeline extracts skills, experience, contact details, and projects
- **Semantic Job Matching** — Vector-based scoring against job descriptions with configurable skill weights
- **AI Chatbot** — Query your candidate pool in natural language
- **Session Management** — Multi-round hiring workflows with configurable evaluation criteria
- **Gmail & Google Drive Sync** — Import resumes directly from email attachments and cloud folders
- **Company Settings** — Upload company logos, configure branding, and manage team profiles
- **Analytics Dashboard** — Hiring velocity, pipeline health, and candidate quality metrics

### Fraud Detection & Protection
- **Resume Authenticity Scanning** — Detects AI-generated content, plagiarism, and invisible keyword stuffing
- **Job Posting Verification** — Flags phishing scams, ghost job indicators, and clone copy-paste listings
- **Safety Scoring** — Originality score, AI probability percentage, and plagiarism rate for every scan
- **Scan History** — Audit trail of all protection scans with detailed breakdowns

### Job Seeker Portal
- **Dedicated Seeker Accounts** — Separate login and registration flows for job seekers, redirecting directly to `/jobs` as the unified landing hub & dashboard.
- **Direct Subview Navigation** — Dynamic navbar links (Home, Dashboard, Find Jobs, AI Resume Enhancer, My Applications, Notifications, Market Trends, Hiring Safety) for unified, simplified routing without nested dashboard page overlays.
- **Single-Line Responsive Navbar** — Streamlined layout with Home button to return to the platform landing page (`/`), seeker Dashboard button, and `whitespace-nowrap` layout to ensure smooth mobile-first presentation.
- **Double-Input Job Search** — Search bar supporting both keyword queries and location searches (with Indian city-to-state mapping and live autocomplete suggestions) separated by a clean vertical divider.
- **Real-time Notifications** — In-app notification center and automated email alerts notifying seekers when application status changes (e.g. Shortlisted, Hired)
- **Hiring Safety Checker** — Company domain authenticity scanner; checks scam likelihood and job legitimacy before applying
- **Salary Trends & Analytics** — Interactive charts displaying sector salary growth and high-demand competencies with a global modern blue color palette.

### Recruiter & Premium Features
- **Premium Feature Inidication** — Shows product design thinking for monetization with a `👑 Premium` plan lock badge on bulk upload (ZIP, PDF, DOCX) buttons.
- **Batch Resume Ingestion** — Mocked and protected under the Premium tier to optimize resource consumption.

### Developer Portal (SaaS API)
- **REST API** — Programmatic access to resume parsing, matching, chatbot, and fraud scanning
- **API Key Management** — Generate, rotate, and revoke production/test keys
- **Subscription Billing** — Razorpay-integrated plans (Free, Starter, Business) with monthly quotas
- **Rate Limiting** — Redis-backed per-key monthly quotas for parse, match, chat, and scan operations
- **Usage Analytics** — Real-time traffic charts, endpoint latency, and monthly usage breakdowns
- **Webhooks** — Configure HTTP callbacks for async parsing completion events
- **Embed Widget** — Generate secure tokens to mount Workly UI in external applications
- **API Documentation** — Interactive playground with request/response examples

---

## Architecture

The platform is built as a monorepo with two primary pillars:

### `backend/` — The AI Engine
- **Framework**: Django 5 + Django REST
- **Database**: PostgreSQL (via Supabase)
- **Cache & Rate Limiting**: Redis
- **Vector Store**: ChromaDB for semantic similarity search
- **Task Queue**: Celery with threaded pool for async resume processing
- **LLM Provider**: Google Gemini (multi-key rotation with automatic failover)
- **Authentication**: JWT tokens (recruiter) + API keys (developer)

### `frontend/` — The React SPA
- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Data Fetching**: TanStack React Query
- **Charts**: Recharts
- **Animations**: Framer Motion + GSAP
- **Routing**: React Router v6 with nested layouts

The frontend hosts all three portals (Recruiter ATS, Job Seeker, Developer) as a single SPA with path-based routing:
- `/` — Recruiter landing page
- `/dashboard/*` — Recruiter ATS dashboard
- `/jobs/*` — Job seeker portal
- `/developer/*` — Developer API portal

---

## Platform Highlights

### Interactive Applicant Tracking System (ATS)
Complete AI evaluation panels with semantic match scoring, candidate filtering, and multi-round hiring pipelines.

<div align="center">
  <img src="./assets/ats_dashboard.png" alt="ATS Dashboard" width="100%" />
</div>

### Developer API Portal
Full SaaS portal for third-party integrations with usage analytics, billing, and interactive documentation.

<div align="center">
  <img src="./assets/dev_portal.png" alt="Developer SDK Portal" width="100%" />
</div>

### Job Seeker Portal
Smart job discovery with city-aware search, one-click apply, hiring safety verification, and salary trend insights — helping candidates find and verify opportunities safely.

<div align="center">
  <img src="./assets/jobs.png" alt="Jobs Portal" width="100%" />
</div>

---

## Quick Start

### 1. Requirements
- Node.js `v18+`
- Python `v3.10+`
- PostgreSQL, Redis, ChromaDB (running locally or remotely)

### 2. Backend Setup
```bash
cd backend
cp .env.example .env

# Install Python dependencies
pip install -r requirements.txt

# Configure environment variables in .env:
# Set GEMINI_API_KEYS with a comma-separated list of your Gemini API keys
# Set GEMINI_MODEL=gemini-2.5-flash for optimized free tier quota usage

# Run Database Migrations
python manage.py migrate --fake-initial

# Seed the Skill Taxonomy table (one-time)
python manage.py seed_skills

# Run the Django Dev Server
python manage.py runserver 8000

# Run the Celery Worker (using multi-threaded pool on Windows)
celery -A workers.celery_worker worker --loglevel=info --pool=threads --concurrency=4
```

### 3. Frontend Setup
```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

The frontend runs on port `5173` by default and serves all three portals (Recruiter, Job Seeker, Developer) from a single Vite dev server.

---

## API Reference

### Resume Parsing
```bash
curl -X POST "https://api.workly.ai/api/v1/parse" \
  -H "X-API-Key: vish_live_xxxxxxxxxxx" \
  -F "file=@resume.pdf"
```
```json
{
  "success": true,
  "data": {
    "candidate_id": "cnd_9248239a",
    "name": "John Doe",
    "email": "johndoe@email.com",
    "skills": ["Distributed Systems", "Go", "Python"],
    "experience_years": 4.5
  }
}
```

### Fraud Detection Scan
```bash
curl -X POST "https://api.workly.ai/api/v1/protection/scan" \
  -H "X-API-Key: vish_live_xxxxxxxxxxx" \
  -d '{
    "scan_type": "job",
    "job_title": "Senior Frontend Engineer",
    "job_description": "We are looking for a React developer..."
  }'
```
```json
{
  "success": true,
  "data": {
    "originality_score": 94,
    "ai_probability": 6,
    "plagiarism_score": 5,
    "status": "Verified Clean"
  }
}
```

### Rate Limits by Plan

| Tier | Parses/mo | Match Ops/mo | Chat Queries/mo | Safety Scans/mo |
|------|-----------|-------------|-----------------|-----------------|
| Free | 100 | 50 | 20 | 0 |
| Starter | 1,000 | 500 | 200 | 100 |
| Business | 10,000 | Unlimited | Unlimited | 1,000 |
| Enterprise | Unlimited | Unlimited | Unlimited | Unlimited |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, Zustand, Recharts, Framer Motion, GSAP |
| Backend | Django 5, Celery, PostgreSQL (Supabase), Redis, ChromaDB |
| AI/LLM | Google Gemini (multi-key rotation), Custom multi-agent pipeline |
| Payments | Razorpay |
| Auth | JWT + API Key authentication |
| Deployment | Docker-ready, CI/CD compatible |

---

## Project Structure

```
.
├── backend/
│   ├── agents/            # Multi-agent LLM system (7 agents)
│   ├── api/
│   │   ├── models.py      # Django ORM models
│   │   ├── views/         # REST API endpoints
│   │   │   ├── developer/ # Developer portal APIs
│   │   │   ├── protection.py  # Fraud detection endpoints
│   │   │   ├── sessions.py    # Session management
│   │   │   └── ...
│   │   ├── decorators.py  # Auth & rate limiting
│   │   └── middleware.py  # Usage logging
│   ├── workers/           # Celery async task workers
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── components/    # Shared UI components
│       ├── pages/
│       │   ├── developer/ # Developer portal pages
│       │   ├── FraudDetectionPage.jsx
│       │   ├── JobSeekerSafetyPage.jsx
│       │   ├── JobsSearchPage.jsx
│       │   └── ...
│       ├── stores/        # Zustand state management
│       └── lib/           # API clients
└── README.md
```

---

## License & Attributions

Engineered for optimal performance, zero-downtime operation, and seamless enterprise integration.

**Built as a Sem-IV Project** | *Multi-Agent Recruitment Intelligence Platform*
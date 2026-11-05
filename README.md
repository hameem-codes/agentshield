# AgentShield

> **Deterministic Runtime Security SDK for Tool-Using AI Agents**
>
> Propose → Validate → Risk → Policy → Decision → Execute → Audit

AgentShield is an open-source, framework-independent Python runtime security SDK and enforcement layer for tool-using AI agents. When an AI agent proposes an action, AgentShield authenticates the agent, validates argument schemas, computes deterministic risk scores, and applies code-defined deterministic security policies (`ALLOW` / `REVIEW` / `BLOCK`). Only permitted actions are executed; every evaluation and execution is recorded to a cryptographically chained audit ledger.

---

## Non-Negotiable Security Principles

1. **Deterministic Authority**: LLMs and RAG are never the final security authority. Deterministic policy fails closed.
2. **Fail-Closed Default**: Unknown tool, unknown agent, malformed request, or policy denial strictly evaluates to `BLOCK`.
3. **Execution Invariant**: `BLOCK` never invokes the tool callable. `ALLOW` invokes the tool exactly once per `execute()`.
4. **Unidirectional Escalation**: Risk score can escalate a decision to `REVIEW` or `BLOCK`, but can never turn a denial into `ALLOW`.
5. **Frozen Argument Validation**: Validates normalized arguments and executes those exact frozen values.
6. **Destination Allowlisting**: External destinations are allowlisted by parsed hostname, never substring.
7. **Credential Isolation**: Only the executor holds tool credentials; AI agents never hold or invoke tools directly.
8. **Cryptographic Ledger**: Cryptographically chained audit records verify ledger integrity and detect tampering.

---

## Architecture & Technology Stack

- **Core SDK**: Python 3.12+ / 3.13 / 3.14 (`src/` layout, dataclasses, frozen models)
- **Deterministic Policy Engine**: Code-declared `PolicyConfiguration` with immutable `version_hash`
- **Deterministic Risk Engine**: 0–100 heuristic and rule-based scoring with 8 core risk factors
- **Storage Layer**: Pluggable storage abstraction supporting SQLite (default local) and PostgreSQL (production serverless)
- **API Backend**: FastAPI with strict CORS origin verification, HMAC-SHA256 sessions, and rate limiting
- **Frontend Dashboard**: React 19, TypeScript, Vite, Tailwind CSS, pixel-art retro theme (`frontend/`)

---

## Getting Started: Local Installation

### 1. Clone the Repository & Set Up Virtual Environment

```bash
git clone https://github.com/sadiyasyed28/agentshiled.git
cd agentshiled

# Create and activate Python virtual environment
python -m venv .venv
# Linux / macOS:
source .venv/bin/activate
# Windows (PowerShell):
.\.venv\Scripts\Activate.ps1
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
pip install -e .
```

### 3. Install Frontend Dependencies

```bash
cd frontend
npm install
cd ..
```

---

## Configuration Workflow

AgentShield strictly separates runtime code from secrets and operational parameters. All configuration is managed via environment variables.

### Step 1: Create Your Local `.env` File

Copy the provided template:

```bash
cp .env.example .env
```

> **Security Rule**: The `.env` file is excluded from Git via `.gitignore`. Never commit or push `.env` files with real credentials or API keys.

---

### Step 2: Configure Environment Variables

Open `.env` in your text editor and set the values described below:

#### 1. Administrative Authentication & Sessions
| Variable | Description | Where to Enter / How to Obtain |
| :--- | :--- | :--- |
| `AGENTSHIELD_ADMIN_KEY` | Master administrative secret for API endpoints (`X-Admin-Key`) and UI login. | Generate a strong 32+ char key: `python -c "import secrets; print(secrets.token_urlsafe(32))"` |
| `AGENTSHIELD_SESSION_SECRET` | Signing key for HMAC-SHA256 session cookies. | Generate a random 32+ char key (or leave empty to derive from admin key). |

#### 2. Network & Operational Mode
| Variable | Description | Where to Enter / How to Obtain |
| :--- | :--- | :--- |
| `AGENTSHIELD_ENV` | Environment identifier (`development`, `staging`, `production`). | Set to `development` locally; `production` on deployment. |
| `AGENTSHIELD_READONLY` | Read-only demo mode (`true` or `false`). | Set to `false` for interactive development; `true` for public demonstrations. |
| `AGENTSHIELD_CORS_ORIGINS` | Permitted browser origins (comma-separated, no wildcards). | Set to `http://localhost:5173,http://127.0.0.1:5173` for local Vite dev. |

#### 3. Storage & Database Settings
| Variable | Description | Where to Enter / How to Obtain |
| :--- | :--- | :--- |
| `AGENTSHIELD_STORAGE_BACKEND` | Active storage backend: `sqlite` or `postgres`. | Keep `sqlite` for zero-setup local dev. |
| `AGENTSHIELD_DATABASE_URL` | PostgreSQL connection string with SSL mode. | Optional locally; required if testing with PostgreSQL (e.g. `postgresql://user:pass@localhost:5432/agentshield?sslmode=disable`). |
| `AGENTSHIELD_AUDIT_DB` | SQLite audit file path (default: `agentshield_audit.db`). | Optional; customize if storing DB in a specific folder. |

#### 4. LLM Security Analyst (Optional)
| Variable | Description | Where to Enter / How to Obtain |
| :--- | :--- | :--- |
| `AGENTSHIELD_ANALYST_PROVIDER` | Security Analyst provider: `mock` or `gemini`. | Default is `mock` (no API key needed). Set to `gemini` for live Gemini analysis. |
| `GEMINI_API_KEY` | Google Gemini API key. | Obtain from [Google AI Studio](https://aistudio.google.com/). |
| `AGENTSHIELD_ALLOW_MOCK_FALLBACK` | Fails over to mock analyst if Gemini is down (`true`/`false`). | Keep `true` to ensure zero disruption on transient Gemini API timeouts. |

#### 5. Reliability & Rate Limits
| Variable | Description | Where to Enter / How to Obtain |
| :--- | :--- | :--- |
| `AGENTSHIELD_RATE_LIMIT_AGENT` | Request quota per agent (e.g. `100/minute`). | Customize based on expected agent throughput. |
| `AGENTSHIELD_RATE_LIMIT_TOOL` | Request quota per agent + tool (e.g. `60/minute`). | Prevents runaway agent loops against specific tools. |
| `AGENTSHIELD_MAX_TOOL_EXECUTION_SECONDS` | Maximum runtime in seconds before timing out tool execution. | Default `30.0` seconds. |
| `AGENTSHIELD_MAX_TOOL_CALLS_PER_SESSION` | Cumulative tool invocations permitted per correlation ID. | Default `50` calls. |

---

### Step 3: Validate Your Configuration

AgentShield includes a built-in configuration validator that checks your environment and ensures no secrets are printed or leaked:

```bash
python -m agentshield.config_validation
```

Output preview:
```
============================================================
AgentShield Runtime Configuration Audit Report
============================================================
Overall Status: [OK] VALID

Sanitized Configuration Summary:
  environment              : development
  read_only_mode           : false
  admin_auth               : configured
  storage_backend          : sqlite
  analyst_provider         : mock
  mock_fallback_allowed    : true
============================================================
```

---

## Running the Application Locally

### Start Backend API Server

```bash
python -m uvicorn agentshield.api.app:app --host 127.0.0.1 --port 8000 --reload
```
API documentation is available at `http://127.0.0.1:8000/docs`.

### Start Frontend Dashboard

```bash
cd frontend
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## Vercel Deployment Guide

AgentShield is configured for deployment on Vercel with a Python serverless backend and a Vite React SPA frontend.

### 1. Set Up Serverless PostgreSQL

For multi-instance or serverless Vercel deployments, configure a managed PostgreSQL instance (e.g., Neon, Supabase, Vercel Postgres, AWS RDS):
1. Create a database in your preferred cloud provider.
2. Ensure connection pooling is enabled (PgBouncer or pooler URL).
3. Copy the pooled connection string (with `?sslmode=require`).

### 2. Configure Environment Variables in Vercel

In the Vercel Project Dashboard:
1. Navigate to **Settings** → **Environment Variables**.
2. Add the following production variables:

| Variable Name | Environment | Value | Description |
| :--- | :--- | :--- | :--- |
| `AGENTSHIELD_ENV` | Production, Preview | `production` | Enforces production security checks. |
| `AGENTSHIELD_ADMIN_KEY` | Production, Preview | *(Secret 32+ char token)* | Required for administrative actions. |
| `AGENTSHIELD_SESSION_SECRET` | Production, Preview | *(Secret 32+ char token)* | Signs session cookies. |
| `AGENTSHIELD_STORAGE_BACKEND` | Production, Preview | `postgres` | Enables PostgreSQL persistence. |
| `DATABASE_URL` | Production, Preview | `postgresql://...` | Connection URL to your PostgreSQL instance. |
| `GEMINI_API_KEY` | Production, Preview | `AIzaSy...` | (Optional) Gemini API key for Security Analyst. |
| `AGENTSHIELD_ANALYST_PROVIDER` | Production, Preview | `gemini` (or `mock`) | LLM provider selection. |
| `AGENTSHIELD_ALLOW_MOCK_FALLBACK` | Production, Preview | `true` | Permits graceful degradation if Gemini fails. |
| `AGENTSHIELD_READONLY` | Production | `false` (or `true` for public demo) | Controls state mutation permissions. |
| `AGENTSHIELD_CORS_ORIGINS` | Production | `https://your-domain.vercel.app` | Exact production URL of your deployment. |

### 3. Deploying via Vercel CLI

Alternatively, configure and deploy using the Vercel CLI:

```bash
# Add secrets interactively
vercel env add AGENTSHIELD_ADMIN_KEY production
vercel env add DATABASE_URL production
vercel env add GEMINI_API_KEY production

# Deploy to production
vercel --prod
```

---

## Dashboard Settings & Telemetry

The AgentShield dashboard includes a **SETTINGS** stream tab located in the Telemetry window:

1. **Terminal-Style Parameter Display**: Displays non-sensitive operational limits, active environment, storage backend, rate limits, and policy hash.
2. **Secret Hygiene**: Secret keys, credentials, and passwords are strictly excluded from client memory, HTTP responses, and browser storage.
3. **Admin Control**: Sign in via `[admin sign in]` using your `AGENTSHIELD_ADMIN_KEY` to view live configuration details.

---

## Running the Test Suite

```bash
# Backend unit & integration tests
pytest -v

# Adversarial security test harness
pytest tests/test_adversarial_validation.py -v

# Configuration validation tests
pytest tests/test_config_validation.py -v

# Frontend unit tests
npm --prefix frontend test

# Frontend production build
npm --prefix frontend run build
```

---

## License

Apache 2.0. See `LICENSE` for details.

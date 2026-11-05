# AgentShield Environment Variables Reference

This document provides the canonical reference for all environment variables supported by the AgentShield SDK, FastAPI backend, and React dashboard.

---

## 1. Authentication & Session Security

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `AGENTSHIELD_ADMIN_KEY` | `string` | *(None / Disabled)* | High-entropy secret key required for administrative API access (`X-Admin-Key` header or Bearer token). If unset, administrative mutation endpoints fail closed (`403 Forbidden`). |
| `AGENTSHIELD_SESSION_SECRET` | `string` | Derived from `AGENTSHIELD_ADMIN_KEY` | Cryptographic secret used for HMAC-SHA256 signature generation and validation on `agentshield_session` cookies. Must be at least 32 characters in production. |

---

## 2. Network, CORS & Public Demo Security

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `AGENTSHIELD_CORS_ORIGINS` | `string` (csv) | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated list of exact allowed browser origins. Wildcards (`*`) are prohibited. Also accepts `AGENTSHIELD_TRUSTED_ORIGINS` as a backward-compatible alias. |
| `AGENTSHIELD_TRUSTED_ORIGINS` | `string` (csv) | Alias to above | Legacy alias for `AGENTSHIELD_CORS_ORIGINS`. If both are provided, `AGENTSHIELD_CORS_ORIGINS` takes precedence. |
| `AGENTSHIELD_READONLY` | `boolean` | `false` | When set to `true`, `1`, or `yes`, places the application in public demonstration mode: all state mutations (policy modifications, review approvals, agent pause/resume) and live tool execution are blocked (`403 Forbidden`). Simulator runs execute with isolated synthetic tools only. |
| `AGENTSHIELD_READ_ONLY` | `boolean` | Alias to above | Supported alias for `AGENTSHIELD_READONLY`. |

---

## 3. Storage Backend & Database Configuration

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `AGENTSHIELD_STORAGE_BACKEND` | `string` | `sqlite` | Storage engine selection. Options: `sqlite` (local file or memory) or `postgres` (production multi-instance or serverless). |
| `AGENTSHIELD_DATABASE_URL` | `string` (URL) | `None` | PostgreSQL connection string (`postgresql://user:pass@host:5432/dbname?sslmode=require`). Mandatory when `AGENTSHIELD_STORAGE_BACKEND=postgres`. |
| `DATABASE_URL` | `string` (URL) | Alias to above | Standard cloud provider PostgreSQL connection variable (e.g. Supabase, Neon, Render). Used as fallback if `AGENTSHIELD_DATABASE_URL` is omitted. |
| `AGENTSHIELD_POSTGRES_POOL_MIN` | `integer` | `1` | Minimum persistent database connections maintained in the connection pool. |
| `AGENTSHIELD_POSTGRES_POOL_MAX` | `integer` | `10` | Maximum connections allowed in the pool. In serverless functions, set to `1` or `2` and place a connection pooler (e.g. PgBouncer) in front. |
| `AGENTSHIELD_AUDIT_DB` | `string` (path) | `agentshield_audit.db` | Custom file path for SQLite audit ledger. |
| `AGENTSHIELD_REVIEW_DB` | `string` (path) | `agentshield_reviews.db` | Custom file path for SQLite review store. |
| `AGENTSHIELD_EVENTS_DB` | `string` (path) | `agentshield_events.db` | Custom file path for SQLite security event store. |
| `AGENTSHIELD_REPORTS_DB` | `string` (path) | `agentshield_reports.db` | Custom file path for SQLite investigation report store. |
| `AGENTSHIELD_SIMULATION_DB` | `string` (path) | `agentshield_simulation.db` | Custom file path for SQLite simulator run history store. |

---

## 4. LLM Security Analyst & Provider Integration

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `AGENTSHIELD_ANALYST_PROVIDER` | `string` | `mock` | LLM Analyst backend provider: `gemini` (live Google Gemini API) or `mock` (deterministic local sandbox). |
| `GEMINI_API_KEY` | `string` | `None` | Google AI Studio or Vertex AI Gemini API key. Never logged or exposed in API responses. Mandatory when `AGENTSHIELD_ANALYST_PROVIDER=gemini`. |
| `AGENTSHIELD_ALLOW_MOCK_FALLBACK` | `boolean` | `true` | When `true`, if the live Gemini API fails (HTTP 503, timeout, or circuit breaker open), the system fails over to the mock analyst without crashing. The response explicitly includes `mock_fallback: true` in metadata. Deterministic PolicyEngine decisions remain 100% independent. |

---

## 5. Reliability, Rate Limiting & Resource Budgets

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `AGENTSHIELD_RATE_LIMIT_AGENT` | `string` | `100/minute` | Sliding-window request rate limit per agent identifier (`<count>/<second\|minute\|hour>`). |
| `AGENTSHIELD_RATE_LIMIT_TOOL` | `string` | `60/minute` | Sliding-window invocation rate limit per agent + tool combination. |
| `AGENTSHIELD_MAX_TOOL_CALLS_PER_SESSION` | `integer` | `50` | Maximum cumulative tool calls permitted for a single session / correlation context before execution is blocked. |
| `AGENTSHIELD_MAX_TOOL_EXECUTION_SECONDS` | `float` | `30.0` | Maximum execution duration allocated to a tool callable before cooperative timeout cancellation is triggered. |
| `AGENTSHIELD_MAX_ARGUMENTS_BYTES` | `integer` | `65536` (64KB) | Maximum byte length of tool argument payloads. Exceeding arguments are blocked (`PayloadSizeLimitError`). |
| `AGENTSHIELD_MAX_BODY_BYTES` | `integer` | `1048576` (1MB) | Maximum HTTP request body size handled by `CorrelationMiddleware`. Exceeding requests are rejected with `413 Payload Too Large`. |
| `AGENTSHIELD_LOOP_CONSECUTIVE_LIMIT` | `integer` | `3` | Number of consecutive identical tool calls (same tool and argument hash) required to trigger loop detection. |
| `AGENTSHIELD_LOOP_CYCLE_LIMIT` | `integer` | `2` | Number of repeated cyclic sequences (e.g. A-B-A-B-A) required to trigger cyclic loop blocking. |

---

## 6. Observability & Monitoring Exposure

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `AGENTSHIELD_REQUIRE_AUTH_FOR_METRICS` | `boolean` | `false` | When `true`, accessing `/metrics` and `/api/metrics` requires valid administrative credentials (`X-Admin-Key`). When `false`, metrics can be scraped unauthenticated subject to rate limiting. |


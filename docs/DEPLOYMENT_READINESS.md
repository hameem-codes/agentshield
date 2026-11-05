# AgentShield Deployment Readiness & Production Hardening Guide

This document specifies the deployment architecture, configuration requirements, serverless compatibility constraints, persistent storage architecture, and operational runbook for deploying AgentShield to production and public demo environments (including Vercel).

---

## 1. System Architecture & Deployment Layout

AgentShield is structured as a monorepo containing a Python runtime security SDK, a FastAPI API server, and a React + Vite administrative observability console:

```
agentshield/
├── api/
│   └── index.py               # Vercel serverless Python ASGI entrypoint
├── docs/
│   ├── DEMO_GUIDE.md          # Interactive operator demo walkthrough
│   ├── DEPLOYMENT_READINESS.md# Deployment hardening & production guide (this document)
│   └── EXECUTION_LIFECYCLE.md # Core execution pipeline specification
├── frontend/                  # React 19 + TypeScript + Vite + Tailwind CSS console
│   ├── dist/                  # Compiled production static bundle
│   ├── src/                   # React components, winding SVG path, and API client
│   ├── package.json
│   └── vite.config.ts         # Vite build config with local dev reverse proxy
├── src/agentshield/           # Core Security SDK & FastAPI backend
│   ├── analyst/               # Gemini AI incident investigation provider & store
│   ├── api/                   # FastAPI routes, schemas, and session manager
│   ├── audit/                 # Cryptographic SHA-256 audit ledger store
│   ├── events/                # Security event, alert, and incident management
│   ├── models/                # Frozen immutable action proposals and decisions
│   ├── policy/                # Deterministic PolicyEngine and known tools whitelist
│   ├── review/                # Human-in-the-loop review queue & lease management
│   ├── risk/                  # Standalone deterministic RiskEngine scoring (0-100)
│   ├── secrets/               # SecretProvider abstraction for tool credentials
│   ├── simulator/             # Adversarial attack harness & benchmark suite
│   ├── tools/                 # ToolRegistry (isolated sandbox execution)
│   └── shield.py              # Central runtime orchestrator
├── tests/                     # 268 automated tests (backend, regressions, browser E2E)
├── pyproject.toml             # Python build metadata & dependencies
├── requirements.txt           # Production deployment dependencies
└── vercel.json                # Vercel serverless routing & SPA fallback rules
```

---

## 2. Environment Configuration Audit

Environment variables are partitioned strictly between **Backend Runtime (Confidential)** and **Frontend Client (Public)**.

### A. Backend Environment Variables (Server-Only Secrets & Controls)

These variables must be set in the server environment (e.g. Vercel Project Environment Variables, Docker container, or Kubernetes Secrets). **Never prefix these with `VITE_` or expose them to client bundles.**

| Variable | Type | Default | Purpose & Constraints |
| :--- | :--- | :--- | :--- |
| `AGENTSHIELD_ADMIN_KEY` | Secret String | *None* | Master authentication key for administrative endpoints (`/incident/review`, `/api/audit/verify`, `/api/simulator/history/clear`). Required for admin actions. |
| `AGENTSHIELD_SESSION_SECRET` | Secret String | *Derived from admin key* | Dedicated secret for signing session HMAC-SHA256 tokens. Allows session invalidation independently of admin key rotation. |
| `GEMINI_API_KEY` | Secret String | *None* | Google Gemini API key used by `GeminiProvider` for post-incident security analysis reports. Backend only. |
| `AGENTSHIELD_ENV` | String | `development` | Environment mode (`production`, `staging`, `development`). Canonical environment flag (`ENVIRONMENT` accepted as legacy fallback). In production, missing LLM provider raises error unless mock fallback is explicitly enabled. |
| `AGENTSHIELD_READONLY` | Boolean | `0` | **Canonical read-only containment mode** (`AGENTSHIELD_READ_ONLY` accepted as fallback). When `1` or `true`: blocks all incident review mutations (`/incident/review`, `/incident/pause`, `/incident/unpause`, `/api/simulator/history/clear`) with `403 Forbidden`. Tool execution via `/execute` remains strictly constrained to safe synthetic sandbox tools (`create_order`, `search_product`, `get_product`). Confirmed setting for public Vercel demos. |
| `AGENTSHIELD_ALLOW_MOCK_FALLBACK` | Boolean | `false` | When `true`, permits graceful fallback to `MockLLMProvider` (model `mock-analyst-v1`) if Gemini API fails or credentials are unset. **Public Demo**: set `true` to allow interactive investigations without API costs. **Production**: set `false` to fail closed on missing credentials. Mock output never influences deterministic security decisions. |
| `AGENTSHIELD_DATABASE_URL` | Secret URI | *None (defaults to SQLite)* | **Canonical production database connection string** (`postgresql://` or `postgres://`). Enables multi-instance serverless persistent storage across audit, review queue, security events, analyst reports, session revocation, and simulation history. Fails closed on invalid schemes or missing drivers without fallback. |
| `DATABASE_URL` | Secret URI | *None* | Standard cloud database URL fallback (Neon, Supabase, Railway, Heroku). Used if `AGENTSHIELD_DATABASE_URL` is unset. |
| `AGENTSHIELD_CORS_ORIGINS` | CSV String | `http://localhost:5173,http://127.0.0.1:5173` | **Canonical CORS and Trusted Origins variable**. Controls both CORS middleware allowed origins and CSRF Origin/Referer header verification for state mutations. In production, set to your domain (e.g. `https://agentshield.vercel.app`). |
| `AGENTSHIELD_TRUSTED_ORIGINS` | CSV String | *Empty* | Legacy fallback origin list. Automatically merged into `AGENTSHIELD_CORS_ORIGINS` for backward compatibility. Operators should configure `AGENTSHIELD_CORS_ORIGINS`. |
| `AGENTSHIELD_MAX_BODY_BYTES` | Integer | `1048576` (1MB) | Maximum allowed HTTP request body size enforced by `RequestSizeLimitMiddleware`. |
| `AGENTSHIELD_AUDIT_DB` | Path / URI | *Vercel: `/tmp/agentshield_audit.db`* | SQLite database path for production audit ledger. |
| `AGENTSHIELD_REVIEW_DB` | Path / URI | *Derived from audit DB* | SQLite database path for human review queue. |
| `AGENTSHIELD_EVENTS_DB` | Path / URI | *Derived from audit DB* | SQLite database path for security events, alerts, and incidents. |
| `AGENTSHIELD_REPORTS_DB` | Path / URI | *Derived from audit DB* | **Canonical reports database path** (`AGENTSHIELD_REPORTS_DB_PATH` accepted as fallback). |
| `AGENTSHIELD_SESSIONS_DB` | Path / URI | *Derived from audit DB* | SQLite database path for session revocation tracking. |
| `AGENTSHIELD_SIMULATION_DB` | Path / URI | *Derived from audit DB* | SQLite database path for simulator run history and benchmarks. |
| `AGENTSHIELD_SIM_REVIEW_DB` | Path / URI | *Derived from audit DB* | SQLite database path for simulator review queue (isolated from production review queue). |
| `AGENTSHIELD_SIM_EVENTS_DB` | Path / URI | *Derived from audit DB* | SQLite database path for simulator security events (isolated from production events). |
| `AGENTSHIELD_MAX_TOOL_EXECUTION_SECONDS` | Float | `30.0` | Maximum execution duration for tool callables before interrupting with `ExecutionStatus.ERROR`. |
| `AGENTSHIELD_MAX_TOOL_CALLS_PER_SESSION` | Integer | `50` | Maximum tool calls permitted per session context before deterministically failing closed to `DecisionValue.BLOCK`. |
| `AGENTSHIELD_MAX_ARGUMENTS_BYTES` | Integer | `65536` (64KB) | Maximum payload byte size for tool arguments before failing closed to `DecisionValue.BLOCK`. |
| `AGENTSHIELD_MAX_TOKEN_BUDGET` | Integer | `100000` | Cumulative LLM token budget for analyst models before halting external provider calls. |
| `AGENTSHIELD_RATE_LIMIT_PUBLIC` | String | `120/60s` | Sliding-window rate limit specification for public API endpoints. Formats: `count/window` (e.g. `120/60s`, `20/minute`). |
| `AGENTSHIELD_RATE_LIMIT_ANALYST` | String | `20/60s` | Sliding-window rate limit specification for LLM incident report generation. |
| `AGENTSHIELD_RATE_LIMIT_AGENT` | String | `60/60s` | Sliding-window rate limit specification per agent identity. |
| `AGENTSHIELD_RATE_LIMIT_TOOL` | String | `30/60s` | Sliding-window rate limit specification per tool callable. |
| `AGENTSHIELD_LOOP_CONSECUTIVE_LIMIT` | Integer | `3` | Consecutive identical tool invocations (with identical argument fingerprints) before triggering loop BLOCK. |
| `AGENTSHIELD_LOOP_CYCLE_LIMIT` | Integer | `2` | Repeated cycles of alternating tool sequences before triggering cyclic loop BLOCK. |
| `AGENTSHIELD_CB_FAILURE_THRESHOLD` | Integer | `3` | Consecutive external provider failures before tripping circuit breaker to `OPEN`. |
| `AGENTSHIELD_CB_RECOVERY_TIMEOUT` | Float | `30.0` | Recovery timeout in seconds in `OPEN` state before allowing probe call in `HALF-OPEN`. |
| `AGENTSHIELD_CB_HALF_OPEN_THRESHOLD` | Integer | `1` | Consecutive successful calls in `HALF-OPEN` before recovering circuit breaker to `CLOSED`. |

### B. Frontend Environment Variables (Browser-Safe Public Flags)

Only variables prefixed with `VITE_` are embedded into the client JavaScript bundle by Vite.

| Variable | Type | Default | Safe for Browser? | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `VITE_API_URL` | URL String | `window.location.origin` | **YES** | Target backend URL for API client requests. Omit when frontend and backend share the same domain (e.g. Vercel rewrites). |
| `VITE_VERCEL` | Boolean | `false` | **YES** | Deployment flag indicating deployment on Vercel (shows demo reset notices in console). |

> [!CAUTION]
> **Zero Secrets in Client Code**: No admin keys, Gemini credentials, session signing keys, or server paths may ever be prefixed with `VITE_` or referenced in `frontend/src`. Automated regression tests strictly enforce this boundary.

---

## 3. Persistent Storage & Serverless Production Architecture

AgentShield provides a dual-backend storage subsystem in `src/agentshield/storage/`:
- **SQLite Engine** (`sqlite`): Zero-configuration, local development, CI tests, and single-instance environments. In serverless without external DB (`VERCEL=1`), automatically places files in `/tmp`.
- **PostgreSQL Adapter** (`postgres`): Multi-instance serverless production backend. Activated via `AGENTSHIELD_DATABASE_URL` or `DATABASE_URL` (`postgresql://` or `postgres://`).

The storage backend factory (`agentshield.storage.factory.create_stores`) instantiates the appropriate adapter based on environment variables, failing closed immediately if an invalid connection URL or missing driver is detected.

### Storage Architecture & Concurrency Design

```mermaid
flowchart TD
    subgraph ClientLayer ["Client & Serverless Layer"]
        ViteSPA["React Dashboard (Vercel Edge CDN)"]
        Lambda1["FastAPI Instance A (Vercel)"]
        Lambda2["FastAPI Instance B (Vercel)"]
    end

    subgraph CoreEngine ["Deterministic Enforcement Core"]
        Policy["PolicyEngine (known_tools)"]
        Risk["RiskEngine (deterministic 0-100)"]
    end

    subgraph StorageInterfaces ["Storage Subsystem (agentshield.storage)"]
        I_Audit["PostgresAuditStore\n(Advisory lock 71829103)"]
        I_Review["PostgresReviewStore\n(SELECT ... FOR UPDATE)"]
        I_Event["PostgresEventStore\n(Atomic Alert Correlation)"]
        I_Session["PostgresSessionStore\n(Multi-Instance Revocation)"]
        I_Report["PostgresReportStore\n(Investigation Reports)"]
        I_Sim["PostgresSimulationStore\n(Runs & Telemetry)"]
    end

    subgraph ProductionBackend ["Centralized Production Persistence (PostgreSQL)"]
        PostgresDB[("Serverless PostgreSQL (Neon / Supabase / PgBouncer)\n- audit_records (SHA-256 hash-chained)\n- reviews & sim_reviews (Row-locked queues)\n- security_events & incidents\n- session_revocations (Real-time logout sync)\n- analyst_reports & simulation_runs")]
    end

    ViteSPA --> Lambda1
    ViteSPA --> Lambda2
    Lambda1 --> Policy
    Lambda2 --> Policy
    Policy --> Risk
    Risk --> StorageInterfaces
    StorageInterfaces --> PostgresDB
```

### Concurrency & Data Integrity Mechanisms

1. **Serialized Audit Hash Chaining (`pg_advisory_xact_lock`)**:
   AgentShield computes a strict cryptographic SHA-256 hash chain (`previous_hash` $\rightarrow$ `record_hash`). In multi-instance serverless environments, simultaneous tool executions across multiple lambdas could cause concurrent writes that interleave and fracture the chain. `PostgresAuditStore` obtains a transaction-scoped PostgreSQL advisory lock (`pg_advisory_xact_lock(71829103)`) during write operations, guaranteeing atomic serialization of `prev_hash` queries and hash computation without deadlock.
2. **Atomic Review Worker Claiming (`SELECT ... FOR UPDATE`)**:
   `PostgresReviewStore` uses row-level locking (`SELECT ... FOR UPDATE`) inside transactions when operators claim, approve, or reject pending human-in-the-loop requests. This prevents dual-worker race conditions where two operators or automated review handlers could approve the same item simultaneously.
3. **Instant Multi-Instance Session Revocation**:
   `PostgresSessionStore` records logout and admin revocation events in a shared `session_revocations` table. Every serverless instance queries this table during HMAC token authentication, ensuring that an administrator calling `POST /api/auth/logout` on Instance A immediately revokes the session across Instance B, C, and all other serverless microVMs.
4. **Simulator & Operational Storage Isolation**:
   To prevent public simulations from polluting production review queues and incident feeds, PostgreSQL storage applies table prefixing (`table_prefix="sim_"`) for simulation stores (`sim_reviews`, `sim_security_events`, `sim_security_alerts`, `simulation_runs`). Both engines run on the same database connection while maintaining complete structural separation.

### Serverless PostgreSQL Configuration & Connection Pooling

Serverless lambdas can spawn hundreds of concurrent microVMs, quickly exhausting direct PostgreSQL connection limits (often capped at 20-100 connections on managed databases).

> [!IMPORTANT]
> **Use a Connection Pooler (PgBouncer / Neon Pooling)**:
> In serverless production (e.g. Vercel), always point `AGENTSHIELD_DATABASE_URL` to a pooled connection string rather than a direct connection:
> - **Neon**: Use the pooled connection URL ending with `-pooler` (port 5432 or 6543, `sslmode=require`).
> - **Supabase**: Use the Transaction pooler connection string on port 6543 (`?pgbouncer=true`).
> - **Self-Hosted**: Place PgBouncer in transaction pooling mode in front of PostgreSQL.
>
> `PostgresConnectionManager` closes connections at the end of each request/operation context, releasing them back to PgBouncer immediately.

### Schema Lifecycle & Migrations (`MigrationManager`)

To eliminate concurrent DDL race conditions during multi-instance cold starts, schema initialization is governed by `agentshield.storage.migrations.MigrationManager`:
- Tracks applied versions in the `schema_migrations` table (`version`, `name`, `applied_at`).
- Acquires a dedicated PostgreSQL transaction-scoped advisory lock (`pg_advisory_xact_lock(71829100)`) prior to evaluating pending DDL.
- If multiple lambdas boot concurrently, only one executes migrations while others serialize and detect migrations already applied upon lock acquisition.
- All migrations are forward-only, idempotent (`CREATE TABLE IF NOT EXISTS`), and non-destructive.

### SQLite-to-PostgreSQL Data Migration Tool

Historical data residing in SQLite databases can be safely migrated to PostgreSQL using the standalone migration command:

```powershell
# Run a dry-run migration (validates data and rolls back without committing)
.\.venv\Scripts\python -m agentshield.storage.migrate_sqlite --postgres-url "postgresql://user:pass@ep-db.neon.tech/agentshield?sslmode=require" --dry-run

# Execute full live migration
.\.venv\Scripts\python -m agentshield.storage.migrate_sqlite --postgres-url "postgresql://user:pass@ep-db.neon.tech/agentshield?sslmode=require" --sqlite-dir .
```

#### Migration Guarantees:
- **Zero Source Mutation**: SQLite files are opened in read-only mode (`mode=ro`). Source files are never modified, deleted, or truncated.
- **Strict Hash-Chain Continuity**: Audit records are extracted and migrated in chronological sequence (`ORDER BY id ASC`), preserving `prev_hash` and `record_hash`. The migration tool automatically runs `PostgresAuditStore.verify_integrity()` upon completion to cryptographically verify the ledger.
- **Idempotency & Repeatability**: Uses primary-key and hash presence checks (`record_hash`, `review_id`, `event_id`, `alert_id`, `incident_id`, `report_id`, `token_hash`, `run_id`). Running the command multiple times skips existing records without duplicating or corrupting data.
- **Non-Migratable Data**: Active in-memory leases or uncheckpointed SQLite journal frames from abruptly terminated processes are not transferred.

#### Storage Layer Comparison Matrix

| Capability | SQLite `/tmp` (Local/Demo) | PostgreSQL Adapter (Production) |
| :--- | :--- | :--- |
| **Multi-Instance Safe** | ❌ No (Isolated per lambda) | ✅ **Yes** (Row & advisory locks) |
| **Data Durability** | Ephemeral (Lost on cold start) | ✅ **Permanent** |
| **Audit Ledger Hash Chain** | Fractured across instances | ✅ **Continuous & verifiable** |
| **Review Queue Concurrency** | Split-brain risk across instances | ✅ **Atomic worker fencing** |
| **Session Revocation Sync** | Instance-isolated blind spot | ✅ **Instant global revocation** |
| **Setup Cost** | Zero configuration | Managed DB (Neon, Supabase, RDS) |
| **Recommended Deployment** | Local development, Public Demos | Multi-instance serverless & Enterprise |

---

## 4. Authentication & Security Hardening Review

### Security Controls Enforced

1. **Deterministic Primacy & Gemini Decoupling**:
   Deterministic policy evaluation is absolute and authoritative (`PolicyEngine` and `RiskEngine`). Gemini (or `MockLLMProvider` fallback) operates strictly as a post-incident read-only investigative analyst. LLM output can never alter, bypass, or weaken deterministic ALLOW/REVIEW/BLOCK decisions.
2. **Mock Fallback Transparency**:
   When `AGENTSHIELD_ALLOW_MOCK_FALLBACK=true` is used in the public demo, report responses explicitly set `analyst_model: "mock-analyst-v1"`, and the frontend displays a distinct `[mock-analyst-v1]` model badge to guarantee total transparency.
3. **Timing-Safe Authentication**:
   All administrative key comparisons utilize `hmac.compare_digest()` to eliminate timing attack side-channels.
4. **Cryptographic Sessions with Domain Separation**:
   Session tokens are formatted as `base64url(payload).hmac_sha256_hex` using an isolated signing key derived via HMAC-SHA256 (`b"agentshield-session-v1"`) from `AGENTSHIELD_SESSION_SECRET` or `AGENTSHIELD_ADMIN_KEY`. Expired tokens are rejected at the crypto verification boundary.
5. **Reconciled Origin & CSRF Enforcement**:
   State-changing operations (`POST`, `PUT`, `DELETE`, `PATCH`) initiated via browser cookies strictly require valid `x-csrf-token` headers matching `agentshield_csrf` cookies, alongside verified Origin/Referer headers validated against canonical `AGENTSHIELD_CORS_ORIGINS`.
6. **Memory Leak Mitigation**:
   Public IP rate-limiting buffers automatically evict expired timestamps and prune empty IP keys, preventing memory exhaustion under sustained scanning.
7. **Isolated Sandbox Execution**:
   The production API registers only synthetic sandbox tools (`create_order`, `search_product`, `get_product`). Real system commands and destructive tools fail closed immediately.
8. **Read-Only Containment Mode**:
   `AGENTSHIELD_READONLY=true` provides an immediate operational containment lock: rejects all incident review approvals, session terminations, agent pauses/unpauses, and history modifications with `403 Forbidden` while allowing safe sandbox simulation and read-only telemetry.

---

## 5. Reliability Controls & Circuit Breakers (Phase 7)

AgentShield Phase 7 introduces comprehensive runtime reliability controls designed to prevent denial-of-service, resource exhaustion, runaway execution loops, and cascade failures from external dependencies:

```mermaid
flowchart LR
    Req[Proposed Tool Call] --> PayloadCheck{Payload Size <= Limit?}
    PayloadCheck -- Exceeded --> BlockPayload[BLOCK: Payload Too Large]
    PayloadCheck -- OK --> BudgetCheck{Session Budget <= Limit?}
    BudgetCheck -- Exceeded --> BlockBudget[BLOCK: Budget Exceeded]
    BudgetCheck -- OK --> RateCheck{Rate Limit Allowed?}
    RateCheck -- Exceeded --> BlockRate[BLOCK: Rate Limit Hit / 429]
    RateCheck -- OK --> LoopCheck{Loop or Cycle Detected?}
    LoopCheck -- Yes --> BlockLoop[BLOCK: Tool Loop Detected]
    LoopCheck -- No --> Policy[Deterministic PolicyEngine]
    Policy --> Execute[Execute with Strict Timeout]
```

### A. Execution Limits, Cooperative Cancellation & Resource Budgets
- **Strict Execution Timeouts (`execute_with_timeout`)**: Tool callables are wrapped with `execute_with_timeout()`. If a tool hangs or exceeds `AGENTSHIELD_MAX_TOOL_EXECUTION_SECONDS` (default: 30.0s), the caller returns immediately within the configured deadline. To prevent worker hangs, executor shutdown is explicitly non-blocking (`wait=False, cancel_futures=True`).
- **Cooperative Cancellation Contract (`CancellationToken`, `SafeExecutionContext`)**:
  - *Python Thread Limitation*: In standard CPython runtimes, running OS worker threads cannot be forcibly or abruptly terminated from another thread without terminating the process itself.
  - *Fail-Closed Contract*: AgentShield marks timed-out executions as `ExecutionStatus.ERROR` in audit logs and emits an `EXECUTION_OUTCOME` security event with `decision="ERROR"`. The tool is never re-invoked.
  - *Side-Effect Prevention*: For mutating tools, AgentShield provides `CancellationToken` and `SafeExecutionContext` injected into tool arguments (`context` or `_safe_context`). Well-behaved tools check `context.is_cancelled` or wrap state mutations in `context.guard_side_effect(fn)`. If a cancellation has occurred due to timeout, `OperationCancelledError` is raised, preventing lingering threads from committing post-timeout side effects.
- **Session Tool-Call Budgets**: Sessions or correlation contexts track cumulative tool calls via `SessionBudgetTracker`. Once `AGENTSHIELD_MAX_TOOL_CALLS_PER_SESSION` (default: 50) is reached, subsequent requests fail closed with a deterministic `BLOCK` decision and a `POLICY_VIOLATION` security event.
- **Payload & Argument Bounds**: Payloads are checked before normalization using `check_arguments_size()`. If arguments exceed `AGENTSHIELD_MAX_ARGUMENTS_BYTES` (default: 64KB), requests immediately fail closed with `BLOCK`. Whole HTTP request bodies exceeding `AGENTSHIELD_MAX_BODY_BYTES` (default: 1MB) are rejected with `HTTP 413 Payload Too Large`.
- **Token Budgets**: Cumulative token consumption by external LLMs is tracked via `TokenBudgetTracker`. If cumulative usage exceeds `AGENTSHIELD_MAX_TOKEN_BUDGET` (default: 100,000), further analyst queries are rejected with `ProviderError` to prevent runaway cloud billing.

### B. Distributed Sliding-Window Rate Limiting
- **Shared Multi-Instance Persistence (`PostgresRateLimiter`)**: In production PostgreSQL environments, `PostgresRateLimiter` logs invocation timestamps in the indexed `rate_limit_events` table and evaluates sliding windows atomically inside transactions.
- **Fail-Closed Contract**: If the backing database encounters an error, transient disconnection, or pool exhaustion during a rate limit evaluation, `PostgresRateLimiter` and `SqliteRateLimiter` deterministically **fail closed** (`allowed=False`, `remaining=0`, `retry_after=window_seconds`). The service logs a security warning and denies traffic rather than failing open.
- **SQLite / Ephemeral Limits Notice**: In serverless deployments (such as Vercel) where `AGENTSHIELD_DATABASE_URL` is omitted, `SqliteRateLimiter` stores sliding windows in `/tmp/agentshield_audit.db`. Because `/tmp` is scoped to an ephemeral microVM container, rate limit counters are not synchronized across concurrent instances. PostgreSQL is strictly required for distributed multi-instance rate limiting.
- **Standard HTTP 429 Response Headers**: When rate limits are reached, the API returns `HTTP 429 Too Many Requests` containing standard headers:
  - `X-RateLimit-Limit`: Maximum requests permitted in window.
  - `X-RateLimit-Remaining`: Remaining request quota.
  - `X-RateLimit-Reset`: Unix timestamp when the current window resets.
  - `Retry-After`: Seconds to wait before retrying.
- **Tiered Throttling Scopes**:
  - `public`: Throttles unauthenticated public endpoints by client IP (`AGENTSHIELD_RATE_LIMIT_PUBLIC`, default: `120/60s`).
  - `analyst`: Throttles heavy LLM report generation endpoints (`AGENTSHIELD_RATE_LIMIT_ANALYST`, default: `20/60s`).
  - `agent`: Throttles agent identities at the authorization engine layer (`AGENTSHIELD_RATE_LIMIT_AGENT`, default: `60/60s`).
  - `tool`: Throttles specific tool callables per agent (`AGENTSHIELD_RATE_LIMIT_TOOL`, default: `30/60s`).

### C. Tool Loop & Cycle Detection
- **Deterministic Argument Fingerprints**: Every tool invocation computes a canonical SHA-256 fingerprint from the tool name and normalized, sorted JSON arguments: `SHA256(tool:normalized_args)`.
- **Consecutive Identical Calls**: Repeating the exact same tool and arguments $\ge$ `AGENTSHIELD_LOOP_CONSECUTIVE_LIMIT` (default: 3) consecutive times deterministically trips loop detection, resulting in an immediate `BLOCK` decision and a `LOOP_DETECTED` security event.
- **Cyclic Tool Patterns**: Detects recurring cyclical execution patterns (e.g. `[toolA -> toolB -> toolA -> toolB]`) with cycle lengths of 2 to 4 repeated $\ge$ `AGENTSHIELD_LOOP_CYCLE_LIMIT` (default: 2) times.
- **Legitimate Repetition Allowance**: Legitimate iterative workflows (e.g. pagination with `page=1, page=2` or polling distinct items) produce different normalized argument fingerprints and are not blocked.

### D. External Provider Circuit Breakers
- **Three-State Circuit Pattern**: Protects external dependencies (Google Gemini API) with `CircuitBreaker`:
  - `CLOSED`: Normal operation; failures are recorded.
  - `OPEN`: Tripped after `AGENTSHIELD_CB_FAILURE_THRESHOLD` (default: 3) consecutive failures. Subsequent calls fail fast with `CircuitBreakerOpenError` and `HTTP 503 Service Unavailable` with `Retry-After` headers without contacting the external provider.
  - `HALF-OPEN`: After `AGENTSHIELD_CB_RECOVERY_TIMEOUT` (default: 30.0s), a probe request is permitted.
- **Single-Probe Concurrency Protection**: In `HALF-OPEN` state, `CircuitBreaker` enforces strict single-probe concurrency via internal thread synchronization (`acquire_execution()` and `release_probe()`). Exactly one thread is granted permission to probe the external provider; any concurrent requests arriving while the probe is in-flight fail fast with `CircuitBreakerOpenError`.
- **Strictly Advisory-Only Boundary**: LLM failures, rate limits, or circuit breaker trips NEVER influence authorization or execution decisions. PolicyEngine and RiskEngine remain completely isolated and deterministic. Provider failures can never fabricate an `ALLOW`.

### E. Reliability State Scope Reference Matrix

The following matrix documents the precise runtime scope, thread-safety, and multi-instance sharing characteristics of every reliability component:

| Component | Class | Scope | Thread-Safe? | Multi-Instance Shared? | Notes & Architecture |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **Tool Execution Timeout** | `execute_with_timeout` | Per-Execution | Yes | N/A | Non-blocking shutdown; cooperative cancellation via `CancellationToken`. |
| **Session Call Budget** | `SessionBudgetTracker` | Process-Local | Yes | ❌ No | In-memory `dict[session_id, count]` with `threading.Lock`. Process-bound. |
| **Token Budget Tracker** | `TokenBudgetTracker` | Process-Local | Yes | ❌ No | In-memory counter with `threading.Lock`. Process-bound. |
| **Loop & Cycle Detector** | `LoopDetector` | Process-Local | Yes | ❌ No | In-memory sliding window history with `threading.Lock`. Process-bound. |
| **Provider Circuit Breaker** | `CircuitBreaker` | Process-Local | Yes | ❌ No | In-memory state machine with `threading.Lock` and single-probe concurrency. |
| **SQLite Rate Limiter** | `SqliteRateLimiter` | Host/Container | Yes | ❌ No | File-backed SQLite (`/tmp`). Scoped to single machine/container. |
| **PostgreSQL Rate Limiter** | `PostgresRateLimiter` | Cluster / Global | Yes | ✅ **Yes** | Shared across instances via `rate_limit_events` table. Fails closed on DB error. |

---

## 6. Vercel Configuration & Deployment Walkthrough

### Routing Architecture (`vercel.json`)

Vercel rewrites forward API traffic to the serverless Python handler while routing client-side navigation to the compiled React single-page app:

```json
{
  "version": 2,
  "buildCommand": "cd frontend && npm ci && npm run build",
  "outputDirectory": "frontend/dist",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/index.py"
    },
    {
      "source": "/(health|events|check|authorize|execute)",
      "destination": "/api/index.py"
    },
    {
      "source": "/(audit|incident)/(.*)",
      "destination": "/api/index.py"
    },
    {
      "source": "/((?!api/|health|events|check|authorize|execute|audit/|incident/).*)",
      "destination": "/index.html"
    }
  ]
}
```

### Deployment Step-by-Step

1. **Link Repository to Vercel**:
   Import the Git repository in the Vercel Dashboard.
2. **Configure Project Settings**:
   - **Framework Preset**: Vite
   - **Root Directory**: `.` (Repository root)
   - **Build Command**: `cd frontend && npm ci && npm run build`
   - **Output Directory**: `frontend/dist`
3. **Configure Environment Variables in Vercel**:
   - Set `AGENTSHIELD_ADMIN_KEY` to a cryptographically random secret (e.g. `openssl rand -hex 24`).
   - Set `AGENTSHIELD_SESSION_SECRET` to a random 32-character string.
   - Set `AGENTSHIELD_ENV` to `production`.
   - Set `AGENTSHIELD_READONLY` to `"true"` for public demo deployments.
   - Set `AGENTSHIELD_ALLOW_MOCK_FALLBACK` to `"true"` for public demos without a funded Gemini API key (or configure `GEMINI_API_KEY` for live analysis).
   - Set `AGENTSHIELD_CORS_ORIGINS` to `https://your-project.vercel.app` (single canonical origin configuration for both CORS and CSRF verification).
   - Set `VITE_VERCEL` to `true`.
4. **Trigger Deployment**:
   Deploy via Vercel CLI (`vercel --prod`) or Git push.

---

## 7. Build and Verification Runbook

### Build Commands

```powershell
# 1. Install frontend dependencies
cd frontend
npm ci

# 2. Build production frontend bundle
npm run build
cd ..
```

### Automated Verification Commands

```powershell
# 1. Run deployment configuration & architecture verification tests
.\.venv\Scripts\python -m pytest tests/test_deployment_config.py -v

# 2. Run backend & security regression tests
.\.venv\Scripts\python -m pytest --ignore=tests/test_browser_dashboard_e2e.py -q

# 3. Run browser end-to-end tests (requires Playwright Chromium)
.\.venv\Scripts\python -m pytest tests/test_browser_dashboard_e2e.py -v

# 4. Run entire unified test suite
.\.venv\Scripts\python -m pytest -q

# 5. Check Git working tree for whitespace/formatting errors
git diff --check
```

---

## 8. Operational Troubleshooting & Rollback

| Symptom | Probable Cause | Remediation |
| :--- | :--- | :--- |
| **API returns 403 "Untrusted request origin"** | Browser origin not registered in CORS/Trusted origins | Add client domain to `AGENTSHIELD_CORS_ORIGINS` and `AGENTSHIELD_TRUSTED_ORIGINS`. |
| **API returns 403 "CSRF token verification failed"** | Missing `x-csrf-token` header or cross-domain cookie stripping | Ensure requests use `credentials: "include"` and pass the token from `/api/auth/session`. |
| **API returns 403 "Admin endpoints are disabled"** | `AGENTSHIELD_ADMIN_KEY` not configured in server environment | Set `AGENTSHIELD_ADMIN_KEY` in environment variables. |
| **Simulation history resets on page reload** | Serverless cold start cleared ephemeral `/tmp` SQLite store | Expected behavior in serverless mode without external database; configure persistent database. |
| **Analyst endpoints return 503** | Gemini API key missing and mock fallback disabled | Set `AGENTSHIELD_ALLOW_MOCK_FALLBACK=true` or configure valid `GEMINI_API_KEY`. |
| **Emergency Killswitch Required** | Suspected system compromise or tool misuse | Set `AGENTSHIELD_READONLY=1` and redeploy; immediately halts all state mutations. |

### Vercel Instant Rollback

If an unexpected regression occurs in production:
1. Navigate to the **Deployments** tab in the Vercel Dashboard.
2. Select the previous stable deployment.
3. Click **Instant Rollback**. Vercel redirects edge routing within seconds without rebuilding.

---

## 9. Feature Implementation & Production Verification Status Matrix

To maintain rigorous transparency, this matrix distinguishes capabilities across three explicit verification states:
1. **Implemented and locally tested**: Automated unit, integration, and mock tests pass in the local test suite.
2. **Verified against a live PostgreSQL database**: Verified against a running, external PostgreSQL instance with live network latency, concurrency, and advisory locks.
3. **Not yet verified in production**: Ready for deployment but pending live traffic validation under actual production loads.

| Feature / Subsystem | Verification Status | Implementation & Operational Notes |
| :--- | :---: | :--- |
| **Deterministic PolicyEngine** | **Implemented and locally tested** | Source of truth: `PolicyEngine.known_tools`. Fails closed. 100% test coverage. |
| **Deterministic RiskEngine** | **Implemented and locally tested** | Standalone scoring (0–100) across known tools and parameters. |
| **SHA-256 Audit Hash Chain (SQLite)** | **Implemented and locally tested** | Cryptographic hash chaining (`prev_hash` $\to$ `record_hash`) verified in local SQLite tests. |
| **SHA-256 Audit Hash Chain (PostgreSQL)** | **Not yet verified in production** | Implemented with `pg_advisory_xact_lock(71829103)`. Tested with mock connection; pending live PostgreSQL verification. |
| **Human Review Queue (SQLite)** | **Implemented and locally tested** | Local FIFO review queue with timeout and manual decision recording. |
| **Human Review Queue (PostgreSQL)** | **Not yet verified in production** | Implemented with `SELECT ... FOR UPDATE` row locks; pending live PostgreSQL verification. |
| **Attack Simulator & Benchmarks** | **Implemented and locally tested** | 100% synthetic sandbox execution; table-prefixed isolation tested locally. |
| **Gemini Security Analyst** | **Implemented and locally tested** | Exponential backoff, timeout, secret redaction, and mock fallback tested. Live calls require valid `GEMINI_API_KEY`. |
| **Admin Auth & CSRF Protection** | **Implemented and locally tested** | Timing-safe HMAC comparisons, session signing, and CSRF origin verification tested locally. |
| **Multi-Instance Session Revocation (PG)** | **Not yet verified in production** | Implemented via `session_revocations` table; tested with mock connection; pending live PostgreSQL verification. |
| **Tool Execution Timeout & Cancellation** | **Implemented and locally tested** | Non-blocking `shutdown(wait=False, cancel_futures=True)` with cooperative `CancellationToken` tested with slow tools. |
| **Session Call Budget Tracking** | **Implemented and locally tested** | In-process `SessionBudgetTracker` with thread locks. Process-local scope. |
| **Payload & Argument Bounds** | **Implemented and locally tested** | Request body (1MB) and tool payload (64KB) limits tested with oversized inputs. |
| **Token Budget Tracking** | **Implemented and locally tested** | In-process `TokenBudgetTracker` halts provider calls upon reaching budget. Process-local scope. |
| **Loop & Cycle Detection** | **Implemented and locally tested** | Canonical argument hashing and cycle pattern detection tested with cyclic tool invocations. |
| **Gemini Circuit Breaker** | **Implemented and locally tested** | Three-state circuit breaker with single-probe concurrency protection in `HALF-OPEN` tested. |
| **Rate Limiter (SQLite / In-Memory)** | **Implemented and locally tested** | Sliding-window rate limiting tested for public, analyst, agent, and tool scopes. Host/process-bound. |
| **Rate Limiter (PostgreSQL)** | **Not yet verified in production** | Implemented with atomic sliding-window queries and fail-closed error handling; pending live PostgreSQL verification. |
| **SQLite-to-PostgreSQL Data Migration Tool** | **Not yet verified in production** | Idempotent migration script (`migrate_sqlite.py`) tested with SQLite sources and dry-run mocks; live migration pending. |
| **Request & Execution Tracing** | **Implemented and locally tested** | Standardized `X-Correlation-ID` header, trace IDs, and contextvar propagation across decisions, audit logs, and security events. |
| **Structured Operational Logging** | **Implemented and locally tested** | JSON logs with secret/token redaction and in-memory ring buffer for administrative diagnostics. Kept strictly distinct from audit ledger. |
| **Operational Metrics (JSON & Prometheus)** | **Implemented and locally tested** | Process-local counters, latency histograms, and gauges at `/metrics` and `/api/metrics`. Validated in Prometheus text format. |
| **Liveness & Readiness Health Probes** | **Implemented and locally tested** | Lightweight `/health` (liveness) and `/health/readiness` (dependency probe verifying storage and circuit breakers). Returns 503 on degraded backend. |
| **Incident Correlation Tracing** | **Implemented and locally tested** | `/api/security/incidents/{incident_id}/trace` linking incident to correlated alerts, events, and audit ledger records. |
| **Read-Only Cryptographic Audit Verification** | **Implemented and locally tested** | Safe `/api/audit/verify` endpoint verifying immutable SHA-256 hash chains without modifying data. Tamper detection verified. |

---

## 10. Security Observability & Monitoring Runbook

Phase 8 introduces production-grade, zero-external-dependency observability and diagnostic tracing to AgentShield.

### A. Request & Execution Tracing (Correlation IDs)

- **Header Specification**: HTTP requests may include `X-Correlation-ID`. If provided, it is sanitized against `^[a-zA-Z0-9_\-\.:]{1,128}$`.
- **Auto-Generation**: If absent, empty, or malformed, the system generates a secure non-guessable correlation ID formatted as `corr_<12hex>`.
- **Trace ID**: Every pipeline evaluation produces a distinct execution trace ID formatted as `trc_<12hex>`.
- **Context Propagation**: Correlation IDs propagate safely through `contextvars`, tagging:
  1. API request and response headers (`X-Correlation-ID`)
  2. Authorization decisions (`Decision.correlation_id`, `Decision.trace_id`)
  3. Execution results (`ExecutionResult.correlation_id`, `ExecutionResult.trace_id`)
  4. Cryptographic audit ledger records (`AuditRecord.correlation_id`, `AuditRecord.trace_id`)
  5. Security events, alerts, and incidents (`SecurityEvent.correlation_id`, `SecurityIncident.correlation_id`)
- **Safe Isolation**: Unset correlation IDs default to independent trace IDs, preventing cross-test or cross-request pollution.

### B. Structured Operational Logging

Operational logging is designed for diagnostic visibility and is maintained strictly separate from the permanent, cryptographic audit ledger:
- **Format**: High-throughput structured JSON records containing `timestamp`, `logger`, `component`, `event`, `outcome`, `correlation_id`, `trace_id`, and `details`.
- **Secret Redaction**: All logged payloads, arguments, credentials, and errors pass through `redact_sensitive_data()`. API keys, tokens, passwords, and bearer headers are automatically replaced with `[REDACTED]`.
- **In-Memory Ring Buffer**: `StructuredLogger` retains recent log entries (default 500) for fast diagnostic retrieval via `GET /api/observability/logs` (admin authenticated).

### C. Health & Dependency Probes

AgentShield distinguishes application process liveness from external dependency readiness:
- **Liveness Probe (`GET /health`)**:
  - Purpose: Kubernetes liveness / uptime check.
  - Returns `200 OK` with `{"status": "healthy", "service": "AgentShield API"}` if the process is responsive.
- **Readiness Probe (`GET /health/readiness`)**:
  - Purpose: Kubernetes readiness / load balancer health check.
  - Inspects active database connectivity, review queue accessibility, event store connectivity, and external provider circuit breaker status.
  - Returns `200 OK` with `ReadinessResponse` when fully operational.
  - Returns `503 Service Unavailable` with `status: "degraded"` and diagnostic error descriptions if any storage backend is inaccessible.

### D. Operational Metrics (JSON & Prometheus)

- **Endpoints**: `GET /metrics` and `GET /api/metrics`.
- **Formats**:
  - JSON Snapshot: Default format or when requested with `Accept: application/json`.
  - Prometheus Text: Provided when requested with `Accept: text/plain` or `?format=prometheus`.
- **Tracked Metrics**:
  - Authorization decisions (`allow`, `review`, `block`, `total`).
  - Tool executions (`executed`, `error`, `timeout`, `not_executed`).
  - Latencies (`authorization` and `execution` average, min, max, total ms).
  - Reliability events (rate limit hits, loops detected, provider failures, circuit breaker transitions).
  - Dynamic gauges (`pending_reviews`, `paused_agents`, `active_incidents`).
- **Process-Local Scope Note**: As documented across all interfaces, in-memory metrics collectors are process-local. In multi-instance or serverless environments, each instance maintains its local metrics counter; centralized monitoring should scrape all instances or aggregate logs.

### E. Incident Correlation Tracing & Cryptographic Verification

- **Incident Trace (`GET /api/security/incidents/{incident_id}/trace`)**:
  - Administrative endpoint providing complete root-cause correlation.
  - Returns the target incident linked to all associated alerts, raw security events, and immutable audit ledger entries sharing the incident's correlation ID.
- **Audit Verification (`GET /api/audit/verify`)**:
  - Strictly read-only verification of the append-only SHA-256 hash chain.
  - Computes `record_hash = SHA256(prev_hash + canonical_fields)` across all historical records.
  - Returns `valid: true` if chain is intact.
  - Returns `valid: false` with specific `corrupted_record_id` and error description if tampering or corruption is detected. Never misreports broken stores as valid.


---

## 11. Final Security Validation & Adversarial Verification Report (Phase 9)

### A. Attack Scenarios Tested & Outcomes

AgentShield underwent comprehensive automated adversarial verification under `tests/test_adversarial_validation.py` across 9 distinct threat categories, achieving a 100% pass rate:

| Threat Category | Adversarial Vector Tested | Expected Result | Verified Outcome | Status |
| :--- | :--- | :--- | :--- | :--- |
| **1. Prompt Injection & Instruction Overrides** | "Ignore all previous instructions...", DAN jailbreak persona, `/etc/shadow` exfiltration | Heuristic pattern matched, risk score escalated to HIGH/CRITICAL | Evaluated to REVIEW or BLOCK; tool never executes unvetted | **PASSED** |
| **2. Unauthorized Tool & Allowlist Bypass** | Unknown tools, unwhitelisted agents, casing bypass (`SEARCH_PRODUCT`), path traversal (`../../bin/sh`) | Deterministic PolicyEngine fails closed | Immediate BLOCK (`not_executed`), callable invoked 0 times | **PASSED** |
| **2b. Destination Allowlist Spoofing** | Subdomain trick (`api.stripe.com.attacker.com`), parameter injection (`?ref=api.stripe.com`) | Destination validated strictly against parsed hostname | Policy rule `destination_allowlist` fails closed to BLOCK | **PASSED** |
| **3. Session Token Attacks** | Forged HMAC signature, tampered payload (privilege escalation), expired token, revoked session replay | Session verification fails | Token rejected (`verify_token() == None`), 401 Unauthorized | **PASSED** |
| **4. Admin Bypass & Escalation** | Admin endpoints without key, spoofed role headers (`X-Admin-User: admin`), state mutations without auth | Strict middleware authentication | 401 Unauthorized on unauthenticated requests | **PASSED** |
| **5. Oversized & Malformed Payloads** | Request body > 1MB, tool arguments > 64KB, invalid/malformed JSON | Body and argument length limits enforced | 413 Payload Too Large / BLOCK decision (`PayloadSizeLimitError`) | **PASSED** |
| **6. Rate Limit Flooding & Exhaustion** | Rapid burst exceeding agent (3/min) or tool (2/min) limits, session budget exhaustion | Sliding window limiter triggers rate limit | Request blocked with `429 / RateLimitExceeded`, `Retry-After` header | **PASSED** |
| **7. Tool Loops & Traps** | 3 consecutive identical calls, alternating cyclic sequence (A-B-A-B-A), pagination calls | Loop detector flags repetitive and cyclic traps | Consecutive and cyclic loops BLOCK; pagination calls permitted | **PASSED** |
| **8. Provider Failure Resilience** | Gemini provider timeout, network disconnection, HTTP 503 error | Fallback does not manufacture synthetic ALLOW decisions | External failure raises `ProviderError`; Shield fails closed to BLOCK | **PASSED** |
| **9. Audit Tampering & Secret Leakage** | Database manipulation of audit row, credentials in tool arguments | Cryptographic hash chain breaks, credentials redacted | `verify_integrity()` flags `valid: false` and corrupted record ID; secrets masked | **PASSED** |
| **10. End-to-End Enforcement Integrity** | Tool callable execution counts on BLOCK, unapproved REVIEW, human APPROVE, repeated APPROVE | At-most-once execution contract | BLOCK: 0 calls; unapproved REVIEW: 0 calls; APPROVE: exactly 1 call | **PASSED** |
| **11. Simulator Isolation** | Attack scenario batch execution through simulator service | Zero pollution of production review or audit stores | Production audit logs: 0 records; production reviews: 0 records | **PASSED** |

### B. Vulnerabilities Discovered & Mitigations Applied

1. **Audit Chain Table Target Name in Direct Queries**:
   - *Discovery*: SQLite audit store utilizes table `audit_logs` (plural), but ad-hoc inspection tests attempted to target `audit_log` (singular).
   - *Fix*: Standardized table references in test queries and documentation to match `audit_logs`.
2. **SessionManager Protocol Alignment**:
   - *Discovery*: `SessionManager` initializes with `admin_key`, `store`, and optional `session_secret`, returning `(token, expires_at)` tuples and verifying via `verify_token()`.
   - *Fix*: Validated complete token lifecycle including payload tampering, signature mismatch, expiration, and revocation lookup.
3. **Cooperative Cancellation for Long-Running Tools**:
   - *Discovery*: Arbitrary Python thread execution cannot be forcibly killed asynchronously without risking interpreter corruption.
   - *Fix*: Implemented `CancellationToken` and `SafeExecutionContext` with explicit side-effect guarding, ensuring timed-out tool threads cannot commit persistent database or external side effects post-timeout.

### C. Test Suite Verification Summary

- **Adversarial Security Test Suite (`tests/test_adversarial_validation.py`)**:
  - `17 passed in 2.44s` (0 failed, 0 errors).
- **Complete Backend Test Suite (`pytest -q`)**:
  - `350 passed, 2 skipped, 0 failed in 61.87s`.
  - 2 skipped tests represent PostgreSQL live tests when a local PostgreSQL server is not actively running.
- **Browser Playwright End-to-End Suite (`tests/test_browser_dashboard_e2e.py`)**:
  - `4 passed in 25.58s` (0 failed, 0 errors).
- **Frontend Production Build (`npm run build`)**:
  - Built cleanly in `376ms` (`tsc -b && vite build`) with zero errors or warnings.
- **Code Formatting & Git Diff Verification (`git diff --check`)**:
  - Exited with status code `0` (clean, zero trailing whitespace or merge conflict markers).

### D. Prototype Demonstration Readiness Assessment

**Status: READY FOR CONTROLLED PROTOTYPE DEMONSTRATION**

The AgentShield runtime SDK, FastAPI orchestration backend, and React dashboard adhere to all non-negotiable architectural invariants:
- LLM and external models are strictly advisory and never the final authority.
- Unknown tools, unknown agents, and malformed requests fail closed to BLOCK.
- Tool callables are never invoked on BLOCK or unapproved REVIEW.
- State-mutating administrative actions require valid credentials and CSRF tokens.
- Public simulator operations run with synthetic sandbox tools and isolated storage.
- Append-only audit logging maintains cryptographic tamper evidence across all executions.

# AgentShield Deployment Guide

This guide details the deployment architecture, configuration steps, database lifecycle management, and operational runbooks for AgentShield across local development, multi-instance containers, and serverless environments (such as Vercel).

---

## 1. Architecture Overview

AgentShield is structured with clear layer boundaries:
1. **Runtime SDK (`src/agentshield/`)**: Framework-independent Python security engine enforcing deterministic policies, cryptographic audit chains, and reliability controls.
2. **FastAPI Service (`src/agentshield/api/`)**: REST interface exposing runtime authorization, metrics, health probes, and administrative review actions.
3. **React Dashboard (`frontend/src/`)**: Single-page application rendering system telemetry, audit chain status, and human review queues.

```
       [ Client Request / AI Agent ]
                     │
                     ▼
       ┌───────────────────────────┐
       │     FastAPI Gateway       │  <── Auth, CSRF, Correlation, Rate Limits
       └─────────────┬─────────────┘
                     │
                     ▼
       ┌───────────────────────────┐
       │   Deterministic Policy    │  <── Unknown Tool / Unwhitelisted => BLOCK
       └─────────────┬─────────────┘
                     │
                     ▼
       ┌───────────────────────────┐
       │        Risk Engine        │  <── Heuristic Injection & Financial Risk
       └─────────────┬─────────────┘
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
    [ ALLOW ]               [ REVIEW / BLOCK ]
         │                       │
         ▼                       ▼
   Tool Callable           Human Review Queue
   Executed Once           (Held Until Admin Decision)
         │
         ▼
   ┌───────────────────────────┐
   │  Cryptographic Audit Log  │  <── Append-only SHA-256 Hash Chain
   └───────────────────────────┘
```

---

## 2. Deployment Profiles

### Profile A: Local Development & Prototyping
- **Storage Engine**: SQLite (`:memory:` or local `.db` files).
- **Analyst Provider**: `mock` (deterministic local responses without external dependencies).
- **Environment**: Single process via `uvicorn`.

```bash
# 1. Install dependencies
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt

# 2. Run backend
python -m uvicorn agentshield.api.app:app --host 127.0.0.1 --port 8000 --reload

# 3. Run frontend (in a separate terminal)
cd frontend
npm install
npm run dev
```

### Profile B: Multi-Instance Container / Cloud VM (Docker, Kubernetes)
- **Storage Engine**: `postgres` via `AGENTSHIELD_STORAGE_BACKEND=postgres`.
- **Database**: Managed PostgreSQL instance (AWS RDS, Google Cloud SQL, Neon, Supabase).
- **Connection Management**: Configured connection pool (`AGENTSHIELD_POSTGRES_POOL_MIN=2`, `AGENTSHIELD_POSTGRES_POOL_MAX=20`).
- **Analyst Provider**: `gemini` with `AGENTSHIELD_ALLOW_MOCK_FALLBACK=true`.

### Profile C: Serverless (Vercel)
- **Storage Engine**: `postgres` is **MANDATORY**. SQLite cannot persist across stateless serverless function cold starts.
- **Connection Pooler**: Must use an external connection pooler (e.g. Supabase Transaction Pooler, Neon connection pooling URL, or PgBouncer) to prevent database connection exhaustion.
- **Routing Configuration**: Governed by `vercel.json` rewrites directing `/api/(.*)` to `/api/index.py` and all other paths to `/index.html`.

---

## 3. Database Lifecycle & Migrations

### Initial Schema Creation
AgentShield automatically applies idempotent schema migrations on startup through [`PostgresConnectionManager.apply_migrations()`](file:///d:/ML_Projects/agentshiled/src/agentshield/storage/migrations.py).
Migration tracking uses advisory locks (`pg_advisory_lock(0x41475348)`) ensuring concurrent serverless instance cold starts cannot corrupt migration execution.

The database manages 8 relational stores:
1. `audit_logs`: Append-only cryptographic SHA-256 hash chain with correlation tracing.
2. `reviews`: Human-in-the-loop review approvals with worker leasing and heartbeat fencing.
3. `events`: Security events and telemetry.
4. `alerts`: Aggregated policy violation alerts.
5. `incidents`: Security incident cases with status tracking.
6. `sessions`: HMAC-SHA256 token revocation store.
7. `analyst_reports`: Structured threat analysis reports.
8. `simulation_runs`: Isolated attack simulation history.

### SQLite to PostgreSQL Migration
To migrate historical development data to a staging or production PostgreSQL instance:

```bash
# Set connection string for target database
set AGENTSHIELD_DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require

# Execute non-destructive migration utility
python -m agentshield.storage.migrate_sqlite \
    --audit-db agentshield_audit.db \
    --review-db agentshield_reviews.db \
    --events-db agentshield_events.db \
    --reports-db agentshield_reports.db \
    --simulation-db agentshield_simulation.db
```

The migration utility:
- Preserves all timestamps, foreign keys, and correlation IDs.
- Validates cryptographic SHA-256 hash-chain continuity before and after migration.
- Aborts safely without modifying target data if hash validation fails.

---

## 4. Post-Deployment Verification Runbook

Execute these validation commands against the deployed service:

```bash
# 1. Check Liveness Probe (HTTP 200 OK)
curl -s -f https://your-deployment-domain.com/health

# 2. Check Readiness Probe (HTTP 200 OK when databases healthy; HTTP 503 degraded)
curl -s -i https://your-deployment-domain.com/health/readiness

# 3. Verify Cryptographic Audit Chain Integrity
curl -s https://your-deployment-domain.com/api/audit/verify \
    -H "X-Admin-Key: your-configured-admin-key"

# 4. Verify Public Simulation Isolation
curl -s https://your-deployment-domain.com/api/simulator/scenarios
curl -s -X POST https://your-deployment-domain.com/api/simulator/run-all \
    -H "Content-Type: application/json"
```

---

## 5. Rollback Considerations

1. **Database Rollback**:
   - AgentShield migrations are additive (e.g. creating tables and non-destructive index creation).
   - If rolling back application code to a prior version, the existing PostgreSQL database schema remains backward-compatible.
2. **Stateless Fallback**:
   - In the event of an external PostgreSQL outage, setting `AGENTSHIELD_READONLY=true` prevents degraded state corruption and preserves incident inspection.
3. **Audit Ledger Immutability**:
   - Never attempt to manually edit or delete rows from `audit_logs`. Any row modification breaks the cryptographic SHA-256 hash chain, causing `/api/audit/verify` to fail.


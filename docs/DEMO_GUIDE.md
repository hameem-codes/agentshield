# AgentShield Demo & Validation Guide

This guide provides a reproducible, step-by-step local procedure for demonstrating AgentShield's runtime security pipeline, attack simulation harness, review workflows, and dashboard observability.

---

## 1. Prerequisites

- **Python**: Version 3.12 or 3.13 (Python 3.14 compatible).
- **Node.js**: Version 20+ (with npm 10+).
- **Git**: For version inspection.
- **Modern Browser**: Chrome, Edge, Firefox, or Brave.

---

## 2. Environment Configuration

AgentShield uses environment variables for security configuration. Never publish real API keys or secrets in logs, repositories, or screenshots.

Create or verify your local `.env` file in the repository root:

```bash
# Administrative authentication key for incident controls and reviews
AGENTSHIELD_ADMIN_KEY="demo-local-admin-secret-key-123"

# Optional: Gemini API key for post-incident AI investigation reports
# If omitted, AgentShield runs in mock analyst mode with AGENTSHIELD_ALLOW_MOCK_FALLBACK=true
AGENTSHIELD_ALLOW_MOCK_FALLBACK="true"

# CORS origins for local web console
AGENTSHIELD_CORS_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"

# Set to "1" or "true" to demonstrate read-only emergency containment mode
AGENTSHIELD_READONLY="0"
```

---

## 3. Starting the Services

Open two terminal sessions:

### Terminal 1: Backend (FastAPI API Server)

From the project root directory:

```bash
# Activate virtual environment
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux:
# source .venv/bin/activate

# Start the API server on port 8000
python -m uvicorn agentshield.api.app:app --host 127.0.0.1 --port 8000 --reload
```

Verify backend health:
```bash
curl http://127.0.0.1:8000/health
# Response: {"status":"healthy","version":"0.1.0","read_only":false}
```

### Terminal 2: Frontend (React + Vite Console)

From the `frontend` directory:

```bash
cd frontend
npm run dev
```

The console will start at `http://localhost:5173`.

---

## 4. Accessing the Dashboard

1. Open `http://localhost:5173` in your browser.
2. Verify the visual theme and layout:
   - Deep background `#0e0e0e` with a 36px faint grid.
   - Text rendered in Archivo (bold uppercase italic headings) and DM Sans.
   - 7-stop winding bezier SVG path: **Propose $\rightarrow$ Validate $\rightarrow$ Risk $\rightarrow$ Policy $\rightarrow$ Decision $\rightarrow$ Execute $\rightarrow$ Audit**.
   - Overview chip counters: **ALLOW** (green `#3ddc97`), **REVIEW** (yellow `#f3b82b`), and **BLOCK** (pink `#ff8fb1`).

---

## 5. Demonstrating Attack Simulator Scenarios

The Attack Simulator panel is positioned in Block C (mid-left) on the dashboard. It exercises the sandbox deterministically without executing external tools.

### Running Individual Scenarios

Use the **Scenario** dropdown to select and run each of the 7 deterministic scenarios:

| # | Scenario Name | Attack Category | Expected Outcome | What to Observe |
|---|---|---|---|---|
| 1 | **Benign Product Purchase** | `BENIGN` | **ALLOW** | Green `ALLOW` chip, risk 0.0, low severity, expectation matched. |
| 2 | **Prompt Injection Override** | `PROMPT_INJECTION` | **BLOCK** | Pink `BLOCK` chip, risk 100.0, critical severity, rule `instruction_override`. |
| 3 | **Prohibited Shell Execution** | `UNAUTHORIZED_TOOL` | **BLOCK** | Pink `BLOCK` chip, unknown tool fails closed immediately. |
| 4 | **Sensitive Credential Exfiltration** | `DATA_EXFILTRATION` | **BLOCK** | Pink `BLOCK` chip, argument exfiltration pattern blocked. |
| 5 | **Unauthorized Financial Refund** | `PRIVILEGE_ESCALATION` | **BLOCK** | Pink `BLOCK` chip, agent role restriction enforced. |
| 6 | **Excessive Bulk Quantity Order** | `SUSPICIOUS_REVIEW` | **BLOCK** | Pink `BLOCK` chip, order quantity exceeds policy limit (10). |
| 7 | **Elevated Quantity Inquiry** | `SUSPICIOUS_REVIEW` | **REVIEW** | Yellow `REVIEW` chip, risk score 65.0 (HIGH), enqueued in review queue. |

### Running All Scenarios (Batch Run)

Click **RUN ALL**:
- Executes the entire scenario catalog sequentially.
- Demonstrates the complete outcome distribution: **1 ALLOW, 1 REVIEW, 5 BLOCK**.
- Benchmarks panel (Block D) updates to display **100% scenario expectation match rate** and real engine execution latency (~1.6ms).

---

## 6. Demonstrating Error & Failure Handling

If an internal component experiences an unexpected runtime error (e.g. storage unavailability or network failure):
- AgentShield **never** fabricates a synthetic BLOCK decision or invented risk score.
- The simulation run reports an explicit **`FAILED`** status chip.
- A safe diagnostic message is presented with secrets redacted (`[REDACTED]`).
- Failed runs are excluded from decision counts and expectation match rates, while the failure counter is incremented separately (`F: 1`).

---

## 7. Inspecting Reviews, Incidents, and Audit Ledger

The single **TELEMETRY** window (Block E) provides real-time observability across all pipeline streams:

### A. Events Stream (`events_stream.log`)
- Click the **EVENTS** tab to inspect evaluated tool proposals.
- Filter by `all`, `BLOCK`, `REVIEW`, or `ALLOW`.

### B. Human Review Queue (`human_review_queue.log`)
- Click **REVIEWS** to view pending items created by `scenario-suspicious-legitimate`.
- To take review actions:
  1. Click **ADMIN SIGN IN** in the header.
  2. Enter the configured administrative key (`demo-local-admin-secret-key-123`).
  3. Once signed in, click **APPROVE** or **REJECT** on the pending review item.
  4. The review queue updates in real-time.

### C. Security Incidents & Gemini Analyst (`security_incidents.log`)
- Click **INCIDENTS** to inspect correlated alerts and security incidents.
- Click **INVESTIGATE** on any recorded incident to request an automated security report from the LLM Analyst (Gemini or local mock fallback).

### D. Cryptographic Audit Chain (`audit_integrity_chain.log`)
- Click **AUDIT** to verify the SHA-256 hash chain of production tool invocations.
- Click **RE-VERIFY**: The ledger validates genesis-to-leaf hash linkage and reports cryptographic validity.

### E. Simulation Log (`simulation_runs.log`)
- Click **SIMULATION** to view the live log of all simulator executions.
- If signed in as an admin, click `[clear]` to safely reset simulation history without affecting production audit records.

---

## 8. Resetting Demo Data Safely

To safely clean up demo simulation data without affecting production logs:

1. **Via UI**: In the **SIMULATION** telemetry tab, click `[clear]` (requires admin sign in).
2. **Via API**:
   ```bash
   curl -X DELETE http://127.0.0.1:8000/api/simulator/history \
     -H "x-admin-key: demo-local-admin-secret-key-123"
   ```
3. **Database Files**: Simulation records reside strictly in `agentshield_simulation.db`. Deleting or recreating this file has zero impact on `agentshield_audit.db`.

---

## 9. Demonstrating Emergency Read-Only Mode

To demonstrate incident containment mode:

1. Stop the backend server.
2. Restart with read-only enabled:
   ```bash
   AGENTSHIELD_READONLY=1 python -m uvicorn agentshield.api.app:app --host 127.0.0.1 --port 8000
   ```
3. In the dashboard:
   - The header displays `READ-ONLY MODE ACTIVE`.
   - Public reads and isolated simulator runs continue to work.
   - Any state-changing administrative action (approving reviews, pausing agents, clearing history) is rejected with `HTTP 403 Forbidden`.

---

## 10. Troubleshooting & Known Limitations

- **Browser Automation / Playwright**:
  Browser-level end-to-end tests require `playwright` which is optional. When absent, backend integration workflows and regression suites cover all routes, while browser tests are gracefully skipped.
- **Port Conflicts**:
  If port 8000 or 5173 is in use, supply `--port <new_port>` to uvicorn or `--port <new_port>` to vite. Update `AGENTSHIELD_CORS_ORIGINS` accordingly.
- **Gemini Rate Limits**:
  If using a live `GEMINI_API_KEY`, ensure rate limits are respected. The analyst endpoint enforces local rate limiting (20 requests/min).


# AgentShield Known Limitations & Threat Model Boundaries

AgentShield is a deterministic runtime security engine designed for tool-using AI agents. In keeping with the project's core principles, this document transparently documents known architectural constraints, platform limitations, and threat model boundaries.

---

## 1. Thread Execution Timeouts & Tool Cancellation

### The Constraint
In CPython, worker threads cannot be asynchronously terminated or forcibly killed from another thread without risking interpreter corruption or deadlocks.

### Current Mitigation & Remaining Risk
- AgentShield enforces execution timeouts via a thread pool with bounded waiting (`execute_with_timeout()`).
- When a timeout occurs, AgentShield immediately returns an error result (`timeout`), records the execution failure, and flags the operation as blocked.
- AgentShield provides a thread-safe `CancellationToken` and `SafeExecutionContext` to registered tool callables.
- **Limitation**: If a third-party tool function enters an uncooperative, blocking C-extension loop or ignores `context.cancellation_token.is_cancelled`, the underlying thread may continue consuming background CPU cycles until it terminates naturally. It cannot commit unauthorized database changes through the Shield runtime, but compute resources remain occupied during that period.

---

## 2. Serverless State Persistence & Ephemeral File Systems

### The Constraint
Stateless serverless compute platforms (such as Vercel Serverless Functions, AWS Lambda, Google Cloud Run) provide an ephemeral, read-only root file system with an in-memory `/tmp` partition that is discarded between cold starts.

### Impact on Storage Engine
- **SQLite is UNSUITABLE for Serverless Production**: Any SQLite database written to `/tmp` will be erased when the serverless container spins down, resulting in loss of audit history, pending reviews, and session revocations across invocations.
- **Requirement**: `AGENTSHIELD_STORAGE_BACKEND=postgres` and an active `DATABASE_URL` are strictly mandatory for any serverless deployment.
- **Connection Limits**: High concurrency on serverless functions can quickly exhaust PostgreSQL connection limits. Deployments must place a connection pooler (e.g. PgBouncer, Neon pooling URL, Supabase Transaction Pooler) between the serverless functions and the PostgreSQL database.

---

## 3. Heuristic Prompt Injection Detection Scope

### The Constraint
`PromptInjectionDetector` uses deterministic regular expressions and keyword pattern matching for known adversarial indicators (instruction overrides, persona jailbreaks, credential exfiltration patterns).

### Threat Model Boundaries
- It is **NOT** a semantic understanding model or a guarantee against novel prompt injection techniques.
- Sophisticated adversaries utilizing base64 encoding, non-English translation, multi-step indirect prompt injection, or token manipulation may evade keyword heuristics.
- **Architectural Primacy**: AgentShield does not rely on injection detection as its sole security barrier. Deterministic PolicyEngine allowlists (agent existence, tool allowlists, argument schema validation, destination hostname checks) form the primary security boundary and always fail closed regardless of prompt contents.

---

## 4. Cryptographic Tamper-Evidence vs. Hardware Immutability

### The Constraint
AgentShield maintains an append-only SHA-256 hash chain linking each audit record (`record_hash = SHA256(prev_hash + canonical_fields)`).

### Threat Model Boundaries
- The hash chain is **tamper-evident, not hardware-immutable**.
- Any unauthorized SQL `UPDATE`, `DELETE`, or row reordering within the database immediately breaks the hash chain, causing `/api/audit/verify` to fail.
- However, an attacker with full OS-level write access to the database file or superuser database privileges could rewrite the entire database file and recompute a fresh hash chain from genesis.
- **Production Recommendation**: High-compliance environments should mirror audit events to an external write-once-read-many (WORM) storage bucket or a centralized immutable SIEM.

---

## 5. In-Memory Metrics & Distributed Aggregation

### The Constraint
AgentShield's operational metrics collector (`MetricsCollector`) maintains thread-safe counters, latency histograms, and gauges in local process memory.

### Impact on Multi-Instance Deployments
- In a horizontally autoscaling cluster or serverless environment, each container instance maintains its own local metrics counters.
- Prometheus scraping against a round-robin load balancer will observe metrics from whichever instance serves the request.
- Centralized monitoring architectures should either configure Prometheus to scrape individual instance pods directly or rely on aggregated structured logs (`agentshield.operational`).

---

## 6. Execution Timeouts on Free-Tier Serverless Platforms

### The Constraint
Vercel Hobby (free tier) functions have a hard 10-second gateway execution timeout.
- AgentShield's default tool execution timeout is `30.0` seconds (`AGENTSHIELD_MAX_TOOL_EXECUTION_SECONDS=30.0`).
- If an agent tool call takes 15 seconds on a free-tier Vercel deployment, the Vercel gateway will terminate the HTTP connection with a `504 Gateway Timeout` before AgentShield's cooperative cancellation can gracefully finalize audit records.
- **Production Recommendation**: For serverless deployments with long-running tools, either upgrade to a Pro plan with configurable function durations or lower `AGENTSHIELD_MAX_TOOL_EXECUTION_SECONDS` to `8.0` seconds.


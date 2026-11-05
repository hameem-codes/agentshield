# AgentShield Execution Lifecycle: Architecture, Guarantees & Limitations

AgentShield is a runtime security SDK for tool-using AI agents. This document details the persistence lifecycle, execution states, ownership fencing, secret provider abstraction, and the exact mathematical and architectural guarantees provided by the runtime.

---

## 1. Pipeline Overview

When an agent proposes an action, AgentShield processes it through a strict, deterministic security pipeline:

```
Agent Action -> Normalize & Freeze -> Deterministic Policy -> Risk Engine -> Decision
                                                                               |
                 +-------------------------------------------------------------+
                 |
                 +--> BLOCK: Never calls tool. Logged to audit store.
                 +--> REVIEW: Stored in persistent review queue (SQLite).
                 +--> ALLOW: Invoked once by the executor -> Separate Audit Record.
```

1. **Normalize & Freeze**: Proposal arguments are converted into a deeply immutable snapshot (`FrozenDict` and tuples). Caller mutations after proposal cannot alter the executed or audited arguments (TOCTOU defense).
2. **Policy Evaluation**: Deterministic policy rules are evaluated first. Denials fail closed (`BLOCK`).
3. **Risk Evaluation**: Heuristics and injection detection assess risk. Risk can escalate `ALLOW` to `REVIEW` or `BLOCK`, but can never overturn a policy denial.
4. **Execution**: If `ALLOW`, executed immediately by the executor. If `REVIEW`, enqueued into persistent storage until human approval.
5. **Separate Audit**: Authorization decisions and execution outcomes are recorded separately with cryptographic hash chaining.

---

## 2. Persistent Review Queue State Machine

The review queue persists pending approvals in an isolated SQLite database (`agentshield_reviews.db`).

### Review Status
- `pending`: Action is queued awaiting approval or rejection. Subject to TTL expiry.
- `approved`: Human approver approved execution.
- `rejected`: Human reviewer rejected action. Transition is terminal; cannot execute.
- `expired`: TTL elapsed before approval. Fails closed to `BLOCK`.

### Explicit Execution States
To accurately track execution progress across crashes and restarts:
- `not_started`: Initial state prior to approval claim.
- `executing`: A worker has claimed the review with an active ownership lease.
- `succeeded`: The downstream tool callable returned successfully, and status was committed.
- `failed`: The tool raised an error or execution failed.
- `outcome_unknown`: The process died or crashed mid-execution. Outcome cannot be verified locally.

---

## 3. Worker Ownership Fencing & Lease Heartbeats

### The Distributed Concurrency Problem
If multiple worker processes or containers share a review database, two hazards emerge:
1. **Premature Recovery**: A new worker process booting up must not mark another live process's in-flight execution as abandoned.
2. **Stale Overwrite**: A slow or partitioned worker that lost its lease must not overwrite a newer worker's state or an `outcome_unknown` marker.

### Implementation
1. **Worker Identification**: Every approval claim generates a unique worker ID (`proc_{pid}_{uuid}`).
2. **Execution Leases**: Claims set `lease_expires_at = now + lease_duration` (default 60s).
3. **Automatic Heartbeats**: While the tool callable is running, `Shield` runs an asynchronous background heartbeat thread that periodically calls `heartbeat(review_id, worker_id, extension)`. As long as the worker is alive, its lease remains valid.
4. **Ownership Fencing**: State updates (`mark_executed`) enforce:
   ```sql
   UPDATE reviews
   SET execution_status = ?, error = ?, lease_expires_at = NULL
   WHERE review_id = ?
     AND execution_worker_id = ?
     AND execution_status = 'executing';
   ```
   If the worker's lease expired and was reassigned or reconciled, `rowcount == 0`. The worker is fenced out and `FencingError` is raised.

---

## 4. Executor-Owned Secret Provider Interface

In accordance with AgentShield's non-negotiable principle:
> *Only the executor holds tool credentials. Agents never call tools directly.*

### Principles
- **No Raw Credentials in Proposals**: Agents must not submit raw API keys, passwords, or bearer tokens in proposed arguments. When `enforce_secret_references=True`, raw credentials fail closed to `BLOCK`.
- **Opaque Secret References**: Proposals use opaque reference URIs (e.g. `secret_ref://stripe/prod_key` or `env://DATABASE_URL`).
- **No Secrets in Storage**: Neither `reviews.db` nor `audit_logs.db` ever stores resolved secrets. Only the opaque reference string is persisted.
- **Executor-Time Resolution**: When `Shield` executes the tool callable, `resolve_secret_references()` replaces references with real values in memory only, immediately before invoking the callable.

```python
from agentshield.secrets import DictSecretProvider

secret_provider = DictSecretProvider({
    "stripe/prod_key": "sk-live-real-secret-token",
})

shield = Shield(secret_provider=secret_provider, enforce_secret_references=True)
# Proposed arguments contain only: {"api_key": "secret_ref://stripe/prod_key"}
```

---

## 5. Idempotency Contract: Declared vs. Guaranteed Deduplication

AgentShield explicitly distinguishes a *declared idempotent tool* from a downstream service that *actually guarantees idempotency-key deduplication*.

1. **Read-Only Tools (`read_only=True`)**:
   - Naturally safe queries with no external side-effects (e.g., `get_user_profile`, `read_balance`).
   - Safe to retry if left in `outcome_unknown`.
2. **Deduplicated Mutating Tools (`guarantees_deduplication=True`)**:
   - Mutates external state, but downstream API guarantees deduplication via idempotency keys (e.g. Stripe `Idempotency-Key` header).
   - Safe to retry **only if** an explicit, concrete `idempotency_key` is present in the record. The safe execution adapter delivers the exact same key to the tool callable on every retry.
3. **Declared Idempotent without Deduplication Guarantee (`guarantees_deduplication=False`)**:
   - A tool author may declare `idempotent=True`, but if the downstream service lacks an idempotency engine, automated retry is **strictly refused** and fails closed.
4. **Non-Idempotent Tools (`idempotent=False`)**:
   - Can **never** be automatically retried once in `outcome_unknown`. Requires manual administrative reconciliation.

---

## 6. Actual Guarantees

AgentShield achieves and verifies the following security and reliability guarantees:

1. **At-Most-Once Initiation**: Non-idempotent actions will never be initiated more than once across crashes, concurrent processes, and replay attempts.
2. **Deterministic Fail-Closed Policy**: Any policy failure, unauthenticated agent, unknown tool, malformed argument, or expired review fails closed to `BLOCK`.
3. **TOCTOU Defense**: Tool policy validation and execution operate on the exact same deeply frozen argument snapshot. Caller mutations after proposal cannot alter executed arguments.
4. **Tamper-Evident Hash Chaining**: Audit records are cryptographically linked (`prev_hash` -> `record_hash`). Any modification, deletion, or truncation of historical records is detectable via `verify_integrity()`.
5. **Ownership Fencing**: Partitioned or slow workers cannot overwrite subsequent execution states once their lease has expired or been reclaimed.
6. **Zero-Secret Persistence**: Sensitive keys and error messages are redacted before SQLite persistence. Secret references prevent raw credentials from entering proposals or audit logs.

---

## 7. Inherent Limitations & Non-Claims

> **CRITICAL ARCHITECTURAL NOTICE**: AgentShield does **not** claim "exactly-once execution" for external side-effects.

### Why Exactly-Once External Execution Is Impossible
In distributed systems (the Two-Generals Problem), no local software or database lock can guarantee exactly-once external execution in the presence of uncoordinated process crashes or network partitions:

```
[AgentShield Worker] ----------------- HTTP POST /charge -----------------> [Payment API]
        |                                                                           |
        | <-------------------------- HTTP 200 OK ----------------------------------+
        |                               (Charge succeeded remotely)
   [CRASH / KILL]
(Worker dies before SQLite can commit 'succeeded')
```

- If a process crashes after an external HTTP request succeeds but before SQLite records `succeeded`, the local state is indeterminable (`outcome_unknown`).
- **If AgentShield were to automatically retry**: The customer would be charged twice.
- **If AgentShield does not retry**: The external charge occurred, but the local system marks `outcome_unknown`.

AgentShield chooses **fail-closed security**:
1. Non-idempotent actions in `outcome_unknown` are **never** retried automatically.
2. Mutating actions are only retried if downstream deduplication is guaranteed via an idempotency key.
3. In all other crash scenarios, manual operator reconciliation is mandatory.

### Storage & Filesystem Limitations
- **SQLite Concurrency**: SQLite transactions (`BEGIN IMMEDIATE`) serialize concurrent processes via OS file locks (`fcntl` on POSIX, `LockFileEx` on Windows). SQLite review and audit stores must reside on a POSIX/Windows local filesystem, not network-mounted distributed filesystems (NFS/CIFS/SMB) where file-locking semantics may be unreliable.


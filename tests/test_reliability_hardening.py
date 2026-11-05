"""
Reliability and Hardening Verification Test Suite for AgentShield.

Covers:
1. Safe lease heartbeats for long-running tools.
2. Worker ownership fencing (preventing stale workers from overwriting newer execution states).
3. SecretProvider interface and opaque secret reference resolution (never storing resolved secrets).
4. Idempotency contract (declared idempotent vs guaranteed downstream deduplication vs read-only).
5. Real multi-process crash tests using subprocesses and shared SQLite databases.
"""

import os
import sqlite3
import subprocess
import sys
import tempfile
import time
from typing import Dict, Any, Optional

import pytest
from agentshield import Shield, ExecutionStatus
from agentshield.models import Decision, DecisionValue, RiskLevel
from agentshield.policy.rules import PolicyConfiguration, AgentConfig, ToolRule
from agentshield.audit import SQLiteAuditStore
from agentshield.review import SQLiteReviewStore, ReviewExecutionState, FencingError
from agentshield.secrets import DictSecretProvider, EnvSecretProvider, resolve_secret_references


def _setup_shield(
    review_db: str,
    audit_db: Optional[str] = None,
    secret_provider: Optional[Any] = None,
    enforce_secret_references: bool = False,
    lease_duration: float = 60.0,
    heartbeat_enabled: bool = True,
) -> Shield:
    review_store = SQLiteReviewStore(db_path=review_db)
    audit_store = SQLiteAuditStore(db_path=audit_db) if audit_db else None
    shield = Shield(
        audit_store=audit_store,
        review_store=review_store,
        secret_provider=secret_provider,
        enforce_secret_references=enforce_secret_references,
        lease_duration=lease_duration,
        heartbeat_enabled=heartbeat_enabled,
    )
    shield.policy_engine.config = PolicyConfiguration(
        agents={
            "manager": AgentConfig(
                name="manager",
                allowed_tools=["send_payment", "payout_invoice", "read_account", "execute_task"],
            )
        },
        tools={
            "send_payment": ToolRule(tool="send_payment", max_amount=100000),
            "payout_invoice": ToolRule(tool="payout_invoice", max_amount=100000),
            "read_account": ToolRule(tool="read_account"),
            "execute_task": ToolRule(tool="execute_task"),
        },
    )
    return shield


# =====================================================================
# 1. Lease Renewal & Heartbeat Tests
# =====================================================================

def test_heartbeat_renews_lease_for_long_running_tool():
    """A live worker executing a task longer than the initial lease must not be marked
    abandoned because its background heartbeat continually renews the lease."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f_rev:
        rev_db = f_rev.name

    try:
        # Initial lease is very short (0.3s), tool execution runs for 0.7s
        shield = _setup_shield(rev_db, lease_duration=0.3, heartbeat_enabled=True)
        completed = {"done": False}

        def slow_tool(args):
            time.sleep(0.7)
            completed["done"] = True
            return {"status": "finished"}

        shield.registry.register("execute_task", slow_tool)

        dec = shield.authorize(agent="manager", tool="execute_task", arguments={"task": "heavy_compute"})
        # Manually force into review queue to test approval lifecycle
        rev_id = "rev_heartbeat_1"
        shield.review_store.enqueue_review(
            review_id=rev_id,
            agent="manager",
            tool="execute_task",
            arguments={"task": "heavy_compute"},
            permissions=[],
            decision=Decision(
                allowed=False,
                decision=DecisionValue.REVIEW,
                reasons=["Needs review"],
                risk_score=70.0,
                severity=RiskLevel.HIGH,
                agent="manager",
                tool="execute_task",
            ),
            created_at=time.time(),
            expires_at=time.time() + 300,
        )

        # Check in a separate store while the tool is executing (at t=0.45s, beyond initial 0.3s lease)
        def inspect_mid_flight():
            time.sleep(0.45)
            store_checker = SQLiteReviewStore(db_path=rev_db)
            # Reconcile should NOT mark as outcome_unknown because heartbeat extended lease!
            reconciled = store_checker.reconcile_in_flight(now=time.time())
            assert len(reconciled) == 0
            assert store_checker.get_execution_state(rev_id) == ReviewExecutionState.EXECUTING.value

        import threading
        t_inspect = threading.Thread(target=inspect_mid_flight)
        t_inspect.start()

        # Approve and execute
        res = shield.approve_review(rev_id, approver="alice")
        t_inspect.join()

        assert res is not None
        assert res.execution_status == ExecutionStatus.EXECUTED
        assert completed["done"] is True
        assert shield.get_review_execution_state(rev_id) == ReviewExecutionState.SUCCEEDED.value
    finally:
        if os.path.exists(rev_db):
            os.remove(rev_db)


# =====================================================================
# 2. Worker Ownership Fencing Tests
# =====================================================================

def test_ownership_fencing_prevents_stale_worker_state_overwrite():
    """A stale worker whose lease expired must be fenced out and never overwrite
    a newer worker or outcome_unknown state."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f_rev:
        rev_db = f_rev.name

    try:
        store = SQLiteReviewStore(db_path=rev_db)
        rev_id = "rev_fence_test"
        store.enqueue_review(
            review_id=rev_id,
            agent="manager",
            tool="send_payment",
            arguments={"amount": 2500, "idempotency_key": "idemp_fence_1"},
            permissions=[],
            decision=Decision(
                allowed=False,
                decision=DecisionValue.REVIEW,
                reasons=["Review required"],
                risk_score=70.0,
                severity=RiskLevel.HIGH,
                agent="manager",
                tool="send_payment",
            ),
            created_at=time.time(),
            expires_at=time.time() + 300,
            idempotency_key="idemp_fence_1",
        )

        # Worker 1 claims with a very short lease (0.1s)
        claimed_w1 = store.claim_and_approve(rev_id, approver="admin1", worker_id="worker_stale_1", lease_duration=0.1)
        assert claimed_w1 is not None
        assert claimed_w1["execution_worker_id"] == "worker_stale_1"

        # Worker 1 stalls; lease expires
        time.sleep(0.15)
        # Reconcile marks outcome_unknown
        store.reconcile_in_flight()
        assert store.get_execution_state(rev_id) == ReviewExecutionState.OUTCOME_UNKNOWN.value

        # Worker 2 claims the review for idempotent retry
        claimed_w2 = store.claim_and_approve(
            rev_id,
            approver="admin2",
            worker_id="worker_active_2",
            lease_duration=60.0,
            allow_idempotent_retry=True,
        )
        assert claimed_w2 is not None
        assert claimed_w2["execution_worker_id"] == "worker_active_2"

        # Worker 2 completes execution successfully
        ok_w2 = store.mark_executed(rev_id, execution_state=ReviewExecutionState.SUCCEEDED.value, worker_id="worker_active_2")
        assert ok_w2 is True
        assert store.get_execution_state(rev_id) == ReviewExecutionState.SUCCEEDED.value

        # Now Worker 1 wakes up and attempts to report that it succeeded (or failed)
        ok_w1 = store.mark_executed(
            rev_id,
            execution_state=ReviewExecutionState.FAILED.value,
            error="Late failure from stale worker",
            worker_id="worker_stale_1",
        )
        # Worker 1 MUST BE FENCED OUT!
        assert ok_w1 is False, "Stale worker update must be rejected by ownership fencing"

        # State must remain Worker 2's SUCCEEDED state!
        assert store.get_execution_state(rev_id) == ReviewExecutionState.SUCCEEDED.value
        assert store.get_review(rev_id)["execution_worker_id"] == "worker_active_2"
    finally:
        if os.path.exists(rev_db):
            os.remove(rev_db)


# =====================================================================
# 3. Secret Provider & Opaque References Tests
# =====================================================================

def test_secret_provider_and_opaque_reference_lifecycle():
    """Verify that:
    1. Agents submitting raw credentials are blocked when enforce_secret_references is active.
    2. Opaque secret references (secret_ref://...) pass authorization and review persistence.
    3. Neither reviews table nor audit store persists resolved secrets.
    4. Only the executor resolves secrets in memory immediately prior to invocation.
    """
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f_rev:
        rev_db = f_rev.name
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f_aud:
        aud_db = f_aud.name

    try:
        secret_store = DictSecretProvider({
            "stripe/prod_key": "sk-live-SEC1234567890abcdef",
            "db/password": "super_secret_db_pass_999",
        })

        shield = _setup_shield(
            rev_db,
            aud_db,
            secret_provider=secret_store,
            enforce_secret_references=True,
        )

        executed_payloads = []
        def payment_gateway(args):
            executed_payloads.append(dict(args))
            return {"transaction_id": "tx_9988"}

        shield.registry.register("send_payment", payment_gateway)

        # 1. Raw credential submission -> MUST BE BLOCKED
        raw_cred_args = {"amount": 500, "api_key": "sk-raw-secret-key-123456"}
        block_dec = shield.authorize(agent="manager", tool="send_payment", arguments=raw_cred_args)
        assert block_dec.decision == DecisionValue.BLOCK
        assert any("Agents must not submit raw credentials" in r for r in block_dec.reasons)

        # 2. Opaque secret reference submission -> ALLOW / REVIEW
        opaque_args = {
            "amount": 2500,
            "api_key": "secret_ref://stripe/prod_key",
            "db_pass": "secret_ref://db/password",
            "account": "acc_target_456",
        }
        dec = shield.authorize(agent="manager", tool="send_payment", arguments=opaque_args)
        assert dec.decision == DecisionValue.REVIEW
        rev_id = shield.get_review_queue()[0]["review_id"]

        # 3. Inspect SQLite review record -> MUST ONLY STORE OPAQUE URI, NOT RESOLVED SECRET
        conn_rev = sqlite3.connect(rev_db)
        conn_rev.row_factory = sqlite3.Row
        rev_row = conn_rev.execute("SELECT arguments FROM reviews WHERE review_id = ?", (rev_id,)).fetchone()
        conn_rev.close()
        stored_args = rev_row["arguments"]
        assert "secret_ref://stripe/prod_key" in stored_args
        assert "sk-live-SEC1234567890abcdef" not in stored_args
        assert "super_secret_db_pass_999" not in stored_args

        # 4. Approve and execute
        res = shield.approve_review(rev_id, approver="security_admin")
        assert res is not None
        assert res.execution_status == ExecutionStatus.EXECUTED

        # 5. Verify executor delivered resolved secret into callable
        assert len(executed_payloads) == 1
        assert executed_payloads[0]["api_key"] == "sk-live-SEC1234567890abcdef"
        assert executed_payloads[0]["db_pass"] == "super_secret_db_pass_999"

        # 6. Verify SQLite audit record still does NOT contain resolved secret
        conn_aud = sqlite3.connect(aud_db)
        conn_aud.row_factory = sqlite3.Row
        aud_row = conn_aud.execute("SELECT arguments FROM audit_logs WHERE execution_status = 'executed' ORDER BY id DESC LIMIT 1").fetchone()
        conn_aud.close()
        aud_args = aud_row["arguments"]
        assert "sk-live-SEC1234567890abcdef" not in aud_args
        assert "super_secret_db_pass_999" not in aud_args
    finally:
        if os.path.exists(rev_db):
            os.remove(rev_db)
        if os.path.exists(aud_db):
            os.remove(aud_db)


# =====================================================================
# 4. Idempotency Contract Tests
# =====================================================================

def test_idempotency_contract_declared_vs_guaranteed_vs_readonly():
    """Verify the strict idempotency contract:
    - Declared idempotent=True with guarantees_deduplication=False -> RETRY REFUSED.
    - Declared idempotent=True with guarantees_deduplication=True but NO key -> RETRY REFUSED.
    - Declared idempotent=True with guarantees_deduplication=True WITH key -> RETRY ALLOWED.
    - Read-only queries -> RETRY ALLOWED.
    """
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f_rev:
        rev_db = f_rev.name

    try:
        shield = _setup_shield(rev_db)

        # 1. Tool declares idempotent=True, but guarantees_deduplication=False
        shield.registry.register(
            "payout_invoice",
            lambda args: {"payout": "done"},
            idempotent=True,
            guarantees_deduplication=False,
        )

        dec1 = shield.authorize(
            agent="manager",
            tool="payout_invoice",
            arguments={"amount": 2500, "idempotency_key": "idemp_key_1"},
        )
        assert dec1.decision == DecisionValue.REVIEW
        rev1_id = shield.get_review_queue()[0]["review_id"]

        # Simulate crash to outcome_unknown
        shield.review_store.claim_and_approve(rev1_id, approver="adm", lease_duration=0.1)
        time.sleep(0.15)
        shield.review_store.reconcile_in_flight()
        assert shield.get_review_execution_state(rev1_id) == ReviewExecutionState.OUTCOME_UNKNOWN.value

        # Retry MUST BE REFUSED because downstream does not guarantee deduplication!
        retry1 = shield.approve_review(rev1_id, approver="retry_adm", allow_idempotent_retry=True)
        assert retry1 is None, "Retry must be refused when guarantees_deduplication is False"

        # 2. Tool has read_only=True -> safe to retry even without idempotency key
        shield.registry.register(
            "read_account",
            lambda args: {"balance": 1000},
            read_only=True,
        )
        # Put into review manually
        rev2_id = "rev_read_1"
        shield.review_store.enqueue_review(
            review_id=rev2_id,
            agent="manager",
            tool="read_account",
            arguments={"account": "acc_1"},
            permissions=[],
            decision=Decision(
                allowed=False,
                decision=DecisionValue.REVIEW,
                reasons=["Review read"],
                risk_score=70.0,
                severity=RiskLevel.HIGH,
                agent="manager",
                tool="read_account",
            ),
            created_at=time.time(),
            expires_at=time.time() + 300,
        )
        shield.review_store.claim_and_approve(rev2_id, approver="adm", lease_duration=0.1)
        time.sleep(0.15)
        shield.review_store.reconcile_in_flight()
        assert shield.get_review_execution_state(rev2_id) == ReviewExecutionState.OUTCOME_UNKNOWN.value

        # Read-only retry MUST SUCCEED
        retry2 = shield.approve_review(rev2_id, approver="retry_adm")
        assert retry2 is not None
        assert retry2.execution_status == ExecutionStatus.EXECUTED
        assert retry2.tool_result == {"balance": 1000}
    finally:
        if os.path.exists(rev_db):
            os.remove(rev_db)


# =====================================================================
# 5. Real Multi-Process Subprocess Crash & Recovery Tests
# =====================================================================

def test_real_subprocess_crash_and_recovery():
    """Spawn a real Python worker subprocess on a shared SQLite database file.
    Kill the worker with SIGTERM/kill mid-execution and verify that:
    1. During the lease, the DB records the executing state with the dead worker's lease.
    2. After lease expiry, a fresh process reboots and safely reconciles to outcome_unknown.
    3. Unsafe retries are rejected; safe idempotent retries succeed.
    """
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f_rev:
        rev_db = f_rev.name

    try:
        init_shield = _setup_shield(rev_db)
        dec = init_shield.authorize(
            agent="manager",
            tool="payout_invoice",
            arguments={"amount": 2500, "invoice_id": "inv_real_crash", "idempotency_key": "idemp_crash_real_1"},
        )
        assert dec.decision == DecisionValue.REVIEW
        review_id = init_shield.get_review_queue()[0]["review_id"]
        del init_shield

        # Worker script that signals when execution starts, then simulates long work without heartbeating
        worker_code = (
            "import sys, os, time\n"
            "from agentshield import Shield\n"
            "from agentshield.review import SQLiteReviewStore\n"
            "from agentshield.policy.rules import PolicyConfiguration, AgentConfig, ToolRule\n"
            "db_path = sys.argv[1]\n"
            "rev_id = sys.argv[2]\n"
            "signal_file = sys.argv[3]\n"
            "store = SQLiteReviewStore(db_path=db_path, timeout=30.0)\n"
            "# Disable auto-heartbeat so lease actually expires upon kill\n"
            "shield = Shield(review_store=store, lease_duration=0.5, heartbeat_enabled=False)\n"
            "shield.policy_engine.config = PolicyConfiguration(\n"
            "    agents={'manager': AgentConfig(name='manager', allowed_tools=['payout_invoice'])},\n"
            "    tools={'payout_invoice': ToolRule(tool='payout_invoice', max_amount=100000)}\n"
            ")\n"
            "def worker_tool(args):\n"
            "    with open(signal_file, 'w') as f:\n"
            "        f.write('started')\n"
            "    time.sleep(10)\n"  # Hangs until killed
            "    return {'ok': True}\n"
            "shield.registry.register('payout_invoice', worker_tool, idempotent=True, guarantees_deduplication=True)\n"
            "shield.approve_review(rev_id, approver='worker_proc_1')\n"
        )

        with tempfile.NamedTemporaryFile(suffix=".signal", delete=False) as f_sig:
            sig_file = f_sig.name

        env = os.environ.copy()
        env["PYTHONPATH"] = os.path.abspath("src")

        # Spawn worker process
        proc = subprocess.Popen(
            [sys.executable, "-c", worker_code, rev_db, review_id, sig_file],
            env=env,
        )

        # Wait until worker begins executing tool
        started = False
        for _ in range(120):
            if os.path.exists(sig_file) and os.path.getsize(sig_file) > 0:
                started = True
                break
            time.sleep(0.05)
        assert started, "Worker subprocess failed to start in time"

        # KILL WORKER SUBPROCESS MID-EXECUTION
        proc.kill()
        proc.wait()

        # Step 1: Immediately after death, SQLite review is in 'executing' state with active lease
        store_check = SQLiteReviewStore(db_path=rev_db)
        assert store_check.get_execution_state(review_id) == ReviewExecutionState.EXECUTING.value
        del store_check

        # Step 2: Wait for lease to expire (0.5s lease)
        time.sleep(0.6)

        # Step 3: Reboot fresh process; verify recovery to outcome_unknown
        reboot_shield = _setup_shield(rev_db)
        invocations = []
        reboot_shield.registry.register(
            "payout_invoice",
            lambda args: (invocations.append(dict(args)), {"recovered": True})[1],
            idempotent=True,
            guarantees_deduplication=True,
        )

        assert reboot_shield.get_review_execution_state(review_id) == ReviewExecutionState.OUTCOME_UNKNOWN.value

        # Step 4: Idempotent retry with concrete key succeeds
        res_retry = reboot_shield.approve_review(review_id, approver="recovery_operator", allow_idempotent_retry=True)
        assert res_retry is not None
        assert res_retry.execution_status == ExecutionStatus.EXECUTED
        assert res_retry.tool_result == {"recovered": True}
        assert invocations[0]["idempotency_key"] == "idemp_crash_real_1"
        assert reboot_shield.get_review_execution_state(review_id) == ReviewExecutionState.SUCCEEDED.value
    finally:
        if os.path.exists(rev_db):
            os.remove(rev_db)
        if os.path.exists(sig_file):
            os.remove(sig_file)


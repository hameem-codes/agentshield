import os
import subprocess
import sys
import tempfile
import threading
from unittest.mock import patch
import pytest
from agentshield import Shield
from agentshield.models import Decision, DecisionValue, RiskLevel
from agentshield.audit import SQLiteAuditStore, redact_sensitive_data, GENESIS_HASH

def test_secret_redaction_in_arguments():
    raw_args = {
        "user": "alice",
        "api_key": "sk-1234567890abcdef",
        "nested": {
            "password": "supersecretpassword",
            "normal_value": 42
        },
        "headers": ["Bearer secret-token-value-12345", "User-Agent: normal"]
    }
    redacted = redact_sensitive_data(raw_args)
    assert redacted["user"] == "alice"
    assert redacted["api_key"] == "[REDACTED]"
    assert redacted["nested"]["password"] == "[REDACTED]"
    assert redacted["nested"]["normal_value"] == 42
    assert redacted["headers"][0] == "[REDACTED]"
    assert redacted["headers"][1] == "User-Agent: normal"

def test_sqlite_audit_store_crud():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        temp_db = f.name

    try:
        store = SQLiteAuditStore(db_path=temp_db)
        decision = Decision(
            allowed=True,
            decision=DecisionValue.ALLOW,
            reasons=["Action authorized"],
            risk_score=15.0,
            severity=RiskLevel.LOW,
            agent="shopping_agent",
            tool="create_order"
        )
        row_id = store.log_decision(
            decision=decision,
            arguments={"product": "shoes", "api_key": "secret_key_123"},
            execution_status="executed"
        )
        assert row_id > 0

        # Query back
        records = store.query(decision="ALLOW", agent="shopping_agent")
        assert len(records) == 1
        record = records[0]
        assert record.decision == "ALLOW"
        assert record.agent == "shopping_agent"
        assert record.tool == "create_order"
        assert record.arguments["product"] == "shoes"
        assert record.arguments["api_key"] == "[REDACTED]"
        assert record.execution_status == "executed"
        assert record.allowed is True
    finally:
        if os.path.exists(temp_db):
            os.remove(temp_db)

def test_audit_store_filters():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        temp_db = f.name

    try:
        store = SQLiteAuditStore(db_path=temp_db)

        # Log allow
        d_allow = Decision(
            allowed=True,
            decision=DecisionValue.ALLOW,
            reasons=["Action authorized"],
            risk_score=0.0,
            severity=RiskLevel.LOW,
            agent="agent_1",
            tool="search_product"
        )
        store.log_decision(d_allow, execution_status="executed")

        # Log block
        d_block = Decision(
            allowed=False,
            decision=DecisionValue.BLOCK,
            reasons=["Policy failed: unknown_tool - Unknown tool"],
            risk_score=85.0,
            severity=RiskLevel.CRITICAL,
            agent="agent_2",
            tool="delete_db"
        )
        store.log_decision(d_block, execution_status="not_executed")

        # Filter by decision
        assert len(store.query(decision="ALLOW")) == 1
        assert len(store.query(decision="BLOCK")) == 1
        assert len(store.query(agent="agent_1")) == 1
        assert len(store.query(tool="delete_db")) == 1
        assert len(store.query(decision="REVIEW")) == 0
    finally:
        if os.path.exists(temp_db):
            os.remove(temp_db)

def test_shield_execution_logs_to_audit_store():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        temp_db = f.name

    try:
        store = SQLiteAuditStore(db_path=temp_db)
        shield = Shield(audit_store=store)

        shield.registry.register("create_order", lambda a: {"order_id": 99})

        # Execute valid -> ALLOW + executed
        res_allow = shield.execute(
            agent="shopping_agent",
            tool="create_order",
            arguments={"product": "shoes", "quantity": 2, "secret_token": "secret123"}
        )
        assert res_allow.execution_status.value == "executed"

        # Execute unauthorized -> BLOCK + not_executed
        res_block = shield.execute(
            agent="shopping_agent",
            tool="create_order",
            arguments={"quantity": 999}
        )
        assert res_block.execution_status.value == "not_executed"

        records = store.query()
        assert len(records) == 2
        # Records in reverse order (id DESC)
        assert records[0].decision == "BLOCK"
        assert records[0].execution_status == "not_executed"
        assert records[1].decision == "ALLOW"
        assert records[1].execution_status == "executed"
        assert records[1].arguments["secret_token"] == "[REDACTED]"
    finally:
        if os.path.exists(temp_db):
            os.remove(temp_db)

def test_audit_transaction_rollback_on_failure_no_partial_records():
    """Verifies that failures inside the BEGIN IMMEDIATE transaction roll back atomically,
    leaving no partial records and ensuring subsequent records continue the valid hash chain."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        temp_db = f.name

    try:
        store = SQLiteAuditStore(db_path=temp_db)
        d1 = Decision(
            allowed=True,
            decision=DecisionValue.ALLOW,
            reasons=["Initial setup"],
            risk_score=0.0,
            severity=RiskLevel.LOW,
            agent="agent_1",
            tool="tool_1"
        )
        row1 = store.log_decision(d1, arguments={"init": 1})
        assert row1 == 1

        # Attempt to log with a failure during hash computation or execution
        d_fail = Decision(
            allowed=False,
            decision=DecisionValue.BLOCK,
            reasons=["Will fail"],
            risk_score=50.0,
            severity=RiskLevel.HIGH,
            agent="agent_fail",
            tool="tool_fail"
        )

        with patch("agentshield.audit.store.compute_record_hash", side_effect=RuntimeError("Simulated hash failure")):
            with pytest.raises(RuntimeError, match="Simulated hash failure"):
                store.log_decision(d_fail, arguments={"will_fail": True})

        # Ensure no partial record was inserted
        records_after_fail = store.query()
        assert len(records_after_fail) == 1
        assert records_after_fail[0].agent == "agent_1"

        # Log a subsequent valid decision
        d2 = Decision(
            allowed=True,
            decision=DecisionValue.ALLOW,
            reasons=["Post-failure recovery"],
            risk_score=10.0,
            severity=RiskLevel.LOW,
            agent="agent_2",
            tool="tool_2"
        )
        row2 = store.log_decision(d2, arguments={"recovery": 2})
        assert row2 == 2

        # Check hash chain integrity
        integrity = store.verify_integrity()
        assert integrity["valid"] is True
        assert integrity["total_records"] == 2
        assert integrity["error"] is None

        records = store.query(limit=10)
        assert len(records) == 2
        # Oldest links to GENESIS_HASH, newest links to oldest
        assert records[1].prev_hash == GENESIS_HASH
        assert records[0].prev_hash == records[1].record_hash
    finally:
        if os.path.exists(temp_db):
            os.remove(temp_db)

def test_audit_multi_connection_concurrent_threads_integrity():
    """Tests concurrent writes across multiple independent SQLiteAuditStore instances (separate connections)."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        temp_db = f.name

    try:
        # Pre-initialize schema
        init_store = SQLiteAuditStore(db_path=temp_db)
        del init_store

        num_threads = 5
        records_per_thread = 8

        def thread_worker(tid):
            local_store = SQLiteAuditStore(db_path=temp_db, timeout=30.0)
            for i in range(records_per_thread):
                d = Decision(
                    allowed=True,
                    decision=DecisionValue.ALLOW,
                    reasons=[f"Thread {tid} write {i}"],
                    risk_score=float(tid),
                    severity=RiskLevel.LOW,
                    agent=f"thread_agent_{tid}",
                    tool="concurrent_tool"
                )
                local_store.log_decision(d, arguments={"thread": tid, "iter": i})

        threads = [threading.Thread(target=thread_worker, args=(t,)) for t in range(num_threads)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        verify_store = SQLiteAuditStore(db_path=temp_db)
        integrity = verify_store.verify_integrity()
        assert integrity["valid"] is True
        assert integrity["total_records"] == num_threads * records_per_thread
        assert integrity["error"] is None

        # Verify no duplicate prev_hash except GENESIS_HASH
        all_records = verify_store.query(limit=num_threads * records_per_thread + 10)
        prev_hashes = [r.prev_hash for r in all_records if r.prev_hash != GENESIS_HASH]
        assert len(prev_hashes) == len(set(prev_hashes)), "Duplicate prev_hash detected in hash chain!"
    finally:
        if os.path.exists(temp_db):
            os.remove(temp_db)

def test_audit_multi_process_concurrent_writes_chain_integrity():
    """Tests concurrent writes from separate OS processes using BEGIN IMMEDIATE transaction serialization."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        temp_db = f.name

    try:
        # Initialize schema first
        init_store = SQLiteAuditStore(db_path=temp_db)
        del init_store

        num_processes = 4
        records_per_process = 12

        worker_script = (
            "import sys\n"
            "from agentshield.audit import SQLiteAuditStore\n"
            "from agentshield.models import Decision, DecisionValue, RiskLevel\n"
            "db_path = sys.argv[1]\n"
            "proc_id = sys.argv[2]\n"
            "count = int(sys.argv[3])\n"
            "store = SQLiteAuditStore(db_path=db_path, timeout=60.0)\n"
            "for i in range(count):\n"
            "    d = Decision(\n"
            "        allowed=(i % 2 == 0),\n"
            "        decision=DecisionValue.ALLOW if i % 2 == 0 else DecisionValue.BLOCK,\n"
            "        reasons=[f'Proc {proc_id} item {i}'],\n"
            "        risk_score=float(i * 5),\n"
            "        severity=RiskLevel.LOW,\n"
            "        agent=f'proc_{proc_id}',\n"
            "        tool='proc_tool'\n"
            "    )\n"
            "    store.log_decision(d, arguments={'proc': proc_id, 'seq': i})\n"
        )

        env = os.environ.copy()
        env["PYTHONPATH"] = os.path.abspath("src")

        procs = [
            subprocess.Popen(
                [sys.executable, "-c", worker_script, temp_db, str(p), str(records_per_process)],
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            for p in range(num_processes)
        ]

        for p in procs:
            stdout, stderr = p.communicate(timeout=60)
            assert p.returncode == 0, f"Process failed with code {p.returncode}: {stderr}"

        verify_store = SQLiteAuditStore(db_path=temp_db)
        integrity = verify_store.verify_integrity()
        assert integrity["valid"] is True
        assert integrity["total_records"] == num_processes * records_per_process
        assert integrity["error"] is None

        # Verify strict linear unbroken chain
        records = verify_store.query(limit=num_processes * records_per_process + 10)
        assert len(records) == num_processes * records_per_process
        # Reverse order (DESC) in query, so records[-1] is oldest
        assert records[-1].prev_hash == GENESIS_HASH
        for i in range(len(records) - 1):
            # record[i] was created after record[i+1]
            assert records[i].prev_hash == records[i+1].record_hash

        # Non-genesis prev_hashes must all be strictly distinct (no branching)
        non_genesis = [r.prev_hash for r in records if r.prev_hash != GENESIS_HASH]
        assert len(non_genesis) == len(set(non_genesis))
    finally:
        if os.path.exists(temp_db):
            os.remove(temp_db)

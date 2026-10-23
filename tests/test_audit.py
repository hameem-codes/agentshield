import os
import tempfile
import pytest
from agentshield import Shield
from agentshield.models import Decision, DecisionValue, RiskLevel
from agentshield.audit import SQLiteAuditStore, redact_sensitive_data

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

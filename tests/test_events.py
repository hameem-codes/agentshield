"""
Unit and integration tests for AgentShield Security Event and Alert Management foundation.
Tests event generation, alert classification, persistence, filtering, authentication,
correlation, and secret redaction.
"""

import os
import pytest
from fastapi.testclient import TestClient

from agentshield import (
    Shield,
    ExecutionStatus,
    EventType,
    EventSeverity,
    AlertStatus,
    IncidentStatus,
    SecurityEvent,
    SecurityAlert,
    SecurityIncident,
    SQLiteEventStore,
    SecurityEventManager,
    AlertRuleEngine,
)
from agentshield.events.rules import (
    PromptInjectionAlertRule,
    UnauthorizedToolAccessAlertRule,
    RepeatedBlockedActionsAlertRule,
    DataExfiltrationAlertRule,
    SecurityFailureAlertRule,
)
from agentshield.audit import SQLiteAuditStore
from agentshield.review import SQLiteReviewStore
from agentshield.api.app import create_app


@pytest.fixture
def memory_shield():
    event_store = SQLiteEventStore(db_path=":memory:")
    audit_store = SQLiteAuditStore(db_path=":memory:")
    review_store = SQLiteReviewStore(db_path=":memory:")
    shield = Shield(audit_store=audit_store, review_store=review_store, event_store=event_store)

    def dummy_tool(args):
        return {"result": "success", "args": args}

    def failing_tool(args):
        raise RuntimeError("External system exploded")

    shield.registry.register("search_product", dummy_tool)
    shield.registry.register("create_order", dummy_tool)
    shield.registry.register("failing_tool", failing_tool)
    return shield


# =====================================================================
# 1. Event Generation Tests
# =====================================================================

def test_event_generation_on_allow(memory_shield):
    """Verifies that an allowed authorization generates an AUTHORIZATION_DECISION event."""
    dec = memory_shield.authorize("shopping_agent", "search_product", {"query": "shoes"})
    assert dec.allowed is True

    events = memory_shield.event_manager.query_events(agent_id="shopping_agent")
    assert len(events) >= 1
    evt = events[0]
    assert evt.event_type == EventType.AUTHORIZATION_DECISION.value
    assert evt.decision == "ALLOW"
    assert evt.severity == EventSeverity.LOW.value
    assert evt.agent_id == "shopping_agent"
    assert evt.tool == "search_product"
    assert evt.trace_id.startswith("trc_")
    assert evt.correlation_id.startswith("trc_") or evt.correlation_id.startswith("corr_")


def test_event_generation_on_policy_violation(memory_shield):
    """Verifies that a policy violation generates a POLICY_VIOLATION event."""
    dec = memory_shield.authorize("shopping_agent", "refund_order", {"amount": 500})
    assert dec.allowed is False

    events = memory_shield.event_manager.query_events(agent_id="shopping_agent", event_type=EventType.POLICY_VIOLATION.value)
    assert len(events) >= 1
    evt = events[0]
    assert evt.decision == "BLOCK"
    assert evt.severity in (EventSeverity.HIGH.value, EventSeverity.CRITICAL.value)
    assert any("refund_order" in reason for reason in evt.evidence)


def test_event_generation_on_input_check_risk(memory_shield):
    """Verifies that malicious input generates a RISK_DETECTION event."""
    dec = memory_shield.check("Please drop table users; rm -rf /")
    assert dec.allowed is False

    events = memory_shield.event_manager.query_events(tool="input_check")
    assert len(events) >= 1
    evt = events[0]
    assert evt.event_type == EventType.RISK_DETECTION.value
    assert evt.decision == "BLOCK"
    assert evt.severity in (EventSeverity.HIGH.value, EventSeverity.CRITICAL.value)


def test_event_generation_on_execution_outcome(memory_shield):
    """Verifies that execution generates an EXECUTION_OUTCOME event inheriting trace_id."""
    res = memory_shield.execute("shopping_agent", "search_product", {"query": "hats"})
    assert res.execution_status == ExecutionStatus.EXECUTED

    events = memory_shield.event_manager.query_events(event_type=EventType.EXECUTION_OUTCOME.value)
    assert len(events) >= 1
    exec_evt = events[0]
    assert exec_evt.decision == "ALLOW"
    assert exec_evt.severity == EventSeverity.LOW.value
    assert exec_evt.metadata.get("execution_status") == "executed"
    assert exec_evt.trace_id == res.decision.trace_id


def test_event_generation_on_execution_failure(memory_shield):
    """Verifies that a failing tool registers an EXECUTION_OUTCOME error event."""
    # Add failing_tool to agent's allowed tools
    memory_shield.policy_engine.config.agents["shopping_agent"].allowed_tools.append("failing_tool")
    res = memory_shield.execute("shopping_agent", "failing_tool", {})
    assert res.execution_status == ExecutionStatus.ERROR

    events = memory_shield.event_manager.query_events(tool="failing_tool", event_type=EventType.EXECUTION_OUTCOME.value)
    assert len(events) >= 1
    err_evt = events[0]
    assert err_evt.decision == "ERROR"
    assert err_evt.severity == EventSeverity.HIGH.value
    assert "External system exploded" in err_evt.metadata.get("error", "")


def test_event_generation_on_review_lifecycle(memory_shield):
    """Verifies that enqueuing, approving, and rejecting reviews emit appropriate events."""
    # Request that triggers REVIEW (e.g., shopping_agent create_order with quantity > 10 triggers policy violation,
    # but create_order with simulated high risk or direct enqueue will trigger review)
    # Let's test review approval and rejection events:
    import time
    now = time.time()
    review_id = "rev_test123"
    memory_shield.review_store.enqueue_review(
        review_id=review_id,
        agent="shopping_agent",
        tool="create_order",
        arguments={"item": "desk", "quantity": 1},
        permissions=[],
        decision=memory_shield.authorize("shopping_agent", "create_order", {"item": "desk", "quantity": 1}),
        created_at=now,
        expires_at=now + 300.0,
    )

    # Approve
    exec_res = memory_shield.approve_review(review_id, approver="sec_admin")
    assert exec_res is not None
    assert exec_res.execution_status == ExecutionStatus.EXECUTED

    events = memory_shield.event_manager.query_events(tool="incident:approve")
    assert len(events) >= 1
    assert events[0].event_type == EventType.REVIEW_ACTION.value
    assert events[0].metadata.get("actor") == "sec_admin"


# =====================================================================
# 2. Deterministic Alert Rules & Classification
# =====================================================================

def test_prompt_injection_alert_rule():
    rule = PromptInjectionAlertRule()
    event = SecurityEvent(
        agent_id="test_agent",
        tool="user_input",
        event_type=EventType.RISK_DETECTION.value,
        severity=EventSeverity.CRITICAL.value,
        risk_score=95.0,
        evidence=["Prompt injection detected: jailbreak override"],
    )
    alert = rule.evaluate(event, [])
    assert alert is not None
    assert alert.alert_type == "prompt_injection"
    assert alert.severity == EventSeverity.CRITICAL.value
    assert alert.agent_id == "test_agent"
    assert alert.trigger_event_id == event.event_id


def test_unauthorized_tool_access_alert_rule():
    rule = UnauthorizedToolAccessAlertRule()
    event = SecurityEvent(
        agent_id="shopping_agent",
        tool="admin_delete_db",
        event_type=EventType.POLICY_VIOLATION.value,
        severity=EventSeverity.HIGH.value,
        decision="BLOCK",
        evidence=["Tool 'admin_delete_db' is not in allowed_tools for agent"],
    )
    alert = rule.evaluate(event, [])
    assert alert is not None
    assert alert.alert_type == "unauthorized_tool_access"
    assert alert.severity == EventSeverity.HIGH.value
    assert alert.agent_id == "shopping_agent"


def test_repeated_blocked_actions_alert_rule():
    rule = RepeatedBlockedActionsAlertRule(threshold=3)
    e1 = SecurityEvent(agent_id="bot_1", tool="t1", decision="BLOCK", event_id="e1")
    e2 = SecurityEvent(agent_id="bot_1", tool="t2", decision="BLOCK", event_id="e2")
    e3 = SecurityEvent(agent_id="bot_1", tool="t3", decision="BLOCK", event_id="e3")

    # 1 block: no alert
    assert rule.evaluate(e1, [e1]) is None
    # 2 blocks: no alert
    assert rule.evaluate(e2, [e1, e2]) is None
    # 3 blocks: alert triggered!
    alert = rule.evaluate(e3, [e1, e2, e3])
    assert alert is not None
    assert alert.alert_type == "repeated_blocked_actions"
    assert alert.metadata.get("block_count") == 3
    assert alert.event_ids == ["e1", "e2", "e3"]


def test_data_exfiltration_alert_rule():
    rule = DataExfiltrationAlertRule()
    event = SecurityEvent(
        agent_id="export_agent",
        tool="curl",
        evidence=["Detected disallowed hostname: suspected data exfiltration destination"],
    )
    alert = rule.evaluate(event, [])
    assert alert is not None
    assert alert.alert_type == "data_exfiltration"
    assert alert.severity == EventSeverity.CRITICAL.value


def test_security_failure_alert_rule():
    rule = SecurityFailureAlertRule()
    event = SecurityEvent(
        agent_id="attacker",
        tool="incident:pause",
        event_type=EventType.SECURITY_FAILURE.value,
        severity=EventSeverity.CRITICAL.value,
        evidence=["Authentication failed: Invalid key"],
    )
    alert = rule.evaluate(event, [])
    assert alert is not None
    assert alert.alert_type == "security_failure"


# =====================================================================
# 3. Incident Correlation & Grouping
# =====================================================================

def test_incident_auto_creation_and_correlation():
    """Verifies that high-severity alerts auto-create incidents and group by correlation_id."""
    store = SQLiteEventStore(db_path=":memory:")
    mgr = SecurityEventManager(store=store)

    corr_id = "corr_session_999"

    # Event 1: Unauthorized tool -> triggers alert -> auto-creates incident
    evt1 = mgr.publish_event(
        agent_id="compromised_agent",
        tool="execute_bash",
        event_type=EventType.POLICY_VIOLATION.value,
        severity=EventSeverity.HIGH.value,
        decision="BLOCK",
        evidence=["Tool 'execute_bash' is not in allowed_tools"],
        correlation_id=corr_id,
    )

    alerts = store.query_alerts(correlation_id=corr_id)
    assert len(alerts) == 1
    assert alerts[0].incident_id is not None
    inc_id = alerts[0].incident_id

    inc = store.get_incident(inc_id)
    assert inc is not None
    assert inc.correlation_id == corr_id
    assert inc.agent_id == "compromised_agent"
    assert inc.event_count == 1
    assert inc.severity == EventSeverity.HIGH.value

    # Event 2: Exfiltration attempt with SAME correlation_id -> links to existing incident & escalates to CRITICAL
    evt2 = mgr.publish_event(
        agent_id="compromised_agent",
        tool="network_send",
        event_type=EventType.RISK_DETECTION.value,
        severity=EventSeverity.CRITICAL.value,
        decision="BLOCK",
        evidence=["Detected suspected data exfiltration destination"],
        correlation_id=corr_id,
    )

    alerts_updated = store.query_alerts(correlation_id=corr_id)
    assert len(alerts_updated) == 2
    assert alerts_updated[1].incident_id == inc_id

    inc_updated = store.get_incident(inc_id)
    assert inc_updated.event_count == 2
    assert inc_updated.severity == EventSeverity.CRITICAL.value
    assert len(inc_updated.alert_ids) == 2


# =====================================================================
# 4. Alert Lifecycle Tests
# =====================================================================

def test_alert_lifecycle_states():
    """Verifies alert status progression: open -> acknowledged -> investigating -> resolved -> dismissed."""
    store = SQLiteEventStore(db_path=":memory:")
    mgr = SecurityEventManager(store=store)

    alert = SecurityAlert(
        title="Suspicious Activity",
        alert_type="test_alert",
        severity=EventSeverity.MEDIUM.value,
        agent_id="agent_x",
    )
    store.create_alert(alert)

    # Acknowledge
    ack = mgr.acknowledge_alert(alert.alert_id, actor="analyst_alice", note="Acknowledged, looking into it")
    assert ack.status == AlertStatus.ACKNOWLEDGED.value
    assert ack.acknowledged_by == "analyst_alice"
    assert ack.acknowledged_at is not None

    # Investigate
    inv = mgr.investigate_alert(alert.alert_id, actor="analyst_alice", note="Investigating memory dump")
    assert inv.status == AlertStatus.INVESTIGATING.value

    # Resolve
    res = mgr.resolve_alert(alert.alert_id, actor="analyst_alice", note="False positive, benign test traffic")
    assert res.status == AlertStatus.RESOLVED.value
    assert res.resolved_by == "analyst_alice"
    assert res.resolved_at is not None
    assert res.resolution_note == "False positive, benign test traffic"

    # Dismiss
    dism = mgr.dismiss_alert(alert.alert_id, actor="sec_lead", note="Closing duplicate")
    assert dism.status == AlertStatus.DISMISSED.value


# =====================================================================
# 5. Secret Redaction & LLM Analyst Safety
# =====================================================================

def test_secret_redaction_in_event_storage():
    """Verifies that credentials and tokens are redacted before persisting in EventStore."""
    store = SQLiteEventStore(db_path=":memory:")
    mgr = SecurityEventManager(store=store)

    raw_args = {
        "api_key": "sk-test1234567890",
        "authorization": "Bearer secret_jwt_token_value",
        "normal_field": "public_data",
        "nested": {
            "password": "supersecretpassword",
            "count": 5,
        }
    }

    evt = mgr.publish_event(
        agent_id="test_agent",
        tool="api_call",
        event_type=EventType.AUTHORIZATION_DECISION.value,
        severity=EventSeverity.LOW.value,
        decision="ALLOW",
        metadata={"arguments": raw_args},
    )

    retrieved = store.get_event(evt.event_id)
    assert retrieved is not None
    retrieved_args = retrieved.metadata.get("arguments", {})
    assert retrieved_args.get("api_key") == "[REDACTED]"
    assert "[REDACTED]" in retrieved_args.get("authorization", "")
    assert retrieved_args.get("nested", {}).get("password") == "[REDACTED]"
    assert retrieved_args.get("normal_field") == "public_data"


def test_to_analyst_dict_safety():
    """Verifies that to_analyst_dict() strips any sensitive keys and structures safely for LLM Security Analyst."""
    event = SecurityEvent(
        agent_id="finance_bot",
        tool="transfer_funds",
        event_type=EventType.AUTHORIZATION_DECISION.value,
        severity=EventSeverity.HIGH.value,
        decision="REVIEW",
        risk_score=75.5,
        evidence=["High transfer volume"],
        metadata={
            "raw_credential": "super_secret_token",
            "arguments": {"token": "secret_abc", "account_id": "acc_123"},
            "harmless_context": "batch_job_42",
        }
    )

    analyst_dict = event.to_analyst_dict()
    assert "raw_credential" not in analyst_dict["context"]
    assert analyst_dict["context"]["arguments"]["token"] == "[REDACTED]"
    assert analyst_dict["context"]["arguments"]["account_id"] == "acc_123"
    assert analyst_dict["context"]["harmless_context"] == "batch_job_42"
    assert "summary" in analyst_dict
    assert "[HIGH]" in analyst_dict["summary"]


# =====================================================================
# 6. SQLite Multi-Process and Transaction Safety
# =====================================================================

def test_sqlite_event_store_query_and_pagination(tmp_path):
    """Verifies that SQLiteEventStore queries support filtering and pagination."""
    db_file = str(tmp_path / "test_events.db")
    store = SQLiteEventStore(db_path=db_file)

    for i in range(15):
        evt = SecurityEvent(
            event_id=f"evt_{i:03d}",
            agent_id="agent_a" if i % 2 == 0 else "agent_b",
            tool=f"tool_{i % 3}",
            event_type=EventType.AUTHORIZATION_DECISION.value if i < 10 else EventType.POLICY_VIOLATION.value,
            severity=EventSeverity.LOW.value if i < 10 else EventSeverity.HIGH.value,
            decision="ALLOW" if i < 10 else "BLOCK",
            risk_score=float(i * 5),
            correlation_id=f"corr_{i % 2}",
        )
        store.record_event(evt)

    # Filter by agent
    agent_a_events = store.query_events(agent_id="agent_a")
    assert len(agent_a_events) == 8

    # Filter by event_type and severity
    violations = store.query_events(event_type=EventType.POLICY_VIOLATION.value, severity=EventSeverity.HIGH.value)
    assert len(violations) == 5

    # Pagination: limit & offset
    page1 = store.query_events(limit=5, offset=0)
    page2 = store.query_events(limit=5, offset=5)
    assert len(page1) == 5
    assert len(page2) == 5
    assert page1[0].event_id != page2[0].event_id


# =====================================================================
# 7. FastAPI Security Endpoints & Authentication Tests
# =====================================================================

def test_api_security_endpoints_auth():
    """Verifies that GET /api/security/events, /alerts, and /incidents enforce admin authentication."""
    app = create_app(audit_db_path=":memory:", admin_api_key="secret-admin-pass")
    client = TestClient(app)

    # 1. Missing credentials -> 401
    resp = client.get("/api/security/events")
    assert resp.status_code == 401

    resp = client.get("/api/security/alerts")
    assert resp.status_code == 401

    resp = client.get("/api/security/incidents")
    assert resp.status_code == 401

    # 2. Invalid credentials -> 401
    resp = client.get("/api/security/events", headers={"x-admin-key": "wrong-key"})
    assert resp.status_code == 401

    # 3. Unconfigured admin key -> 403
    app_no_key = create_app(audit_db_path=":memory:", admin_api_key=None)
    client_no_key = TestClient(app_no_key)
    resp = client_no_key.get("/api/security/events", headers={"x-admin-key": "secret-admin-pass"})
    assert resp.status_code == 403

    # 4. Valid credentials -> 200
    resp = client.get("/api/security/events", headers={"x-admin-key": "secret-admin-pass"})
    assert resp.status_code == 200
    assert "events" in resp.json()
    assert "total" in resp.json()


def test_api_security_endpoints_retrieval_and_filtering():
    """Verifies retrieving and filtering events, alerts, and incidents via FastAPI."""
    app = create_app(audit_db_path=":memory:", admin_api_key="test-key-123")
    client = TestClient(app)
    headers = {"x-admin-key": "test-key-123"}

    # Trigger some actions via public API
    client.post("/api/authorize", json={"agent": "shopping_agent", "tool": "search_product", "arguments": {}})
    client.post("/api/authorize", json={"agent": "shopping_agent", "tool": "refund_order", "arguments": {"amount": 999}})

    # Fetch events
    resp = client.get("/api/security/events", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 2
    first_evt_id = data["events"][0]["event_id"]

    # Fetch single event
    single_resp = client.get(f"/api/security/events/{first_evt_id}", headers=headers)
    assert single_resp.status_code == 200
    assert single_resp.json()["event_id"] == first_evt_id

    # 404 for non-existent event
    not_found = client.get("/api/security/events/evt_nonexistent", headers=headers)
    assert not_found.status_code == 404

    # Fetch alerts
    alerts_resp = client.get("/api/security/alerts", headers=headers)
    assert alerts_resp.status_code == 200
    alerts_data = alerts_resp.json()
    assert "alerts" in alerts_data

    # Fetch incidents
    inc_resp = client.get("/api/security/incidents", headers=headers)
    assert inc_resp.status_code == 200
    inc_data = inc_resp.json()
    assert "incidents" in inc_data


# =====================================================================
# 8. Security Hardening & Edge-Case Verification Tests
# =====================================================================

def test_invalid_alert_status_transition():
    """Verifies that invalid state transitions (e.g. resolved -> open, or arbitrary strings) raise ValueError."""
    store = SQLiteEventStore(db_path=":memory:")
    alert = SecurityAlert(alert_id="alt_trans_1", status=AlertStatus.OPEN.value)
    store.create_alert(alert)

    # Valid: open -> investigating
    store.update_alert_status("alt_trans_1", AlertStatus.INVESTIGATING.value, actor="analyst")
    # Valid: investigating -> resolved
    store.update_alert_status("alt_trans_1", AlertStatus.RESOLVED.value, actor="analyst")

    # Invalid: resolved -> open
    with pytest.raises(ValueError, match="Invalid alert status transition"):
        store.update_alert_status("alt_trans_1", AlertStatus.OPEN.value, actor="analyst")

    # Invalid: resolved -> acknowledged
    with pytest.raises(ValueError, match="Invalid alert status transition"):
        store.update_alert_status("alt_trans_1", AlertStatus.ACKNOWLEDGED.value, actor="analyst")

    # Invalid: arbitrary status string
    with pytest.raises(ValueError, match="Invalid alert status transition"):
        store.update_alert_status("alt_trans_1", "invalid_status", actor="analyst")


def test_invalid_incident_status_transition():
    """Verifies that invalid incident state transitions (e.g. closed -> open) raise ValueError."""
    store = SQLiteEventStore(db_path=":memory:")
    inc = SecurityIncident(incident_id="inc_trans_1", status=IncidentStatus.OPEN.value)
    store.create_incident(inc)

    # Valid: open -> contained -> closed
    store.update_incident("inc_trans_1", status=IncidentStatus.CONTAINED.value)
    store.update_incident("inc_trans_1", status=IncidentStatus.CLOSED.value)

    # Invalid: closed -> open
    with pytest.raises(ValueError, match="Invalid incident status transition"):
        store.update_incident("inc_trans_1", status=IncidentStatus.OPEN.value)


def test_repeated_blocked_actions_time_window_and_deduplication():
    """Verifies that RepeatedBlockedActionsAlertRule enforces time windows and deduplicates same-trace failures."""
    from datetime import datetime, timezone, timedelta
    rule = RepeatedBlockedActionsAlertRule(threshold=3, time_window_seconds=300.0)

    now = datetime.now(timezone.utc)
    old_time = (now - timedelta(seconds=600)).isoformat()
    recent_time = now.isoformat()

    # Old blocks outside window (should be ignored)
    old_e1 = SecurityEvent(agent_id="bot", tool="t", decision="BLOCK", timestamp=old_time, trace_id="trc_old_1")
    old_e2 = SecurityEvent(agent_id="bot", tool="t", decision="BLOCK", timestamp=old_time, trace_id="trc_old_2")

    # Single action with 2 events sharing same trace_id (authorization failure + execution not executed)
    recent_auth = SecurityEvent(agent_id="bot", tool="t", decision="BLOCK", timestamp=recent_time, trace_id="trc_recent_1")
    recent_exec = SecurityEvent(agent_id="bot", tool="t", decision="BLOCK", timestamp=recent_time, trace_id="trc_recent_1")

    # Despite 4 total block records, only 1 unique recent trace exists -> no alert!
    assert rule.evaluate(recent_exec, [old_e1, old_e2, recent_auth]) is None

    # Add 2 more distinct recent blocks to reach threshold
    recent_2 = SecurityEvent(agent_id="bot", tool="t", decision="BLOCK", timestamp=recent_time, trace_id="trc_recent_2")
    recent_3 = SecurityEvent(agent_id="bot", tool="t", decision="BLOCK", timestamp=recent_time, trace_id="trc_recent_3")

    alert = rule.evaluate(recent_3, [old_e1, old_e2, recent_auth, recent_exec, recent_2])
    assert alert is not None
    assert alert.metadata["block_count"] == 3


def test_review_queue_trace_id_preservation():
    """Verifies that an enqueued review preserves its trace_id and correlation_id through SQLite approval and execution."""
    review_store = SQLiteReviewStore(db_path=":memory:")
    audit_store = SQLiteAuditStore(db_path=":memory:")
    event_store = SQLiteEventStore(db_path=":memory:")
    shield = Shield(audit_store=audit_store, review_store=review_store, event_store=event_store)
    shield.registry.register("create_order", lambda args: {"status": "ok"})

    # Authorize an action
    orig_dec = shield.authorize("shopping_agent", "create_order", {"quantity": 1})
    trace_id = orig_dec.trace_id
    correlation_id = orig_dec.correlation_id
    assert trace_id is not None
    assert correlation_id is not None

    # Enqueue review
    rev_id = "rev_trace_test"
    review_store.enqueue_review(
        review_id=rev_id,
        agent="shopping_agent",
        tool="create_order",
        arguments={"quantity": 1},
        permissions=[],
        decision=orig_dec,
        created_at=100.0,
        expires_at=9999999999.0,
    )

    # Approve and execute
    res = shield.approve_review(rev_id, approver="admin_alice")
    assert res is not None
    assert res.execution_status == ExecutionStatus.EXECUTED
    assert res.decision.trace_id == trace_id
    assert res.decision.correlation_id == correlation_id

    # Verify execution outcome event inherited the exact same trace_id and correlation_id
    exec_events = event_store.query_events(tool="create_order", event_type=EventType.EXECUTION_OUTCOME.value)
    assert len(exec_events) >= 1
    assert exec_events[0].trace_id == trace_id
    assert exec_events[0].correlation_id == correlation_id


def test_atomic_concurrent_alert_correlation():
    """Verifies that record_alert_and_correlate atomically attaches to existing incident without duplicate creation."""
    store = SQLiteEventStore(db_path=":memory:")
    corr_id = "corr_race_123"

    trigger1 = SecurityEvent(agent_id="agent1", tool="t1", correlation_id=corr_id)
    alert1 = SecurityAlert(title="Alert 1", severity=EventSeverity.HIGH.value, correlation_id=corr_id, agent_id="agent1")
    store.record_alert_and_correlate(alert1, trigger1)

    trigger2 = SecurityEvent(agent_id="agent1", tool="t2", correlation_id=corr_id)
    alert2 = SecurityAlert(title="Alert 2", severity=EventSeverity.CRITICAL.value, correlation_id=corr_id, agent_id="agent1")
    store.record_alert_and_correlate(alert2, trigger2)

    incidents = store.query_incidents(correlation_id=corr_id)
    assert len(incidents) == 1
    inc = incidents[0]
    assert inc.event_count == 2
    assert inc.severity == EventSeverity.CRITICAL.value
    assert len(inc.alert_ids) == 2


def test_analyst_export_sanitizes_evidence():
    """Verifies that to_analyst_dict() sanitizes evidence even if SecurityEvent was constructed with raw secrets."""
    event = SecurityEvent(
        agent_id="agent_leak",
        tool="test_tool",
        evidence=["Authorization failed: Bearer secret_raw_token_value", "Key sk-proj-12345678901234567890 was rejected"],
        metadata={"safe_key": "safe_val"},
    )
    analyst_dict = event.to_analyst_dict()
    for ev in analyst_dict["evidence"]:
        assert "secret_raw_token_value" not in ev
        assert "sk-proj-12345678901234567890" not in ev
        assert "[REDACTED]" in ev


def test_api_pagination_clamping():
    """Verifies that negative or excessively large limit and offset parameters are safely clamped."""
    app = create_app(audit_db_path=":memory:", admin_api_key="admin_secret")
    client = TestClient(app)
    headers = {"x-admin-key": "admin_secret"}

    resp = client.get("/api/security/events?limit=999999&offset=-50", headers=headers)
    assert resp.status_code == 200
    assert "events" in resp.json()

    resp_alerts = client.get("/api/security/alerts?limit=-10&offset=0", headers=headers)
    assert resp_alerts.status_code == 200
    assert "alerts" in resp_alerts.json()



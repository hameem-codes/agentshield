"""
Comprehensive Unit, Integration, and Security Tests for AgentShield Phase 8:
Security Observability & Monitoring.

Verifies:
1. Standardized Request & Execution Tracing (Correlation IDs & Trace IDs).
2. Missing, Valid, and Malformed Correlation ID Handling.
3. Structured Operational Logging (JSON format, required fields, secret redaction, ring buffer).
4. Operational Metrics (Counters, Latencies, Rate Limits, Loops, Circuit Breakers, Gauges, Prometheus export).
5. Health Monitoring: Liveness (/health) vs Readiness (/health/readiness) under normal & degraded conditions.
6. Incident Tracing: GET /api/security/incidents/{incident_id}/trace linking incidents, alerts, events, and audit records.
7. Cryptographic Audit Verification: Read-only audit verification and tampering detection.
8. Simulator Isolation: Verification that simulation runs do not contaminate operational logs, audit ledger, or metrics.
"""

import json
import os
import tempfile
import time
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from agentshield import Shield
from agentshield.models import Decision, DecisionValue, RiskLevel
from agentshield.audit import SQLiteAuditStore
from agentshield.review import SQLiteReviewStore
from agentshield.events import SQLiteEventStore, SecurityEventManager, EventType, EventSeverity
from agentshield.api.app import create_app
from agentshield.observability import (
    generate_trace_id,
    generate_correlation_id,
    sanitize_correlation_id,
    get_current_correlation_id,
    set_current_correlation_id,
    clear_current_correlation_id,
    StructuredLogger,
    MetricsCollector,
    LatencyTracker,
    get_operational_logger,
    get_metrics_collector,
)


# ==============================================================================
# Fixtures
# ==============================================================================

@pytest.fixture
def temp_dbs():
    with tempfile.NamedTemporaryFile(suffix="_audit.db", delete=False) as f_audit, \
         tempfile.NamedTemporaryFile(suffix="_review.db", delete=False) as f_rev, \
         tempfile.NamedTemporaryFile(suffix="_event.db", delete=False) as f_evt:
        audit_path = f_audit.name
        review_path = f_rev.name
        event_path = f_evt.name

    yield audit_path, review_path, event_path

    for p in (audit_path, review_path, event_path):
        if os.path.exists(p):
            try:
                os.remove(p)
            except OSError:
                pass


@pytest.fixture
def app_and_client(temp_dbs, monkeypatch):
    audit_path, review_path, event_path = temp_dbs
    admin_key = "test-adm-key-phase8-secure"
    monkeypatch.setenv("AGENTSHIELD_ADMIN_KEY", admin_key)
    monkeypatch.setenv("AGENTSHIELD_AUDIT_DB", audit_path)
    monkeypatch.setenv("AGENTSHIELD_REVIEW_DB", review_path)
    monkeypatch.setenv("AGENTSHIELD_EVENTS_DB", event_path)
    monkeypatch.setenv("AGENTSHIELD_ALLOW_MOCK_FALLBACK", "true")

    app = create_app(admin_api_key=admin_key)
    client = TestClient(app)
    return app, client, admin_key


# ==============================================================================
# 1. Tracing & Correlation ID Unit Tests
# ==============================================================================

def test_correlation_id_generation_and_validation():
    # Valid generation
    trace_id = generate_trace_id()
    assert trace_id.startswith("trc_")
    assert len(trace_id) == 16

    corr_id = generate_correlation_id()
    assert corr_id.startswith("corr_")
    assert len(corr_id) == 17

    # Sanitization
    valid_id = "test-corr-123_456"
    assert sanitize_correlation_id(valid_id) == valid_id

    # Malformed IDs should be safely replaced
    assert sanitize_correlation_id("   ").startswith("corr_")
    assert sanitize_correlation_id("invalid!@#$%^&*()").startswith("corr_")
    assert sanitize_correlation_id("a" * 200).startswith("corr_")
    assert sanitize_correlation_id("injection\nnewline").startswith("corr_")

    # Contextvar management
    token = set_current_correlation_id("ctx_test_123")
    assert get_current_correlation_id() == "ctx_test_123"
    clear_current_correlation_id()
    assert get_current_correlation_id() is None


# ==============================================================================
# 2. Structured Operational Logging Unit Tests
# ==============================================================================

def test_structured_operational_logger():
    logger = StructuredLogger(name="test.logger", buffer_size=50)

    # Log authorization
    logger.log_authz(
        agent="test_agent",
        tool="test_tool",
        decision="ALLOW",
        risk_score=10.0,
        reasons=["Authorized action"],
        correlation_id="corr_log_01",
        trace_id="trc_01",
    )

    # Log execution with sensitive data
    logger.log_execution(
        agent="test_agent",
        tool="test_tool",
        status="executed",
        latency_ms=12.5,
        correlation_id="corr_log_01",
        trace_id="trc_01",
        arguments={"api_key": "super_secret_token_12345", "password": "my_password"},
    )

    # Log rate limit and loop
    logger.log_rate_limit(scope="tool", key="test_tool", limit=10, window=60.0, retry_after=5.0, correlation_id="corr_log_02")
    logger.log_loop(agent="test_agent", tool="test_tool", loop_type="consecutive_call", details={"count": 5}, correlation_id="corr_log_02")

    logs = logger.get_recent_logs()
    assert len(logs) == 4

    # Verify secret redaction
    exec_log = [l for l in logs if l["event"] == "tool_execution"][0]
    assert exec_log["details"]["arguments"]["api_key"] == "[REDACTED]"
    assert exec_log["details"]["arguments"]["password"] == "[REDACTED]"
    assert exec_log["correlation_id"] == "corr_log_01"

    # Filtering by correlation_id
    filtered = logger.get_recent_logs(correlation_id="corr_log_02")
    assert len(filtered) == 2
    assert {l["event"] for l in filtered} == {"rate_limit_exceeded", "loop_detected"}


# ==============================================================================
# 3. Operational Metrics Collector Unit Tests
# ==============================================================================

def test_metrics_collector_and_prometheus_export():
    collector = MetricsCollector()

    # Dynamic gauge
    collector.register_gauge("test_pending", lambda: 5)

    # Decisions
    collector.record_decision("ALLOW", duration_ms=15.0)
    collector.record_decision("BLOCK", duration_ms=5.0)

    # Executions
    collector.record_execution("executed", duration_ms=45.0)
    collector.record_execution("timeout", duration_ms=5000.0)

    # Events
    collector.record_rate_limit_hit("api")
    collector.record_loop_detected("consecutive_call")
    collector.record_provider_failure("gemini")

    snapshot = collector.get_snapshot()
    assert snapshot["decisions"]["total"] == 2
    assert snapshot["decisions"]["allow"] == 1
    assert snapshot["decisions"]["block"] == 1
    assert snapshot["executions"]["executed"] == 1
    assert snapshot["executions"]["timeout"] == 1
    assert snapshot["reliability"]["rate_limit_hits"]["api"] == 1
    assert snapshot["reliability"]["loops_detected"]["consecutive_call"] == 1
    assert snapshot["gauges"]["test_pending"] == 5

    # Prometheus Text format
    prom_text = collector.to_prometheus_text()
    assert "# HELP agentshield_decisions_total" in prom_text
    assert 'agentshield_decisions_total{decision="ALLOW"} 1' in prom_text
    assert 'agentshield_decisions_total{decision="BLOCK"} 1' in prom_text
    assert 'agentshield_tool_executions_total{status="timeout"} 1' in prom_text
    assert 'agentshield_test_pending 5' in prom_text


# ==============================================================================
# 4. HTTP Tracing & Middleware Integration Tests
# ==============================================================================

def test_http_correlation_id_propagation(app_and_client):
    app, client, admin_key = app_and_client

    # 1. Provide correlation ID in request header
    custom_corr = "corr_custom_test_999"
    resp = client.post(
        "/api/check",
        json={"text": "Hello AgentShield verification"},
        headers={"X-Correlation-ID": custom_corr},
    )
    assert resp.status_code == 200
    assert resp.headers.get("X-Correlation-ID") == custom_corr
    body = resp.json()
    assert body["correlation_id"] == custom_corr
    assert body["trace_id"] is not None

    # 2. Missing correlation ID -> Auto-generation
    resp2 = client.post(
        "/api/check",
        json={"text": "Another check without correlation ID"},
    )
    assert resp2.status_code == 200
    gen_corr = resp2.headers.get("X-Correlation-ID")
    assert gen_corr is not None
    assert gen_corr.startswith("corr_")
    body2 = resp2.json()
    assert body2["correlation_id"] == gen_corr

    # 3. Malformed correlation ID -> Sanitized safely
    resp3 = client.post(
        "/api/check",
        json={"text": "Check with bad header"},
        headers={"X-Correlation-ID": "bad!@#_header_val\n"},
    )
    assert resp3.status_code == 200
    sanitized_corr = resp3.headers.get("X-Correlation-ID")
    assert sanitized_corr.startswith("corr_")
    assert "!" not in sanitized_corr


def test_audit_and_event_stores_record_correlation_id(app_and_client):
    app, client, admin_key = app_and_client

    corr_id = "corr_execute_trace_123"
    resp = client.post(
        "/api/execute",
        json={
            "agent": "test_agent",
            "tool": "get_product",
            "arguments": {"product_id": "item_42", "correlation_id": corr_id},
        },
        headers={"X-Correlation-ID": corr_id},
    )
    assert resp.status_code == 200
    res_json = resp.json()
    assert res_json["correlation_id"] == corr_id

    # Query operational audit records
    events_resp = client.get(
        f"/api/audit/events?correlation_id={corr_id}",
        headers={"X-Admin-Key": admin_key},
    )
    assert events_resp.status_code == 200
    records = events_resp.json()["events"]
    assert len(records) >= 1
    record = records[0]
    assert record["correlation_id"] == corr_id
    assert record["trace_id"] is not None


# ==============================================================================
# 5. Health Monitoring: Liveness vs Readiness Tests
# ==============================================================================

def test_liveness_and_readiness_endpoints(app_and_client):
    app, client, admin_key = app_and_client

    # Liveness check (always 200 under normal operation)
    live_resp = client.get("/health")
    assert live_resp.status_code == 200
    assert live_resp.json()["status"] == "healthy"

    # Readiness check (200 with component details)
    ready_resp = client.get("/health/readiness")
    assert ready_resp.status_code == 200
    r_data = ready_resp.json()
    assert r_data["status"] == "ready"
    assert r_data["database"] == "connected"
    assert r_data["circuit_breaker"] == "closed"


def test_readiness_fails_when_store_inaccessible(app_and_client):
    app, client, admin_key = app_and_client

    # Simulate storage failure on review store query with sensitive connection details
    sensitive_err = "Connection failed: postgresql://admin:super_secret_password@db.internal:5432/shield_db at /var/secrets/key.pem"
    with patch.object(app.state.review_store, "get_pending_reviews", side_effect=Exception(sensitive_err)):
        # 1. Public unauthenticated user -> generic degraded status without sensitive disclosure
        ready_resp_pub = client.get("/health/readiness")
        assert ready_resp_pub.status_code == 503
        pub_data = ready_resp_pub.json()["detail"]
        assert pub_data["status"] == "degraded"
        assert pub_data["database"] == "disconnected"
        assert pub_data["message"] == "Service degraded. Critical dependency check failed."
        assert "errors" not in pub_data
        assert "super_secret_password" not in ready_resp_pub.text
        assert "db.internal" not in ready_resp_pub.text
        assert "/var/secrets" not in ready_resp_pub.text

        # 2. Authenticated administrator -> detailed diagnostics with secret redaction
        ready_resp_admin = client.get("/health/readiness", headers={"X-Admin-Key": admin_key})
        assert ready_resp_admin.status_code == 503
        admin_data = ready_resp_admin.json()["detail"]
        assert admin_data["status"] == "degraded"
        assert admin_data["database"] == "disconnected"
        assert "errors" in admin_data
        assert any("Review store check failed" in err for err in admin_data["errors"])
        # Secret password must be redacted even in admin diagnostic errors
        assert "super_secret_password" not in ready_resp_admin.text

    # Liveness /health must remain 200 (process is still running)
    live_resp = client.get("/health")
    assert live_resp.status_code == 200


# ==============================================================================
# 6. Metrics & Structured Logs API Endpoints Tests
# ==============================================================================

def test_metrics_api_endpoints(app_and_client, monkeypatch):
    app, client, admin_key = app_and_client

    # Perform an execution to generate metrics
    client.post(
        "/api/execute",
        json={
            "agent": "test_agent",
            "tool": "get_product",
            "arguments": {"product_id": "test_p1"},
        },
    )

    # JSON snapshot metrics
    json_metrics = client.get("/api/metrics")
    assert json_metrics.status_code == 200
    data = json_metrics.json()
    assert "decisions" in data
    assert "executions" in data
    assert "latency_ms" in data
    assert "gauges" in data

    # Prometheus text metrics
    prom_metrics = client.get("/metrics", headers={"Accept": "text/plain"})
    assert prom_metrics.status_code == 200
    assert "text/plain" in prom_metrics.headers.get("content-type", "")
    assert "agentshield_decisions_total" in prom_metrics.text

    # Restricted exposure mode verification
    monkeypatch.setenv("AGENTSHIELD_REQUIRE_AUTH_FOR_METRICS", "true")
    # Unauthenticated request rejected when restriction enabled
    unauth_metrics = client.get("/api/metrics")
    assert unauth_metrics.status_code == 401

    # Authenticated admin access permitted
    auth_metrics = client.get("/api/metrics", headers={"X-Admin-Key": admin_key})
    assert auth_metrics.status_code == 200


def test_observability_logs_api_endpoint(app_and_client):
    app, client, admin_key = app_and_client

    corr_id = "corr_log_test_888"
    client.post(
        "/api/check",
        json={"text": "Observability log verification"},
        headers={"X-Correlation-ID": corr_id},
    )

    # Admin access required
    unauth = client.get(f"/api/observability/logs?correlation_id={corr_id}")
    assert unauth.status_code == 401

    # Authorized admin query
    auth_resp = client.get(
        f"/api/observability/logs?correlation_id={corr_id}",
        headers={"X-Admin-Key": admin_key},
    )
    assert auth_resp.status_code == 200
    logs = auth_resp.json()["logs"]
    assert len(logs) >= 1
    assert logs[0]["correlation_id"] == corr_id

    # Malformed correlation_id query rejected with 400
    bad_resp = client.get(
        "/api/observability/logs?correlation_id=invalid!@#$%^&*()",
        headers={"X-Admin-Key": admin_key},
    )
    assert bad_resp.status_code == 400


# ==============================================================================
# 7. Incident Tracing API Tests
# ==============================================================================

def test_incident_trace_endpoint(app_and_client):
    app, client, admin_key = app_and_client
    event_manager = app.state.event_manager
    audit_store = app.state.audit_store

    from agentshield.events.models import SecurityEvent, SecurityAlert, SecurityIncident, AlertStatus, IncidentStatus

    corr_id = "corr_incident_trace_404"
    evt = SecurityEvent(
        event_id="evt_test_trace_1",
        timestamp="2026-11-04T12:00:00Z",
        agent_id="suspicious_agent",
        tool="admin_action",
        event_type=EventType.POLICY_VIOLATION.value,
        severity=EventSeverity.HIGH.value,
        decision="BLOCK",
        risk_score=95.0,
        evidence=["Suspicious admin action blocked"],
        trace_id="trc_trace_1",
        correlation_id=corr_id,
        metadata={},
    )
    event_manager.store.record_event(evt)

    alert = SecurityAlert(
        alert_id="alt_test_trace_1",
        title="High risk detected",
        description="High risk alert",
        severity=EventSeverity.HIGH.value,
        alert_type="risk_threshold",
        agent_id="suspicious_agent",
        trigger_event_id=evt.event_id,
        event_ids=[evt.event_id],
        correlation_id=corr_id,
        incident_id="inc_test_trace_1",
        status=AlertStatus.OPEN.value,
    )
    event_manager.store.create_alert(alert)

    incident = SecurityIncident(
        incident_id="inc_test_trace_1",
        title="Investigate suspicious agent activity",
        description="Security Incident",
        severity=EventSeverity.HIGH.value,
        status=IncidentStatus.OPEN.value,
        correlation_id=corr_id,
        agent_id="suspicious_agent",
        alert_ids=[alert.alert_id],
        event_count=1,
    )
    event_manager.store.create_incident(incident)

    # Also log an audit record with same correlation ID and sensitive argument
    decision = Decision(
        allowed=False,
        decision=DecisionValue.BLOCK,
        reasons=["Blocked by policy"],
        risk_score=95.0,
        severity=RiskLevel.HIGH,
        agent="suspicious_agent",
        tool="admin_action",
    )
    audit_store.log_decision(
        decision=decision,
        arguments={"action": "delete_all", "api_key": "incident_secret_token_123"},
        execution_status="not_executed",
        correlation_id=corr_id,
    )

    # 1. Unauthenticated request rejected
    unauth = client.get(f"/api/security/incidents/{incident.incident_id}/trace")
    assert unauth.status_code == 401

    # 2. Malformed incident ID rejected with 400
    bad_id_resp = client.get(
        "/api/security/incidents/bad!@#_invalid/trace",
        headers={"X-Admin-Key": admin_key},
    )
    assert bad_id_resp.status_code == 400

    # 3. Authorized incident trace query
    trace_resp = client.get(
        f"/api/security/incidents/{incident.incident_id}/trace",
        headers={"X-Admin-Key": admin_key},
    )
    assert trace_resp.status_code == 200
    trace_data = trace_resp.json()
    assert trace_data["incident"]["incident_id"] == incident.incident_id
    assert trace_data["incident"]["correlation_id"] == corr_id
    assert len(trace_data["alerts"]) >= 1
    assert len(trace_data["events"]) >= 1
    assert len(trace_data["audit_records"]) >= 1
    assert trace_data["summary"]["total_audit_records"] >= 1
    # Ensure sensitive credentials are redacted in trace response
    assert trace_data["audit_records"][0]["arguments"]["api_key"] == "[REDACTED]"
    assert "incident_secret_token_123" not in trace_resp.text


# ==============================================================================
# 8. Cryptographic Audit Verification Endpoint Tests
# ==============================================================================

def test_audit_verify_endpoint_read_only_and_tamper_detection(app_and_client):
    import sqlite3
    app, client, admin_key = app_and_client
    audit_store = app.state.audit_store

    # Log a legitimate record
    dec = Decision(
        allowed=True,
        decision=DecisionValue.ALLOW,
        reasons=["Valid action"],
        risk_score=5.0,
        severity=RiskLevel.LOW,
        agent="test_agent",
        tool="search_product",
    )
    rec_id = audit_store.log_decision(
        decision=dec,
        arguments={"q": "shoes"},
        execution_status="executed",
    )

    # 1. Unauthenticated request rejected
    unauth = client.get("/api/audit/verify")
    assert unauth.status_code == 401

    # 2. Clean verification
    verify_resp = client.get("/api/audit/verify", headers={"X-Admin-Key": admin_key})
    assert verify_resp.status_code == 200
    v_data = verify_resp.json()
    assert v_data["valid"] is True
    assert v_data["error"] is None

    # 3. Tamper detection: artificially corrupt a record in the database
    with sqlite3.connect(audit_store.db_path) as conn:
        conn.execute("UPDATE audit_logs SET decision = 'BLOCK' WHERE id = ?", (rec_id,))
        conn.commit()

    # Re-verify -> Must report invalid with corruption details
    corrupt_resp = client.get("/api/audit/verify", headers={"X-Admin-Key": admin_key})
    assert corrupt_resp.status_code == 200
    c_data = corrupt_resp.json()
    assert c_data["valid"] is False
    assert c_data["error"] is not None


# ==============================================================================
# 9. Simulator Isolation Tests
# ==============================================================================

def test_simulation_runs_do_not_pollute_operational_telemetry(app_and_client):
    app, client, admin_key = app_and_client

    # Capture initial operational audit record count
    initial_audit_events = client.get("/api/audit/events", headers={"X-Admin-Key": admin_key}).json()["total"]
    initial_operational_logs = client.get("/api/observability/logs", headers={"X-Admin-Key": admin_key}).json()["total"]

    # Execute simulation scenario
    sim_resp = client.post("/api/simulator/run/scenario-prompt-injection")
    assert sim_resp.status_code == 200
    sim_result = sim_resp.json()
    assert sim_result["actual_decision"] == "BLOCK"

    # Verify operational audit ledger was NOT modified
    after_audit_events = client.get("/api/audit/events", headers={"X-Admin-Key": admin_key}).json()["total"]
    assert after_audit_events == initial_audit_events

    # Verify operational logs do not include simulation runs
    after_operational_logs = client.get("/api/observability/logs", headers={"X-Admin-Key": admin_key}).json()["total"]
    assert after_operational_logs == initial_operational_logs

    # Verify operational review queue was not contaminated
    reviews_resp = client.get("/api/reviews?source=production", headers={"X-Admin-Key": admin_key})
    assert reviews_resp.status_code == 200
    assert reviews_resp.json()["count"] == 0

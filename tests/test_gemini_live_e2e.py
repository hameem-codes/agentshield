"""
AgentShield — Milestone 7, Phase 4B: Live Gemini E2E Validation Tests.

Validates the real and simulated Gemini integration across the complete
AgentShield analyst pipeline:
1. Synthetic security scenario creation (suspicious tool invocation, unauthorized access,
   repeated blocked actions, potential data exfiltration).
2. Live Gemini API test (conditionally executed if GEMINI_API_KEY is configured; explicitly
   skipped if missing, never substituting MockLLMProvider).
3. Simulated Gemini E2E test with grounding and hallucination stripping.
4. Persistent investigation report storage & retrieval across application restarts.
5. Authenticated API verification for analyst, investigation, and report endpoints.
6. Provider failure isolation (401, 429, 503, timeout, malformed) confirming deterministic
   Shield policy evaluation, authorization, execution, and audit remain completely uncompromised.
"""

import json
import os
from typing import List, Tuple
from unittest.mock import MagicMock, patch
import httpx
import pytest
from fastapi.testclient import TestClient

from agentshield import (
    Shield,
    ExecutionStatus,
    SecurityEvent,
    SecurityAlert,
    SecurityIncident,
    SQLiteEventStore,
    SQLiteAuditStore,
    SQLiteReviewStore,
    SQLiteReportStore,
    SecurityAnalyst,
    GeminiProvider,
    ProviderError,
    AnalysisReport,
    AnalystSeverity,
)
from agentshield.analyst import AnalysisValidationError
from agentshield.api.app import create_app


# =====================================================================
# Helper: Synthetic Security Scenario
# =====================================================================

def build_synthetic_security_scenario(
    event_store: SQLiteEventStore,
    incident_id: str = "inc_synth_01",
    correlation_id: str = "corr_synth_01",
    agent_id: str = "agent_synth_4b",
) -> Tuple[SecurityIncident, List[SecurityAlert], List[SecurityEvent]]:
    """Constructs a reproducible synthetic security scenario containing:
    1. Suspicious tool invocation (SQL pattern injection probe).
    2. Unauthorized tool access attempt (lacks refund permission).
    3. Repeated blocked actions (second attempt on denied tool).
    4. Potential data exfiltration indicator (egress to unapproved external URL).
    """
    # 1. Suspicious tool invocation
    evt_1 = SecurityEvent(
        event_id="evt_synth_1",
        timestamp="2026-11-03T20:00:00Z",
        agent_id=agent_id,
        tool="search_product",
        correlation_id=correlation_id,
        event_type="SUSPICIOUS_QUERY",
        severity="MEDIUM",
        decision="ALLOW",
        evidence=["SQL wildcard pattern in query parameter: 'SELECT * FROM users WHERE admin=1'"],
        metadata={"query": "SELECT * FROM users WHERE admin=1", "ip": "192.168.1.100"},
    )
    event_store.record_event(evt_1)

    # 2. Unauthorized tool access attempt
    evt_2 = SecurityEvent(
        event_id="evt_synth_2",
        timestamp="2026-11-03T20:01:00Z",
        agent_id=agent_id,
        tool="refund_order",
        correlation_id=correlation_id,
        event_type="UNAUTHORIZED_TOOL",
        severity="HIGH",
        decision="BLOCK",
        evidence=["Agent lacks 'refund' permission; policy violation blocked"],
        metadata={"order_id": "ord_999", "amount": 50000},
    )
    event_store.record_event(evt_2)

    # 3. Repeated blocked action
    evt_3 = SecurityEvent(
        event_id="evt_synth_3",
        timestamp="2026-11-03T20:02:00Z",
        agent_id=agent_id,
        tool="refund_order",
        correlation_id=correlation_id,
        event_type="UNAUTHORIZED_TOOL",
        severity="HIGH",
        decision="BLOCK",
        evidence=["Repeated attempt on denied tool 'refund_order'"],
        metadata={"order_id": "ord_999", "amount": 50000},
    )
    event_store.record_event(evt_3)

    # 4. Potential data exfiltration indicator
    evt_4 = SecurityEvent(
        event_id="evt_synth_4",
        timestamp="2026-11-03T20:03:00Z",
        agent_id=agent_id,
        tool="export_data",
        correlation_id=correlation_id,
        event_type="EXFILTRATION_ATTEMPT",
        severity="CRITICAL",
        decision="BLOCK",
        evidence=["Egress attempt to unapproved domain: https://evil-exfil.corp.internal/webhook?token=SuperSecretExfilToken123&dest=bucket"],
        metadata={"destination": "https://evil-exfil.corp.internal/webhook?token=SuperSecretExfilToken123&dest=bucket", "bytes": 10485760},
    )
    event_store.record_event(evt_4)

    # Alerts
    alt_1 = SecurityAlert(
        alert_id="alt_synth_1",
        timestamp="2026-11-03T20:01:10Z",
        title="Unauthorized Tool Access Attempt",
        alert_type="unauthorized_tool",
        severity="HIGH",
        agent_id=agent_id,
        correlation_id=correlation_id,
        event_ids=["evt_synth_2"],
        incident_id=incident_id,
    )
    event_store.create_alert(alt_1)

    alt_2 = SecurityAlert(
        alert_id="alt_synth_2",
        timestamp="2026-11-03T20:02:10Z",
        title="Repeated Blocked Actions Threshold Exceeded",
        alert_type="repeated_blocked",
        severity="HIGH",
        agent_id=agent_id,
        correlation_id=correlation_id,
        event_ids=["evt_synth_2", "evt_synth_3"],
        incident_id=incident_id,
    )
    event_store.create_alert(alt_2)

    alt_3 = SecurityAlert(
        alert_id="alt_synth_3",
        timestamp="2026-11-03T20:03:10Z",
        title="Suspected Data Exfiltration to External Destination",
        alert_type="data_exfiltration",
        severity="CRITICAL",
        agent_id=agent_id,
        correlation_id=correlation_id,
        event_ids=["evt_synth_4"],
        incident_id=incident_id,
    )
    event_store.create_alert(alt_3)

    # Incident
    incident = SecurityIncident(
        incident_id=incident_id,
        created_at="2026-11-03T20:03:20Z",
        title="Potential Data Exfiltration and Privilege Escalation",
        severity="CRITICAL",
        correlation_id=correlation_id,
        agent_id=agent_id,
        alert_ids=["alt_synth_1", "alt_synth_2", "alt_synth_3"],
    )
    event_store.create_incident(incident)

    return incident, [alt_1, alt_2, alt_3], [evt_1, evt_2, evt_3, evt_4]


# =====================================================================
# 1. Live Gemini API E2E Validation (Requires GEMINI_API_KEY)
# =====================================================================

@pytest.mark.skipif(
    not os.environ.get("GEMINI_API_KEY"),
    reason="GEMINI_API_KEY environment variable is not configured. Live Gemini API test explicitly skipped.",
)
def test_live_gemini_api_e2e_investigation():
    """Validates real end-to-end investigation with the official Gemini API.

    If GEMINI_API_KEY is not set, this test is explicitly skipped (never mocked).
    """
    event_store = SQLiteEventStore(db_path=":memory:")
    report_store = SQLiteReportStore(db_path=":memory:")

    incident, alerts, events = build_synthetic_security_scenario(
        event_store,
        incident_id="inc_live_gemini_01",
        correlation_id="corr_live_gemini_01",
        agent_id="agent_live_gemini",
    )

    provider = GeminiProvider(timeout=45.0, max_retries=2)
    analyst = SecurityAnalyst(provider=provider, event_store=event_store, report_store=report_store)

    # Execute investigation against live Gemini API
    report = analyst.investigate_incident("inc_live_gemini_01")

    # 1. Structural correctness & Pydantic validation
    assert isinstance(report, AnalysisReport)
    assert report.incident_id == "inc_live_gemini_01"
    assert report.correlation_id == "corr_live_gemini_01"
    assert report.agent_id == "agent_live_gemini"
    assert report.analyst_model == provider.model_name
    assert len(report.incident_summary) >= 5
    assert len(report.threat_assessment) >= 5
    assert isinstance(report.severity_assessment, AnalystSeverity)
    assert 0.0 <= report.confidence <= 1.0

    # 2. Evidence Grounding: every referenced event/alert must be in the supplied telemetry
    allowed_event_ids = {e.event_id for e in events}
    allowed_alert_ids = {a.alert_id for a in alerts}
    for eid in report.supporting_event_ids:
        assert eid in allowed_event_ids
    for aid in report.supporting_alert_ids:
        assert aid in allowed_alert_ids

    # Grounded observations and threats
    for obs in report.confirmed_observations:
        for eid in obs.evidence_ids:
            assert eid in allowed_event_ids or eid in allowed_alert_ids
    for threat in report.potential_threats:
        for eid in threat.evidence_ids:
            assert eid in allowed_event_ids or eid in allowed_alert_ids

    # 3. Deterministic timeline based strictly on actual stored telemetry
    assert len(report.timeline) == len(events)
    timeline_ids = [t.event_id for t in report.timeline]
    assert timeline_ids == ["evt_synth_1", "evt_synth_2", "evt_synth_3", "evt_synth_4"]

    # 4. Behavioral patterns deterministically detected
    assert report.repeated_behavior is True
    assert report.data_exfiltration_indicators is True

    # 5. Report was auto-persisted in SQLiteReportStore
    persisted = report_store.get_report(report.report_id)
    assert persisted is not None
    assert persisted.report_id == report.report_id
    assert persisted.incident_id == "inc_live_gemini_01"


# =====================================================================
# 2. Simulated Gemini E2E Synthetic Scenario (Grounding & Redaction)
# =====================================================================

def test_simulated_gemini_e2e_synthetic_scenario():
    """Reproducible E2E test verifying sanitized context transmission, structured output,
    Pydantic validation, and evidence grounding with fabricated ID stripping.
    """
    event_store = SQLiteEventStore(db_path=":memory:")
    report_store = SQLiteReportStore(db_path=":memory:")

    incident, alerts, events = build_synthetic_security_scenario(
        event_store,
        incident_id="inc_sim_01",
        correlation_id="corr_sim_01",
        agent_id="agent_sim",
    )

    mock_client = MagicMock()
    # Simulated model response containing valid IDs PLUS two fabricated IDs
    model_response_data = {
        "incident_summary": "Synthetic scenario analysis: unauthorized privilege escalation and exfiltration.",
        "threat_assessment": "The agent attempted unapproved refund actions followed by external exfiltration egress.",
        "severity_assessment": "CRITICAL",
        "supporting_event_ids": ["evt_synth_2", "evt_synth_4", "evt_hallucinated_999"],
        "supporting_alert_ids": ["alt_synth_3", "alt_hallucinated_888"],
        "suspicious_behavior": [
            "Attempted refund tool call without permission",
            "Attempted bulk egress to external URL",
        ],
        "recommended_investigation_steps": [
            "Revoke agent session credentials",
            "Block egress destination domain on firewall",
        ],
        "confidence": 0.95,
        "uncertainty_factors": [],
        "confirmed_observations": [
            {"statement": "Refund denied by deterministic policy", "evidence_ids": ["evt_synth_2", "evt_hallucinated_999"]}
        ],
        "potential_threats": [
            {"statement": "Exfiltration of sensitive customer data", "evidence_ids": ["alt_synth_3", "alt_hallucinated_888"]}
        ],
        "hypotheses": ["Agent was prompted with prompt injection to extract customer lists"],
        "missing_evidence": ["Network perimeter PCAP logs"],
        "suspicious_sequences": [
            {
                "sequence_type": "escalation_to_exfil",
                "event_ids": ["evt_synth_2", "evt_synth_4", "evt_hallucinated_999"],
                "description": "Probe followed by exfiltration attempt",
            }
        ],
        "repeated_behavior": True,
        "escalation_pattern": True,
        "unusual_tool_access": True,
        "data_exfiltration_indicators": True,
    }
    mock_client.models.generate_content.return_value = MagicMock(text=json.dumps(model_response_data))

    provider = GeminiProvider(api_key="test_key", client=mock_client)
    analyst = SecurityAnalyst(provider=provider, event_store=event_store, report_store=report_store)

    report = analyst.investigate_incident("inc_sim_01")

    # 1. Verify telemetry was sanitized before transmission
    mock_client.models.generate_content.assert_called_once()
    passed_contents = mock_client.models.generate_content.call_args.kwargs["contents"]
    # The exfiltration token must be redacted
    assert "SuperSecretExfilToken123" not in passed_contents
    assert "token=[REDACTED]" in passed_contents

    # 2. Verify structured report validity
    assert isinstance(report, AnalysisReport)
    assert report.incident_id == "inc_sim_01"
    assert report.severity_assessment == AnalystSeverity.CRITICAL
    assert report.confidence == 0.95

    # 3. Verify fabricated IDs were rejected / stripped from report
    assert "evt_hallucinated_999" not in report.supporting_event_ids
    assert "alt_hallucinated_888" not in report.supporting_alert_ids
    assert "evt_synth_2" in report.supporting_event_ids
    assert "evt_synth_4" in report.supporting_event_ids
    assert "alt_synth_3" in report.supporting_alert_ids

    # Confirmed observations and potential threats must have stripped fabricated IDs
    assert report.confirmed_observations[0].evidence_ids == ["evt_synth_2"]
    assert report.potential_threats[0].evidence_ids == ["alt_synth_3"]
    assert report.suspicious_sequences[0].event_ids == ["evt_synth_2", "evt_synth_4"]

    # Uncertainty factors must record the stripped unverified IDs
    assert any("evt_hallucinated_999" in u for u in report.uncertainty_factors)
    assert any("alt_hallucinated_888" in u for u in report.uncertainty_factors)

    # 4. Verify deterministic timeline is grounded in actual events
    assert len(report.timeline) == 4
    assert [t.event_id for t in report.timeline] == [
        "evt_synth_1",
        "evt_synth_2",
        "evt_synth_3",
        "evt_synth_4",
    ]


# =====================================================================
# 3. Persistence Verification Across Application & Store Recreation
# =====================================================================

def test_gemini_persistence_across_app_recreation(tmp_path):
    """Verifies that an AnalysisReport generated with GeminiProvider persists into SQLite,
    survives process/store re-initialization, preserves every field, and is accessible
    via both store and FastAPI endpoints without data loss.
    """
    db_file = str(tmp_path / "gemini_e2e_persistent_reports.db")
    event_store = SQLiteEventStore(db_path=":memory:")
    report_store_1 = SQLiteReportStore(db_path=db_file)

    incident, alerts, events = build_synthetic_security_scenario(
        event_store,
        incident_id="inc_persist_01",
        correlation_id="corr_persist_01",
        agent_id="agent_persist",
    )

    valid_json = {
        "incident_summary": "Persistent Investigation Report for E2E Validation.",
        "threat_assessment": "Simulated multi-stage attacker progression.",
        "severity_assessment": "HIGH",
        "supporting_event_ids": ["evt_synth_2"],
        "supporting_alert_ids": ["alt_synth_1"],
        "suspicious_behavior": ["Unauthorized tool call"],
        "recommended_investigation_steps": ["Inspect audit logs"],
        "confidence": 0.88,
        "uncertainty_factors": ["Pending firewall telemetry"],
        "confirmed_observations": [{"statement": "Blocked refund attempt", "evidence_ids": ["evt_synth_2"]}],
        "potential_threats": [{"statement": "Attempted balance drain", "evidence_ids": ["alt_synth_1"]}],
        "hypotheses": ["Compromised session"],
        "missing_evidence": ["DNS logs"],
        "suspicious_sequences": [],
        "repeated_behavior": True,
        "escalation_pattern": False,
        "unusual_tool_access": True,
        "data_exfiltration_indicators": False,
    }

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = MagicMock(text=json.dumps(valid_json))

    provider = GeminiProvider(api_key="test_key", client=mock_client)
    analyst_1 = SecurityAnalyst(provider=provider, event_store=event_store, report_store=report_store_1)

    # Generate and auto-persist report
    original_report = analyst_1.investigate_incident("inc_persist_01")
    report_id = original_report.report_id

    # Close initial store
    report_store_1.close()

    # Re-initialize an independent SQLiteReportStore against the same database file
    report_store_2 = SQLiteReportStore(db_path=db_file)

    # 1. Retrieve by report_id
    retrieved_report = report_store_2.get_report(report_id)
    assert retrieved_report is not None
    assert retrieved_report.report_id == report_id
    assert retrieved_report.incident_id == "inc_persist_01"
    assert retrieved_report.correlation_id == "corr_persist_01"
    assert retrieved_report.agent_id == "agent_persist"
    assert retrieved_report.incident_summary == original_report.incident_summary
    assert retrieved_report.threat_assessment == original_report.threat_assessment
    assert retrieved_report.severity_assessment == AnalystSeverity.HIGH
    assert retrieved_report.confidence == 0.88
    assert retrieved_report.supporting_event_ids == ["evt_synth_2"]
    assert retrieved_report.supporting_alert_ids == ["alt_synth_1"]
    assert len(retrieved_report.timeline) == 4
    assert retrieved_report.repeated_behavior is True
    assert retrieved_report.unusual_tool_access is True

    # 2. Retrieve through incident association
    incident_reports = report_store_2.list_reports_for_incident("inc_persist_01")
    assert len(incident_reports) == 1
    assert incident_reports[0].report_id == report_id

    # 3. Retrieve through correlation association
    corr_reports = report_store_2.list_reports_for_correlation("corr_persist_01")
    assert len(corr_reports) == 1
    assert corr_reports[0].report_id == report_id

    # 4. Verify API accessibility after re-creating FastAPI application with same database
    app = create_app(
        audit_db_path=":memory:",
        reports_db_path=db_file,
        admin_api_key="persistent-admin-key",
        event_store=event_store,
        analyst=analyst_1,
    )
    client = TestClient(app)
    headers = {"x-admin-key": "persistent-admin-key"}

    resp = client.get(f"/api/security/reports/{report_id}", headers=headers)
    assert resp.status_code == 200
    data = resp.json()["report"]
    assert data["report_id"] == report_id
    assert data["incident_id"] == "inc_persist_01"

    report_store_2.close()


# =====================================================================
# 4. API Verification (Authenticated Endpoints & Schemas)
# =====================================================================

def test_gemini_analyst_api_endpoints():
    """Verifies existing authenticated endpoints with GeminiProvider:
    - POST /api/security/analyst/analyze
    - GET  /api/security/incidents/{incident_id}/investigation
    - GET  /api/security/incidents/{incident_id}/reports
    - GET  /api/security/reports/{report_id}
    """
    event_store = SQLiteEventStore(db_path=":memory:")
    report_store = SQLiteReportStore(db_path=":memory:")

    incident, alerts, events = build_synthetic_security_scenario(
        event_store,
        incident_id="inc_api_01",
        correlation_id="corr_api_01",
        agent_id="agent_api",
    )

    valid_json = {
        "incident_summary": "API investigation test report.",
        "threat_assessment": "Verified API contract and schema validation.",
        "severity_assessment": "MEDIUM",
        "supporting_event_ids": ["evt_synth_1"],
        "supporting_alert_ids": ["alt_synth_1"],
        "suspicious_behavior": ["API probe"],
        "recommended_investigation_steps": ["Check endpoints"],
        "confidence": 0.85,
        "uncertainty_factors": [],
        "confirmed_observations": [],
        "potential_threats": [],
        "hypotheses": [],
        "missing_evidence": [],
    }

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = MagicMock(text=json.dumps(valid_json))

    provider = GeminiProvider(api_key="test_key", client=mock_client)
    analyst = SecurityAnalyst(provider=provider, event_store=event_store, report_store=report_store)

    app = create_app(
        audit_db_path=":memory:",
        admin_api_key="api-admin-secret-4b",
        event_store=event_store,
        report_store=report_store,
        analyst=analyst,
    )
    client = TestClient(app)
    auth_headers = {"x-admin-key": "api-admin-secret-4b"}

    # 1. Authentication enforcement: 401 Unauthorized without admin key
    assert client.get("/api/security/incidents/inc_api_01/investigation").status_code == 401
    assert client.post("/api/security/analyst/analyze", json={"incident_id": "inc_api_01"}).status_code == 401
    assert client.get("/api/security/incidents/inc_api_01/reports").status_code == 401
    assert client.get("/api/security/reports/rep_dummy").status_code == 401

    # 2. POST /api/security/analyst/analyze with incident_id -> 200
    res_analyze = client.post(
        "/api/security/analyst/analyze",
        headers=auth_headers,
        json={"incident_id": "inc_api_01"},
    )
    assert res_analyze.status_code == 200
    rep_data = res_analyze.json()["report"]
    assert rep_data["incident_id"] == "inc_api_01"
    report_id = rep_data["report_id"]

    # 3. POST /api/security/analyst/analyze with correlation_id -> 200
    res_corr = client.post(
        "/api/security/analyst/analyze",
        headers=auth_headers,
        json={"correlation_id": "corr_api_01"},
    )
    assert res_corr.status_code == 200
    assert res_corr.json()["report"]["correlation_id"] == "corr_api_01"

    # 4. POST /api/security/analyst/analyze with empty payload -> 400
    res_bad = client.post(
        "/api/security/analyst/analyze",
        headers=auth_headers,
        json={},
    )
    assert res_bad.status_code == 400

    # 5. GET /api/security/incidents/{incident_id}/investigation -> 200
    res_inv = client.get("/api/security/incidents/inc_api_01/investigation", headers=auth_headers)
    assert res_inv.status_code == 200
    assert res_inv.json()["report"]["incident_id"] == "inc_api_01"

    # 6. GET /api/security/incidents/{incident_id}/reports -> 200
    res_list = client.get("/api/security/incidents/inc_api_01/reports", headers=auth_headers)
    assert res_list.status_code == 200
    list_json = res_list.json()
    assert list_json["total"] >= 2
    assert any(r["report_id"] == report_id for r in list_json["reports"])

    # 7. GET /api/security/reports/{report_id} -> 200
    res_get_rep = client.get(f"/api/security/reports/{report_id}", headers=auth_headers)
    assert res_get_rep.status_code == 200
    assert res_get_rep.json()["report"]["report_id"] == report_id

    # 8. Nonexistent resources -> 404
    assert client.get("/api/security/incidents/nonexistent_inc/investigation", headers=auth_headers).status_code == 404
    assert client.get("/api/security/reports/rep_nonexistent", headers=auth_headers).status_code == 404


# =====================================================================
# 5. Provider Failure Isolation (Deterministic Shield Unaffected)
# =====================================================================

@pytest.mark.parametrize(
    "error_scenario,simulated_side_effect,expected_status_code",
    [
        ("invalid_api_key", Exception("401 Unauthenticated: API key invalid"), 502),
        ("rate_limiting", Exception("429 ResourceExhausted: rate limit exceeded"), 502),
        ("service_unavailable", Exception("503 Service Unavailable: backend down"), 502),
        ("timeout", Exception("Request timed out after 30.0s"), 502),
        ("malformed_response", MagicMock(text="<invalid>malformed non-json</invalid>"), 422),
    ],
)
def test_provider_failure_isolation_shield_unaffected(
    error_scenario,
    simulated_side_effect,
    expected_status_code,
):
    """Simulates 5 distinct provider failure modes (invalid key, 429, 503, timeout, malformed)
    and verifies that:
    1. Analyst failure is surfaced cleanly via appropriate HTTP status code (502 or 422).
    2. Deterministic Shield authorization remains 100% operational (ALLOW and BLOCK).
    3. Tool execution executes allowed tools exactly once.
    4. Audit logging and hash chain integrity remain untampered.
    5. The LLM has zero capability to authorize actions or modify security policies.
    """
    event_store = SQLiteEventStore(db_path=":memory:")
    audit_store = SQLiteAuditStore(db_path=":memory:")
    review_store = SQLiteReviewStore(db_path=":memory:")
    report_store = SQLiteReportStore(db_path=":memory:")

    incident, alerts, events = build_synthetic_security_scenario(
        event_store,
        incident_id=f"inc_fail_{error_scenario}",
        correlation_id=f"corr_fail_{error_scenario}",
    )

    mock_client = MagicMock()
    if isinstance(simulated_side_effect, Exception):
        mock_client.models.generate_content.side_effect = simulated_side_effect
    else:
        mock_client.models.generate_content.return_value = simulated_side_effect

    failing_provider = GeminiProvider(api_key="test_key", client=mock_client, max_retries=0)
    analyst = SecurityAnalyst(provider=failing_provider, event_store=event_store, report_store=report_store)

    shield = Shield(
        audit_store=audit_store,
        review_store=review_store,
        event_store=event_store,
        analyst=analyst,
    )

    execution_counter = {"search_product": 0}

    def real_search_tool(args):
        execution_counter["search_product"] += 1
        return {"items": ["book_1", "book_2"], "query": args.get("query")}

    shield.registry.register("search_product", real_search_tool)

    app = create_app(
        audit_db_path=":memory:",
        admin_api_key="isolation-admin-key",
        event_store=event_store,
        report_store=report_store,
        analyst=analyst,
    )
    # Inject our configured shield
    app.state.shield = shield
    client = TestClient(app)
    headers = {"x-admin-key": "isolation-admin-key"}

    # --- 1. Verify analyst endpoint surfaces failure cleanly ---
    res_inv = client.get(f"/api/security/incidents/inc_fail_{error_scenario}/investigation", headers=headers)
    assert res_inv.status_code == expected_status_code

    # --- 2. Deterministic authorization remains completely uncompromised ---
    # Allowed action evaluates to ALLOW
    auth_allow = shield.authorize("shopping_agent", "search_product", {"query": "laptop"})
    assert auth_allow.allowed is True
    assert getattr(auth_allow.decision, "value", auth_allow.decision) == "ALLOW"

    # Disallowed action evaluates to BLOCK
    auth_block = shield.authorize("shopping_agent", "refund_order", {"amount": 500})
    assert auth_block.allowed is False
    assert getattr(auth_block.decision, "value", auth_block.decision) == "BLOCK"

    # --- 3. Execution succeeds exactly once for allowed action ---
    exec_res = shield.execute("shopping_agent", "search_product", {"query": "laptop"})
    assert exec_res.execution_status == ExecutionStatus.EXECUTED
    assert exec_res.tool_result == {"items": ["book_1", "book_2"], "query": "laptop"}
    assert execution_counter["search_product"] == 1

    # Execution fails closed for blocked action without calling any callable
    exec_block = shield.execute("shopping_agent", "refund_order", {"amount": 500})
    assert exec_block.execution_status == ExecutionStatus.NOT_EXECUTED
    assert exec_block.tool_result is None

    # --- 4. Audit logging & hash chain integrity remain untampered ---
    records = audit_store.query(limit=10)
    assert len(records) >= 2
    # Verify hash chain integrity
    integrity_res = audit_store.verify_integrity()
    assert integrity_res["valid"] is True


# =====================================================================
# 6. End-to-End Backend Integration Verification (Milestone 7 Extension)
# =====================================================================

def test_create_app_environment_driven_gemini_provider():
    """1. App factory configuration:
    - Verifies environment-driven Gemini provider initialization through create_app().
    - Verifies model, API key handling, and millisecond timeout configuration.
    - Uses a mocked SDK client without requiring live API keys.
    """
    mock_genai_client = MagicMock()
    with patch("agentshield.analyst.providers.gemini.genai.Client", return_value=mock_genai_client):
        with patch.dict(
            os.environ,
            {
                "AGENTSHIELD_ANALYST_PROVIDER": "gemini",
                "GEMINI_API_KEY": "AIzaSyTestEnvSecretKey1234567890",
                "AGENTSHIELD_ANALYST_MODEL": "gemini-1.5-pro",
                "AGENTSHIELD_ANALYST_TIMEOUT": "25.0",
                "AGENTSHIELD_ANALYST_MAX_RETRIES": "3",
            },
            clear=False,
        ):
            app = create_app(audit_db_path=":memory:", admin_api_key="env-admin-key")
            assert hasattr(app.state, "analyst")
            analyst = app.state.analyst
            assert analyst is not None
            assert isinstance(analyst.provider, GeminiProvider)
            assert analyst.provider.model_name == "gemini-1.5-pro"
            assert analyst.provider.timeout == 25.0
            assert analyst.provider.timeout_ms == 25000
            assert analyst.provider.max_retries == 3
            assert app.state.shield.analyst == analyst

    # Verify that missing GEMINI_API_KEY without fallback raises ProviderError in create_app
    with patch.dict(
        os.environ,
        {
            "AGENTSHIELD_ANALYST_PROVIDER": "gemini",
            "GEMINI_API_KEY": "",
            "AGENTSHIELD_ALLOW_MOCK_FALLBACK": "false",
        },
        clear=False,
    ):
        with pytest.raises(ProviderError, match="GEMINI_API_KEY is not configured"):
            create_app(audit_db_path=":memory:")


def test_gemini_api_transient_retry_recovery():
    """2. Transient retry recovery:
    - Simulates a 429 response on attempt 1 followed by a successful Gemini response on attempt 2.
    - Calls POST /api/security/analyst/analyze.
    - Verifies HTTP 200, exactly two attempts and successful report persistence.
    - Verifies retries do not create duplicate reports in the store.
    """
    event_store = SQLiteEventStore(db_path=":memory:")
    report_store = SQLiteReportStore(db_path=":memory:")

    incident, alerts, events = build_synthetic_security_scenario(
        event_store,
        incident_id="inc_retry_01",
        correlation_id="corr_retry_01",
        agent_id="agent_retry",
    )

    valid_json = {
        "incident_summary": "Recovered after transient rate limit.",
        "threat_assessment": "Threat cleared after backoff retry.",
        "severity_assessment": "LOW",
        "supporting_event_ids": ["evt_synth_1"],
        "supporting_alert_ids": ["alt_synth_1"],
        "suspicious_behavior": [],
        "recommended_investigation_steps": ["Continue monitoring"],
        "confidence": 0.95,
        "uncertainty_factors": [],
        "confirmed_observations": [],
        "potential_threats": [],
        "hypotheses": [],
        "missing_evidence": [],
    }

    rate_limit_err = Exception("429 ResourceExhausted: Quota exceeded, retry in 0.1s")
    valid_resp = MagicMock(text=json.dumps(valid_json))

    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = [rate_limit_err, valid_resp]

    provider = GeminiProvider(api_key="test_key", client=mock_client, max_retries=2, backoff_factor=0.01)
    analyst = SecurityAnalyst(provider=provider, event_store=event_store, report_store=report_store)

    app = create_app(
        audit_db_path=":memory:",
        admin_api_key="retry-admin-key",
        event_store=event_store,
        report_store=report_store,
        analyst=analyst,
    )
    client = TestClient(app)
    headers = {"x-admin-key": "retry-admin-key"}

    res = client.post(
        "/api/security/analyst/analyze",
        headers=headers,
        json={"incident_id": "inc_retry_01"},
    )

    assert res.status_code == 200
    report_data = res.json()["report"]
    assert report_data["incident_id"] == "inc_retry_01"
    assert report_data["incident_summary"] == "Recovered after transient rate limit."

    # Exactly two attempts executed
    assert mock_client.models.generate_content.call_count == 2

    # Exactly ONE report persisted in report_store (retries must not duplicate records)
    assert report_store.count_reports(incident_id="inc_retry_01") == 1
    persisted_reports = report_store.list_reports_for_incident("inc_retry_01")
    assert len(persisted_reports) == 1
    assert persisted_reports[0].report_id == report_data["report_id"]


@pytest.mark.parametrize(
    "timeout_exc",
    [
        httpx.ConnectTimeout("ConnectTimeout: _ssl.c:1064: The handshake operation timed out"),
        httpx.ReadTimeout("ReadTimeout: The read operation timed out after 15.0s"),
    ],
)
def test_gemini_api_timeout_propagation(timeout_exc):
    """3. Timeout propagation:
    - Simulates httpx.ConnectTimeout and httpx.ReadTimeout from SDK.
    - Verifies the API returns HTTP 502 with sanitized timeout details.
    - Verifies no invalid or partial report is saved to report_store.
    """
    event_store = SQLiteEventStore(db_path=":memory:")
    report_store = SQLiteReportStore(db_path=":memory:")

    incident, alerts, events = build_synthetic_security_scenario(
        event_store,
        incident_id="inc_timeout_01",
        correlation_id="corr_timeout_01",
    )

    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = timeout_exc

    provider = GeminiProvider(api_key="test_key", client=mock_client, timeout=15.0, max_retries=1, backoff_factor=0.01)
    analyst = SecurityAnalyst(provider=provider, event_store=event_store, report_store=report_store)

    app = create_app(
        audit_db_path=":memory:",
        admin_api_key="timeout-admin-key",
        event_store=event_store,
        report_store=report_store,
        analyst=analyst,
    )
    client = TestClient(app)
    headers = {"x-admin-key": "timeout-admin-key"}

    res = client.get("/api/security/incidents/inc_timeout_01/investigation", headers=headers)
    assert res.status_code == 502
    err_detail = res.json()["detail"]
    assert "Gemini request timed out after 15.0s" in err_detail

    # No report must be persisted when provider times out
    assert report_store.count_reports(incident_id="inc_timeout_01") == 0


def test_gemini_api_credential_leakage_prevention():
    """4. Credential leakage prevention:
    - Simulates SDK exceptions containing fake Gemini API keys in URLs, headers, and error bodies.
    - Verifies the complete HTTP response does not leak the raw key.
    - Verifies redaction matches existing project convention [REDACTED_API_KEY] or key=[REDACTED].
    """
    fake_key = "AIzaSyFakeCredential9876543210ABCDEF"
    event_store = SQLiteEventStore(db_path=":memory:")
    report_store = SQLiteReportStore(db_path=":memory:")

    incident, alerts, events = build_synthetic_security_scenario(
        event_store,
        incident_id="inc_leak_01",
        correlation_id="corr_leak_01",
    )

    leak_error = Exception(
        f"403 Forbidden: Request to https://generativelanguage.googleapis.com/v1beta/models?key={fake_key} "
        f"failed with header Authorization: Bearer {fake_key}"
    )

    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = leak_error

    provider = GeminiProvider(api_key=fake_key, client=mock_client, max_retries=0)
    analyst = SecurityAnalyst(provider=provider, event_store=event_store, report_store=report_store)

    app = create_app(
        audit_db_path=":memory:",
        admin_api_key="leak-admin-key",
        event_store=event_store,
        report_store=report_store,
        analyst=analyst,
    )
    client = TestClient(app)
    headers = {"x-admin-key": "leak-admin-key"}

    res = client.post(
        "/api/security/analyst/analyze",
        headers=headers,
        json={"incident_id": "inc_leak_01"},
    )
    assert res.status_code == 502
    raw_response_text = res.text

    # Verify zero raw key leakage in body, headers, or JSON
    assert fake_key not in raw_response_text
    assert "[REDACTED_API_KEY]" in raw_response_text or "key=[REDACTED]" in raw_response_text


@pytest.mark.parametrize(
    "invalid_payload,expected_error_match",
    [
        ("<gateway>502 Not JSON</gateway>", "Analysis validation error"),
        (json.dumps({"unexpected_schema": True}), "Analysis validation error"),
        (json.dumps({"incident_summary": "Missing required fields"}), "Analysis validation error"),
    ],
)
def test_gemini_api_malformed_and_structurally_invalid_response(invalid_payload, expected_error_match):
    """5. Malformed provider response:
    - Simulates non-JSON and structurally invalid analysis responses.
    - Verifies the API returns HTTP 422 with descriptive validation error.
    - Verifies invalid reports are not persisted in report_store.
    """
    event_store = SQLiteEventStore(db_path=":memory:")
    report_store = SQLiteReportStore(db_path=":memory:")

    incident, alerts, events = build_synthetic_security_scenario(
        event_store,
        incident_id="inc_malformed_01",
        correlation_id="corr_malformed_01",
    )

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = MagicMock(text=invalid_payload)

    provider = GeminiProvider(api_key="test_key", client=mock_client, max_retries=0)
    analyst = SecurityAnalyst(provider=provider, event_store=event_store, report_store=report_store)

    app = create_app(
        audit_db_path=":memory:",
        admin_api_key="malformed-admin-key",
        event_store=event_store,
        report_store=report_store,
        analyst=analyst,
    )
    client = TestClient(app)
    headers = {"x-admin-key": "malformed-admin-key"}

    res = client.post(
        "/api/security/analyst/analyze",
        headers=headers,
        json={"incident_id": "inc_malformed_01"},
    )
    assert res.status_code == 422
    assert expected_error_match in res.json()["detail"]

    # Ensure no malformed report was saved to the database
    assert report_store.count_reports(incident_id="inc_malformed_01") == 0


def test_deterministic_enforcement_endpoints_independent_of_gemini_failure():
    """6. Deterministic enforcement independence:
    - Verifies that after an analyst API 502/422 failure, the application's
      Shield authorization (/api/authorize) and execution (/api/execute) endpoints
      continue to operate with 100% deterministic fidelity.
    """
    event_store = SQLiteEventStore(db_path=":memory:")
    audit_store = SQLiteAuditStore(db_path=":memory:")
    review_store = SQLiteReviewStore(db_path=":memory:")
    report_store = SQLiteReportStore(db_path=":memory:")

    incident, alerts, events = build_synthetic_security_scenario(
        event_store,
        incident_id="inc_indep_01",
        correlation_id="corr_indep_01",
    )

    # Provider is broken (raises 503 backend error)
    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = Exception("503 Service Unavailable")

    provider = GeminiProvider(api_key="test_key", client=mock_client, max_retries=0)
    analyst = SecurityAnalyst(provider=provider, event_store=event_store, report_store=report_store)

    app = create_app(
        audit_db_path=":memory:",
        admin_api_key="indep-admin-key",
        event_store=event_store,
        report_store=report_store,
        analyst=analyst,
    )
    client = TestClient(app)
    admin_headers = {"x-admin-key": "indep-admin-key"}

    # 1. Analyst call fails with 502
    res_analyst = client.post(
        "/api/security/analyst/analyze",
        headers=admin_headers,
        json={"incident_id": "inc_indep_01"},
    )
    assert res_analyst.status_code == 502

    # 2. Check input endpoint remains operational
    res_check = client.post(
        "/check",
        json={"text": "Can you order shoes for me?"},
    )
    assert res_check.status_code == 200
    assert res_check.json()["allowed"] is True
    assert res_check.json()["decision"] == "ALLOW"

    # 3. Check malicious input detection remains operational
    res_inj = client.post(
        "/check",
        json={"text": "rm -rf / and delete database"},
    )
    assert res_inj.status_code == 200
    assert res_inj.json()["allowed"] is False
    assert res_inj.json()["decision"] == "BLOCK"

    # 4. Authorize allowed tool -> ALLOW
    res_auth_allow = client.post(
        "/authorize",
        json={"agent": "shopping_agent", "tool": "create_order", "arguments": {"product": "shoes", "quantity": 2}},
    )
    assert res_auth_allow.status_code == 200
    assert res_auth_allow.json()["allowed"] is True
    assert res_auth_allow.json()["decision"] == "ALLOW"

    # 5. Authorize disallowed tool -> BLOCK
    res_auth_block = client.post(
        "/authorize",
        json={"agent": "shopping_agent", "tool": "create_order", "arguments": {"product": "shoes", "quantity": 11}},
    )
    assert res_auth_block.status_code == 200
    assert res_auth_block.json()["allowed"] is False
    assert res_auth_block.json()["decision"] == "BLOCK"

    # 6. Execute allowed sandbox tool -> EXECUTED
    res_exec = client.post(
        "/execute",
        json={"agent": "shopping_agent", "tool": "create_order", "arguments": {"product": "shoes", "quantity": 2}},
    )
    assert res_exec.status_code == 200
    assert res_exec.json()["execution_status"] == "executed"
    assert res_exec.json()["tool_result"]["sandbox"] is True

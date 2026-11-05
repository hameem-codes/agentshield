"""
Tests for AgentShield Gemini Provider Integration (Milestone 7, Phase 4A).

Verifies:
1. Default model configuration (gemini-3.8-flash) and AGENTSHIELD_ANALYST_MODEL override.
2. Missing GEMINI_API_KEY handling.
3. Successful generation with schema constraint.
4. Telemetry secret redaction before sending to Gemini.
5. Transient error retries with backoff (429, 503, timeouts).
6. Non-transient errors (401, 403, 404) failing immediately without retrying.
7. Request timeout and empty/null response handling.
8. API key credential scrubbing from error messages.
9. End-to-end integration with SecurityAnalyst and SQLiteReportStore.
10. Independence of deterministic Shield enforcement when Gemini fails.
"""

import json
import os
from unittest.mock import MagicMock, patch
import pytest

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
from agentshield.analyst import AnalysisValidationError, MockLLMProvider, build_gemini_schema
from agentshield.api.app import create_app


@pytest.fixture
def mock_gemini_client():
    """Returns a mock genai.Client with configurable generate_content."""
    client = MagicMock()
    mock_response = MagicMock()
    valid_report = {
        "incident_summary": "Suspicious privilege escalation attempt detected.",
        "threat_assessment": "Attacker probed sensitive endpoints.",
        "severity_assessment": "HIGH",
        "supporting_event_ids": ["evt_1"],
        "supporting_alert_ids": ["alt_1"],
        "suspicious_behavior": ["Repeated blocked action"],
        "recommended_investigation_steps": ["Inspect agent credentials"],
        "confidence": 0.92,
        "uncertainty_factors": [],
        "confirmed_observations": [
            {"statement": "Unauthorized path access", "evidence_ids": ["evt_1"]}
        ],
        "potential_threats": [
            {"statement": "Credential compromise", "evidence_ids": ["alt_1"]}
        ],
        "hypotheses": ["Agent was prompted to bypass checks"],
        "missing_evidence": ["Network egress logs"],
    }
    mock_response.text = json.dumps(valid_report)
    client.models.generate_content.return_value = mock_response
    return client


# =====================================================================
# 1. Configuration & Model Selection
# =====================================================================

def test_gemini_provider_default_model(mock_gemini_client):
    """Verifies that GeminiProvider defaults to gemini-3.8-flash."""
    provider = GeminiProvider(api_key="test_key", client=mock_gemini_client)
    assert provider.model_name == "gemini-3.8-flash"


def test_gemini_provider_env_model_override(monkeypatch, mock_gemini_client):
    """Verifies that AGENTSHIELD_ANALYST_MODEL overrides the default model."""
    monkeypatch.setenv("AGENTSHIELD_ANALYST_MODEL", "gemini-3.5-flash-lite")
    provider = GeminiProvider(api_key="test_key", client=mock_gemini_client)
    assert provider.model_name == "gemini-3.5-flash-lite"


def test_gemini_provider_explicit_model_override(mock_gemini_client):
    """Verifies that constructor model argument overrides environment configuration."""
    provider = GeminiProvider(api_key="test_key", model="custom-gemini-model", client=mock_gemini_client)
    assert provider.model_name == "custom-gemini-model"


def test_gemini_provider_missing_api_key(monkeypatch):
    """Verifies that missing API key raises ProviderError without network calls."""
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    provider = GeminiProvider(api_key=None, client=None)
    with pytest.raises(ProviderError, match="Gemini API key is not configured"):
        provider.generate_analysis("prompt", "system")


# =====================================================================
# 2. Generation & Schema Constraints
# =====================================================================

def test_gemini_provider_successful_generation(mock_gemini_client):
    """Verifies successful invocation with structured schema constraint."""
    provider = GeminiProvider(api_key="test_key", client=mock_gemini_client)
    res = provider.generate_analysis("Analyze telemetry", "System instructions")

    assert "Suspicious privilege escalation attempt detected" in res
    mock_gemini_client.models.generate_content.assert_called_once()
    call_kwargs = mock_gemini_client.models.generate_content.call_args.kwargs
    assert call_kwargs["model"] == "gemini-3.8-flash"
    assert call_kwargs["contents"] == "Analyze telemetry"
    config = call_kwargs["config"]
    assert config.response_mime_type == "application/json"
    assert config.response_schema == provider.build_response_schema()
    # Confirm additionalProperties is absent from schema
    assert "additionalProperties" not in str(config.response_schema)
    assert "additional_properties" not in str(config.response_schema)


# =====================================================================
# 3. Secret Redaction
# =====================================================================

def test_gemini_provider_redacts_secrets_in_prompt(mock_gemini_client):
    """Verifies that raw credentials and tokens in prompts are redacted before transmission."""
    provider = GeminiProvider(api_key="test_key", client=mock_gemini_client)

    sensitive_prompt = (
        "Agent attempted tool call with password='SuperSecretPassword123!' "
        "and header Authorization: Bearer sk-ant-api03-abcdef1234567890abcdef123456"
    )
    sensitive_system = "System rule with API key AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6"

    provider.generate_analysis(sensitive_prompt, sensitive_system)

    call_kwargs = mock_gemini_client.models.generate_content.call_args.kwargs
    passed_contents = call_kwargs["contents"]
    passed_system = call_kwargs["config"].system_instruction

    assert "SuperSecretPassword123!" not in passed_contents
    assert "sk-ant-api03-abcdef1234567890abcdef123456" not in passed_contents
    assert "[REDACTED]" in passed_contents

    assert "AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6" not in passed_system
    assert "[REDACTED]" in passed_system


# =====================================================================
# 4. Retries & Error Handling
# =====================================================================

def test_gemini_provider_retries_transient_error(mock_gemini_client):
    """Verifies that transient errors (e.g. 429 rate limit) are retried with backoff."""
    rate_limit_error = Exception("429 ResourceExhausted: rate limit exceeded, please retry later")
    valid_response = MagicMock(text=json.dumps({"incident_summary": "Summary", "threat_assessment": "Threat"}))

    mock_gemini_client.models.generate_content.side_effect = [rate_limit_error, valid_response]

    provider = GeminiProvider(api_key="test_key", client=mock_gemini_client, max_retries=2, backoff_factor=0.01)
    res = provider.generate_analysis("prompt", "system")

    assert "Summary" in res
    assert mock_gemini_client.models.generate_content.call_count == 2


def test_gemini_provider_non_transient_error_fails_immediately(mock_gemini_client):
    """Verifies that non-transient errors (401 unauthenticated) fail immediately without retrying."""
    auth_error = Exception("401 Unauthenticated: API key not valid")
    mock_gemini_client.models.generate_content.side_effect = auth_error

    provider = GeminiProvider(api_key="test_key", client=mock_gemini_client, max_retries=3)

    with pytest.raises(ProviderError, match="Gemini authentication failed"):
        provider.generate_analysis("prompt", "system")

    # Must NOT retry 401 errors
    assert mock_gemini_client.models.generate_content.call_count == 1


def test_gemini_provider_timeout_handling(mock_gemini_client):
    """Verifies that request timeouts are converted into descriptive ProviderError."""
    timeout_err = Exception("Request timed out after 30.0s")
    mock_gemini_client.models.generate_content.side_effect = timeout_err

    provider = GeminiProvider(api_key="test_key", client=mock_gemini_client, max_retries=0)

    with pytest.raises(ProviderError, match="Gemini request timed out"):
        provider.generate_analysis("prompt", "system")


def test_gemini_provider_empty_response_handling(mock_gemini_client):
    """Verifies that empty or null responses raise ProviderError."""
    mock_gemini_client.models.generate_content.return_value = MagicMock(text="")

    provider = GeminiProvider(api_key="test_key", client=mock_gemini_client)

    with pytest.raises(ProviderError, match="returned an empty response"):
        provider.generate_analysis("prompt", "system")


def test_gemini_provider_sanitizes_credentials_in_errors(mock_gemini_client):
    """Verifies that API keys in exception messages are redacted and never leaked."""
    raw_key = "AIzaSyTestSecretKey9876543210"
    mock_gemini_client.models.generate_content.side_effect = Exception(
        f"403 Forbidden: Request failed for key={raw_key}"
    )

    provider = GeminiProvider(api_key=raw_key, client=mock_gemini_client, max_retries=0)

    with pytest.raises(ProviderError) as exc_info:
        provider.generate_analysis("prompt", "system")

    err_msg = str(exc_info.value)
    assert raw_key not in err_msg
    assert "[REDACTED" in err_msg


# =====================================================================
# 5. End-to-End Analyst & Shield Integration
# =====================================================================

def test_gemini_provider_e2e_with_analyst(mock_gemini_client):
    """Verifies full investigation lifecycle with GeminiProvider and SQLite stores."""
    event_store = SQLiteEventStore(db_path=":memory:")
    report_store = SQLiteReportStore(db_path=":memory:")

    incident = SecurityIncident(
        incident_id="inc_gemini_01",
        title="Gemini Investigation Incident",
        severity="HIGH",
        correlation_id="corr_gemini_01",
        agent_id="agent_gemini",
    )
    event_store.create_incident(incident)

    evt = SecurityEvent(
        event_id="evt_1",
        agent_id="agent_gemini",
        tool="read_file",
        decision="BLOCK",
        severity="HIGH",
        correlation_id="corr_gemini_01",
    )
    event_store.record_event(evt)

    alert = SecurityAlert(
        alert_id="alt_1",
        title="Alert for Gemini Test",
        alert_type="policy_violation",
        severity="HIGH",
        agent_id="agent_gemini",
        correlation_id="corr_gemini_01",
        event_ids=["evt_1"],
        incident_id="inc_gemini_01",
    )
    event_store.create_alert(alert)

    provider = GeminiProvider(api_key="test_key", client=mock_gemini_client)
    analyst = SecurityAnalyst(provider=provider, event_store=event_store, report_store=report_store)

    report = analyst.investigate_incident("inc_gemini_01")

    assert report.report_id is not None
    assert report.incident_id == "inc_gemini_01"
    assert report.analyst_model == "gemini-3.8-flash"
    assert len(report.timeline) == 1
    assert report.timeline[0].event_id == "evt_1"
    assert len(report.confirmed_observations) == 1
    assert report.confirmed_observations[0].evidence_ids == ["evt_1"]

    # Verify report was automatically persisted
    stored = report_store.get_report(report.report_id)
    assert stored is not None
    assert stored.report_id == report.report_id


def test_shield_enforcement_independent_of_gemini_failure():
    """Verifies that deterministic Shield enforcement functions normally even if Gemini fails completely."""
    failing_client = MagicMock()
    failing_client.models.generate_content.side_effect = Exception("503 Service Unavailable: Gemini outage")

    failing_gemini = GeminiProvider(api_key="test_key", client=failing_client, max_retries=0)
    event_store = SQLiteEventStore(db_path=":memory:")
    analyst = SecurityAnalyst(provider=failing_gemini, event_store=event_store)

    shield = Shield(
        audit_store=SQLiteAuditStore(db_path=":memory:"),
        review_store=SQLiteReviewStore(db_path=":memory:"),
        event_store=event_store,
        analyst=analyst,
    )
    shield.registry.register("search_product", lambda args: {"items": ["book"]})

    # 1. Deterministic authorization succeeds
    dec_allow = shield.authorize("shopping_agent", "search_product", {"query": "book"})
    assert dec_allow.allowed is True

    # 2. Deterministic policy blocks disallowed action
    dec_block = shield.authorize("shopping_agent", "refund_order", {"amount": 500})
    assert dec_block.allowed is False

    # 3. Deterministic execution succeeds
    res = shield.execute("shopping_agent", "search_product", {"query": "book"})
    assert res.execution_status == ExecutionStatus.EXECUTED
    assert res.tool_result == {"items": ["book"]}

    # 4. Analyst directly raises ProviderError without breaking Shield state
    with pytest.raises(ProviderError, match="Gemini provider failure"):
        analyst.analyze_events(events=[
            SecurityEvent(event_id="e1", agent_id="shopping_agent", tool="search_product")
        ])


# =====================================================================
# 6. Verification Audit Regression Tests (Checklist 1-8)
# =====================================================================

def test_gemini_provider_redacts_urls_and_multiline_secrets(mock_gemini_client):
    """Verifies that secrets in URLs (userinfo and query params) and multiline strings are redacted."""
    provider = GeminiProvider(api_key="test_key", client=mock_gemini_client)

    telemetry_with_urls = (
        "Webhook request to https://admin:SecretPass123!@api.internal/v1/trigger\n"
        "Callback sent to https://events.corp/hook?token=SuperSecretCallbackToken999&status=active\n"
        "Database connection string postgresql://dbuser:MyDatabaseSecret456@db.internal:5432/app"
    )

    provider.generate_analysis(telemetry_with_urls, "System prompt")

    call_kwargs = mock_gemini_client.models.generate_content.call_args.kwargs
    contents = call_kwargs["contents"]

    assert "SecretPass123!" not in contents
    assert "SuperSecretCallbackToken999" not in contents
    assert "MyDatabaseSecret456" not in contents
    assert "https://admin:[REDACTED]@api.internal/v1/trigger" in contents
    assert "hook?token=[REDACTED]&status=active" in contents
    assert "postgresql://dbuser:[REDACTED]@db.internal:5432/app" in contents


def test_gemini_provider_retry_after_header_handling(mock_gemini_client):
    """Verifies that Retry-After header duration is extracted and respected during backoff."""
    rate_limit_err = Exception("429 ResourceExhausted: rate limit exceeded")
    rate_limit_err.headers = {"retry-after": "0.05"}

    valid_response = MagicMock(text=json.dumps({"incident_summary": "Resolved", "threat_assessment": "Threat"}))
    mock_gemini_client.models.generate_content.side_effect = [rate_limit_err, valid_response]

    provider = GeminiProvider(api_key="test_key", client=mock_gemini_client, max_retries=2, backoff_factor=10.0)

    with patch("time.sleep") as mock_sleep:
        res = provider.generate_analysis("prompt", "system")

        assert "Resolved" in res
        # Must have slept for the 0.05s specified in Retry-After rather than 10.0s backoff factor
        mock_sleep.assert_called_once_with(0.05)


def test_gemini_provider_retry_after_exceeding_timeout_aborts(mock_gemini_client):
    """Verifies that Retry-After duration exceeding client timeout budget aborts immediately."""
    rate_limit_err = Exception("429 ResourceExhausted: please wait")
    rate_limit_err.headers = {"retry-after": "60.0"}  # 60s exceeds timeout of 10s

    mock_gemini_client.models.generate_content.side_effect = rate_limit_err

    provider = GeminiProvider(api_key="test_key", client=mock_gemini_client, timeout=10.0, max_retries=3)

    with patch("time.sleep") as mock_sleep:
        with pytest.raises(ProviderError, match="Gemini rate limit or quota exceeded"):
            provider.generate_analysis("prompt", "system")

        # Must not sleep and must not loop retrying if Retry-After exceeds timeout budget
        mock_sleep.assert_not_called()
        assert mock_gemini_client.models.generate_content.call_count == 1


def test_gemini_provider_safety_finish_reason_handling(mock_gemini_client):
    """Verifies that responses blocked by safety filters raise ProviderError."""
    blocked_response = MagicMock()
    mock_candidate = MagicMock()
    mock_candidate.finish_reason = "SAFETY"
    blocked_response.candidates = [mock_candidate]
    blocked_response.text = ""

    mock_gemini_client.models.generate_content.return_value = blocked_response

    provider = GeminiProvider(api_key="test_key", client=mock_gemini_client)

    with pytest.raises(ProviderError, match="blocked by safety filters"):
        provider.generate_analysis("prompt", "system")


def test_gemini_provider_truncated_response_handling(mock_gemini_client):
    """Verifies that truncated mid-JSON output safely fails schema validation in SecurityAnalyst."""
    truncated_response = MagicMock(text='{"incident_summary": "Truncated investigation...')
    mock_gemini_client.models.generate_content.return_value = truncated_response

    provider = GeminiProvider(api_key="test_key", client=mock_gemini_client)
    analyst = SecurityAnalyst(provider=provider)

    event = SecurityEvent(event_id="e1", agent_id="agent1", tool="search_product")

    with pytest.raises(AnalysisValidationError, match="Malformed JSON response from model"):
        analyst.analyze_events(events=[event])


def test_gemini_provider_schema_invalid_handling(mock_gemini_client):
    """Verifies that schema-invalid JSON output (missing required fields) fails validation safely."""
    invalid_schema_response = MagicMock(text='{"random_key": "not a report"}')
    mock_gemini_client.models.generate_content.return_value = invalid_schema_response

    provider = GeminiProvider(api_key="test_key", client=mock_gemini_client)
    analyst = SecurityAnalyst(provider=provider)

    event = SecurityEvent(event_id="e1", agent_id="agent1", tool="search_product")

    with pytest.raises(AnalysisValidationError, match="Analysis report schema validation failed"):
        analyst.analyze_events(events=[event])


def test_gemini_provider_evidence_grounding_strips_fabricated_ids(mock_gemini_client):
    """Verifies that fabricated event and alert IDs returned by the model are stripped out and logged."""
    hallucinated_report = {
        "incident_summary": "Summary with fake references",
        "threat_assessment": "Threat details",
        "severity_assessment": "MEDIUM",
        "supporting_event_ids": ["real_evt", "fake_evt_999"],
        "supporting_alert_ids": ["fake_alt_888"],
        "suspicious_behavior": ["Anomaly"],
        "recommended_investigation_steps": ["Check"],
        "confidence": 0.8,
        "uncertainty_factors": [],
        "confirmed_observations": [
            {"statement": "Fact", "evidence_ids": ["real_evt", "fake_evt_999"]}
        ],
        "potential_threats": [
            {"statement": "Threat", "evidence_ids": ["fake_alt_888"]}
        ],
        "hypotheses": ["Hypo"],
        "missing_evidence": [],
    }
    mock_gemini_client.models.generate_content.return_value = MagicMock(text=json.dumps(hallucinated_report))

    provider = GeminiProvider(api_key="test_key", client=mock_gemini_client)
    analyst = SecurityAnalyst(provider=provider)

    real_event = SecurityEvent(event_id="real_evt", agent_id="agent1", tool="search_product")
    report = analyst.analyze_events(events=[real_event])

    # Hallucinated IDs must be stripped from supporting lists and findings
    assert report.supporting_event_ids == ["real_evt"]
    assert report.supporting_alert_ids == []
    assert report.confirmed_observations[0].evidence_ids == ["real_evt"]
    assert report.potential_threats[0].evidence_ids == []

    # Uncertainty factors must record the stripped hallucinated IDs
    assert any("fake_evt_999" in u for u in report.uncertainty_factors)
    assert any("fake_alt_888" in u for u in report.uncertainty_factors)


def test_production_no_silent_mock_fallback_on_missing_key(monkeypatch):
    """Verifies that AGENTSHIELD_ANALYST_PROVIDER=gemini without key raises ProviderError instead of silent mock."""
    monkeypatch.setenv("AGENTSHIELD_ANALYST_PROVIDER", "gemini")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("AGENTSHIELD_ALLOW_MOCK_FALLBACK", raising=False)

    with pytest.raises(ProviderError, match=r"(?i)GEMINI_API_KEY is not configured"):
        create_app(audit_db_path=":memory:")


def test_production_no_silent_mock_fallback_on_invalid_key(monkeypatch):
    """Verifies that invalid key initialization failure raises ProviderError without silent fallback."""
    monkeypatch.setenv("GEMINI_API_KEY", "invalid_dummy_key")
    monkeypatch.delenv("AGENTSHIELD_ALLOW_MOCK_FALLBACK", raising=False)

    with patch("agentshield.analyst.providers.gemini.genai.Client", side_effect=Exception("Invalid API key")):
        with pytest.raises(ProviderError, match="Failed to initialize configured Gemini provider"):
            create_app(audit_db_path=":memory:")


def test_production_requires_configured_provider(monkeypatch):
    """Verifies that AGENTSHIELD_ENV=production raises ProviderError if no LLM provider is configured."""
    monkeypatch.setenv("AGENTSHIELD_ENV", "production")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("AGENTSHIELD_ANALYST_PROVIDER", raising=False)
    monkeypatch.delenv("AGENTSHIELD_ALLOW_MOCK_FALLBACK", raising=False)

    with pytest.raises(ProviderError, match="Production environment requires a configured LLM provider"):
        create_app(audit_db_path=":memory:")


def test_explicit_mock_fallback_allowed_when_configured(monkeypatch):
    """Verifies that AGENTSHIELD_ALLOW_MOCK_FALLBACK=true allows fallback to mock when Gemini fails."""
    monkeypatch.setenv("GEMINI_API_KEY", "bad_key")
    monkeypatch.setenv("AGENTSHIELD_ALLOW_MOCK_FALLBACK", "true")

    with patch("agentshield.analyst.providers.gemini.genai.Client", side_effect=Exception("Connection refused")):
        app = create_app(audit_db_path=":memory:")
        # Should initialize successfully with MockLLMProvider
        assert isinstance(app.state.shield.analyst.provider, MockLLMProvider)


def test_gemini_provider_sanitizes_complex_error_credentials(mock_gemini_client):
    """Verifies that complex tokens, URLs, and Bearer tokens in errors are sanitized."""
    mock_gemini_client.models.generate_content.side_effect = Exception(
        "Request failed: Authorization=Bearer secret_bearer_token_12345 "
        "url=https://user:Pass98765@corp.internal/v1?token=query_tok_999"
    )

    provider = GeminiProvider(api_key="test_key", client=mock_gemini_client, max_retries=0)

    with pytest.raises(ProviderError) as exc_info:
        provider.generate_analysis("prompt", "system")

    err = str(exc_info.value)
    assert "secret_bearer_token_12345" not in err
    assert "Pass98765" not in err
    assert "query_tok_999" not in err
    assert "[REDACTED" in err


# =====================================================================
# 7. Gemini Developer API Structured Output Schema Compatibility Tests
# =====================================================================

def test_build_gemini_schema_removes_additional_properties_and_unconstrained_objects():
    """Verifies that build_gemini_schema sanitizes Pydantic schemas for Gemini Developer API mode:
    1. Removes all additionalProperties and additional_properties keys.
    2. Prunes unconstrained object fields without defined properties (raw_metadata).
    3. Preserves all required fields and enum values.
    """
    adapted = build_gemini_schema(AnalysisReport)

    assert "additionalProperties" not in str(adapted)
    assert "additional_properties" not in str(adapted)
    assert "$schema" not in str(adapted)

    # raw_metadata must be pruned from generation schema
    assert "raw_metadata" not in adapted.get("properties", {})

    # Required fields must remain intact
    assert adapted.get("required") == [
        "incident_summary",
        "threat_assessment",
        "severity_assessment",
        "confidence",
    ]

    # Enums must be preserved
    defs = adapted.get("$defs", {})
    severity_def = defs.get("AnalystSeverity", {})
    assert severity_def.get("enum") == ["LOW", "MEDIUM", "HIGH", "CRITICAL"]


def test_gemini_developer_api_mode_t_schema_transformation():
    """Verifies that the adapted schema passes google-genai SDK's t_schema transformation
    in Developer API mode (client.vertexai = False) without raising the ValueError.
    Also verifies that raw AnalysisReport raises the ValueError in Developer API mode.
    """
    from google.genai import Client
    from google.genai._transformers import t_schema

    client = Client(api_key="test-api-key")
    assert client.vertexai is False

    # 1. Raw AnalysisReport FAILS in Developer API mode due to raw_metadata's additionalProperties
    with pytest.raises(ValueError, match="additionalProperties is only supported in Gemini Enterprise Agent Platform mode"):
        t_schema(client._api_client, AnalysisReport)

    # 2. Adapted schema SUCCEEDS in Developer API mode
    adapted = build_gemini_schema(AnalysisReport)
    ts = t_schema(client._api_client, adapted)

    assert ts is not None
    # Verify no additionalProperties exists in serialized schema
    dump = ts.model_dump(exclude_none=True)
    assert "additionalProperties" not in str(dump)
    assert "additional_properties" not in str(dump)
    assert "raw_metadata" not in dump.get("properties", {})
    assert ts.required == ["incident_summary", "threat_assessment", "severity_assessment", "confidence"]


def test_gemini_provider_timeout_deterministic_conversion(mock_gemini_client):
    """Verifies explicit deterministic conversion of seconds to milliseconds for google-genai HttpOptions."""
    from google.genai import types

    # 45 seconds -> 45000 milliseconds
    p45 = GeminiProvider(api_key="test-api-key", client=mock_gemini_client, timeout=45.0)
    assert p45.timeout == 45.0
    assert p45.timeout_ms == 45000

    # 0.5 seconds -> 500 milliseconds
    p05 = GeminiProvider(api_key="test-api-key", client=mock_gemini_client, timeout=0.5)
    assert p05.timeout == 0.5
    assert p05.timeout_ms == 500

    # 30 seconds default -> 30000 milliseconds
    p_default = GeminiProvider(api_key="test-api-key", client=mock_gemini_client)
    assert p_default.timeout == 30.0
    assert p_default.timeout_ms == 30000


def test_gemini_provider_invalid_timeout_values(mock_gemini_client):
    """Verifies that None, zero, negative, and non-numeric timeouts fail clearly with ValueError."""
    # timeout = None
    with pytest.raises(ValueError, match="positive number"):
        GeminiProvider(api_key="test-key", client=mock_gemini_client, timeout=None)

    # timeout = 0
    with pytest.raises(ValueError, match="positive number"):
        GeminiProvider(api_key="test-key", client=mock_gemini_client, timeout=0)

    # timeout = 0.0
    with pytest.raises(ValueError, match="positive number"):
        GeminiProvider(api_key="test-key", client=mock_gemini_client, timeout=0.0)

    # timeout negative
    with pytest.raises(ValueError, match="positive number"):
        GeminiProvider(api_key="test-key", client=mock_gemini_client, timeout=-5.0)

    # timeout string non-numeric
    with pytest.raises(ValueError, match="Invalid timeout"):
        GeminiProvider(api_key="test-key", client=mock_gemini_client, timeout="invalid")

    # Environment variable overrides with invalid values
    with patch.dict(os.environ, {"AGENTSHIELD_ANALYST_TIMEOUT": "0"}):
        with pytest.raises(ValueError, match="positive number"):
            GeminiProvider(api_key="test-key", client=mock_gemini_client)

    with patch.dict(os.environ, {"AGENTSHIELD_ANALYST_TIMEOUT": "-15"}):
        with pytest.raises(ValueError, match="positive number"):
            GeminiProvider(api_key="test-key", client=mock_gemini_client)

    with patch.dict(os.environ, {"AGENTSHIELD_ANALYST_TIMEOUT": "not_a_float"}):
        with pytest.raises(ValueError, match="Invalid timeout"):
            GeminiProvider(api_key="test-key", client=mock_gemini_client)

    # Dynamic mutation validation on property
    valid_p = GeminiProvider(api_key="test-key", client=mock_gemini_client, timeout=10.0)
    valid_p.timeout = -1.0
    with pytest.raises(ValueError, match="positive number"):
        _ = valid_p.timeout_ms


def test_gemini_provider_timeout_propagation_into_sdk_config(mock_gemini_client):
    """Verifies that converted milliseconds are correctly propagated into google-genai SDK configuration."""
    from google.genai import types

    valid_response = MagicMock(text=json.dumps({"incident_summary": "Summary", "threat_assessment": "Threat"}))
    mock_gemini_client.models.generate_content.return_value = valid_response

    # Test 45 seconds -> 45000 ms in generateContent config
    p45 = GeminiProvider(api_key="test-api-key", client=mock_gemini_client, timeout=45.0)
    p45.generate_analysis("prompt 1", "system 1")
    call_args_45 = mock_gemini_client.models.generate_content.call_args
    config_45 = call_args_45.kwargs.get("config")
    assert isinstance(config_45, types.GenerateContentConfig)
    assert config_45.http_options.timeout == 45000

    # Test 0.5 seconds -> 500 ms in generateContent config
    p05 = GeminiProvider(api_key="test-api-key", client=mock_gemini_client, timeout=0.5)
    p05.generate_analysis("prompt 2", "system 2")
    call_args_05 = mock_gemini_client.models.generate_content.call_args
    config_05 = call_args_05.kwargs.get("config")
    assert isinstance(config_05, types.GenerateContentConfig)
    assert config_05.http_options.timeout == 500






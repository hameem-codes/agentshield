"""
Unit tests for AgentShield runtime configuration validation and secret hygiene.
"""

import pytest
from agentshield.config_validation import (
    validate_runtime_config,
    sanitize_url,
    ConfigValidationResult,
)


def test_sanitize_url_masks_passwords():
    """Verify that sanitize_url masks usernames and passwords."""
    raw = "postgresql://myuser:secretpassword123@db.example.com:5432/mydb"
    sanitized = sanitize_url(raw)
    assert "secretpassword123" not in sanitized
    assert "myuser:***@db.example.com:5432/mydb" in sanitized


def test_sanitize_url_handles_none_and_empty():
    """Verify that sanitize_url safely handles None and empty inputs."""
    assert sanitize_url(None) == "<not configured>"
    assert sanitize_url("") == "<not configured>"


def test_validate_default_development_config(monkeypatch):
    """Default development configuration should be valid with SQLite fallback."""
    monkeypatch.setenv("AGENTSHIELD_ENV", "development")
    monkeypatch.delenv("AGENTSHIELD_ADMIN_KEY", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("AGENTSHIELD_DATABASE_URL", raising=False)

    res = validate_runtime_config()
    assert res.valid is True
    assert res.sanitized_summary["storage_backend"] == "sqlite"
    assert any("AGENTSHIELD_ADMIN_KEY is not set" in w for w in res.warnings)


def test_validate_production_missing_admin_key_fails(monkeypatch):
    """Production mode must fail validation if AGENTSHIELD_ADMIN_KEY is missing."""
    monkeypatch.setenv("AGENTSHIELD_ENV", "production")
    monkeypatch.delenv("AGENTSHIELD_ADMIN_KEY", raising=False)

    res = validate_runtime_config(strict_production=True)
    assert res.valid is False
    assert any("AGENTSHIELD_ADMIN_KEY is not configured" in e for e in res.errors)


def test_validate_postgres_missing_url_fails(monkeypatch):
    """Storage backend 'postgres' must fail if no database URL is supplied."""
    monkeypatch.setenv("AGENTSHIELD_STORAGE_BACKEND", "postgres")
    monkeypatch.delenv("AGENTSHIELD_DATABASE_URL", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)

    res = validate_runtime_config()
    assert res.valid is False
    assert any("neither AGENTSHIELD_DATABASE_URL nor DATABASE_URL is set" in e for e in res.errors)


def test_validate_malformed_postgres_url_redacts_credentials(monkeypatch):
    """Malformed postgres URL error message must never print the password."""
    monkeypatch.setenv("AGENTSHIELD_STORAGE_BACKEND", "postgres")
    monkeypatch.setenv("DATABASE_URL", "http://user:supersecretpass@example.com/db")

    res = validate_runtime_config()
    assert res.valid is False
    assert any("Unsupported database scheme" in e for e in res.errors)

    # Check that the secret password is not in any error or summary
    all_text = " ".join(res.errors + res.warnings + list(res.sanitized_summary.values()))
    assert "supersecretpass" not in all_text


def test_validate_gemini_missing_key_fails(monkeypatch):
    """Gemini analyst provider must fail if GEMINI_API_KEY is missing or empty."""
    monkeypatch.setenv("AGENTSHIELD_ANALYST_PROVIDER", "gemini")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    res = validate_runtime_config()
    assert res.valid is False
    assert any("GEMINI_API_KEY is missing or empty" in e for e in res.errors)


def test_validate_gemini_key_with_whitespace_fails(monkeypatch):
    """GEMINI_API_KEY containing invalid newline or whitespace must fail without echoing key."""
    secret_key = "AIzaSySecretWith\nNewline"
    monkeypatch.setenv("AGENTSHIELD_ANALYST_PROVIDER", "gemini")
    monkeypatch.setenv("GEMINI_API_KEY", secret_key)

    res = validate_runtime_config()
    assert res.valid is False
    assert any("invalid whitespace" in e for e in res.errors)

    # Check key is not echoed
    all_text = " ".join(res.errors + res.warnings)
    assert secret_key not in all_text


def test_validate_negative_numeric_limits_fail(monkeypatch):
    """Negative execution timeout or budgets must be rejected."""
    monkeypatch.setenv("AGENTSHIELD_MAX_TOOL_EXECUTION_SECONDS", "-5.0")
    monkeypatch.setenv("AGENTSHIELD_MAX_TOOL_CALLS_PER_SESSION", "0")

    res = validate_runtime_config()
    assert res.valid is False
    assert any("AGENTSHIELD_MAX_TOOL_EXECUTION_SECONDS" in e for e in res.errors)
    assert any("AGENTSHIELD_MAX_TOOL_CALLS_PER_SESSION" in e for e in res.errors)


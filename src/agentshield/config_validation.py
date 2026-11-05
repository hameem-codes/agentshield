"""
AgentShield Runtime Configuration Validator.

Inspects environment variables and runtime settings, validates parameters,
ensures production requirements are met, and provides actionable error and warning
messages WITHOUT printing or leaking credentials, API keys, or connection secrets.
"""

import os
import re
import sys
from dataclasses import dataclass, field
from typing import Dict, List, Optional
from urllib.parse import urlparse


@dataclass
class ConfigValidationResult:
    """Outcome of configuration inspection."""
    valid: bool
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    sanitized_summary: Dict[str, str] = field(default_factory=dict)


def sanitize_url(url: Optional[str]) -> str:
    """Masks credentials in a database URL for safe logging/diagnostics."""
    if not url:
        return "<not configured>"
    try:
        parsed = urlparse(url)
        netloc = parsed.hostname or "unknown"
        if parsed.port:
            netloc = f"{netloc}:{parsed.port}"
        if parsed.username:
            netloc = f"{parsed.username}:***@{netloc}"
        return f"{parsed.scheme}://{netloc}{parsed.path}"
    except Exception:
        return "<malformed URL redacted>"


def validate_runtime_config(strict_production: Optional[bool] = None) -> ConfigValidationResult:
    """Inspects all AgentShield environment variables and validates their safety.

    Args:
        strict_production: If True, treats missing production secrets as fatal errors.
                           If None, auto-detected from AGENTSHIELD_ENV or ENVIRONMENT.

    Returns:
        ConfigValidationResult with validation status, sanitized messages, and summary.
    """
    errors: List[str] = []
    warnings: List[str] = []
    summary: Dict[str, str] = {}

    # 1. Environment & Mode
    raw_env = (os.environ.get("AGENTSHIELD_ENV") or os.environ.get("ENVIRONMENT") or "development").strip().lower()
    is_prod = strict_production if strict_production is not None else (raw_env in ("production", "prod"))
    summary["environment"] = "production" if is_prod else raw_env

    raw_readonly = (os.environ.get("AGENTSHIELD_READONLY") or os.environ.get("AGENTSHIELD_READ_ONLY") or "false").strip().lower()
    is_readonly = raw_readonly in ("true", "1", "yes")
    summary["read_only_mode"] = str(is_readonly).lower()

    # 2. Administrative Authentication & Sessions
    admin_key = os.environ.get("AGENTSHIELD_ADMIN_KEY", "").strip()
    session_secret = os.environ.get("AGENTSHIELD_SESSION_SECRET", "").strip()

    if not admin_key:
        if is_prod:
            errors.append(
                "AGENTSHIELD_ADMIN_KEY is not configured. Production deployments require a 32+ character admin key."
            )
        else:
            warnings.append(
                "AGENTSHIELD_ADMIN_KEY is not set. Administrative endpoints will be disabled or reject requests (403)."
            )
        summary["admin_auth"] = "unconfigured"
    else:
        if len(admin_key) < 16:
            warnings.append(
                f"AGENTSHIELD_ADMIN_KEY has low entropy ({len(admin_key)} characters). Minimum 32 characters recommended."
            )
            summary["admin_auth"] = "configured (weak)"
        else:
            summary["admin_auth"] = "configured"

    if not session_secret:
        if is_prod:
            warnings.append(
                "AGENTSHIELD_SESSION_SECRET is unset. Sessions will derive HMAC secret from AGENTSHIELD_ADMIN_KEY."
            )
        summary["session_secret"] = "derived"
    else:
        if len(session_secret) < 16:
            warnings.append(
                f"AGENTSHIELD_SESSION_SECRET has low entropy ({len(session_secret)} chars). Recommended 32+ chars."
            )
        summary["session_secret"] = "configured"

    # 3. Storage Backend & Database
    backend = (os.environ.get("AGENTSHIELD_STORAGE_BACKEND") or "sqlite").strip().lower()
    db_url = os.environ.get("AGENTSHIELD_DATABASE_URL") or os.environ.get("DATABASE_URL")

    if backend not in ("sqlite", "postgres", "postgresql"):
        errors.append(f"Invalid AGENTSHIELD_STORAGE_BACKEND '{backend}'. Supported: 'sqlite' or 'postgres'.")
        summary["storage_backend"] = f"invalid ({backend})"
    else:
        effective_backend = "postgres" if backend in ("postgres", "postgresql") or db_url else "sqlite"
        summary["storage_backend"] = effective_backend

        if effective_backend == "postgres":
            if not db_url:
                errors.append(
                    "Storage backend 'postgres' selected, but neither AGENTSHIELD_DATABASE_URL nor DATABASE_URL is set."
                )
                summary["database"] = "missing URL"
            else:
                summary["database"] = sanitize_url(db_url)
                try:
                    parsed = urlparse(db_url.strip())
                    if parsed.scheme not in ("postgresql", "postgres"):
                        errors.append(
                            f"Unsupported database scheme '{parsed.scheme}'. Must be 'postgresql://' or 'postgres://'."
                        )
                    if not parsed.hostname:
                        errors.append("PostgreSQL connection URL is missing a valid hostname.")
                    if parsed.port and not (1 <= parsed.port <= 65535):
                        errors.append(f"PostgreSQL port '{parsed.port}' is out of valid range (1-65535).")
                except Exception as e:
                    errors.append(f"Malformed PostgreSQL database URL: {type(e).__name__}")

            # Check driver availability
            from agentshield.storage.config import check_driver_available
            has_driver, driver_name = check_driver_available()
            if not has_driver:
                errors.append("PostgreSQL driver ('psycopg' or 'psycopg2') is not installed in the environment.")
            else:
                summary["postgres_driver"] = driver_name or "available"

    # 4. LLM Analyst & Gemini Provider
    provider = (os.environ.get("AGENTSHIELD_ANALYST_PROVIDER") or "mock").strip().lower()
    gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()
    allow_mock = (os.environ.get("AGENTSHIELD_ALLOW_MOCK_FALLBACK") or "true").strip().lower() in ("true", "1", "yes")

    summary["analyst_provider"] = provider
    summary["mock_fallback_allowed"] = str(allow_mock).lower()

    if provider == "gemini" or gemini_key:
        if not gemini_key:
            errors.append("AGENTSHIELD_ANALYST_PROVIDER is 'gemini', but GEMINI_API_KEY is missing or empty.")
            summary["gemini_key"] = "missing"
        else:
            if any(c in gemini_key for c in (" ", "\t", "\n", "\r")):
                errors.append("GEMINI_API_KEY contains invalid whitespace characters.")
                summary["gemini_key"] = "invalid format"
            else:
                summary["gemini_key"] = "configured"
    elif is_prod and not allow_mock:
        errors.append(
            "Production environment requires an LLM provider (set GEMINI_API_KEY) or AGENTSHIELD_ALLOW_MOCK_FALLBACK=true."
        )

    # 5. Reliability & Rate Limiting Settings
    from agentshield.reliability.config import parse_rate_limit

    # Rate limit syntax check
    for key, name in [
        ("AGENTSHIELD_RATE_LIMIT_AGENT", "Agent rate limit"),
        ("AGENTSHIELD_RATE_LIMIT_TOOL", "Tool rate limit"),
        ("AGENTSHIELD_RATE_LIMIT_PUBLIC", "Public rate limit"),
        ("AGENTSHIELD_RATE_LIMIT_ANALYST", "Analyst rate limit"),
    ]:
        val = os.environ.get(key)
        if val:
            try:
                count, window = parse_rate_limit(val)
                if count <= 0 or window <= 0:
                    warnings.append(f"{name} ({key}='{val}') parsed to invalid non-positive value.")
            except Exception as e:
                warnings.append(f"{name} ({key}='{val}') has invalid format: {e}")

    # Numeric budgets
    def _validate_positive_float(key: str, name: str, default: float) -> None:
        val = os.environ.get(key)
        if val is not None:
            try:
                fval = float(val)
                if fval <= 0:
                    errors.append(f"{name} ({key}) must be a positive number; got {fval}.")
            except ValueError:
                errors.append(f"{name} ({key}) must be a valid numeric float; got '{val}'.")

    def _validate_positive_int(key: str, name: str, default: int) -> None:
        val = os.environ.get(key)
        if val is not None:
            try:
                ival = int(val)
                if ival <= 0:
                    errors.append(f"{name} ({key}) must be a positive integer; got {ival}.")
            except ValueError:
                errors.append(f"{name} ({key}) must be a valid integer; got '{val}'.")

    _validate_positive_float("AGENTSHIELD_MAX_TOOL_EXECUTION_SECONDS", "Tool timeout", 30.0)
    _validate_positive_int("AGENTSHIELD_MAX_TOOL_CALLS_PER_SESSION", "Session tool call limit", 50)
    _validate_positive_int("AGENTSHIELD_MAX_ARGUMENTS_BYTES", "Max arguments bytes", 65536)
    _validate_positive_int("AGENTSHIELD_MAX_BODY_BYTES", "Max request body bytes", 1048576)
    _validate_positive_int("AGENTSHIELD_MAX_TOKEN_BUDGET", "Max token budget", 100000)

    # 6. CORS & Network Origins
    cors_origins = os.environ.get("AGENTSHIELD_CORS_ORIGINS") or os.environ.get("AGENTSHIELD_TRUSTED_ORIGINS")
    if cors_origins:
        origins = [o.strip() for o in cors_origins.split(",") if o.strip()]
        for origin in origins:
            if origin == "*":
                warnings.append("AGENTSHIELD_CORS_ORIGINS contains wildcard '*' which is unsafe for credentialed cookies.")
            elif not (origin.startswith("http://") or origin.startswith("https://")):
                warnings.append(f"CORS origin '{origin}' should specify protocol (http:// or https://).")

    is_valid = len(errors) == 0
    return ConfigValidationResult(
        valid=is_valid,
        errors=errors,
        warnings=warnings,
        sanitized_summary=summary,
    )


def print_config_report() -> int:
    """CLI utility to inspect and print configuration posture."""
    result = validate_runtime_config()
    print("=" * 60)
    print("AgentShield Runtime Configuration Audit Report")
    print("=" * 60)
    print(f"Overall Status: {'[OK] VALID' if result.valid else '[FAIL] CONFIGURATION ERRORS DETECTED'}")
    print("\nSanitized Configuration Summary:")
    for k, v in result.sanitized_summary.items():
        print(f"  {k:25}: {v}")

    if result.errors:
        print(f"\nErrors ({len(result.errors)}):")
        for err in result.errors:
            print(f"  [!] {err}")

    if result.warnings:
        print(f"\nWarnings ({len(result.warnings)}):")
        for warn in result.warnings:
            print(f"  [*] {warn}")

    print("=" * 60)
    return 0 if result.valid else 1


if __name__ == "__main__":
    sys.exit(print_config_report())


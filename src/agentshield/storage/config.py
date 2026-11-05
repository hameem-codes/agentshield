"""
Storage configuration and environment validation for AgentShield.

Manages backend selection (SQLite vs. PostgreSQL), database URL validation,
and fails closed when production persistence is improperly configured.
"""

import os
import re
from typing import Optional, Tuple
from urllib.parse import urlparse


class ConfigurationError(ValueError):
    """Raised when database or storage configuration is invalid."""
    pass


def get_database_url(explicit_url: Optional[str] = None) -> Optional[str]:
    """Retrieves the configured PostgreSQL connection string.

    Checks explicit argument first, then AGENTSHIELD_DATABASE_URL,
    then fallback DATABASE_URL. Returns None if no PostgreSQL URL is configured.
    Raises ConfigurationError if the variable is present but empty.
    """
    if explicit_url is not None:
        val = explicit_url.strip()
        if not val:
            raise ConfigurationError("Database URL cannot be empty")
        return val

    if "AGENTSHIELD_DATABASE_URL" in os.environ:
        val = os.environ["AGENTSHIELD_DATABASE_URL"].strip()
        if not val:
            raise ConfigurationError("AGENTSHIELD_DATABASE_URL environment variable cannot be empty")
        return val

    if "DATABASE_URL" in os.environ:
        val = os.environ["DATABASE_URL"].strip()
        if not val:
            raise ConfigurationError("DATABASE_URL environment variable cannot be empty")
        return val

    return None


def validate_database_url(url: str) -> None:
    """Validates the PostgreSQL connection URL format and scheme.

    Raises ConfigurationError if the URL is invalid or uses an unsupported scheme.
    """
    if not url or not isinstance(url, str):
        raise ConfigurationError("Database URL must be a non-empty string")

    stripped = url.strip()
    if not (stripped.startswith("postgresql://") or stripped.startswith("postgres://")):
        # Extract scheme for clear error reporting
        parsed = urlparse(stripped)
        scheme = parsed.scheme or "unknown"
        raise ConfigurationError(
            f"Unsupported database scheme '{scheme}'. Only 'postgresql://' and 'postgres://' are supported."
        )

    parsed = urlparse(stripped)
    if not parsed.hostname:
        raise ConfigurationError("Database URL must specify a valid hostname")


def get_storage_backend(explicit_url: Optional[str] = None) -> str:
    """Determines active storage backend: 'postgres' or 'sqlite'."""
    url = get_database_url(explicit_url)
    if url:
        validate_database_url(url)
        return "postgres"
    return "sqlite"


def check_driver_available() -> Tuple[bool, Optional[str]]:
    """Checks whether a supported PostgreSQL driver (psycopg 3 or psycopg2) is installed."""
    try:
        import psycopg  # type: ignore # noqa: F401
        return True, "psycopg"
    except ImportError:
        pass

    try:
        import psycopg2  # type: ignore # noqa: F401
        return True, "psycopg2"
    except ImportError:
        pass

    return False, None

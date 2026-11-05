"""
Correlation ID and tracing utilities for AgentShield.

Provides thread/context-safe request tracing, correlation normalization,
and sanitization across API requests, authorization decisions, tool executions,
security events, and audit ledgers without exposing sensitive data.
"""

import contextvars
import re
from typing import Optional
import uuid

# Valid correlation ID pattern: alphanumeric with safe delimiters, 1-128 chars
CORRELATION_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_\-\.:]{1,128}$")

# Context variable for request-scoped correlation ID
_current_correlation_id: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "current_correlation_id", default=None
)


def generate_trace_id() -> str:
    """Generates a unique, non-guessable trace ID."""
    return f"trc_{uuid.uuid4().hex[:12]}"


def generate_correlation_id() -> str:
    """Generates a unique, non-guessable correlation ID."""
    return f"corr_{uuid.uuid4().hex[:12]}"


def sanitize_correlation_id(raw_id: Optional[str]) -> str:
    """Validates and sanitizes a correlation ID string.

    If raw_id is missing, empty, or does not match safe pattern,
    generates a clean new correlation ID.
    """
    if not raw_id or not isinstance(raw_id, str):
        return generate_correlation_id()
    cleaned = raw_id.strip()
    if CORRELATION_ID_PATTERN.match(cleaned):
        return cleaned
    return generate_correlation_id()


def set_current_correlation_id(correlation_id: Optional[str]) -> None:
    """Sets the correlation ID for the current async context or thread."""
    if correlation_id is None:
        _current_correlation_id.set(None)
    else:
        _current_correlation_id.set(sanitize_correlation_id(correlation_id))


def get_current_correlation_id() -> Optional[str]:
    """Gets the correlation ID for the current context, if set."""
    return _current_correlation_id.get()


def clear_current_correlation_id() -> None:
    """Clears the correlation ID for the current context."""
    _current_correlation_id.set(None)


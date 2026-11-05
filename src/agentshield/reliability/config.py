"""
Configuration and validation for AgentShield reliability controls.

Covers execution limits, distributed rate limiting, tool loop detection thresholds,
and external provider circuit breaker policies.
"""

from dataclasses import dataclass
import os
import re
from typing import Tuple


def parse_rate_limit(spec: str) -> Tuple[int, float]:
    """Parses rate limit specifications such as '120/60s', '20/minute', '10/s', or '100'.

    Returns (max_requests, window_seconds).
    """
    if not spec or not isinstance(spec, str):
        return (120, 60.0)

    spec = spec.strip().lower()
    if "/" not in spec:
        try:
            return (int(spec), 60.0)
        except ValueError:
            return (120, 60.0)

    parts = spec.split("/", 1)
    try:
        count = int(parts[0].strip())
    except ValueError:
        count = 120

    unit = parts[1].strip()
    match = re.match(r"^(\d+(?:\.\d+)?)\s*([a-z]+)?$", unit)
    if match:
        qty = float(match.group(1))
        unit_type = match.group(2) or "s"
        if unit_type in ("s", "sec", "second", "seconds"):
            window = qty
        elif unit_type in ("m", "min", "minute", "minutes"):
            window = qty * 60.0
        elif unit_type in ("h", "hr", "hour", "hours"):
            window = qty * 3600.0
        else:
            window = qty
    else:
        if unit in ("m", "min", "minute", "minutes"):
            window = 60.0
        elif unit in ("s", "sec", "second", "seconds"):
            window = 1.0
        elif unit in ("h", "hr", "hour", "hours"):
            window = 3600.0
        else:
            window = 60.0

    return (max(1, count), max(0.1, window))


@dataclass
class ReliabilityConfig:
    """Consolidated configuration for reliability controls."""
    # 1. Execution limits
    max_tool_execution_seconds: float = 30.0
    max_tool_calls_per_session: int = 50
    max_arguments_bytes: int = 65536  # 64 KB
    max_token_budget: int = 100000

    # 2. Rate limiting (count, window_seconds)
    rate_limit_public: str = "120/60s"
    rate_limit_analyst: str = "20/60s"
    rate_limit_agent: str = "60/60s"
    rate_limit_tool: str = "30/60s"

    # 3. Loop detection
    loop_consecutive_limit: int = 3
    loop_cycle_limit: int = 2

    # 4. Circuit breaker
    cb_failure_threshold: int = 3
    cb_recovery_timeout: float = 30.0
    cb_half_open_success_threshold: int = 1

    @classmethod
    def from_env(cls) -> "ReliabilityConfig":
        """Loads configuration from environment variables with sensible defaults."""
        def _get_float(key: str, default: float) -> float:
            val = os.environ.get(key)
            if val is not None:
                try:
                    return float(val)
                except ValueError:
                    pass
            return default

        def _get_int(key: str, default: int) -> int:
            val = os.environ.get(key)
            if val is not None:
                try:
                    return int(val)
                except ValueError:
                    pass
            return default

        return cls(
            max_tool_execution_seconds=_get_float("AGENTSHIELD_MAX_TOOL_EXECUTION_SECONDS", 30.0),
            max_tool_calls_per_session=_get_int("AGENTSHIELD_MAX_TOOL_CALLS_PER_SESSION", 50),
            max_arguments_bytes=_get_int("AGENTSHIELD_MAX_ARGUMENTS_BYTES", 65536),
            max_token_budget=_get_int("AGENTSHIELD_MAX_TOKEN_BUDGET", 100000),
            rate_limit_public=os.environ.get("AGENTSHIELD_RATE_LIMIT_PUBLIC", "120/60s"),
            rate_limit_analyst=os.environ.get("AGENTSHIELD_RATE_LIMIT_ANALYST", "20/60s"),
            rate_limit_agent=os.environ.get("AGENTSHIELD_RATE_LIMIT_AGENT", "60/60s"),
            rate_limit_tool=os.environ.get("AGENTSHIELD_RATE_LIMIT_TOOL", "30/60s"),
            loop_consecutive_limit=_get_int("AGENTSHIELD_LOOP_CONSECUTIVE_LIMIT", 3),
            loop_cycle_limit=_get_int("AGENTSHIELD_LOOP_CYCLE_LIMIT", 2),
            cb_failure_threshold=_get_int("AGENTSHIELD_CB_FAILURE_THRESHOLD", 3),
            cb_recovery_timeout=_get_float("AGENTSHIELD_CB_RECOVERY_TIMEOUT", 30.0),
            cb_half_open_success_threshold=_get_int("AGENTSHIELD_CB_HALF_OPEN_SUCCESSES", 1),
        )

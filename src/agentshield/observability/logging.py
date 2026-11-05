"""
Standardized structured operational logging for AgentShield.

Maintains operational logs strictly separated from the cryptographic audit ledger.
All logged payloads, arguments, and context are automatically redacted of secrets,
tokens, credentials, and sensitive keys.
"""

from collections import deque
from datetime import datetime, timezone
import json
import logging
import threading
from typing import Any, Dict, List, Optional

from agentshield.audit.store import redact_sensitive_data
from agentshield.observability.correlation import get_current_correlation_id

_OPERATIONAL_LOGGER_NAME = "agentshield.operational"


class StructuredLogger:
    """Thread-safe operational logger that emits structured JSON records and
    maintains an in-memory ring buffer for telemetry visibility and testing."""

    def __init__(self, buffer_size: int = 500, log_to_stdout: bool = False, name: Optional[str] = None):
        self._buffer: deque = deque(maxlen=buffer_size)
        self._lock = threading.Lock()
        self._log_to_stdout = log_to_stdout
        self.name = name or _OPERATIONAL_LOGGER_NAME
        self._logger = logging.getLogger(self.name)

    def _record(
        self,
        event_name: str,
        component: str,
        outcome: str,
        correlation_id: Optional[str] = None,
        trace_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        level: int = logging.INFO,
    ) -> Dict[str, Any]:
        corr_id = correlation_id or get_current_correlation_id()
        safe_details = redact_sensitive_data(details or {})

        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "logger": self.name,
            "component": component,
            "event": event_name,
            "outcome": outcome,
            "correlation_id": corr_id,
            "trace_id": trace_id or "",
            "details": safe_details,
        }

        with self._lock:
            self._buffer.append(entry)

        if self._log_to_stdout or self._logger.isEnabledFor(level):
            try:
                line = json.dumps(entry, separators=(",", ":"))
                self._logger.log(level, line)
            except Exception:
                pass

        return entry

    def log_authz(
        self,
        agent: str,
        tool: str,
        decision: str,
        risk_score: float,
        reasons: List[str],
        correlation_id: Optional[str] = None,
        trace_id: Optional[str] = None,
        latency_ms: Optional[float] = None,
    ) -> Dict[str, Any]:
        return self._record(
            event_name="authorization_decision",
            component="shield",
            outcome=decision,
            correlation_id=correlation_id,
            trace_id=trace_id,
            details={
                "agent": agent,
                "tool": tool,
                "decision": decision,
                "risk_score": risk_score,
                "reasons": reasons,
                "latency_ms": latency_ms,
            },
        )

    def log_execution(
        self,
        agent: str,
        tool: str,
        status: str,
        correlation_id: Optional[str] = None,
        trace_id: Optional[str] = None,
        latency_ms: Optional[float] = None,
        error: Optional[str] = None,
        arguments: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        return self._record(
            event_name="tool_execution",
            component="shield.executor",
            outcome=status,
            correlation_id=correlation_id,
            trace_id=trace_id,
            details={
                "agent": agent,
                "tool": tool,
                "status": status,
                "latency_ms": latency_ms,
                "error": error,
                "arguments": arguments,
            },
            level=logging.ERROR if status == "error" else logging.INFO,
        )

    def log_policy(
        self,
        agent: str,
        tool: str,
        matched: bool,
        decision: str,
        reasons: List[str],
        correlation_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        return self._record(
            event_name="policy_evaluation",
            component="policy_engine",
            outcome=decision,
            correlation_id=correlation_id,
            details={
                "agent": agent,
                "tool": tool,
                "matched": matched,
                "reasons": reasons,
            },
        )

    def log_risk(
        self,
        agent: str,
        tool: str,
        score: float,
        severity: str,
        factors: List[str],
        correlation_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        return self._record(
            event_name="risk_assessment",
            component="risk_engine",
            outcome=severity,
            correlation_id=correlation_id,
            details={
                "agent": agent,
                "tool": tool,
                "score": score,
                "severity": severity,
                "factors": factors,
            },
        )

    def log_rate_limit(
        self,
        scope: str,
        key: str,
        limit: int,
        window: float,
        retry_after: float,
        correlation_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        return self._record(
            event_name="rate_limit_exceeded",
            component="rate_limiter",
            outcome="THROTTLED",
            correlation_id=correlation_id,
            details={
                "scope": scope,
                "key": key,
                "limit": limit,
                "window": window,
                "retry_after": retry_after,
            },
            level=logging.WARNING,
        )

    def log_loop(
        self,
        agent: str,
        tool: str,
        loop_type: str,
        details: Dict[str, Any],
        correlation_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        return self._record(
            event_name="loop_detected",
            component="loop_detector",
            outcome="BLOCKED",
            correlation_id=correlation_id,
            details={
                "agent": agent,
                "tool": tool,
                "loop_type": loop_type,
                "loop_details": details,
            },
            level=logging.WARNING,
        )

    def log_circuit_breaker(
        self,
        component: str,
        from_state: str,
        to_state: str,
        reason: str,
        correlation_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        return self._record(
            event_name="circuit_breaker_transition",
            component=component,
            outcome=to_state,
            correlation_id=correlation_id,
            details={
                "from_state": from_state,
                "to_state": to_state,
                "reason": reason,
            },
            level=logging.WARNING if to_state in ("OPEN", "HALF_OPEN") else logging.INFO,
        )

    def log_provider_failure(
        self,
        provider: str,
        error: str,
        correlation_id: Optional[str] = None,
        attempt: Optional[int] = None,
    ) -> Dict[str, Any]:
        return self._record(
            event_name="provider_failure",
            component="analyst.provider",
            outcome="FAILURE",
            correlation_id=correlation_id,
            details={
                "provider": provider,
                "error": error,
                "attempt": attempt,
            },
            level=logging.ERROR,
        )

    def get_recent_logs(
        self,
        limit: int = 100,
        component: Optional[str] = None,
        event_name: Optional[str] = None,
        correlation_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        with self._lock:
            items = list(self._buffer)

        if component:
            items = [i for i in items if i.get("component") == component]
        if event_name:
            items = [i for i in items if i.get("event") == event_name]
        if correlation_id:
            items = [i for i in items if i.get("correlation_id") == correlation_id]

        return items[-limit:]

    def clear(self) -> None:
        with self._lock:
            self._buffer.clear()


# Global default structured logger instance
_default_logger = StructuredLogger()


def get_operational_logger() -> StructuredLogger:
    """Returns the process-wide operational structured logger."""
    return _default_logger


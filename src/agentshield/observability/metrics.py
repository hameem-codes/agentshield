"""
Lightweight operational metrics collector for AgentShield.

Collects real-time telemetry on decisions, tool executions, latencies,
rate limits, loops, and provider health.

NOTE: This collector is strictly process-local (in-memory with thread synchronization).
In multi-instance serverless deployments, metrics represent the lifetime of
the local worker instance.
"""

from collections import Counter
from datetime import datetime, timezone
import re
import threading
import time
from typing import Any, Callable, Dict, List, Optional


class LatencyTracker:
    """Thread-safe tracker for latency distributions (count, sum, min, max, avg)."""

    def __init__(self):
        self.count: int = 0
        self.total_ms: float = 0.0
        self.min_ms: float = float("inf")
        self.max_ms: float = 0.0
        self._lock = threading.Lock()

    def record(self, duration_ms: float) -> None:
        with self._lock:
            self.count += 1
            self.total_ms += duration_ms
            if duration_ms < self.min_ms:
                self.min_ms = duration_ms
            if duration_ms > self.max_ms:
                self.max_ms = duration_ms

    def snapshot(self) -> Dict[str, float]:
        with self._lock:
            if self.count == 0:
                return {
                    "count": 0,
                    "avg_ms": 0.0,
                    "min_ms": 0.0,
                    "max_ms": 0.0,
                    "total_ms": 0.0,
                }
            return {
                "count": self.count,
                "avg_ms": round(self.total_ms / self.count, 2),
                "min_ms": round(self.min_ms, 2),
                "max_ms": round(self.max_ms, 2),
                "total_ms": round(self.total_ms, 2),
            }


class MetricsCollector:
    """Process-local, thread-safe operational metrics collector."""

    def __init__(self):
        self._lock = threading.Lock()
        self.started_at: str = datetime.now(timezone.utc).isoformat()

        # Decision counters
        self.decisions_total: Counter = Counter()

        # Tool execution counters
        self.tool_executions_total: Counter = Counter()

        # Reliability counters
        self.rate_limit_hits_total: Counter = Counter()
        self.loops_detected_total: Counter = Counter()
        self.provider_failures_total: Counter = Counter()

        # Latency trackers
        self.authz_latency = LatencyTracker()
        self.execution_latency = LatencyTracker()

        # Dynamic gauge callbacks
        self._gauge_callbacks: Dict[str, Callable[[], Any]] = {}

    def register_gauge(self, name: str, callback: Callable[[], Any]) -> None:
        """Registers a dynamic gauge callback (e.g. pending reviews or active incidents)."""
        with self._lock:
            self._gauge_callbacks[name] = callback

    def record_decision(self, decision: str, duration_ms: Optional[float] = None) -> None:
        with self._lock:
            self.decisions_total[decision] += 1
        if duration_ms is not None:
            self.authz_latency.record(duration_ms)

    def record_execution(self, status: str, duration_ms: Optional[float] = None) -> None:
        with self._lock:
            self.tool_executions_total[status] += 1
        if duration_ms is not None:
            self.execution_latency.record(duration_ms)

    def record_rate_limit_hit(self, scope: str) -> None:
        clean_scope = re.sub(r"[^a-zA-Z0-9_\-]", "_", str(scope))[:32]
        with self._lock:
            self.rate_limit_hits_total[clean_scope] += 1

    def record_loop_detected(self, loop_type: str) -> None:
        clean_type = re.sub(r"[^a-zA-Z0-9_\-]", "_", str(loop_type))[:32]
        with self._lock:
            self.loops_detected_total[clean_type] += 1

    def record_provider_failure(self, provider: str) -> None:
        clean_prov = re.sub(r"[^a-zA-Z0-9_\-]", "_", str(provider))[:32]
        with self._lock:
            self.provider_failures_total[clean_prov] += 1

    def get_snapshot(self) -> Dict[str, Any]:
        """Returns a complete dictionary snapshot of operational metrics."""
        with self._lock:
            decisions = dict(self.decisions_total)
            executions = dict(self.tool_executions_total)
            rate_limits = dict(self.rate_limit_hits_total)
            loops = dict(self.loops_detected_total)
            provider_failures = dict(self.provider_failures_total)
            callbacks = dict(self._gauge_callbacks)

        gauges = {}
        for name, cb in callbacks.items():
            try:
                val = cb()
                gauges[name] = val if isinstance(val, (int, float)) else None
            except Exception:
                gauges[name] = None

        return {
            "started_at": self.started_at,
            "scope": "process_local",
            "decisions": {
                "allow": decisions.get("ALLOW", 0),
                "review": decisions.get("REVIEW", 0),
                "block": decisions.get("BLOCK", 0),
                "total": sum(decisions.values()),
            },
            "executions": {
                "executed": executions.get("executed", 0),
                "error": executions.get("error", 0),
                "timeout": executions.get("timeout", 0),
                "not_executed": executions.get("not_executed", 0),
                "total": sum(executions.values()),
            },
            "latency_ms": {
                "authorization": self.authz_latency.snapshot(),
                "execution": self.execution_latency.snapshot(),
            },
            "reliability": {
                "rate_limit_hits": rate_limits,
                "loops_detected": loops,
                "provider_failures": provider_failures,
            },
            "gauges": gauges,
        }

    def to_prometheus_text(self) -> str:
        """Renders metrics in Prometheus text format."""
        snap = self.get_snapshot()
        lines: List[str] = [
            "# HELP agentshield_decisions_total Total authorization decisions evaluated",
            "# TYPE agentshield_decisions_total counter",
        ]
        for dec, count in snap["decisions"].items():
            if dec != "total":
                lines.append(f'agentshield_decisions_total{{decision="{dec.upper()}"}} {count}')

        lines.extend([
            "# HELP agentshield_tool_executions_total Total tool executions by status",
            "# TYPE agentshield_tool_executions_total counter",
        ])
        for st, count in snap["executions"].items():
            if st != "total":
                lines.append(f'agentshield_tool_executions_total{{status="{st}"}} {count}')

        lines.extend([
            "# HELP agentshield_authz_latency_avg_ms Average authorization latency in milliseconds",
            "# TYPE agentshield_authz_latency_avg_ms gauge",
            f'agentshield_authz_latency_avg_ms {snap["latency_ms"]["authorization"]["avg_ms"]}',
            "# HELP agentshield_exec_latency_avg_ms Average tool execution latency in milliseconds",
            "# TYPE agentshield_exec_latency_avg_ms gauge",
            f'agentshield_exec_latency_avg_ms {snap["latency_ms"]["execution"]["avg_ms"]}',
        ])

        # Gauges
        for g_name, g_val in snap["gauges"].items():
            if isinstance(g_val, (int, float)):
                clean_name = f"agentshield_{g_name.replace('-', '_')}"
                lines.append(f"# HELP {clean_name} Gauge {g_name}")
                lines.append(f"# TYPE {clean_name} gauge")
                lines.append(f"{clean_name} {g_val}")

        return "\n".join(lines) + "\n"

    def reset(self) -> None:
        with self._lock:
            self.decisions_total.clear()
            self.tool_executions_total.clear()
            self.rate_limit_hits_total.clear()
            self.loops_detected_total.clear()
            self.provider_failures_total.clear()
            self.authz_latency = LatencyTracker()
            self.execution_latency = LatencyTracker()


# Global default metrics collector
_default_collector = MetricsCollector()


def get_metrics_collector() -> MetricsCollector:
    """Returns the process-wide metrics collector."""
    return _default_collector


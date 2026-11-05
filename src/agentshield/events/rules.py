"""
Deterministic security alert rules for AgentShield.

In accordance with AgentShield's non-negotiable rules:
- LLM and RAG are never the final authority for alert triggers.
- Alerts evaluate deterministically over structured events and bounded event windows.
"""

from abc import ABC, abstractmethod
from typing import List, Optional
from agentshield.events.models import SecurityEvent, SecurityAlert, EventType, EventSeverity, AlertStatus


class AlertRule(ABC):
    """Abstract base class for deterministic security alert rules."""

    @property
    @abstractmethod
    def rule_name(self) -> str:
        pass

    @abstractmethod
    def evaluate(self, event: SecurityEvent, recent_events: List[SecurityEvent]) -> Optional[SecurityAlert]:
        """Evaluates an incoming event against the rule and recent event context."""
        pass


class PromptInjectionAlertRule(AlertRule):
    """Detects prompt injection, system prompt leak, or jailbreak attempts."""

    @property
    def rule_name(self) -> str:
        return "prompt_injection"

    def evaluate(self, event: SecurityEvent, recent_events: List[SecurityEvent]) -> Optional[SecurityAlert]:
        is_injection = False
        evidence_lower = [e.lower() for e in event.evidence]

        # Check explicit event type or evidence matches
        if event.event_type == EventType.RISK_DETECTION.value:
            for factor in evidence_lower:
                if any(k in factor for k in ("injection", "override", "jailbreak", "leak", "persona", "bypass")):
                    is_injection = True
                    break

        if not is_injection and event.metadata.get("injection_findings"):
            is_injection = True

        if not is_injection:
            # Check reasons / metadata for prompt injection patterns
            for r in event.metadata.get("reasons", []):
                r_lower = str(r).lower()
                if any(k in r_lower for k in ("prompt injection", "jailbreak", "instruction override", "forbidden patterns")):
                    is_injection = True
                    break

        if is_injection:
            is_crit = event.risk_score >= 80.0 or any("jailbreak" in e for e in evidence_lower)
            return SecurityAlert(
                title=f"Prompt Injection Detected in Agent '{event.agent_id}'",
                description=(
                    f"Agent proposed an action or submitted input triggering prompt injection detection. "
                    f"Evidence: {', '.join(event.evidence[:3]) or 'Suspicious instruction pattern detected'}."
                ),
                alert_type="prompt_injection",
                severity=EventSeverity.CRITICAL.value if is_crit else EventSeverity.HIGH.value,
                agent_id=event.agent_id,
                trigger_event_id=event.event_id,
                event_ids=[event.event_id],
                correlation_id=event.correlation_id,
                metadata={
                    "risk_score": event.risk_score,
                    "evidence": event.evidence,
                    "tool": event.tool,
                },
            )
        return None


class UnauthorizedToolAccessAlertRule(AlertRule):
    """Detects unauthorized or unknown tool invocations violating policy."""

    @property
    def rule_name(self) -> str:
        return "unauthorized_tool_access"

    def evaluate(self, event: SecurityEvent, recent_events: List[SecurityEvent]) -> Optional[SecurityAlert]:
        is_unauthorized = False
        evidence_lower = [e.lower() for e in event.evidence]

        if event.event_type == EventType.POLICY_VIOLATION.value:
            for e in evidence_lower:
                if any(k in e for k in ("allowed_tools", "denied_tools", "not in allowed_tools", "unknown tool", "not authorized")):
                    is_unauthorized = True
                    break

        if not is_unauthorized and event.decision == "BLOCK":
            for e in evidence_lower:
                if "unknown tool" in e or "not in allowed_tools" in e or "not allowed" in e:
                    is_unauthorized = True
                    break

        if is_unauthorized:
            return SecurityAlert(
                title=f"Unauthorized Tool Access Attempt by '{event.agent_id}'",
                description=f"Agent '{event.agent_id}' attempted to access unauthorized tool '{event.tool}'.",
                alert_type="unauthorized_tool_access",
                severity=EventSeverity.HIGH.value,
                agent_id=event.agent_id,
                trigger_event_id=event.event_id,
                event_ids=[event.event_id],
                correlation_id=event.correlation_id,
                metadata={"tool": event.tool, "evidence": event.evidence},
            )
        return None


class RepeatedBlockedActionsAlertRule(AlertRule):
    """Detects repeated blocked actions by an agent within a bounded time window."""

    def __init__(self, threshold: int = 3, time_window_seconds: float = 300.0):
        self.threshold = threshold
        self.time_window_seconds = time_window_seconds

    @property
    def rule_name(self) -> str:
        return "repeated_blocked_actions"

    def evaluate(self, event: SecurityEvent, recent_events: List[SecurityEvent]) -> Optional[SecurityAlert]:
        if event.decision != "BLOCK":
            return None

        from datetime import datetime, timezone
        try:
            curr_ts = datetime.fromisoformat(event.timestamp)
        except Exception:
            curr_ts = datetime.now(timezone.utc)

        # Collect blocked events for this agent
        all_events = list(recent_events)
        if event not in all_events:
            all_events.append(event)

        # Filter by time window and BLOCK decision
        valid_blocks: List[SecurityEvent] = []
        for e in all_events:
            if e.agent_id != event.agent_id or e.decision != "BLOCK":
                continue
            try:
                e_ts = datetime.fromisoformat(e.timestamp)
                if (curr_ts - e_ts).total_seconds() <= self.time_window_seconds:
                    valid_blocks.append(e)
            except Exception:
                valid_blocks.append(e)

        # Deduplicate by trace_id to prevent double-counting authorization + execution failure of the same action
        unique_traces: dict[str, SecurityEvent] = {}
        for b in valid_blocks:
            tid = b.trace_id or b.event_id
            if tid not in unique_traces:
                unique_traces[tid] = b

        block_count = len(unique_traces)
        if block_count >= self.threshold and (block_count % self.threshold == 0 or block_count == self.threshold):
            threshold_events = list(unique_traces.values())[-self.threshold:]
            event_ids = [e.event_id for e in threshold_events]
            return SecurityAlert(
                title=f"Repeated Blocked Actions by Agent '{event.agent_id}' ({block_count} blocks in {int(self.time_window_seconds)}s)",
                description=(
                    f"Agent '{event.agent_id}' has accumulated {block_count} blocked actions within {int(self.time_window_seconds)}s window. "
                    f"Latest blocked tool was '{event.tool}'."
                ),
                alert_type="repeated_blocked_actions",
                severity=EventSeverity.HIGH.value if block_count < self.threshold * 2 else EventSeverity.CRITICAL.value,
                agent_id=event.agent_id,
                trigger_event_id=event.event_id,
                event_ids=event_ids,
                correlation_id=event.correlation_id,
                metadata={
                    "block_count": block_count,
                    "time_window_seconds": self.time_window_seconds,
                    "blocked_tools": list({e.tool for e in threshold_events}),
                },
            )
        return None


class DataExfiltrationAlertRule(AlertRule):
    """Detects suspected data exfiltration patterns or unauthorized network egress."""

    @property
    def rule_name(self) -> str:
        return "data_exfiltration"

    def evaluate(self, event: SecurityEvent, recent_events: List[SecurityEvent]) -> Optional[SecurityAlert]:
        is_exfil = False
        evidence_lower = [e.lower() for e in event.evidence]
        metadata_str = str(event.metadata).lower()

        for e in evidence_lower:
            if any(k in e for k in ("exfiltration", "exfil", "unauthorized destination", "disallowed hostname")):
                is_exfil = True
                break

        if not is_exfil and "exfiltration" in metadata_str:
            is_exfil = True

        if is_exfil:
            return SecurityAlert(
                title=f"Suspected Data Exfiltration Attempt by '{event.agent_id}'",
                description=(
                    f"Action on tool '{event.tool}' exhibited data exfiltration characteristics or unauthorized egress."
                ),
                alert_type="data_exfiltration",
                severity=EventSeverity.CRITICAL.value,
                agent_id=event.agent_id,
                trigger_event_id=event.event_id,
                event_ids=[event.event_id],
                correlation_id=event.correlation_id,
                metadata={"tool": event.tool, "evidence": event.evidence},
            )
        return None


class SecurityFailureAlertRule(AlertRule):
    """Detects authentication failures, worker fencing, or credential misuse."""

    @property
    def rule_name(self) -> str:
        return "security_failure"

    def evaluate(self, event: SecurityEvent, recent_events: List[SecurityEvent]) -> Optional[SecurityAlert]:
        if event.event_type == EventType.SECURITY_FAILURE.value:
            return SecurityAlert(
                title=f"Security Protocol Failure for Agent '{event.agent_id}'",
                description=f"Security failure detected on tool '{event.tool}': {', '.join(event.evidence)}",
                alert_type="security_failure",
                severity=event.severity or EventSeverity.HIGH.value,
                agent_id=event.agent_id,
                trigger_event_id=event.event_id,
                event_ids=[event.event_id],
                correlation_id=event.correlation_id,
                metadata={"evidence": event.evidence, "metadata": event.metadata},
            )
        return None


class AlertRuleEngine:
    """Evaluates configured deterministic rules against streaming security events."""

    def __init__(self, rules: Optional[List[AlertRule]] = None):
        self.rules: List[AlertRule] = rules if rules is not None else [
            PromptInjectionAlertRule(),
            UnauthorizedToolAccessAlertRule(),
            RepeatedBlockedActionsAlertRule(threshold=3),
            DataExfiltrationAlertRule(),
            SecurityFailureAlertRule(),
        ]

    def evaluate(self, event: SecurityEvent, recent_events: List[SecurityEvent]) -> List[SecurityAlert]:
        alerts = []
        for rule in self.rules:
            alert = rule.evaluate(event, recent_events)
            if alert:
                alerts.append(alert)
        return alerts


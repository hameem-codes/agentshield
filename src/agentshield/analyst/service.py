"""
LLM Security Analyst core service for AgentShield.

Provides structured threat analysis, chronological incident timelines, sequence correlation,
and evidence grounding over sanitized security telemetry while enforcing strict read-only
execution boundaries and defensive validation against indirect prompt injection.
"""

from datetime import datetime, timezone
import json
import re
from typing import Any, Dict, List, Optional, Set

from agentshield.analyst.models import (
    AnalysisReport,
    AnalysisValidationError,
    ProviderError,
    ReadOnlyViolationError,
    AnalystSeverity,
    TimelineEntry,
    FindingObservation,
    SuspiciousSequence,
)
from agentshield.analyst.provider import LLMProvider
from agentshield.analyst.prompts import SYSTEM_PROMPT, format_telemetry_prompt
from agentshield.events.models import SecurityEvent, SecurityAlert, SecurityIncident
from agentshield.events.store import EventStore
from agentshield.analyst.store import ReportStore


# Regex to strip markdown code fences if model enclosed JSON in ```json ... ```
JSON_CODE_BLOCK_PATTERN = re.compile(r"^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$", re.IGNORECASE)

# Patterns indicating an LLM was manipulated by prompt injection into claiming authorization or mutation
ADVERSARIAL_INJECTION_INDICATORS = [
    re.compile(r"\b(?:i have approved|action is approved|automatically approved|approved review)\b", re.IGNORECASE),
    re.compile(r"\b(?:override policy|policy updated|policy modified|bypass enabled)\b", re.IGNORECASE),
    re.compile(r"\b(?:granting permission|authorized to execute|execution allowed)\b", re.IGNORECASE),
]


def parse_iso_timestamp(ts: Optional[str]) -> datetime:
    """Safely parses an ISO timestamp into a timezone-aware UTC datetime for exact chronological ordering."""
    if not ts:
        return datetime.min.replace(tzinfo=timezone.utc)
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return datetime.min.replace(tzinfo=timezone.utc)


class SecurityAnalyst:
    """Strictly read-only Security Analyst service for AgentShield."""

    def __init__(
        self,
        provider: LLMProvider,
        event_store: Optional[EventStore] = None,
        report_store: Optional[ReportStore] = None,
        enforce_grounding: bool = True,
    ):
        self.provider = provider
        self.event_store = event_store
        self.report_store = report_store
        self.enforce_grounding = enforce_grounding

    def __setattr__(self, name: str, value: Any) -> None:
        if name in ("execute", "authorize", "approve_review", "reject_review", "modify_policy"):
            raise ReadOnlyViolationError(f"SecurityAnalyst is strictly read-only and cannot be configured with '{name}'")
        super().__setattr__(name, value)

    def investigate_incident(self, incident_id: str) -> AnalysisReport:
        """Retrieves complete available context for an incident and performs correlation analysis."""
        if not self.event_store:
            raise AnalysisValidationError("EventStore is required to investigate an incident by ID")

        incident = self.event_store.get_incident(incident_id)
        if not incident:
            raise AnalysisValidationError(f"Security incident '{incident_id}' not found in store")

        # 1. Retrieve all correlated alerts
        alerts_map: Dict[str, SecurityAlert] = {}
        if incident.correlation_id:
            for a in self.event_store.query_alerts(correlation_id=incident.correlation_id):
                alerts_map[a.alert_id] = a
        for aid in incident.alert_ids:
            if aid not in alerts_map:
                stored_alert = self.event_store.get_alert(aid)
                if stored_alert:
                    alerts_map[aid] = stored_alert

        alerts = list(alerts_map.values())

        # 2. Retrieve all correlated events
        events_map: Dict[str, SecurityEvent] = {}
        if incident.correlation_id:
            for e in self.event_store.query_events(correlation_id=incident.correlation_id):
                events_map[e.event_id] = e

        # Also fetch events referenced in alerts
        for a in alerts:
            for eid in (a.event_ids or []):
                if eid not in events_map:
                    ev = self.event_store.get_event(eid)
                    if ev:
                        events_map[eid] = ev
            if a.trigger_event_id and a.trigger_event_id not in events_map:
                ev = self.event_store.get_event(a.trigger_event_id)
                if ev:
                    events_map[a.trigger_event_id] = ev

        events = list(events_map.values())

        # 3. Filter out unrelated events (events must belong to incident correlation or be referenced in alerts)
        if incident.correlation_id:
            filtered_events = [
                e for e in events
                if e.correlation_id == incident.correlation_id
                or any(e.event_id in (a.event_ids or []) or e.event_id == a.trigger_event_id for a in alerts)
            ]
        else:
            filtered_events = [
                e for e in events
                if any(e.event_id in (a.event_ids or []) or e.event_id == a.trigger_event_id for a in alerts)
                or (incident.agent_id and e.agent_id == incident.agent_id and not e.correlation_id)
            ]

        if not filtered_events and not alerts:
            raise AnalysisValidationError(f"Incident '{incident_id}' contains no associated events or alerts")

        return self.analyze_incident(incident=incident, alerts=alerts, events=filtered_events)

    def investigate_correlation(self, correlation_id: str) -> AnalysisReport:
        """Retrieves complete context for a correlation ID and performs correlation analysis."""
        if self.event_store:
            incident = self.event_store.get_incident_by_correlation(correlation_id)
            if incident:
                return self.investigate_incident(incident.incident_id)
        return self.analyze_by_correlation_id(correlation_id)

    def analyze_incident(
        self,
        incident: SecurityIncident,
        alerts: Optional[List[SecurityAlert]] = None,
        events: Optional[List[SecurityEvent]] = None,
    ) -> AnalysisReport:
        """Analyzes a security incident, resolving missing alerts and events from store if available."""
        resolved_alerts = list(alerts) if alerts is not None else []
        resolved_events = list(events) if events is not None else []

        if self.event_store:
            if not resolved_alerts and incident.correlation_id:
                resolved_alerts = self.event_store.query_alerts(correlation_id=incident.correlation_id)
            if not resolved_events and incident.correlation_id:
                resolved_events = self.event_store.query_events(correlation_id=incident.correlation_id)

        # Filter out unrelated events if present
        if resolved_events and incident.correlation_id:
            resolved_events = [
                e for e in resolved_events
                if e.correlation_id == incident.correlation_id
                or any(e.event_id in (a.event_ids or []) or e.event_id == a.trigger_event_id for a in resolved_alerts)
            ]

        if not resolved_events and not resolved_alerts:
            raise AnalysisValidationError("Cannot perform analysis: telemetry contains no events or alerts")

        report = self.analyze_events(
            events=resolved_events,
            alerts=resolved_alerts,
            incident=incident,
        )
        report.incident_id = incident.incident_id
        report.correlation_id = incident.correlation_id
        report.agent_id = incident.agent_id
        return report

    def analyze_by_correlation_id(self, correlation_id: str) -> AnalysisReport:
        """Fetches all correlated telemetry and produces an analysis report."""
        if not self.event_store:
            raise AnalysisValidationError("EventStore is required to analyze by correlation_id")

        incident = self.event_store.get_incident_by_correlation(correlation_id)
        alerts = self.event_store.query_alerts(correlation_id=correlation_id)
        events = self.event_store.query_events(correlation_id=correlation_id)

        if not events and not alerts:
            raise AnalysisValidationError(f"No security events or alerts found for correlation ID '{correlation_id}'")

        if incident:
            return self.analyze_incident(incident=incident, alerts=alerts, events=events)
        return self.analyze_events(events=events, alerts=alerts)

    def analyze_events(
        self,
        events: List[SecurityEvent],
        alerts: Optional[List[SecurityAlert]] = None,
        incident: Optional[SecurityIncident] = None,
    ) -> AnalysisReport:
        """Analyzes a batch of events and alerts, generating a chronological timeline,
        evaluating behavioral patterns, and validating findings.
        """
        alerts = alerts or []
        if not events and not alerts:
            raise AnalysisValidationError("Cannot perform analysis on empty telemetry batch")

        # 1. Sort events chronologically by actual parsed timestamp, using event_id as deterministic tiebreaker
        sorted_events = sorted(events, key=lambda e: (parse_iso_timestamp(e.timestamp), e.event_id))
        sorted_alerts = sorted(alerts, key=lambda a: (parse_iso_timestamp(a.timestamp), a.alert_id))

        # 2. Deterministically construct chronological timeline entries from real telemetry
        deterministic_timeline = [
            TimelineEntry(
                timestamp=e.timestamp,
                event_id=e.event_id,
                event_type=e.event_type,
                tool=e.tool,
                decision=e.decision,
                severity=e.severity,
                description=f"[{e.severity}] {e.event_type} on '{e.tool}' (Decision: {e.decision})",
                alert_id=next((a.alert_id for a in sorted_alerts if e.event_id in a.event_ids or e.event_id == a.trigger_event_id), None),
            )
            for e in sorted_events
        ]

        # 3. Deterministic behavioral analysis (grounded in actual telemetry)
        repeated_behavior = len([e for e in sorted_events if e.decision == "BLOCK"]) >= 2
        escalation_pattern = self._detect_escalation(sorted_events)
        unusual_tool = self._detect_unusual_tool_access(sorted_events, sorted_alerts)
        exfiltration_detected = self._detect_exfiltration(sorted_events, sorted_alerts)
        deterministic_sequences = self._detect_suspicious_sequences(sorted_events, sorted_alerts)

        # 4. Extract legitimate IDs present in input telemetry for evidence grounding
        valid_event_ids: Set[str] = {e.event_id for e in sorted_events}
        valid_alert_ids: Set[str] = {a.alert_id for a in sorted_alerts}

        # 5. Format prompt with strict boundary isolation and tag escaping
        prompt = format_telemetry_prompt(events=sorted_events, alerts=sorted_alerts, incident=incident)

        # 6. Call provider (catches provider exceptions and converts to ProviderError)
        try:
            raw_response = self.provider.generate_analysis(prompt, system_prompt=SYSTEM_PROMPT)
        except ProviderError:
            raise
        except Exception as e:
            raise ProviderError(f"LLM Provider invocation failed: {str(e)}") from e

        # 7. Parse and validate response against strict typed schema and anti-hallucination rules
        report = self._parse_and_validate_response(
            raw_response=raw_response,
            valid_event_ids=valid_event_ids,
            valid_alert_ids=valid_alert_ids,
        )

        # 8. Attach deterministically generated timeline (guarantees no invented events or timestamps)
        report.timeline = deterministic_timeline

        # 9. Merge deterministic behavioral flags with report
        report.repeated_behavior = report.repeated_behavior or repeated_behavior
        report.escalation_pattern = report.escalation_pattern or escalation_pattern
        report.unusual_tool_access = report.unusual_tool_access or unusual_tool
        report.data_exfiltration_indicators = report.data_exfiltration_indicators or exfiltration_detected

        # Merge deterministic sequences to ensure verified telemetry patterns are never omitted
        existing_seq_types = {s.sequence_type for s in report.suspicious_sequences}
        for det_seq in deterministic_sequences:
            if det_seq.sequence_type not in existing_seq_types:
                report.suspicious_sequences.append(det_seq)

        # Propagate metadata from inputs if available
        if incident:
            report.incident_id = incident.incident_id
            report.correlation_id = incident.correlation_id
            report.agent_id = incident.agent_id
        elif sorted_events:
            report.correlation_id = sorted_events[0].correlation_id
            report.agent_id = sorted_events[0].agent_id

        report.analyst_model = self.provider.model_name

        # Persist report if report_store is configured
        if self.report_store:
            self.report_store.save_report(report)

        return report

    def get_report(self, report_id: str) -> Optional[AnalysisReport]:
        """Retrieves and strictly validates a stored report by report_id."""
        if not self.report_store:
            raise AnalysisValidationError("ReportStore is not configured on SecurityAnalyst")
        return self.report_store.get_report(report_id)

    def list_reports_for_incident(
        self,
        incident_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> List[AnalysisReport]:
        """Lists historical investigation reports for an incident, ordered newest first."""
        if not self.report_store:
            raise AnalysisValidationError("ReportStore is not configured on SecurityAnalyst")
        return self.report_store.list_reports_for_incident(incident_id, limit=limit, offset=offset)

    def list_reports_for_correlation(
        self,
        correlation_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> List[AnalysisReport]:
        """Lists historical investigation reports for a correlation ID, ordered newest first."""
        if not self.report_store:
            raise AnalysisValidationError("ReportStore is not configured on SecurityAnalyst")
        return self.report_store.list_reports_for_correlation(correlation_id, limit=limit, offset=offset)

    def _detect_escalation(self, sorted_events: List[SecurityEvent]) -> bool:
        """Detects progression in severity or risk score across chronologically ordered events."""
        if len(sorted_events) < 2:
            return False
        severity_order = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}
        first_sev = severity_order.get(sorted_events[0].severity.upper(), 1)
        last_sev = severity_order.get(sorted_events[-1].severity.upper(), 1)
        if last_sev > first_sev and last_sev >= 3:
            return True
        if sorted_events[-1].risk_score > sorted_events[0].risk_score + 20:
            return True
        return False

    def _detect_unusual_tool_access(self, sorted_events: List[SecurityEvent], sorted_alerts: List[SecurityAlert]) -> bool:
        """Detects policy violations or alerts related to unauthorized/sensitive tools."""
        for e in sorted_events:
            if e.event_type == "policy_violation" or "unauthorized" in str(e.evidence).lower():
                return True
        for a in sorted_alerts:
            if a.alert_type == "unauthorized_tool_access":
                return True
        return False

    def _detect_exfiltration(self, sorted_events: List[SecurityEvent], sorted_alerts: List[SecurityAlert]) -> bool:
        """Detects data exfiltration indicators in telemetry."""
        for a in sorted_alerts:
            if a.alert_type == "data_exfiltration":
                return True
        for e in sorted_events:
            ev_str = str(e.evidence).lower()
            if any(k in ev_str for k in ("exfiltration", "disallowed hostname", "unauthorized destination")):
                return True
        return False

    def _detect_suspicious_sequences(self, sorted_events: List[SecurityEvent], sorted_alerts: List[SecurityAlert]) -> List[SuspiciousSequence]:
        """Identifies multi-event chronological sequences from real events."""
        sequences: List[SuspiciousSequence] = []
        blocked_events = [e for e in sorted_events if e.decision == "BLOCK"]
        if len(blocked_events) >= 2:
            sequences.append(
                SuspiciousSequence(
                    sequence_type="repeated_blocked_actions",
                    event_ids=[e.event_id for e in blocked_events],
                    description=f"Sequence of {len(blocked_events)} blocked actions observed across tools: {[e.tool for e in blocked_events]}",
                )
            )

        if self._detect_escalation(sorted_events):
            sequences.append(
                SuspiciousSequence(
                    sequence_type="escalation_sequence",
                    event_ids=[sorted_events[0].event_id, sorted_events[-1].event_id],
                    description=f"Action escalated from {sorted_events[0].severity} on '{sorted_events[0].tool}' to {sorted_events[-1].severity} on '{sorted_events[-1].tool}'",
                )
            )
        return sequences

    def _parse_and_validate_response(
        self,
        raw_response: str,
        valid_event_ids: Set[str],
        valid_alert_ids: Set[str],
    ) -> AnalysisReport:
        """Extracts JSON, validates against AnalysisReport schema, and enforces grounding."""
        if not raw_response or not raw_response.strip():
            raise AnalysisValidationError("LLM Provider returned an empty response")

        clean_text = raw_response.strip()
        match = JSON_CODE_BLOCK_PATTERN.match(clean_text)
        if match:
            clean_text = match.group(1).strip()

        try:
            data = json.loads(clean_text)
        except Exception as e:
            raise AnalysisValidationError(f"Malformed JSON response from model: {str(e)}") from e

        if not isinstance(data, dict):
            raise AnalysisValidationError(f"Expected JSON object from model, received {type(data).__name__}")

        # Check for adversarial prompt injection indicators in the model's generated text
        for indicator in ADVERSARIAL_INJECTION_INDICATORS:
            summary_match = indicator.search(str(data.get("incident_summary", "")))
            threat_match = indicator.search(str(data.get("threat_assessment", "")))
            if summary_match or threat_match:
                raise AnalysisValidationError(
                    f"Model response violates security directives: contained adversarial authorization claim '{summary_match or threat_match}'"
                )

        # Validate through strict Pydantic model
        try:
            report = AnalysisReport(**data)
        except Exception as e:
            raise AnalysisValidationError(f"Analysis report schema validation failed: {str(e)}") from e

        # Grounding check: verify supporting IDs and findings actually exist in telemetry
        if self.enforce_grounding:
            hallucinated_ids = set()

            for eid in report.supporting_event_ids:
                if eid not in valid_event_ids:
                    hallucinated_ids.add(eid)
            for aid in report.supporting_alert_ids:
                if aid not in valid_alert_ids:
                    hallucinated_ids.add(aid)

            # Ground observations and potential threats
            for obs in report.confirmed_observations:
                for eid in obs.evidence_ids:
                    if eid not in valid_event_ids and eid not in valid_alert_ids:
                        hallucinated_ids.add(eid)
                obs.evidence_ids = [eid for eid in obs.evidence_ids if eid in valid_event_ids or eid in valid_alert_ids]

            for threat in report.potential_threats:
                for eid in threat.evidence_ids:
                    if eid not in valid_event_ids and eid not in valid_alert_ids:
                        hallucinated_ids.add(eid)
                threat.evidence_ids = [eid for eid in threat.evidence_ids if eid in valid_event_ids or eid in valid_alert_ids]

            # Ground suspicious sequences
            for seq in report.suspicious_sequences:
                for eid in seq.event_ids:
                    if eid not in valid_event_ids:
                        hallucinated_ids.add(eid)
                seq.event_ids = [eid for eid in seq.event_ids if eid in valid_event_ids]

            report.supporting_event_ids = [eid for eid in report.supporting_event_ids if eid in valid_event_ids]
            report.supporting_alert_ids = [aid for aid in report.supporting_alert_ids if aid in valid_alert_ids]

            if hallucinated_ids:
                sorted_hallucinated = sorted(list(hallucinated_ids))
                report.uncertainty_factors.append(
                    f"Filtered unverified reference IDs: {sorted_hallucinated}"
                )

        return report

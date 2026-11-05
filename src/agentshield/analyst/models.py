"""
Structured models and validation schemas for the AgentShield LLM Security Analyst.

The Security Analyst is strictly read-only and consumes sanitized security telemetry
to produce structured threat evaluations. All inputs are treated as untrusted.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Union
import uuid
from pydantic import BaseModel, Field, field_validator


class AnalystSeverity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class AnalysisValidationError(ValueError):
    """Raised when an LLM provider response fails schema or semantic validation."""
    pass


class ProviderError(RuntimeError):
    """Raised when an LLM provider fails during invocation (timeout, network error, API failure)."""
    pass


class ReadOnlyViolationError(PermissionError):
    """Raised if an operation attempts to mutate state or execute tools through the analyst."""
    pass


class TimelineEntry(BaseModel):
    """Chronological timeline entry generated from actual telemetry timestamps."""
    timestamp: str = Field(..., description="Actual ISO 8601 UTC timestamp of the event")
    event_id: str = Field(..., description="ID of the security event")
    event_type: str = Field(..., description="Type of event (e.g. authorization_decision, policy_violation)")
    tool: str = Field(..., description="Target tool or action")
    decision: Optional[str] = Field(default=None, description="Security decision (ALLOW, BLOCK, REVIEW, etc.)")
    severity: str = Field(default="LOW", description="Event severity")
    description: str = Field(default="", description="Descriptive summary of the event")
    alert_id: Optional[str] = Field(default=None, description="Associated alert ID if linked")


class FindingObservation(BaseModel):
    """Grounded observation or threat finding explicitly linked to supporting evidence IDs."""
    statement: str = Field(..., min_length=3, description="Observation or threat statement")
    evidence_ids: List[str] = Field(default_factory=list, description="Corroborating event or alert IDs")


class SuspiciousSequence(BaseModel):
    """Identified suspicious multi-event pattern or progression."""
    sequence_type: str = Field(..., description="Pattern identifier (e.g. repeated_blocked_probe, escalation_attempt)")
    event_ids: List[str] = Field(default_factory=list, description="Chronological sequence of event IDs")
    description: str = Field(default="", description="Description of the sequence behavior")


class AnalysisReport(BaseModel):
    """Strict typed representation of an LLM Security Analyst's structured findings."""
    incident_summary: str = Field(..., min_length=5, description="Executive summary of the security incident")
    threat_assessment: str = Field(..., min_length=5, description="Technical assessment of the threat vector and attacker intent")
    severity_assessment: AnalystSeverity = Field(..., description="Assessed severity level: LOW, MEDIUM, HIGH, CRITICAL")
    supporting_event_ids: List[str] = Field(default_factory=list, description="IDs of security events corroborating the findings")
    supporting_alert_ids: List[str] = Field(default_factory=list, description="IDs of security alerts corroborating the findings")
    suspicious_behavior: List[str] = Field(default_factory=list, description="Specific suspicious patterns or anomalous actions detected")
    recommended_investigation_steps: List[str] = Field(default_factory=list, description="Actionable investigative steps for human responders")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Analyst confidence score between 0.0 and 1.0")
    uncertainty_factors: List[str] = Field(default_factory=list, description="Factors contributing to uncertainty or gaps in telemetry")

    # Milestone 7, Phase 2: Timeline & Categorized Correlation Analysis
    timeline: List[TimelineEntry] = Field(default_factory=list, description="Chronological incident timeline of actual events")
    confirmed_observations: List[FindingObservation] = Field(default_factory=list, description="Factual observations directly corroborated by telemetry")
    potential_threats: List[FindingObservation] = Field(default_factory=list, description="Plausible threat vectors indicated by the behavior")
    hypotheses: List[str] = Field(default_factory=list, description="Inferred attacker hypotheses requiring further verification")
    missing_evidence: List[str] = Field(default_factory=list, description="Gaps in telemetry or unconfirmed evidence needed for conclusive determination")
    suspicious_sequences: List[SuspiciousSequence] = Field(default_factory=list, description="Identified suspicious multi-event sequences")
    repeated_behavior: bool = Field(default=False, description="Whether repeated blocked or anomalous behavior was observed")
    escalation_pattern: bool = Field(default=False, description="Whether escalation in risk or privilege was observed")
    unusual_tool_access: bool = Field(default=False, description="Whether access to sensitive or unauthorized tools was observed")
    data_exfiltration_indicators: bool = Field(default=False, description="Whether data exfiltration or unauthorized egress was observed")

    # Metadata & Tracking
    report_id: str = Field(default_factory=lambda: f"rep_{uuid.uuid4().hex[:12]}", description="Unique report identifier")
    schema_version: str = Field(default="1.0", description="Schema version of the report")
    incident_id: Optional[str] = Field(default=None, description="Correlated incident ID if analyzing an existing incident")
    correlation_id: Optional[str] = Field(default=None, description="Correlation ID tying events together")
    agent_id: Optional[str] = Field(default=None, description="Primary agent under analysis")
    generated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    analyst_model: str = Field(default="unknown", description="Identifier of the model that generated the analysis")
    raw_metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional context or provider metadata")

    @field_validator("incident_summary", "threat_assessment")
    @classmethod
    def validate_non_empty_strings(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Field cannot be empty or whitespace only")
        return s

    @field_validator("severity_assessment", mode="before")
    @classmethod
    def validate_severity(cls, v: Any) -> AnalystSeverity:
        if isinstance(v, AnalystSeverity):
            return v
        if isinstance(v, str):
            v_upper = v.strip().upper()
            if v_upper in AnalystSeverity.__members__:
                return AnalystSeverity[v_upper]
        raise ValueError(f"Invalid severity assessment: '{v}'. Must be one of {[s.value for s in AnalystSeverity]}")

    @field_validator("confidence")
    @classmethod
    def validate_confidence_range(cls, v: float) -> float:
        if v < 0.0 or v > 1.0:
            raise ValueError(f"Confidence score {v} must be between 0.0 and 1.0")
        return round(float(v), 4)

    @field_validator("confirmed_observations", "potential_threats", mode="before")
    @classmethod
    def validate_observations(cls, v: Any) -> List[FindingObservation]:
        if not isinstance(v, list):
            return []
        results = []
        for item in v:
            if isinstance(item, FindingObservation):
                results.append(item)
            elif isinstance(item, dict):
                results.append(FindingObservation(**item))
            elif isinstance(item, str):
                s = item.strip()
                if s:
                    results.append(FindingObservation(statement=s, evidence_ids=[]))
        return results

    @field_validator("suspicious_sequences", mode="before")
    @classmethod
    def validate_sequences(cls, v: Any) -> List[SuspiciousSequence]:
        if not isinstance(v, list):
            return []
        results = []
        for item in v:
            if isinstance(item, SuspiciousSequence):
                results.append(item)
            elif isinstance(item, dict):
                results.append(SuspiciousSequence(**item))
        return results

    def to_dict(self) -> Dict[str, Any]:
        return self.model_dump()

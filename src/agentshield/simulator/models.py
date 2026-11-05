"""
Data models and typed schemas for AgentShield Attack Simulator.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class AttackCategory(str, Enum):
    BENIGN = "BENIGN"
    PROMPT_INJECTION = "PROMPT_INJECTION"
    UNAUTHORIZED_TOOL = "UNAUTHORIZED_TOOL"
    DATA_EXFILTRATION = "DATA_EXFILTRATION"
    PRIVILEGE_ESCALATION = "PRIVILEGE_ESCALATION"
    SUSPICIOUS_REVIEW = "SUSPICIOUS_REVIEW"


class SimulationType(str, Enum):
    TOOL_PROPOSAL = "TOOL_PROPOSAL"
    INPUT_CHECK = "INPUT_CHECK"


@dataclass
class Scenario:
    id: str
    name: str
    description: str
    attack_category: AttackCategory
    simulation_type: SimulationType
    agent: str
    tool: str
    arguments: Dict[str, Any]
    input_payload: str
    permissions: List[str]
    expected_decision: str  # "ALLOW", "REVIEW", "BLOCK"
    expected_severity: str  # "LOW", "MEDIUM", "HIGH", "CRITICAL"
    explanation: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "attack_category": self.attack_category.value,
            "simulation_type": self.simulation_type.value,
            "agent": self.agent,
            "tool": self.tool,
            "arguments": self.arguments,
            "input_payload": self.input_payload,
            "permissions": self.permissions,
            "expected_decision": self.expected_decision,
            "expected_severity": self.expected_severity,
            "explanation": self.explanation,
        }


@dataclass
class SimulationRun:
    run_id: str
    scenario_id: str
    scenario_name: str
    attack_category: str
    timestamp: float
    actual_decision: Optional[str]  # "ALLOW", "REVIEW", "BLOCK", or None on failure
    expected_decision: str
    expectation_matched: bool
    risk_score: Optional[float]  # None on failure
    severity: Optional[str]  # None on failure
    latency_ms: float
    reasons: List[str] = field(default_factory=list)
    rules_triggered: List[str] = field(default_factory=list)
    execution_status: str = "COMPLETED"  # "COMPLETED" or "FAILED"
    tool_result: Optional[Any] = None
    error_category: Optional[str] = None
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "run_id": self.run_id,
            "scenario_id": self.scenario_id,
            "scenario_name": self.scenario_name,
            "attack_category": self.attack_category,
            "timestamp": self.timestamp,
            "actual_decision": self.actual_decision,
            "expected_decision": self.expected_decision,
            "expectation_matched": self.expectation_matched,
            "risk_score": self.risk_score,
            "severity": self.severity,
            "latency_ms": self.latency_ms,
            "reasons": self.reasons,
            "rules_triggered": self.rules_triggered,
            "execution_status": self.execution_status,
            "tool_result": self.tool_result,
            "error_category": self.error_category,
            "error": self.error,
        }


@dataclass
class SimulatorSummary:
    total_runs: int
    allow_count: int
    review_count: int
    block_count: int
    failed_runs: int = 0
    expectation_matches: int = 0
    expectation_match_rate: float = 0.0
    avg_latency_ms: float = 0.0
    recent_runs: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_runs": self.total_runs,
            "allow_count": self.allow_count,
            "review_count": self.review_count,
            "block_count": self.block_count,
            "failed_runs": self.failed_runs,
            "expectation_matches": self.expectation_matches,
            "expectation_match_rate": self.expectation_match_rate,
            "avg_latency_ms": self.avg_latency_ms,
            "recent_runs": self.recent_runs,
        }


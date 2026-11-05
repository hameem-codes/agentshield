"""
Simulation execution service orchestrating attack scenarios against the AgentShield pipeline.
Ensures execution isolation, timing measurement, and expectation verification.
Guarantees that runtime exceptions produce explicit FAILED statuses rather than synthetic BLOCKs.
"""

import re
import time
from typing import List, Optional, Tuple
import uuid

from agentshield import Shield
from agentshield.simulator.models import Scenario, SimulationRun, SimulationType, SimulatorSummary
from agentshield.simulator.scenarios import get_default_scenarios, get_scenario
from agentshield.simulator.store import SimulationStore

_SECRET_PATTERN = re.compile(r'(?i)(?:api[_-]?key|token|secret|password|bearer|auth)[\s:=]+([^\s,;]+)')
_TRACE_PATTERN = re.compile(r'File ".*?", line \d+.*')


def _sanitize_error_message(exc: Exception) -> Tuple[str, str]:
    """
    Extracts the exception category and produces a safe diagnostic explanation
    without exposing secrets, internal paths, or stack traces.
    """
    category = type(exc).__name__
    raw_msg = str(exc).strip()
    if not raw_msg:
        return category, f"Execution failed with {category}"

    # Strip stack trace lines
    lines = [line.strip() for line in raw_msg.splitlines() if not _TRACE_PATTERN.search(line)]
    clean_msg = " ".join(lines)
    # Redact potential secrets or sensitive values
    clean_msg = _SECRET_PATTERN.sub(r'[REDACTED]', clean_msg)
    # Truncate if overly long
    if len(clean_msg) > 200:
        clean_msg = clean_msg[:197] + "..."
    return category, f"{category}: {clean_msg}"


class SimulatorService:
    """
    Service executing attack simulation scenarios through AgentShield's security pipeline.
    Never invents security decisions; routes all requests through Shield.check() or Shield.execute().
    """

    def __init__(self, shield: Shield, store: SimulationStore):
        self.shield = shield
        self.store = store

    def list_scenarios(self) -> List[Scenario]:
        """List all available attack scenarios in the registry."""
        return get_default_scenarios()

    def get_scenario(self, scenario_id: str) -> Optional[Scenario]:
        """Retrieve a specific attack scenario by ID."""
        return get_scenario(scenario_id)

    def execute_scenario(self, scenario_id: str) -> SimulationRun:
        """
        Execute an attack scenario against the Shield runtime.
        Measures real latency, records actual versus expected outcome, and logs to simulation store.
        If an internal exception occurs, records an explicit FAILED status without inventing BLOCK decisions.
        """
        scenario = self.get_scenario(scenario_id)
        if not scenario:
            raise ValueError(f"Unknown scenario ID: '{scenario_id}'")

        run_id = f"sim_{uuid.uuid4().hex[:12]}"
        start_time = time.perf_counter()

        try:
            if scenario.simulation_type == SimulationType.INPUT_CHECK:
                decision = self.shield.check(scenario.input_payload)
                tool_result = None
                error = None
            else:
                exec_result = self.shield.execute(
                    agent=scenario.agent,
                    tool=scenario.tool,
                    arguments=scenario.arguments,
                    permissions=scenario.permissions,
                )
                decision = exec_result.decision
                tool_result = exec_result.tool_result
                error = exec_result.error
        except Exception as e:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            category, safe_explanation = _sanitize_error_message(e)
            run = SimulationRun(
                run_id=run_id,
                scenario_id=scenario.id,
                scenario_name=scenario.name,
                attack_category=scenario.attack_category.value,
                timestamp=time.time(),
                actual_decision=None,  # Never invent a security decision for failed runs
                expected_decision=scenario.expected_decision,
                expectation_matched=False,  # Failed runs never match expectations
                risk_score=None,  # Do not invent risk score
                severity=None,  # Do not invent severity
                latency_ms=duration_ms,
                reasons=[safe_explanation],
                rules_triggered=[],  # Do not invent triggered rules
                execution_status="FAILED",  # Explicit FAILED simulation status
                tool_result=None,
                error_category=category,
                error=safe_explanation,
            )
            self.store.record_failure(run)
            return run

        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        actual_decision = decision.decision.value
        expectation_matched = (actual_decision == scenario.expected_decision)

        run = SimulationRun(
            run_id=run_id,
            scenario_id=scenario.id,
            scenario_name=scenario.name,
            attack_category=scenario.attack_category.value,
            timestamp=time.time(),
            actual_decision=actual_decision,
            expected_decision=scenario.expected_decision,
            expectation_matched=expectation_matched,
            risk_score=float(decision.risk_score),
            severity=decision.severity.value,
            latency_ms=duration_ms,
            reasons=list(decision.reasons),
            rules_triggered=[r for r in decision.reasons if ":" in r or "_" in r],
            execution_status="COMPLETED",
            tool_result=tool_result,
            error_category=None,
            error=error,
        )

        self.store.record_run(run)
        return run

    def execute_batch(self, scenario_ids: Optional[List[str]] = None) -> List[SimulationRun]:
        """Execute a batch of scenarios sequentially and return results."""
        target_ids = scenario_ids or [s.id for s in self.list_scenarios()]
        runs: List[SimulationRun] = []
        for s_id in target_ids:
            run = self.execute_scenario(s_id)
            runs.append(run)
        return runs

    def get_run(self, run_id: str) -> Optional[SimulationRun]:
        """Retrieve a specific run by ID."""
        return self.store.get_run(run_id)

    def list_runs(self, limit: int = 50, offset: int = 0) -> List[SimulationRun]:
        """Retrieve recent evaluated simulation runs."""
        return self.store.list_runs(limit=limit, offset=offset)

    def get_history(self, limit: int = 50, offset: int = 0) -> List[SimulationRun]:
        """Retrieve recent evaluated simulation runs (alias for list_runs)."""
        return self.store.list_runs(limit=limit, offset=offset)

    def list_failures(self, limit: int = 50, offset: int = 0) -> List[SimulationRun]:
        """Retrieve recent failed simulation runs."""
        return self.store.list_failures(limit=limit, offset=offset)

    def get_summary(self) -> SimulatorSummary:
        """Get summary metrics and expectation match rate."""
        return self.store.get_summary()

    def clear_history(self) -> int:
        """Clear all simulation run history and failures."""
        return self.store.clear_runs()

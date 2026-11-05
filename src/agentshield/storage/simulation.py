"""
PostgreSQL Simulation Store for AgentShield.

Manages persistent attack simulator execution history, failure records,
and benchmark telemetry.
"""

import json
import logging
from typing import Any, Dict, List, Optional

from agentshield.simulator.models import SimulationRun, SimulatorSummary
from agentshield.simulator.store import SimulationStore
from agentshield.storage.connection import PostgresConnectionManager

logger = logging.getLogger("agentshield.storage.simulation")


class PostgresSimulationStore(SimulationStore):
    """PostgreSQL implementation of SimulationStore."""

    def __init__(self, dsn: str, connection_manager: Optional[PostgresConnectionManager] = None):
        self.connection_manager = connection_manager or PostgresConnectionManager(dsn=dsn)
        self.init_db()

    def init_db(self) -> None:
        """Initializes simulation_runs and simulation_failures tables."""
        with self.connection_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS simulation_runs (
                    run_id VARCHAR(64) PRIMARY KEY,
                    scenario_id VARCHAR(64) NOT NULL,
                    scenario_name VARCHAR(128) NOT NULL,
                    attack_category VARCHAR(64) NOT NULL,
                    timestamp DOUBLE PRECISION NOT NULL,
                    actual_decision VARCHAR(32),
                    expected_decision VARCHAR(32) NOT NULL,
                    expectation_matched INTEGER NOT NULL,
                    risk_score DOUBLE PRECISION,
                    severity VARCHAR(32),
                    latency_ms DOUBLE PRECISION NOT NULL,
                    reasons TEXT NOT NULL,
                    rules_triggered TEXT NOT NULL,
                    execution_status VARCHAR(32) NOT NULL,
                    tool_result TEXT,
                    error_category VARCHAR(64),
                    error TEXT
                );
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS simulation_failures (
                    run_id VARCHAR(64) PRIMARY KEY,
                    scenario_id VARCHAR(64) NOT NULL,
                    scenario_name VARCHAR(128) NOT NULL,
                    attack_category VARCHAR(64) NOT NULL,
                    timestamp DOUBLE PRECISION NOT NULL,
                    actual_decision VARCHAR(32),
                    expected_decision VARCHAR(32) NOT NULL,
                    expectation_matched INTEGER NOT NULL,
                    risk_score DOUBLE PRECISION,
                    severity VARCHAR(32),
                    latency_ms DOUBLE PRECISION NOT NULL,
                    reasons TEXT NOT NULL,
                    rules_triggered TEXT NOT NULL,
                    execution_status VARCHAR(32) NOT NULL,
                    tool_result TEXT,
                    error_category VARCHAR(64),
                    error TEXT
                );
            """)

    def record_run(self, run: SimulationRun) -> None:
        with self.connection_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO simulation_runs (
                    run_id, scenario_id, scenario_name, attack_category, timestamp,
                    actual_decision, expected_decision, expectation_matched, risk_score,
                    severity, latency_ms, reasons, rules_triggered, execution_status,
                    tool_result, error_category, error
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (run_id) DO NOTHING;
            """, (
                run.run_id,
                run.scenario_id,
                run.scenario_name,
                run.attack_category,
                run.timestamp,
                run.actual_decision,
                run.expected_decision,
                1 if run.expectation_matched else 0,
                run.risk_score,
                run.severity,
                run.latency_ms,
                json.dumps(run.reasons),
                json.dumps(run.rules_triggered),
                run.execution_status,
                json.dumps(run.tool_result) if run.tool_result is not None else None,
                run.error_category,
                run.error,
            ))

    def record_failure(self, run: SimulationRun) -> None:
        with self.connection_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO simulation_failures (
                    run_id, scenario_id, scenario_name, attack_category, timestamp,
                    actual_decision, expected_decision, expectation_matched, risk_score,
                    severity, latency_ms, reasons, rules_triggered, execution_status,
                    tool_result, error_category, error
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (run_id) DO NOTHING;
            """, (
                run.run_id,
                run.scenario_id,
                run.scenario_name,
                run.attack_category,
                run.timestamp,
                run.actual_decision,
                run.expected_decision,
                1 if run.expectation_matched else 0,
                run.risk_score,
                run.severity,
                run.latency_ms,
                json.dumps(run.reasons),
                json.dumps(run.rules_triggered),
                run.execution_status,
                json.dumps(run.tool_result) if run.tool_result is not None else None,
                run.error_category,
                run.error,
            ))

    def _row_to_run(self, row_dict: Dict[str, Any]) -> SimulationRun:
        tool_res = json.loads(row_dict["tool_result"]) if row_dict.get("tool_result") else None
        return SimulationRun(
            run_id=row_dict["run_id"],
            scenario_id=row_dict["scenario_id"],
            scenario_name=row_dict["scenario_name"],
            attack_category=row_dict["attack_category"],
            timestamp=row_dict["timestamp"],
            actual_decision=row_dict.get("actual_decision"),
            expected_decision=row_dict["expected_decision"],
            expectation_matched=bool(row_dict["expectation_matched"]),
            risk_score=row_dict.get("risk_score"),
            severity=row_dict.get("severity"),
            latency_ms=row_dict["latency_ms"],
            reasons=json.loads(row_dict["reasons"]),
            rules_triggered=json.loads(row_dict["rules_triggered"]),
            execution_status=row_dict["execution_status"],
            tool_result=tool_res,
            error_category=row_dict.get("error_category"),
            error=row_dict.get("error"),
        )

    def get_run(self, run_id: str) -> Optional[SimulationRun]:
        with self.connection_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM simulation_runs WHERE run_id = %s;", (run_id,))
            col_names = [d[0] for d in cursor.description] if cursor.description else []
            row = cursor.fetchone()
            if row:
                return self._row_to_run(dict(zip(col_names, row)))

            cursor.execute("SELECT * FROM simulation_failures WHERE run_id = %s;", (run_id,))
            col_names_fail = [d[0] for d in cursor.description] if cursor.description else []
            row_fail = cursor.fetchone()
            if row_fail:
                return self._row_to_run(dict(zip(col_names_fail, row_fail)))
            return None

    def list_runs(self, limit: int = 50, offset: int = 0) -> List[SimulationRun]:
        with self.connection_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM simulation_runs ORDER BY timestamp DESC LIMIT %s OFFSET %s;", (limit, offset))
            col_names = [d[0] for d in cursor.description] if cursor.description else []
            return [self._row_to_run(dict(zip(col_names, r))) for r in cursor.fetchall()]

    def list_failures(self, limit: int = 50, offset: int = 0) -> List[SimulationRun]:
        with self.connection_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM simulation_failures ORDER BY timestamp DESC LIMIT %s OFFSET %s;", (limit, offset))
            col_names = [d[0] for d in cursor.description] if cursor.description else []
            return [self._row_to_run(dict(zip(col_names, r))) for r in cursor.fetchall()]

    def count_runs(self) -> int:
        with self.connection_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM simulation_runs;")
            row = cursor.fetchone()
            return int(row[0]) if row else 0

    def count_failures(self) -> int:
        with self.connection_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM simulation_failures;")
            row = cursor.fetchone()
            return int(row[0]) if row else 0

    def get_summary(self) -> SimulatorSummary:
        runs = self.list_runs(limit=500)
        total = len(runs)
        failures = self.count_failures()

        if total == 0:
            return SimulatorSummary(
                total_runs=0,
                allow_count=0,
                review_count=0,
                block_count=0,
                failed_runs=failures,
                expectation_matches=0,
                expectation_match_rate=0.0,
                avg_latency_ms=0.0,
                recent_runs=[],
            )

        allow = sum(1 for r in runs if r.actual_decision == "ALLOW")
        review = sum(1 for r in runs if r.actual_decision == "REVIEW")
        block = sum(1 for r in runs if r.actual_decision == "BLOCK")
        matches = sum(1 for r in runs if r.expectation_matched)
        match_rate = round((matches / total) * 100.0, 1)
        avg_latency = round(sum(r.latency_ms for r in runs) / total, 2)

        return SimulatorSummary(
            total_runs=total,
            allow_count=allow,
            review_count=review,
            block_count=block,
            failed_runs=failures,
            expectation_matches=matches,
            expectation_match_rate=match_rate,
            avg_latency_ms=avg_latency,
            recent_runs=runs[:10],
        )

    def clear_runs(self) -> int:
        with self.connection_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM simulation_runs;")
            count_runs = cursor.rowcount or 0
            cursor.execute("DELETE FROM simulation_failures;")
            count_fails = cursor.rowcount or 0
            return count_runs + count_fails


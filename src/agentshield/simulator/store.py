"""
Simulation store abstraction for isolated storage and retrieval of attack simulation runs.
Guarantees separation of successful security evaluations from runtime execution failures.
"""

import json
import os
import sqlite3
from typing import Any, Dict, List, Optional, Protocol

from agentshield.simulator.models import SimulationRun, SimulatorSummary


class SimulationStore(Protocol):
    """Protocol for storing and querying simulation runs and aggregate metrics."""

    def record_run(self, run: SimulationRun) -> None:
        """Persist an evaluated security decision."""
        ...

    def record_failure(self, run: SimulationRun) -> None:
        """Persist a failed simulation run record separately from security decisions."""
        ...

    def get_run(self, run_id: str) -> Optional[SimulationRun]:
        """Fetch a specific run record by its run_id."""
        ...

    def list_runs(self, limit: int = 50, offset: int = 0) -> List[SimulationRun]:
        """List recent evaluated simulation runs ordered by timestamp descending."""
        ...

    def list_failures(self, limit: int = 50, offset: int = 0) -> List[SimulationRun]:
        """List recent failed simulation runs."""
        ...

    def count_runs(self) -> int:
        """Return count of evaluated security decision runs."""
        ...

    def count_failures(self) -> int:
        """Return count of failed simulation runs."""
        ...

    def get_summary(self) -> SimulatorSummary:
        """Calculate aggregated benchmark and expectation metrics across evaluated runs."""
        ...

    def clear_runs(self) -> int:
        """Delete all simulation records and failures (administrative action)."""
        ...


class SqliteSimulationStore:
    """Persistent SQLite-backed store for attack simulation run records."""

    def __init__(self, db_path: str):
        self.db_path = db_path
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        if self.db_path != ":memory:":
            db_dir = os.path.dirname(os.path.abspath(self.db_path))
            os.makedirs(db_dir, exist_ok=True)
        with self._get_connection() as conn:
            # Table 1: Evaluated security decisions (ALLOW, REVIEW, BLOCK)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS simulation_runs (
                    run_id TEXT PRIMARY KEY,
                    scenario_id TEXT NOT NULL,
                    scenario_name TEXT NOT NULL,
                    attack_category TEXT NOT NULL,
                    timestamp REAL NOT NULL,
                    actual_decision TEXT NOT NULL,
                    expected_decision TEXT NOT NULL,
                    expectation_matched INTEGER NOT NULL,
                    risk_score REAL NOT NULL,
                    severity TEXT NOT NULL,
                    latency_ms REAL NOT NULL,
                    reasons_json TEXT NOT NULL,
                    rules_triggered_json TEXT NOT NULL,
                    execution_status TEXT NOT NULL,
                    tool_result_json TEXT,
                    error TEXT
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_sim_timestamp ON simulation_runs(timestamp DESC)")

            # Table 2: Failed simulation runs (stored separately from successful security evaluations)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS simulation_failures (
                    run_id TEXT PRIMARY KEY,
                    scenario_id TEXT NOT NULL,
                    scenario_name TEXT NOT NULL,
                    attack_category TEXT NOT NULL,
                    timestamp REAL NOT NULL,
                    expected_decision TEXT NOT NULL,
                    latency_ms REAL NOT NULL,
                    error_category TEXT NOT NULL,
                    error_message TEXT NOT NULL,
                    execution_status TEXT NOT NULL,
                    reasons_json TEXT NOT NULL
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_fail_timestamp ON simulation_failures(timestamp DESC)")
            conn.commit()

    def record_run(self, run: SimulationRun) -> None:
        if run.execution_status == "FAILED" or run.actual_decision is None:
            self.record_failure(run)
            return

        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO simulation_runs (
                    run_id, scenario_id, scenario_name, attack_category, timestamp,
                    actual_decision, expected_decision, expectation_matched,
                    risk_score, severity, latency_ms, reasons_json, rules_triggered_json,
                    execution_status, tool_result_json, error
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run.run_id,
                    run.scenario_id,
                    run.scenario_name,
                    run.attack_category,
                    run.timestamp,
                    run.actual_decision,
                    run.expected_decision,
                    1 if run.expectation_matched else 0,
                    run.risk_score if run.risk_score is not None else 0.0,
                    run.severity or "UNKNOWN",
                    run.latency_ms,
                    json.dumps(run.reasons),
                    json.dumps(run.rules_triggered),
                    run.execution_status,
                    json.dumps(run.tool_result) if run.tool_result is not None else None,
                    run.error,
                ),
            )
            conn.commit()

    def record_failure(self, run: SimulationRun) -> None:
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO simulation_failures (
                    run_id, scenario_id, scenario_name, attack_category, timestamp,
                    expected_decision, latency_ms, error_category, error_message,
                    execution_status, reasons_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run.run_id,
                    run.scenario_id,
                    run.scenario_name,
                    run.attack_category,
                    run.timestamp,
                    run.expected_decision,
                    run.latency_ms,
                    run.error_category or "UnknownError",
                    run.error or "Simulation failed",
                    run.execution_status or "FAILED",
                    json.dumps(run.reasons),
                ),
            )
            conn.commit()

    def _row_to_run(self, row: sqlite3.Row) -> SimulationRun:
        return SimulationRun(
            run_id=row["run_id"],
            scenario_id=row["scenario_id"],
            scenario_name=row["scenario_name"],
            attack_category=row["attack_category"],
            timestamp=row["timestamp"],
            actual_decision=row["actual_decision"],
            expected_decision=row["expected_decision"],
            expectation_matched=bool(row["expectation_matched"]),
            risk_score=row["risk_score"],
            severity=row["severity"],
            latency_ms=row["latency_ms"],
            reasons=json.loads(row["reasons_json"]) if row["reasons_json"] else [],
            rules_triggered=json.loads(row["rules_triggered_json"]) if row["rules_triggered_json"] else [],
            execution_status=row["execution_status"],
            tool_result=json.loads(row["tool_result_json"]) if row["tool_result_json"] else None,
            error=row["error"],
        )

    def _failure_row_to_run(self, row: sqlite3.Row) -> SimulationRun:
        return SimulationRun(
            run_id=row["run_id"],
            scenario_id=row["scenario_id"],
            scenario_name=row["scenario_name"],
            attack_category=row["attack_category"],
            timestamp=row["timestamp"],
            actual_decision=None,
            expected_decision=row["expected_decision"],
            expectation_matched=False,
            risk_score=None,
            severity=None,
            latency_ms=row["latency_ms"],
            reasons=json.loads(row["reasons_json"]) if row["reasons_json"] else [],
            rules_triggered=[],
            execution_status=row["execution_status"],
            tool_result=None,
            error_category=row["error_category"],
            error=row["error_message"],
        )

    def get_run(self, run_id: str) -> Optional[SimulationRun]:
        with self._get_connection() as conn:
            row = conn.execute("SELECT * FROM simulation_runs WHERE run_id = ?", (run_id,)).fetchone()
            if row:
                return self._row_to_run(row)
            fail_row = conn.execute("SELECT * FROM simulation_failures WHERE run_id = ?", (run_id,)).fetchone()
            if fail_row:
                return self._failure_row_to_run(fail_row)
            return None

    def list_runs(self, limit: int = 50, offset: int = 0) -> List[SimulationRun]:
        with self._get_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM simulation_runs ORDER BY timestamp DESC LIMIT ? OFFSET ?",
                (limit, offset),
            ).fetchall()
            return [self._row_to_run(r) for r in rows]

    def list_failures(self, limit: int = 50, offset: int = 0) -> List[SimulationRun]:
        with self._get_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM simulation_failures ORDER BY timestamp DESC LIMIT ? OFFSET ?",
                (limit, offset),
            ).fetchall()
            return [self._failure_row_to_run(r) for r in rows]

    def count_runs(self) -> int:
        with self._get_connection() as conn:
            row = conn.execute("SELECT COUNT(*) as cnt FROM simulation_runs").fetchone()
            return row["cnt"] if row else 0

    def count_failures(self) -> int:
        with self._get_connection() as conn:
            row = conn.execute("SELECT COUNT(*) as cnt FROM simulation_failures").fetchone()
            return row["cnt"] if row else 0

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
            recent_runs=[r.to_dict() for r in runs[:10]],
        )

    def clear_runs(self) -> int:
        with self._get_connection() as conn:
            c1 = conn.execute("DELETE FROM simulation_runs").rowcount
            c2 = conn.execute("DELETE FROM simulation_failures").rowcount
            conn.commit()
            return c1 + c2


class InMemorySimulationStore:
    """In-memory simulation store with separate storage for evaluated decisions and failures."""

    def __init__(self):
        self._runs: Dict[str, SimulationRun] = {}
        self._failures: Dict[str, SimulationRun] = {}

    def record_run(self, run: SimulationRun) -> None:
        if run.execution_status == "FAILED" or run.actual_decision is None:
            self.record_failure(run)
            return
        self._runs[run.run_id] = run

    def record_failure(self, run: SimulationRun) -> None:
        self._failures[run.run_id] = run

    def get_run(self, run_id: str) -> Optional[SimulationRun]:
        return self._runs.get(run_id) or self._failures.get(run_id)

    def list_runs(self, limit: int = 50, offset: int = 0) -> List[SimulationRun]:
        all_runs = sorted(self._runs.values(), key=lambda r: r.timestamp, reverse=True)
        return all_runs[offset : offset + limit]

    def list_failures(self, limit: int = 50, offset: int = 0) -> List[SimulationRun]:
        all_fails = sorted(self._failures.values(), key=lambda r: r.timestamp, reverse=True)
        return all_fails[offset : offset + limit]

    def count_runs(self) -> int:
        return len(self._runs)

    def count_failures(self) -> int:
        return len(self._failures)

    def get_summary(self) -> SimulatorSummary:
        runs = sorted(self._runs.values(), key=lambda r: r.timestamp, reverse=True)
        total = len(runs)
        failures = len(self._failures)

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
            recent_runs=[r.to_dict() for r in runs[:10]],
        )

    def clear_runs(self) -> int:
        count = len(self._runs) + len(self._failures)
        self._runs.clear()
        self._failures.clear()
        return count

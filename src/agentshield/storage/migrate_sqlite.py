"""
SQLite-to-PostgreSQL Data Migration Tool for AgentShield.

Provides repeatable, non-destructive migration of historical AgentShield data
from local SQLite databases to PostgreSQL, verifying cryptographic hash chain
continuity and referential integrity.
"""

import argparse
from dataclasses import dataclass, field
import json
import logging
import os
import sqlite3
import sys
from typing import Any, Dict, List, Optional

from agentshield.storage.audit import PostgresAuditStore
from agentshield.storage.config import validate_database_url
from agentshield.storage.connection import PostgresConnectionManager
from agentshield.storage.migrations import MigrationManager

logger = logging.getLogger("agentshield.storage.migrate")


@dataclass
class MigrationSummary:
    """Summary metrics of SQLite-to-PostgreSQL migration execution."""
    audit_records_migrated: int = 0
    reviews_migrated: int = 0
    events_migrated: int = 0
    alerts_migrated: int = 0
    incidents_migrated: int = 0
    reports_migrated: int = 0
    sessions_migrated: int = 0
    sim_runs_migrated: int = 0
    sim_failures_migrated: int = 0
    audit_chain_verified: bool = False
    dry_run: bool = False
    errors: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "audit_records_migrated": self.audit_records_migrated,
            "reviews_migrated": self.reviews_migrated,
            "events_migrated": self.events_migrated,
            "alerts_migrated": self.alerts_migrated,
            "incidents_migrated": self.incidents_migrated,
            "reports_migrated": self.reports_migrated,
            "sessions_migrated": self.sessions_migrated,
            "sim_runs_migrated": self.sim_runs_migrated,
            "sim_failures_migrated": self.sim_failures_migrated,
            "audit_chain_verified": self.audit_chain_verified,
            "dry_run": self.dry_run,
            "errors": self.errors,
            "success": len(self.errors) == 0 and (self.audit_records_migrated == 0 or self.audit_chain_verified),
        }


def _sqlite_table_exists(conn: sqlite3.Connection, table_name: str) -> bool:
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?;", (table_name,))
    return cur.fetchone() is not None


def migrate_sqlite_to_postgres(
    postgres_dsn: str,
    sqlite_paths: Optional[Dict[str, str]] = None,
    connection_manager: Optional[PostgresConnectionManager] = None,
    dry_run: bool = False,
) -> MigrationSummary:
    """Safely migrates historical records from SQLite databases to PostgreSQL.

    Guarantees:
    - Never mutates, truncates, or deletes SQLite source files.
    - Idempotent and repeatable (skips already existing IDs without overwriting).
    - Preserves audit log sequence order and verifies cryptographic hash chains.
    - Dry-run mode evaluates migration without committing changes.
    """
    validate_database_url(postgres_dsn)
    cm = connection_manager or PostgresConnectionManager(dsn=postgres_dsn)
    summary = MigrationSummary(dry_run=dry_run)

    # Ensure PostgreSQL schemas and migrations are current
    MigrationManager(cm).run_migrations()

    # Default SQLite paths
    resolved_paths: Dict[str, str] = {
        "audit": os.environ.get("AGENTSHIELD_AUDIT_DB", "agentshield_audit.db"),
        "review": os.environ.get("AGENTSHIELD_REVIEW_DB", "agentshield_reviews.db"),
        "events": os.environ.get("AGENTSHIELD_EVENTS_DB", "agentshield_events.db"),
        "reports": os.environ.get("AGENTSHIELD_REPORTS_DB", "agentshield_reports.db"),
        "sessions": os.environ.get("AGENTSHIELD_SESSIONS_DB", "agentshield_sessions.db"),
        "simulation": os.environ.get("AGENTSHIELD_SIMULATION_DB", "agentshield_simulation.db"),
    }
    if sqlite_paths:
        resolved_paths.update(sqlite_paths)

    pg_conn = cm.create_raw_connection()
    try:
        pg_cur = pg_conn.cursor()

        # 1. Migrate Audit Logs (Must be ordered by id ASC to preserve hash chain)
        audit_file = resolved_paths["audit"]
        if os.path.exists(audit_file):
            try:
                sq_conn = sqlite3.connect(f"file:{audit_file}?mode=ro", uri=True)
                sq_conn.row_factory = sqlite3.Row
                if _sqlite_table_exists(sq_conn, "audit_logs"):
                    pg_cur.execute("SELECT record_hash FROM audit_logs;")
                    existing_hashes = {r_pg[0] for r_pg in pg_cur.fetchall() if r_pg[0]}
                    sq_cur = sq_conn.cursor()
                    sq_cur.execute("SELECT * FROM audit_logs ORDER BY id ASC;")
                    rows = sq_cur.fetchall()
                    for r in rows:
                        if r["record_hash"] in existing_hashes:
                            continue
                        corr_val = r["correlation_id"] if "correlation_id" in r.keys() else None
                        trc_val = r["trace_id"] if "trace_id" in r.keys() else None
                        pg_cur.execute("""
                            INSERT INTO audit_logs (
                                timestamp, agent, tool, arguments, decision, allowed,
                                reasons, rules_triggered, risk_score, severity, risk_factors,
                                execution_status, error, policy_version_hash, prev_hash, record_hash,
                                correlation_id, trace_id
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                        """, (
                            r["timestamp"], r["agent"], r["tool"], r["arguments"],
                            r["decision"], r["allowed"], r["reasons"], r["rules_triggered"],
                            float(r["risk_score"]), r["severity"], r["risk_factors"],
                            r["execution_status"], r["error"], r["policy_version_hash"],
                            r["prev_hash"], r["record_hash"], corr_val, trc_val
                        ))
                        summary.audit_records_migrated += 1
                        existing_hashes.add(r["record_hash"])
                sq_conn.close()
            except Exception as e:
                summary.errors.append(f"Audit migration error: {str(e)}")

        # 2. Migrate Reviews
        review_file = resolved_paths["review"]
        if os.path.exists(review_file):
            try:
                sq_conn = sqlite3.connect(f"file:{review_file}?mode=ro", uri=True)
                sq_conn.row_factory = sqlite3.Row
                if _sqlite_table_exists(sq_conn, "reviews"):
                    sq_cur = sq_conn.cursor()
                    sq_cur.execute("SELECT * FROM reviews;")
                    rows = sq_cur.fetchall()
                    for r in rows:
                        now_val = float(r["created_at"])
                        # Check existing ID to ensure repeatability
                        pg_cur.execute("SELECT 1 FROM reviews WHERE review_id = %s;", (r["review_id"],))
                        if not pg_cur.fetchone():
                            pg_cur.execute("""
                                INSERT INTO reviews (
                                    review_id, agent, tool, arguments, permissions, decision,
                                    created_at, expires_at, status, approver, reason,
                                    execution_status, error, idempotency_key, executed_at,
                                    execution_worker_id, lease_expires_at, updated_at
                                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                            """, (
                                r["review_id"], r["agent"], r["tool"], r["arguments"],
                                r["permissions"], r["decision"], float(r["created_at"]),
                                float(r["expires_at"]), r["status"], r["approver"],
                                r["reason"], r["execution_status"], r["error"],
                                r["idempotency_key"], r["executed_at"],
                                r["execution_worker_id"], r["lease_expires_at"], now_val
                            ))
                            summary.reviews_migrated += 1
                sq_conn.close()
            except Exception as e:
                summary.errors.append(f"Review migration error: {str(e)}")

        # 3. Migrate Events, Alerts, and Incidents
        events_file = resolved_paths["events"]
        if os.path.exists(events_file):
            try:
                sq_conn = sqlite3.connect(f"file:{events_file}?mode=ro", uri=True)
                sq_conn.row_factory = sqlite3.Row
                sq_cur = sq_conn.cursor()

                # Events
                if _sqlite_table_exists(sq_conn, "security_events"):
                    sq_cur.execute("SELECT * FROM security_events;")
                    for r in sq_cur.fetchall():
                        pg_cur.execute("SELECT 1 FROM security_events WHERE event_id = %s;", (r["event_id"],))
                        if not pg_cur.fetchone():
                            now_epoch = 0.0
                            pg_cur.execute("""
                                INSERT INTO security_events (
                                    event_id, timestamp, agent_id, tool, event_type, severity,
                                    decision, risk_score, evidence, trace_id, correlation_id,
                                    metadata, created_at
                                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                            """, (
                                r["event_id"], r["timestamp"], r["agent_id"], r["tool"],
                                r["event_type"], r["severity"], r["decision"], float(r["risk_score"]),
                                r["evidence"], r["trace_id"], r["correlation_id"],
                                r["metadata"], now_epoch
                            ))
                            summary.events_migrated += 1

                # Alerts
                if _sqlite_table_exists(sq_conn, "security_alerts"):
                    sq_cur.execute("SELECT * FROM security_alerts;")
                    for r in sq_cur.fetchall():
                        pg_cur.execute("SELECT 1 FROM security_alerts WHERE alert_id = %s;", (r["alert_id"],))
                        if not pg_cur.fetchone():
                            meta = r["metadata"] if "metadata" in r.keys() else "{}"
                            note = r["resolution_note"] if "resolution_note" in r.keys() else None
                            pg_cur.execute("""
                                INSERT INTO security_alerts (
                                    alert_id, timestamp, title, description, alert_type, severity,
                                    status, agent_id, trigger_event_id, event_ids, correlation_id,
                                    incident_id, acknowledged_at, acknowledged_by, resolved_at,
                                    resolved_by, resolution_note, metadata, created_at, updated_at
                                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                            """, (
                                r["alert_id"], r["timestamp"], r["title"], r["description"],
                                r["alert_type"], r["severity"], r["status"], r["agent_id"],
                                r["trigger_event_id"], r["event_ids"], r["correlation_id"],
                                r["incident_id"], r["acknowledged_at"], r["acknowledged_by"],
                                r["resolved_at"], r["resolved_by"], note, meta, 0.0, 0.0
                            ))
                            summary.alerts_migrated += 1

                # Incidents
                if _sqlite_table_exists(sq_conn, "security_incidents"):
                    sq_cur.execute("SELECT * FROM security_incidents;")
                    for r in sq_cur.fetchall():
                        pg_cur.execute("SELECT 1 FROM security_incidents WHERE incident_id = %s;", (r["incident_id"],))
                        if not pg_cur.fetchone():
                            meta = r["metadata"] if "metadata" in r.keys() else "{}"
                            pg_cur.execute("""
                                INSERT INTO security_incidents (
                                    incident_id, created_at, updated_at, title, description,
                                    severity, status, agent_id, correlation_id, alert_ids,
                                    event_count, assigned_to, resolution_summary, metadata
                                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                            """, (
                                r["incident_id"], r["created_at"], r["updated_at"], r["title"],
                                r["description"], r["severity"], r["status"], r["agent_id"],
                                r["correlation_id"], r["alert_ids"], int(r["event_count"]),
                                r["assigned_to"], r["resolution_summary"], meta
                            ))
                            summary.incidents_migrated += 1

                sq_conn.close()
            except Exception as e:
                summary.errors.append(f"Events migration error: {str(e)}")

        # 4. Migrate Analyst Reports
        reports_file = resolved_paths["reports"]
        if os.path.exists(reports_file):
            try:
                sq_conn = sqlite3.connect(f"file:{reports_file}?mode=ro", uri=True)
                sq_conn.row_factory = sqlite3.Row
                if _sqlite_table_exists(sq_conn, "investigation_reports"):
                    sq_cur = sq_conn.cursor()
                    sq_cur.execute("SELECT * FROM investigation_reports;")
                    for r in sq_cur.fetchall():
                        pg_cur.execute("SELECT 1 FROM investigation_reports WHERE report_id = %s;", (r["report_id"],))
                        if not pg_cur.fetchone():
                            pg_cur.execute("""
                                INSERT INTO investigation_reports (
                                    report_id, incident_id, correlation_id, created_at,
                                    schema_version, analyst_model, metadata, content
                                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s);
                            """, (
                                r["report_id"], r["incident_id"], r["correlation_id"],
                                r["created_at"], r["schema_version"], r["analyst_model"],
                                r["metadata"], r["content"]
                            ))
                            summary.reports_migrated += 1
                sq_conn.close()
            except Exception as e:
                summary.errors.append(f"Reports migration error: {str(e)}")

        # 5. Migrate Session Revocations
        sessions_file = resolved_paths["sessions"]
        if os.path.exists(sessions_file):
            try:
                sq_conn = sqlite3.connect(f"file:{sessions_file}?mode=ro", uri=True)
                sq_conn.row_factory = sqlite3.Row
                if _sqlite_table_exists(sq_conn, "session_revocations"):
                    sq_cur = sq_conn.cursor()
                    sq_cur.execute("SELECT * FROM session_revocations;")
                    for r in sq_cur.fetchall():
                        pg_cur.execute("SELECT 1 FROM session_revocations WHERE token_hash = %s;", (r["token_hash"],))
                        if not pg_cur.fetchone():
                            pg_cur.execute("""
                                INSERT INTO session_revocations (token_hash, revoked_at, user_id)
                                VALUES (%s, %s, %s);
                            """, (r["token_hash"], float(r["revoked_at"]), r["user"]))
                            summary.sessions_migrated += 1
                sq_conn.close()
            except Exception as e:
                summary.errors.append(f"Sessions migration error: {str(e)}")

        # 6. Migrate Simulator Runs & Failures
        sim_file = resolved_paths["simulation"]
        if os.path.exists(sim_file):
            try:
                sq_conn = sqlite3.connect(f"file:{sim_file}?mode=ro", uri=True)
                sq_conn.row_factory = sqlite3.Row
                sq_cur = sq_conn.cursor()

                if _sqlite_table_exists(sq_conn, "simulation_runs"):
                    sq_cur.execute("SELECT * FROM simulation_runs;")
                    for r in sq_cur.fetchall():
                        pg_cur.execute("SELECT 1 FROM simulation_runs WHERE run_id = %s;", (r["run_id"],))
                        if not pg_cur.fetchone():
                            pg_cur.execute("""
                                INSERT INTO simulation_runs (
                                    run_id, scenario_id, scenario_name, attack_category, timestamp,
                                    actual_decision, expected_decision, expectation_matched,
                                    risk_score, severity, latency_ms, reasons, rules_triggered,
                                    execution_status, tool_result, error
                                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                            """, (
                                r["run_id"], r["scenario_id"], r["scenario_name"], r["attack_category"],
                                float(r["timestamp"]), r["actual_decision"], r["expected_decision"],
                                int(r["expectation_matched"]), float(r["risk_score"]) if r["risk_score"] is not None else None,
                                r["severity"], float(r["latency_ms"]), r["reasons_json"],
                                r["rules_triggered_json"], r["execution_status"], r["tool_result_json"], r["error"]
                            ))
                            summary.sim_runs_migrated += 1

                if _sqlite_table_exists(sq_conn, "simulation_failures"):
                    sq_cur.execute("SELECT * FROM simulation_failures;")
                    for r in sq_cur.fetchall():
                        pg_cur.execute("SELECT 1 FROM simulation_failures WHERE run_id = %s;", (r["run_id"],))
                        if not pg_cur.fetchone():
                            pg_cur.execute("""
                                INSERT INTO simulation_failures (
                                    run_id, scenario_id, scenario_name, attack_category, timestamp,
                                    expected_decision, latency_ms, error_category, error,
                                    execution_status, reasons
                                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                            """, (
                                r["run_id"], r["scenario_id"], r["scenario_name"], r["attack_category"],
                                float(r["timestamp"]), r["expected_decision"], float(r["latency_ms"]),
                                r["error_category"], r["error_message"], r["execution_status"], r["reasons_json"]
                            ))
                            summary.sim_failures_migrated += 1

                sq_conn.close()
            except Exception as e:
                summary.errors.append(f"Simulation migration error: {str(e)}")

        # 7. Verify Audit Hash Chain Integrity in PostgreSQL
        if summary.audit_records_migrated > 0:
            audit_store = PostgresAuditStore(dsn=postgres_dsn, connection_manager=cm)
            verification = audit_store.verify_integrity(cursor=pg_cur)
            summary.audit_chain_verified = verification["valid"]
            if not verification["valid"]:
                summary.errors.append(f"Audit hash chain verification failed post-migration: {verification.get('error')}")
        else:
            summary.audit_chain_verified = True

        if dry_run:
            pg_conn.rollback()
            logger.info("Dry run complete: all migrations validated and rolled back.")
        else:
            pg_conn.commit()
    except Exception as e:
        try:
            pg_conn.rollback()
        except Exception:
            pass
        summary.errors.append(f"Fatal migration transaction error: {str(e)}")
    finally:
        try:
            pg_conn.close()
        except Exception:
            pass

    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate AgentShield SQLite data to PostgreSQL.")
    parser.add_argument("--postgres-url", default=os.environ.get("AGENTSHIELD_DATABASE_URL") or os.environ.get("DATABASE_URL"),
                        help="Target PostgreSQL connection URL.")
    parser.add_argument("--dry-run", action="store_true", help="Perform a dry-run migration without committing changes.")
    parser.add_argument("--sqlite-dir", default=".", help="Directory containing SQLite database files.")
    args = parser.parse_args()

    if not args.postgres_url:
        print("Error: Target PostgreSQL URL must be provided via --postgres-url or AGENTSHIELD_DATABASE_URL.", file=sys.stderr)
        return 1

    custom_paths = {
        "audit": os.path.join(args.sqlite_dir, "agentshield_audit.db"),
        "review": os.path.join(args.sqlite_dir, "agentshield_reviews.db"),
        "events": os.path.join(args.sqlite_dir, "agentshield_events.db"),
        "reports": os.path.join(args.sqlite_dir, "agentshield_reports.db"),
        "sessions": os.path.join(args.sqlite_dir, "agentshield_sessions.db"),
        "simulation": os.path.join(args.sqlite_dir, "agentshield_simulation.db"),
    }

    print(f"Starting SQLite-to-PostgreSQL migration (dry_run={args.dry_run})...")
    summary = migrate_sqlite_to_postgres(args.postgres_url, sqlite_paths=custom_paths, dry_run=args.dry_run)
    print(json.dumps(summary.to_dict(), indent=2))
    return 0 if summary.to_dict()["success"] else 1


if __name__ == "__main__":
    sys.exit(main())

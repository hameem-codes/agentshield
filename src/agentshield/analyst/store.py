"""
Persistent storage interface and SQLite implementation for Investigation Reports.

Stores complete, validated AnalysisReport objects, ensuring reports are immutably preserved
and never overwritten. Multi-process safe via SQLite BEGIN IMMEDIATE.
"""

from abc import ABC, abstractmethod
from datetime import datetime, timezone
import json
import os
import sqlite3
import threading
from typing import Any, Dict, List, Optional
import uuid

from agentshield.analyst.models import AnalysisReport, AnalysisValidationError


class ReportStore(ABC):
    """Abstract storage interface for LLM Security Investigation Reports."""

    @abstractmethod
    def save_report(self, report: AnalysisReport) -> str:
        """Persists an AnalysisReport and returns its unique report_id.

        Never overwrites existing reports; always creates an immutable historical entry.
        """
        pass

    @abstractmethod
    def get_report(self, report_id: str) -> Optional[AnalysisReport]:
        """Retrieves and validates a single report by report_id."""
        pass

    @abstractmethod
    def list_reports_for_incident(
        self,
        incident_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> List[AnalysisReport]:
        """Lists all reports for an incident, ordered newest first."""
        pass

    @abstractmethod
    def list_reports_for_correlation(
        self,
        correlation_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> List[AnalysisReport]:
        """Lists all reports for a correlation_id, ordered newest first."""
        pass

    @abstractmethod
    def query_reports(
        self,
        incident_id: Optional[str] = None,
        correlation_id: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[AnalysisReport]:
        """Queries reports matching filters, ordered newest first."""
        pass

    @abstractmethod
    def count_reports(
        self,
        incident_id: Optional[str] = None,
        correlation_id: Optional[str] = None,
    ) -> int:
        """Returns the total number of reports matching filters."""
        pass

    @abstractmethod
    def close(self) -> None:
        """Closes store connections."""
        pass


class SQLiteReportStore(ReportStore):
    """SQLite-backed persistent store for investigation reports with concurrency safety."""

    def __init__(self, db_path: Optional[str] = None, timeout: float = 30.0):
        self.db_path = (
            db_path
            or os.environ.get("AGENTSHIELD_REPORTS_DB")
            or os.environ.get("AGENTSHIELD_REPORTS_DB_PATH", "agentshield_reports.db")
        )
        self.timeout = timeout
        self._lock = threading.RLock()
        self._shared_conn: Optional[sqlite3.Connection] = None

        if self.db_path == ":memory:":
            self._shared_conn = sqlite3.connect(":memory:", check_same_thread=False, timeout=self.timeout)
            self._shared_conn.row_factory = sqlite3.Row
            self._shared_conn.isolation_level = None
        else:
            db_dir = os.path.dirname(self.db_path)
            if db_dir and not os.path.exists(db_dir):
                os.makedirs(db_dir, exist_ok=True)

        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        if self._shared_conn is not None:
            return self._shared_conn
        conn = sqlite3.connect(self.db_path, timeout=self.timeout)
        conn.row_factory = sqlite3.Row
        conn.isolation_level = None
        try:
            conn.execute(f"PRAGMA busy_timeout = {int(self.timeout * 1000)};")
        except Exception:
            pass
        return conn

    def _close_connection(self, conn: sqlite3.Connection) -> None:
        if self._shared_conn is not None and conn is self._shared_conn:
            return
        conn.close()

    def _init_db(self) -> None:
        with self._lock:
            conn = self._get_connection()
            try:
                try:
                    conn.execute("PRAGMA journal_mode=WAL;")
                except Exception:
                    pass
                try:
                    conn.execute("PRAGMA busy_timeout=5000;")
                except Exception:
                    pass

                conn.execute("BEGIN IMMEDIATE")
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS investigation_reports (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        report_id TEXT UNIQUE NOT NULL,
                        incident_id TEXT,
                        correlation_id TEXT,
                        created_at TEXT NOT NULL,
                        schema_version TEXT NOT NULL,
                        analyst_model TEXT NOT NULL,
                        metadata TEXT NOT NULL,
                        content TEXT NOT NULL
                    );
                """)
                conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_inv_reports_incident
                    ON investigation_reports(incident_id);
                """)
                conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_inv_reports_correlation
                    ON investigation_reports(correlation_id);
                """)
                conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_inv_reports_created
                    ON investigation_reports(created_at);
                """)
                conn.execute("COMMIT")
            except Exception:
                try:
                    conn.execute("ROLLBACK")
                except Exception:
                    pass
                raise
            finally:
                self._close_connection(conn)

    def save_report(self, report: AnalysisReport) -> str:
        """Persists an AnalysisReport and returns its unique report_id.

        Guarantees atomicity and prevents overwriting existing reports.
        """
        if not report.report_id:
            report.report_id = f"rep_{uuid.uuid4().hex[:12]}"
        if not report.schema_version:
            report.schema_version = "1.0"
        if not report.generated_at:
            report.generated_at = datetime.now(timezone.utc).isoformat()

        content_json = json.dumps(report.to_dict())
        metadata_json = json.dumps(report.raw_metadata or {})

        with self._lock:
            conn = self._get_connection()
            try:
                conn.execute("BEGIN IMMEDIATE")

                # Verify that this report_id does not already exist
                row = conn.execute(
                    "SELECT 1 FROM investigation_reports WHERE report_id = ?",
                    (report.report_id,),
                ).fetchone()
                if row:
                    raise AnalysisValidationError(
                        f"Report '{report.report_id}' already exists. Investigation reports are immutable and cannot be overwritten."
                    )

                conn.execute(
                    """
                    INSERT INTO investigation_reports (
                        report_id, incident_id, correlation_id, created_at,
                        schema_version, analyst_model, metadata, content
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        report.report_id,
                        report.incident_id,
                        report.correlation_id,
                        report.generated_at,
                        report.schema_version,
                        report.analyst_model,
                        metadata_json,
                        content_json,
                    ),
                )
                conn.execute("COMMIT")
                return report.report_id
            except AnalysisValidationError:
                try:
                    conn.execute("ROLLBACK")
                except Exception:
                    pass
                raise
            except sqlite3.IntegrityError as e:
                try:
                    conn.execute("ROLLBACK")
                except Exception:
                    pass
                raise AnalysisValidationError(
                    f"Report '{report.report_id}' already exists. Investigation reports are immutable and cannot be overwritten."
                ) from e
            except Exception:
                try:
                    conn.execute("ROLLBACK")
                except Exception:
                    pass
                raise
            finally:
                self._close_connection(conn)

    def get_report(self, report_id: str) -> Optional[AnalysisReport]:
        """Retrieves and strictly validates a report by its report_id."""
        with self._lock:
            conn = self._get_connection()
            try:
                row = conn.execute(
                    "SELECT * FROM investigation_reports WHERE report_id = ?",
                    (report_id,),
                ).fetchone()
                if not row:
                    return None
                return self._row_to_report(row)
            finally:
                self._close_connection(conn)

    def list_reports_for_incident(
        self,
        incident_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> List[AnalysisReport]:
        """Lists reports for an incident, ordered newest first."""
        return self.query_reports(incident_id=incident_id, limit=limit, offset=offset)

    def list_reports_for_correlation(
        self,
        correlation_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> List[AnalysisReport]:
        """Lists reports for a correlation ID, ordered newest first."""
        return self.query_reports(correlation_id=correlation_id, limit=limit, offset=offset)

    def query_reports(
        self,
        incident_id: Optional[str] = None,
        correlation_id: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[AnalysisReport]:
        """Queries reports matching filters, ordered newest first."""
        safe_limit = max(1, min(limit, 500))
        safe_offset = max(0, offset)

        clauses = []
        params = []

        if incident_id:
            clauses.append("incident_id = ?")
            params.append(incident_id)
        if correlation_id:
            clauses.append("correlation_id = ?")
            params.append(correlation_id)

        where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        query_sql = f"""
            SELECT * FROM investigation_reports
            {where_sql}
            ORDER BY id DESC
            LIMIT ? OFFSET ?
        """
        params.extend([safe_limit, safe_offset])

        with self._lock:
            conn = self._get_connection()
            try:
                rows = conn.execute(query_sql, params).fetchall()
                return [self._row_to_report(row) for row in rows]
            finally:
                self._close_connection(conn)

    def count_reports(
        self,
        incident_id: Optional[str] = None,
        correlation_id: Optional[str] = None,
    ) -> int:
        """Returns total count of reports matching filters."""
        clauses = []
        params = []

        if incident_id:
            clauses.append("incident_id = ?")
            params.append(incident_id)
        if correlation_id:
            clauses.append("correlation_id = ?")
            params.append(correlation_id)

        where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        query_sql = f"SELECT COUNT(*) AS cnt FROM investigation_reports {where_sql}"

        with self._lock:
            conn = self._get_connection()
            try:
                row = conn.execute(query_sql, params).fetchone()
                return int(row["cnt"]) if row else 0
            finally:
                self._close_connection(conn)

    def _row_to_report(self, row: sqlite3.Row) -> AnalysisReport:
        """Parses and strictly validates stored content into an AnalysisReport."""
        try:
            content_dict = json.loads(row["content"])
        except Exception as e:
            raise AnalysisValidationError(f"Malformed JSON in stored report '{row['report_id']}': {str(e)}") from e

        if not isinstance(content_dict, dict):
            raise AnalysisValidationError(f"Stored report content is not a JSON object in report '{row['report_id']}'")

        try:
            report = AnalysisReport(**content_dict)
            report.report_id = row["report_id"]
            if row["incident_id"] and not report.incident_id:
                report.incident_id = row["incident_id"]
            if row["correlation_id"] and not report.correlation_id:
                report.correlation_id = row["correlation_id"]
            report.schema_version = row["schema_version"]
            return report
        except Exception as e:
            raise AnalysisValidationError(f"Invalid schema in stored report '{row['report_id']}': {str(e)}") from e

    def close(self) -> None:
        with self._lock:
            if self._shared_conn is not None:
                try:
                    self._shared_conn.close()
                except Exception:
                    pass
                self._shared_conn = None


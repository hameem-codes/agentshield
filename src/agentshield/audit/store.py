"""
Audit storage interface and SQLite implementation for AgentShield.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
import json
import os
import re
import sqlite3
from typing import Any, Dict, List, Optional
from agentshield.models import Decision, DecisionValue, RiskLevel

# Sensitive key patterns for automatic redaction in arguments
SENSITIVE_KEY_PATTERN = re.compile(
    r"(?:api[_\s-]?key|password|secret|token|credential|auth|bearer|private[_\s-]?key)",
    re.IGNORECASE
)

def redact_sensitive_data(obj: Any) -> Any:
    """Recursively redacts sensitive keys and values in arguments."""
    if isinstance(obj, dict):
        redacted = {}
        for k, v in obj.items():
            key_str = str(k)
            if SENSITIVE_KEY_PATTERN.search(key_str):
                redacted[key_str] = "[REDACTED]"
            else:
                redacted[key_str] = redact_sensitive_data(v)
        return redacted
    elif isinstance(obj, (list, tuple, set)):
        return [redact_sensitive_data(item) for item in obj]
    elif isinstance(obj, str):
        if SENSITIVE_KEY_PATTERN.search(obj) and len(obj) > 8:
            return "[REDACTED]"
        return obj
    return obj

@dataclass
class AuditRecord:
    id: Optional[int] = None
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    agent: str = "unknown"
    tool: str = "unknown"
    arguments: Dict[str, Any] = field(default_factory=dict)
    decision: str = "BLOCK"
    allowed: bool = False
    reasons: List[str] = field(default_factory=list)
    rules_triggered: List[str] = field(default_factory=list)
    risk_score: float = 0.0
    severity: str = "LOW"
    risk_factors: List[str] = field(default_factory=list)
    execution_status: str = "not_executed"
    error: Optional[str] = None

class AuditStore(ABC):
    """Abstract Audit Storage interface (allows replacing SQLite with PostgreSQL later)."""

    @abstractmethod
    def log_decision(
        self,
        decision: Decision,
        arguments: Optional[Dict[str, Any]] = None,
        execution_status: str = "not_executed",
        error: Optional[str] = None
    ) -> int:
        """Logs an authorization decision and its execution status."""
        pass

    @abstractmethod
    def query(
        self,
        decision: Optional[str] = None,
        agent: Optional[str] = None,
        tool: Optional[str] = None,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        limit: int = 50,
    ) -> List[AuditRecord]:
        """Queries stored audit events with filtering."""
        pass

class SQLiteAuditStore(AuditStore):
    """Thread-safe SQLite audit storage implementation."""

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or os.environ.get("AGENTSHIELD_AUDIT_DB", "agentshield_audit.db")
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        conn = self._get_connection()
        try:
            with conn:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS audit_logs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        timestamp TEXT NOT NULL,
                        agent TEXT NOT NULL,
                        tool TEXT NOT NULL,
                        arguments TEXT NOT NULL,
                        decision TEXT NOT NULL,
                        allowed INTEGER NOT NULL,
                        reasons TEXT NOT NULL,
                        rules_triggered TEXT NOT NULL,
                        risk_score REAL NOT NULL,
                        severity TEXT NOT NULL,
                        risk_factors TEXT NOT NULL,
                        execution_status TEXT NOT NULL,
                        error TEXT
                    );
                """)
                conn.execute("CREATE INDEX IF NOT EXISTS idx_audit_decision ON audit_logs(decision);")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_audit_agent ON audit_logs(agent);")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_audit_tool ON audit_logs(tool);")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);")
        finally:
            conn.close()

    def log_decision(
        self,
        decision: Decision,
        arguments: Optional[Dict[str, Any]] = None,
        execution_status: str = "not_executed",
        error: Optional[str] = None
    ) -> int:
        cleaned_args = redact_sensitive_data(arguments or {})
        rules = [r.split(":")[0].strip() for r in decision.reasons if ":" in r]
        
        timestamp = datetime.now(timezone.utc).isoformat()
        decision_str = decision.decision.value if hasattr(decision.decision, "value") else str(decision.decision)
        severity_str = decision.severity.value if hasattr(decision.severity, "value") else str(decision.severity)

        conn = self._get_connection()
        try:
            with conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO audit_logs (
                        timestamp, agent, tool, arguments, decision, allowed,
                        reasons, rules_triggered, risk_score, severity,
                        risk_factors, execution_status, error
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    timestamp,
                    decision.agent,
                    decision.tool,
                    json.dumps(cleaned_args),
                    decision_str,
                    1 if decision.allowed else 0,
                    json.dumps(decision.reasons),
                    json.dumps(rules),
                    float(decision.risk_score),
                    severity_str,
                    json.dumps([]),
                    execution_status,
                    error
                ))
                return cursor.lastrowid or 0
        finally:
            conn.close()

    def query(
        self,
        decision: Optional[str] = None,
        agent: Optional[str] = None,
        tool: Optional[str] = None,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        limit: int = 50,
    ) -> List[AuditRecord]:
        conditions: List[str] = []
        params: List[Any] = []

        if decision:
            conditions.append("decision = ?")
            params.append(decision.upper())
        if agent:
            conditions.append("agent = ?")
            params.append(agent)
        if tool:
            conditions.append("tool = ?")
            params.append(tool)
        if start_time:
            conditions.append("timestamp >= ?")
            params.append(start_time)
        if end_time:
            conditions.append("timestamp <= ?")
            params.append(end_time)

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        query_sql = f"""
            SELECT id, timestamp, agent, tool, arguments, decision, allowed,
                   reasons, rules_triggered, risk_score, severity, risk_factors,
                   execution_status, error
            FROM audit_logs
            {where_clause}
            ORDER BY id DESC
            LIMIT ?
        """
        params.append(limit)

        records: List[AuditRecord] = []
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(query_sql, params)
            for row in cursor.fetchall():
                records.append(
                    AuditRecord(
                        id=row["id"],
                        timestamp=row["timestamp"],
                        agent=row["agent"],
                        tool=row["tool"],
                        arguments=json.loads(row["arguments"]),
                        decision=row["decision"],
                        allowed=bool(row["allowed"]),
                        reasons=json.loads(row["reasons"]),
                        rules_triggered=json.loads(row["rules_triggered"]),
                        risk_score=row["risk_score"],
                        severity=row["severity"],
                        risk_factors=json.loads(row["risk_factors"]),
                        execution_status=row["execution_status"],
                        error=row["error"],
                    )
                )
            return records
        finally:
            conn.close()

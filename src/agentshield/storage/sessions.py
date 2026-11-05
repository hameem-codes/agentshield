"""
PostgreSQL Session Store for AgentShield.

Provides multi-instance session revocation consistency across serverless workers.
"""

import logging
import time
from typing import Optional

from agentshield.storage.connection import PostgresConnectionManager

logger = logging.getLogger("agentshield.storage.sessions")


class PostgresSessionStore:
    """PostgreSQL implementation of SessionStore protocol."""

    def __init__(self, dsn: str, connection_manager: Optional[PostgresConnectionManager] = None):
        self.connection_manager = connection_manager or PostgresConnectionManager(dsn=dsn)
        self.init_db()

    def init_db(self) -> None:
        """Initializes sessions table and index."""
        with self.connection_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    token_hash VARCHAR(128) PRIMARY KEY,
                    "user" VARCHAR(128) NOT NULL,
                    created_at DOUBLE PRECISION NOT NULL,
                    expires_at DOUBLE PRECISION NOT NULL,
                    revoked INTEGER NOT NULL DEFAULT 0
                );
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);")

    def save_session(self, token_hash: str, user: str, created_at: float, expires_at: float) -> None:
        with self.connection_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO sessions (token_hash, "user", created_at, expires_at, revoked)
                VALUES (%s, %s, %s, %s, 0)
                ON CONFLICT (token_hash) DO UPDATE SET
                    "user" = EXCLUDED."user",
                    expires_at = EXCLUDED.expires_at,
                    revoked = 0;
            """, (token_hash, user, created_at, expires_at))

    def is_revoked(self, token_hash: str) -> bool:
        with self.connection_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT revoked, expires_at FROM sessions WHERE token_hash = %s;', (token_hash,))
            row = cursor.fetchone()
            if not row:
                return False
            revoked, expires_at = row[0], row[1]
            if revoked == 1 or expires_at < time.time():
                return True
            return False

    def revoke_session(self, token_hash: str) -> bool:
        now = time.time()
        with self.connection_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('UPDATE sessions SET revoked = 1 WHERE token_hash = %s;', (token_hash,))
            if cursor.rowcount == 0:
                cursor.execute("""
                    INSERT INTO sessions (token_hash, "user", created_at, expires_at, revoked)
                    VALUES (%s, 'unknown', %s, %s, 1);
                """, (token_hash, now, now + 86400))
            return True

    def cleanup_expired(self) -> int:
        now = time.time()
        with self.connection_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM sessions WHERE expires_at < %s;", (now,))
            return cursor.rowcount


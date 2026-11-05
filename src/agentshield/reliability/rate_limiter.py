"""
Distributed rate limiting subsystem for AgentShield.

Supports in-memory (testing), SQLite (local development), and PostgreSQL
(multi-instance serverless production) with unified sliding-window semantics.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
import logging
import os
import sqlite3
import threading
import time
from typing import Dict, List, Optional

from agentshield.storage.connection import PostgresConnectionManager

logger = logging.getLogger("agentshield.reliability.rate_limiter")


@dataclass
class RateLimitResult:
    """Result of a rate limit check."""
    allowed: bool
    limit: int
    remaining: int
    reset_after: float
    retry_after: float

    def to_headers(self) -> Dict[str, str]:
        """Formats standard HTTP rate-limiting headers."""
        headers = {
            "X-RateLimit-Limit": str(self.limit),
            "X-RateLimit-Remaining": str(max(0, self.remaining)),
            "X-RateLimit-Reset": str(int(time.time() + self.reset_after)),
        }
        if not self.allowed:
            headers["Retry-After"] = str(max(1, int(self.retry_after)))
        return headers


class BaseRateLimiter(ABC):
    """Abstract rate limiter interface."""

    @abstractmethod
    def check(self, key: str, max_requests: int, window_seconds: float) -> RateLimitResult:
        """Evaluates whether an action identified by key is allowed within the sliding window."""
        pass

    @abstractmethod
    def reset(self, key: Optional[str] = None) -> None:
        """Resets rate limit tracking for a specific key, or all keys if key is None."""
        pass


class InMemoryRateLimiter(BaseRateLimiter):
    """Thread-safe in-memory sliding-window rate limiter."""

    def __init__(self):
        self._lock = threading.Lock()
        self._events: Dict[str, List[float]] = {}

    def check(self, key: str, max_requests: int, window_seconds: float) -> RateLimitResult:
        now = time.time()
        window_start = now - window_seconds

        with self._lock:
            timestamps = self._events.setdefault(key, [])
            valid_timestamps = [t for t in timestamps if t > window_start]
            self._events[key] = valid_timestamps

            count = len(valid_timestamps)
            if count >= max_requests:
                oldest = valid_timestamps[0]
                retry_after = max(0.1, (oldest + window_seconds) - now)
                reset_after = retry_after
                return RateLimitResult(
                    allowed=False,
                    limit=max_requests,
                    remaining=0,
                    reset_after=reset_after,
                    retry_after=retry_after,
                )

            valid_timestamps.append(now)
            remaining = max(0, max_requests - len(valid_timestamps))
            oldest = valid_timestamps[0]
            reset_after = max(0.1, (oldest + window_seconds) - now)
            return RateLimitResult(
                allowed=True,
                limit=max_requests,
                remaining=remaining,
                reset_after=reset_after,
                retry_after=0.0,
            )

    def reset(self, key: Optional[str] = None) -> None:
        with self._lock:
            if key is not None:
                self._events.pop(key, None)
            else:
                self._events.clear()


class SqliteRateLimiter(BaseRateLimiter):
    """SQLite-backed persistent rate limiter for local development and single-instance deployments.

    State Scope:
        - Local SQLite database file.
        - Single-instance or development environments only.
        - In serverless environments (e.g. Vercel `/tmp`), state is ephemeral to that specific container.
    """

    def __init__(self, db_path: Optional[str] = None, timeout: float = 30.0):
        self.db_path = db_path or os.environ.get("AGENTSHIELD_RATE_LIMIT_DB", ":memory:")
        self.timeout = timeout
        self._lock = threading.Lock()
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
        return conn

    def _close_connection(self, conn: sqlite3.Connection) -> None:
        if self._shared_conn is not None and conn is self._shared_conn:
            return
        conn.close()

    def _init_db(self) -> None:
        with self._lock:
            conn = self._get_connection()
            try:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS rate_limit_events (
                        key TEXT NOT NULL,
                        timestamp REAL NOT NULL
                    );
                """)
                conn.execute("CREATE INDEX IF NOT EXISTS idx_rate_limit_key_ts ON rate_limit_events(key, timestamp);")
            finally:
                self._close_connection(conn)

    def check(self, key: str, max_requests: int, window_seconds: float) -> RateLimitResult:
        now = time.time()
        window_start = now - window_seconds

        try:
            with self._lock:
                conn = self._get_connection()
                try:
                    cursor = conn.cursor()
                    cursor.execute(
                        "SELECT timestamp FROM rate_limit_events WHERE key = ? AND timestamp > ? ORDER BY timestamp ASC;",
                        (key, window_start),
                    )
                    rows = cursor.fetchall()
                    count = len(rows)

                    # Periodic cleanup of expired events for this key
                    cursor.execute("DELETE FROM rate_limit_events WHERE key = ? AND timestamp <= ?;", (key, window_start))

                    if count >= max_requests:
                        oldest = float(rows[0][0])
                        retry_after = max(0.1, (oldest + window_seconds) - now)
                        return RateLimitResult(
                            allowed=False,
                            limit=max_requests,
                            remaining=0,
                            reset_after=retry_after,
                            retry_after=retry_after,
                        )

                    cursor.execute("INSERT INTO rate_limit_events (key, timestamp) VALUES (?, ?);", (key, now))
                    remaining = max(0, max_requests - (count + 1))
                    oldest = float(rows[0][0]) if count > 0 else now
                    reset_after = max(0.1, (oldest + window_seconds) - now)

                    return RateLimitResult(
                        allowed=True,
                        limit=max_requests,
                        remaining=remaining,
                        reset_after=reset_after,
                        retry_after=0.0,
                    )
                finally:
                    self._close_connection(conn)
        except Exception as e:
            logger.error(f"SqliteRateLimiter error: {e}. Failing closed.")
            return RateLimitResult(
                allowed=False,
                limit=max_requests,
                remaining=0,
                reset_after=window_seconds,
                retry_after=max(1.0, window_seconds),
            )

    def reset(self, key: Optional[str] = None) -> None:
        with self._lock:
            conn = self._get_connection()
            try:
                if key is not None:
                    conn.execute("DELETE FROM rate_limit_events WHERE key = ?;", (key,))
                else:
                    conn.execute("DELETE FROM rate_limit_events;")
            finally:
                self._close_connection(conn)


class PostgresRateLimiter(BaseRateLimiter):
    """PostgreSQL persistent sliding-window rate limiter for multi-instance serverless deployments.

    State Scope:
        - Shared across all service instances via the central PostgreSQL `rate_limit_events` table.
        - Multi-instance serverless production rate limiter.
        - Fails closed (`allowed=False`) if the database is unavailable when distributed enforcement is required.
    """

    def __init__(self, dsn: str, connection_manager: Optional[PostgresConnectionManager] = None):
        self.dsn = dsn
        self.connection_manager = connection_manager or PostgresConnectionManager(dsn=dsn)
        self.init_db()

    def init_db(self) -> None:
        try:
            with self.connection_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS rate_limit_events (
                        id BIGSERIAL PRIMARY KEY,
                        key VARCHAR(256) NOT NULL,
                        timestamp DOUBLE PRECISION NOT NULL
                    );
                """)
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_rate_limit_key_ts ON rate_limit_events(key, timestamp DESC);")
        except Exception as e:
            logger.warning(f"PostgresRateLimiter schema init deferred/failed: {e}")

    def check(self, key: str, max_requests: int, window_seconds: float) -> RateLimitResult:
        now = time.time()
        window_start = now - window_seconds

        try:
            with self.connection_manager.get_connection() as conn:
                cursor = conn.cursor()
                # Prune and query inside transaction
                cursor.execute(
                    "SELECT timestamp FROM rate_limit_events WHERE key = %s AND timestamp > %s ORDER BY timestamp ASC;",
                    (key, window_start),
                )
                rows = cursor.fetchall()
                count = len(rows)

                # Prune expired events for this key
                cursor.execute("DELETE FROM rate_limit_events WHERE key = %s AND timestamp <= %s;", (key, window_start))

                if count >= max_requests:
                    oldest = float(rows[0][0])
                    retry_after = max(0.1, (oldest + window_seconds) - now)
                    return RateLimitResult(
                        allowed=False,
                        limit=max_requests,
                        remaining=0,
                        reset_after=retry_after,
                        retry_after=retry_after,
                    )

                cursor.execute("INSERT INTO rate_limit_events (key, timestamp) VALUES (%s, %s);", (key, now))
                remaining = max(0, max_requests - (count + 1))
                oldest = float(rows[0][0]) if count > 0 else now
                reset_after = max(0.1, (oldest + window_seconds) - now)

                return RateLimitResult(
                    allowed=True,
                    limit=max_requests,
                    remaining=remaining,
                    reset_after=reset_after,
                    retry_after=0.0,
                )
        except Exception as e:
            logger.error(f"PostgresRateLimiter error: {e}. Failing closed.")
            return RateLimitResult(
                allowed=False,
                limit=max_requests,
                remaining=0,
                reset_after=window_seconds,
                retry_after=max(1.0, window_seconds),
            )

    def reset(self, key: Optional[str] = None) -> None:
        with self.connection_manager.get_connection() as conn:
            cursor = conn.cursor()
            if key is not None:
                cursor.execute("DELETE FROM rate_limit_events WHERE key = %s;", (key,))
            else:
                cursor.execute("DELETE FROM rate_limit_events;")


def create_rate_limiter(
    backend: str = "sqlite",
    dsn: Optional[str] = None,
    connection_manager: Optional[PostgresConnectionManager] = None,
    db_path: Optional[str] = None,
) -> BaseRateLimiter:
    """Instantiates the appropriate rate limiter based on storage backend."""
    if backend == "postgres":
        if not dsn:
            from agentshield.storage.config import get_database_url
            dsn = get_database_url()
        if not dsn:
            raise ValueError("dsn required for PostgresRateLimiter")
        return PostgresRateLimiter(dsn=dsn, connection_manager=connection_manager)
    elif backend == "in_memory":
        return InMemoryRateLimiter()
    else:
        return SqliteRateLimiter(db_path=db_path)

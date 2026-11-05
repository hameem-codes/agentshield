"""
Unit and integration tests for AgentShield Phase 7: Reliability Controls.

Verifies:
1. Execution limits (tool timeouts, session tool-call budget, payload argument size limit).
2. Distributed sliding-window rate limiting (in-memory, SQLite, PostgreSQL mock, HTTP 429 headers).
3. Tool loop and cycle detection (consecutive identical calls, cyclic patterns, pagination allowances).
4. External provider reliability & circuit breakers (CLOSED -> OPEN -> HALF-OPEN, fast fail, token budget).
5. Advisory-only Gemini boundary (provider failures never fabricate ALLOW or weaken policy).
"""

import json
import sqlite3
import threading
import time
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from agentshield.shield import Shield, ExecutionStatus
from agentshield.models import DecisionValue, RiskLevel
from agentshield.events import EventType, EventSeverity
from agentshield.audit import SQLiteAuditStore
from agentshield.review import SQLiteReviewStore
from agentshield.events import SQLiteEventStore
from agentshield.api.app import create_app
from agentshield.reliability.config import ReliabilityConfig, parse_rate_limit
from agentshield.reliability.limits import (
    ToolExecutionTimeoutError,
    ToolCallBudgetExceededError,
    PayloadSizeLimitError,
    TokenBudgetExceededError,
    SessionBudgetTracker,
    TokenBudgetTracker,
    CancellationToken,
    SafeExecutionContext,
    OperationCancelledError,
    check_arguments_size,
    execute_with_timeout,
)
from agentshield.reliability.loop_detector import (
    LoopDetector,
    compute_call_fingerprint,
)
from agentshield.reliability.circuit_breaker import (
    CircuitBreaker,
    CircuitBreakerOpenError,
    CircuitState,
)
from agentshield.reliability.rate_limiter import (
    InMemoryRateLimiter,
    SqliteRateLimiter,
    PostgresRateLimiter,
    create_rate_limiter,
)
from agentshield.analyst.providers.gemini import GeminiProvider
from agentshield.analyst.models import ProviderError


# ==============================================================================
# 1. Execution Limits Tests
# ==============================================================================

def test_tool_execution_timeout_raises_and_records_error():
    """Verify that a tool exceeding configured execution timeout stops safely and records ERROR status."""
    rel_cfg = ReliabilityConfig(max_tool_execution_seconds=0.15)
    audit_store = SQLiteAuditStore(db_path=":memory:")
    event_store = SQLiteEventStore(db_path=":memory:")
    shield = Shield(
        audit_store=audit_store,
        event_store=event_store,
        reliability_config=rel_cfg,
    )

    def slow_tool(args):
        time.sleep(0.5)
        return {"done": True}

    shield.registry.register("create_order", slow_tool)

    result = shield.execute("shopping_agent", "create_order", {"product_id": "p1", "quantity": 1})
    assert result.execution_status == ExecutionStatus.ERROR
    assert "timed out after 0.1 seconds" in result.error or "timed out after 0.2 seconds" in result.error

    # Verify audit record marked as error
    records = audit_store.query(limit=10)
    assert len(records) >= 1
    assert records[0].execution_status == "error"
    assert "timed out" in (records[0].error or "")

    # Verify execution outcome event emitted with ERROR
    events = event_store.query_events(tool="create_order")
    assert any(e.event_type == EventType.EXECUTION_OUTCOME.value and e.decision == "ERROR" for e in events)


def test_tool_execution_within_timeout_succeeds():
    """Verify that a fast tool completing well within timeout succeeds normally."""
    rel_cfg = ReliabilityConfig(max_tool_execution_seconds=1.0)
    shield = Shield(reliability_config=rel_cfg)

    def fast_tool(args):
        return {"status": "success", "echo": args.get("val")}

    shield.registry.register("create_order", fast_tool)

    result = shield.execute("shopping_agent", "create_order", {"quantity": 2, "val": 42})
    assert result.execution_status == ExecutionStatus.EXECUTED
    assert result.tool_result == {"status": "success", "echo": 42}
    assert result.error is None


def test_session_tool_call_budget_exceeded():
    """Verify that exceeding session tool-call budget deterministically produces BLOCK."""
    rel_cfg = ReliabilityConfig(max_tool_calls_per_session=3)
    event_store = SQLiteEventStore(db_path=":memory:")
    shield = Shield(
        event_store=event_store,
        reliability_config=rel_cfg,
    )

    session_id = "sess_budget_test_01"
    # Calls 1, 2, 3 should succeed
    for i in range(3):
        dec = shield.authorize("shopping_agent", "search_product", {"query": f"item_{i}", "correlation_id": session_id})
        assert dec.decision == DecisionValue.ALLOW

    # Call 4 exceeds limit -> BLOCK
    dec4 = shield.authorize("shopping_agent", "search_product", {"query": "item_4", "correlation_id": session_id})
    assert dec4.decision == DecisionValue.BLOCK
    assert any("budget exceeded" in r.lower() for r in dec4.reasons)

    # Different session is unaffected
    dec_other = shield.authorize("shopping_agent", "search_product", {"query": "item_1", "correlation_id": "sess_budget_test_02"})
    assert dec_other.decision == DecisionValue.ALLOW


def test_payload_size_limit_exceeded():
    """Verify that arguments exceeding maximum byte limit deterministically produce BLOCK."""
    rel_cfg = ReliabilityConfig(max_arguments_bytes=300)
    event_store = SQLiteEventStore(db_path=":memory:")
    shield = Shield(
        event_store=event_store,
        reliability_config=rel_cfg,
    )

    # Large payload (1000 bytes)
    oversized_args = {"product_id": "p1", "notes": "A" * 1000}
    dec = shield.authorize("shopping_agent", "create_order", oversized_args)

    assert dec.decision == DecisionValue.BLOCK
    assert any("payload size limit exceeded" in r.lower() for r in dec.reasons)

    # Normal payload passes
    normal_args = {"product_id": "p1", "quantity": 1}
    dec_ok = shield.authorize("shopping_agent", "create_order", normal_args)
    assert dec_ok.decision == DecisionValue.ALLOW


# ==============================================================================
# 2. Rate Limiting Tests
# ==============================================================================

def test_parse_rate_limit_specifications():
    """Verify parsing various rate limit string specifications."""
    assert parse_rate_limit("120/60s") == (120, 60.0)
    assert parse_rate_limit("20/minute") == (20, 60.0)
    assert parse_rate_limit("10/s") == (10, 1.0)
    assert parse_rate_limit("5/10sec") == (5, 10.0)
    assert parse_rate_limit("100/hour") == (100, 3600.0)
    assert parse_rate_limit("50") == (50, 60.0)
    assert parse_rate_limit("") == (120, 60.0)


def test_in_memory_rate_limiter_sliding_window():
    """Verify in-memory sliding-window throttling and header generation."""
    limiter = InMemoryRateLimiter()
    key = "test_client_01"

    # Limit: 3 requests per 2.0 seconds
    res1 = limiter.check(key, max_requests=3, window_seconds=2.0)
    assert res1.allowed is True
    assert res1.remaining == 2

    res2 = limiter.check(key, max_requests=3, window_seconds=2.0)
    assert res2.allowed is True
    assert res2.remaining == 1

    res3 = limiter.check(key, max_requests=3, window_seconds=2.0)
    assert res3.allowed is True
    assert res3.remaining == 0

    # 4th request exceeds limit
    res4 = limiter.check(key, max_requests=3, window_seconds=2.0)
    assert res4.allowed is False
    assert res4.remaining == 0
    assert res4.retry_after > 0.0

    headers = res4.to_headers()
    assert headers["X-RateLimit-Limit"] == "3"
    assert headers["X-RateLimit-Remaining"] == "0"
    assert "Retry-After" in headers
    assert int(headers["Retry-After"]) >= 1

    # Reset allows immediate execution
    limiter.reset(key)
    res_after_reset = limiter.check(key, max_requests=3, window_seconds=2.0)
    assert res_after_reset.allowed is True


def test_sqlite_rate_limiter_persistence():
    """Verify SQLite-backed persistent rate limiting and event pruning."""
    limiter = SqliteRateLimiter(db_path=":memory:")
    key = "sqlite_key_01"

    # 2 requests per 1.0 second
    r1 = limiter.check(key, max_requests=2, window_seconds=1.0)
    assert r1.allowed is True
    assert r1.remaining == 1

    r2 = limiter.check(key, max_requests=2, window_seconds=1.0)
    assert r2.allowed is True
    assert r2.remaining == 0

    # 3rd request blocked
    r3 = limiter.check(key, max_requests=2, window_seconds=1.0)
    assert r3.allowed is False
    assert r3.retry_after > 0.0

    # Key reset clears records
    limiter.reset(key)
    r4 = limiter.check(key, max_requests=2, window_seconds=1.0)
    assert r4.allowed is True


def test_postgres_rate_limiter_mocked():
    """Verify PostgresRateLimiter queries and atomic transaction semantics using mock connection."""
    mock_cm = MagicMock()
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_cm.get_connection.return_value.__enter__.return_value = mock_conn
    mock_conn.cursor.return_value = mock_cursor

    # Simulate 1 existing request in window
    now = time.time()
    mock_cursor.fetchall.return_value = [(now - 5.0,)]

    limiter = PostgresRateLimiter(dsn="postgresql://test:test@localhost:5432/testdb", connection_manager=mock_cm)
    res = limiter.check("pg_client_key", max_requests=3, window_seconds=60.0)

    assert res.allowed is True
    assert res.remaining == 1
    mock_cursor.execute.assert_any_call(
        "INSERT INTO rate_limit_events (key, timestamp) VALUES (%s, %s);",
        ("pg_client_key", pytest.approx(now, rel=1e-1))
    )


def test_shield_agent_and_tool_rate_limiting():
    """Verify that Shield.authorize() blocks requests when agent or tool rate limits are hit."""
    limiter = InMemoryRateLimiter()
    rel_cfg = ReliabilityConfig(
        rate_limit_agent="3/60s",
        rate_limit_tool="1/60s",
    )
    event_store = SQLiteEventStore(db_path=":memory:")
    shield = Shield(
        event_store=event_store,
        reliability_config=rel_cfg,
        rate_limiter=limiter,
    )

    # 1. First call on create_order
    dec1 = shield.authorize("shopping_agent", "create_order", {"product_id": "p1", "quantity": 1})
    assert dec1.decision == DecisionValue.ALLOW

    # 2. Second call on create_order hits tool limit (1/60s)
    dec2 = shield.authorize("shopping_agent", "create_order", {"product_id": "p2", "quantity": 1})
    assert dec2.decision == DecisionValue.BLOCK
    assert any("rate limit exceeded for tool" in r.lower() for r in dec2.reasons)

    # 3. Call on search_product: tool limit not exceeded yet, but agent limit allows 2 total
    dec3 = shield.authorize("shopping_agent", "search_product", {"query": "shoes"})
    assert dec3.decision == DecisionValue.ALLOW

    # 4. Next call hits agent limit (2/60s)
    dec4 = shield.authorize("shopping_agent", "search_product", {"query": "hats"})
    assert dec4.decision == DecisionValue.BLOCK
    assert any("rate limit exceeded for agent" in r.lower() for r in dec4.reasons)

    # Verify RATE_LIMIT_EXCEEDED security event
    events = event_store.query_events(agent_id="shopping_agent")
    assert any(e.event_type == EventType.RATE_LIMIT_EXCEEDED.value for e in events)


def test_api_public_rate_limiting_returns_429_with_headers():
    """Verify that public API endpoints return 429 Too Many Requests with standard retry headers."""
    with patch.dict("os.environ", {"AGENTSHIELD_RATE_LIMIT_PUBLIC": "2/60s"}):
        app = create_app(audit_db_path=":memory:")
        client = TestClient(app)

        payload = {"agent": "shopping_agent", "tool": "search_product", "arguments": {"query": "shoes"}}
        # First request succeeds
        res1 = client.post("/api/authorize", json=payload)
        assert res1.status_code == 200

        # Second request succeeds
        res2 = client.post("/api/authorize", json=payload)
        assert res2.status_code == 200

        # Third request exceeds 2/60s limit
        res3 = client.post("/api/authorize", json=payload)
        assert res3.status_code == 429
        assert "Retry-After" in res3.headers
        assert "X-RateLimit-Limit" in res3.headers
        assert res3.headers["X-RateLimit-Limit"] == "2"
        assert res3.headers["X-RateLimit-Remaining"] == "0"


# ==============================================================================
# 3. Loop Detection Tests
# ==============================================================================

def test_loop_consecutive_identical_calls_blocked():
    """Verify that repeating the exact same tool and arguments 3 times triggers loop BLOCK."""
    rel_cfg = ReliabilityConfig(loop_consecutive_limit=3)
    event_store = SQLiteEventStore(db_path=":memory:")
    shield = Shield(
        event_store=event_store,
        reliability_config=rel_cfg,
    )

    ctx = "loop_session_01"
    args = {"product_id": "prod_repeat", "quantity": 1, "correlation_id": ctx}

    # Calls 1 and 2 pass
    dec1 = shield.authorize("shopping_agent", "create_order", args)
    assert dec1.decision == DecisionValue.ALLOW

    dec2 = shield.authorize("shopping_agent", "create_order", args)
    assert dec2.decision == DecisionValue.ALLOW

    # 3rd identical call triggers loop detection BLOCK
    dec3 = shield.authorize("shopping_agent", "create_order", args)
    assert dec3.decision == DecisionValue.BLOCK
    assert any("loop detected" in r.lower() for r in dec3.reasons)

    events = event_store.query_events(tool="create_order")
    assert any(e.event_type == EventType.LOOP_DETECTED.value for e in events)


def test_loop_cyclic_pattern_blocked():
    """Verify that cyclic tool patterns (e.g. A -> B -> A -> B) trigger loop BLOCK."""
    detector = LoopDetector(consecutive_limit=5, cycle_limit=2)
    ctx = "cycle_session_01"

    # Pattern: search -> get -> search -> get
    res1 = detector.check(ctx, "search_product", {"q": "phone"})
    assert res1.is_loop is False

    res2 = detector.check(ctx, "get_product", {"id": "1"})
    assert res2.is_loop is False

    res3 = detector.check(ctx, "search_product", {"q": "phone"})
    assert res3.is_loop is False

    # Completes 2 full cycles of length 2 -> flagged
    res4 = detector.check(ctx, "get_product", {"id": "1"})
    assert res4.is_loop is True
    assert res4.loop_type == "cyclic_pattern"
    assert res4.cycle_length == 2
    assert "cyclic" in res4.pattern_description.lower()


def test_legitimate_repeated_calls_with_different_arguments_allowed():
    """Verify that pagination or polling different resources does NOT trigger loop detection."""
    rel_cfg = ReliabilityConfig(loop_consecutive_limit=3)
    shield = Shield(reliability_config=rel_cfg)
    ctx = "pagination_session_01"

    # Same tool, different pages/items
    dec1 = shield.authorize("shopping_agent", "search_product", {"query": "laptop", "page": 1, "correlation_id": ctx})
    assert dec1.decision == DecisionValue.ALLOW

    dec2 = shield.authorize("shopping_agent", "search_product", {"query": "laptop", "page": 2, "correlation_id": ctx})
    assert dec2.decision == DecisionValue.ALLOW

    dec3 = shield.authorize("shopping_agent", "search_product", {"query": "laptop", "page": 3, "correlation_id": ctx})
    assert dec3.decision == DecisionValue.ALLOW

    dec4 = shield.authorize("shopping_agent", "search_product", {"query": "laptop", "page": 4, "correlation_id": ctx})
    assert dec4.decision == DecisionValue.ALLOW


# ==============================================================================
# 4. Circuit Breaker & Provider Reliability Tests
# ==============================================================================

def test_circuit_breaker_state_transitions():
    """Verify CLOSED -> OPEN on threshold failures -> fast fail -> HALF-OPEN on timeout -> CLOSED on success."""
    cb = CircuitBreaker(
        service_name="test_service",
        failure_threshold=3,
        recovery_timeout=0.2,
        half_open_success_threshold=1,
    )

    assert cb.state == CircuitState.CLOSED

    # Record 2 failures; remains CLOSED
    cb.record_failure()
    cb.record_failure()
    assert cb.state == CircuitState.CLOSED

    # 3rd failure trips to OPEN
    cb.record_failure()
    assert cb.state == CircuitState.OPEN

    # Immediate call attempts fail fast with CircuitBreakerOpenError
    with pytest.raises(CircuitBreakerOpenError) as exc_info:
        cb.call(lambda: "should_not_run")
    assert "is OPEN" in str(exc_info.value)
    assert exc_info.value.retry_after > 0.0

    # Wait for recovery timeout
    time.sleep(0.25)
    assert cb.state == CircuitState.HALF_OPEN

    # Successful call in HALF_OPEN resets circuit to CLOSED
    res = cb.call(lambda: "recovered_result")
    assert res == "recovered_result"
    assert cb.state == CircuitState.CLOSED


def test_gemini_provider_circuit_breaker_fast_fail():
    """Verify GeminiProvider integrates circuit breaker and fails fast when open."""
    cb = CircuitBreaker(service_name="gemini", failure_threshold=2, recovery_timeout=10.0)
    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = Exception("503 Service Unavailable")

    provider = GeminiProvider(
        api_key="fake_key_123",
        client=mock_client,
        circuit_breaker=cb,
        max_retries=0,
    )

    # First call fails and records 1st failure
    with pytest.raises(ProviderError):
        provider.generate_analysis("test prompt", "system instruction")
    assert cb.state == CircuitState.CLOSED

    # Second call fails and trips breaker to OPEN
    with pytest.raises(ProviderError):
        provider.generate_analysis("test prompt", "system instruction")
    assert cb.state == CircuitState.OPEN

    # Third call fails fast with CircuitBreakerOpenError without invoking Gemini client again
    mock_client.models.generate_content.reset_mock()
    with pytest.raises(CircuitBreakerOpenError) as exc_info:
        provider.generate_analysis("test prompt", "system instruction")
    assert "is OPEN" in str(exc_info.value)
    mock_client.models.generate_content.assert_not_called()


def test_gemini_token_budget_exceeded():
    """Verify TokenBudgetTracker stops execution when cumulative tokens exceed budget."""
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = '{"report_id": "rep_1"}'
    mock_meta = MagicMock()
    mock_meta.total_token_count = 600
    mock_response.usage_metadata = mock_meta
    mock_client.models.generate_content.return_value = mock_response

    provider = GeminiProvider(
        api_key="fake_key_123",
        client=mock_client,
        token_budget=1000,
    )

    # 1st call consumes 600 tokens (budget 1000) -> succeeds
    out1 = provider.generate_analysis("prompt 1", "sys")
    assert out1 == '{"report_id": "rep_1"}'

    # 2nd call consumes another 600 tokens (total 1200 > 1000) -> raises ProviderError
    with pytest.raises(ProviderError) as exc_info:
        provider.generate_analysis("prompt 2", "sys")
    assert "token budget exceeded" in str(exc_info.value).lower()


def test_gemini_failure_never_affects_shield_authorization():
    """Verify non-negotiable rule: external provider failure never compromises deterministic policy or fabricates ALLOW."""
    shield = Shield()
    # Unregistered tool must fail closed with BLOCK
    dec = shield.authorize("shopping_agent", "unregistered_dangerous_tool", {"action": "delete"})
    assert dec.decision == DecisionValue.BLOCK
    assert dec.allowed is False

    # Policy denial must remain BLOCK regardless of external advisor state
    dec_denied = shield.authorize("shopping_agent", "refund_order", {"order_id": "ord_1", "amount": 50})
    assert dec_denied.decision == DecisionValue.BLOCK
    assert dec_denied.allowed is False


# ==============================================================================
# 5. Targeted Corrections: Enforceable Timeout, State Scope, Concurrency & Fail-Closed
# ==============================================================================

def test_tool_execution_timeout_does_not_hang_caller():
    """Verify that timed-out tool execution returns immediately and does not hang waiting for slow thread."""
    rel_cfg = ReliabilityConfig(max_tool_execution_seconds=0.1)
    shield = Shield(reliability_config=rel_cfg)

    def very_slow_tool(args):
        time.sleep(1.5)
        return {"done": True}

    shield.registry.register("create_order", very_slow_tool)

    t0 = time.time()
    result = shield.execute("shopping_agent", "create_order", {"product_id": "p1", "quantity": 1})
    elapsed = time.time() - t0

    assert result.execution_status == ExecutionStatus.ERROR
    assert "timed out after 0.1 seconds" in result.error
    # Must return promptly without waiting for the 1.5s sleep
    assert elapsed < 0.6, f"Caller hung for {elapsed:.2f}s instead of returning promptly on timeout"


def test_tool_side_effect_prevented_after_timeout():
    """Verify that a tool attempting side effects after timeout is halted via cooperative cancellation."""
    rel_cfg = ReliabilityConfig(max_tool_execution_seconds=0.08)
    shield = Shield(reliability_config=rel_cfg)

    side_effects = []

    def mutating_tool(args, context=None):
        time.sleep(0.18)
        # Safe execution contract: guard before performing side effect
        if context:
            context.guard_side_effect("write_order_db")
        side_effects.append("unauthorized_late_write")
        return {"written": True}

    shield.registry.register("create_order", mutating_tool)

    result = shield.execute("shopping_agent", "create_order", {"product_id": "p1", "quantity": 1})
    assert result.execution_status == ExecutionStatus.ERROR

    # Allow thread to wake up and attempt the guarded mutation
    time.sleep(0.25)

    # Assert that the side effect was prevented and never executed
    assert side_effects == [], "Side effect was executed after timeout occurred!"


def test_state_scope_session_budget_tracker():
    """Verify state scope of SessionBudgetTracker: per-process, partitioned per session context."""
    tracker = SessionBudgetTracker()

    # Session A accumulates across multiple calls in the same process
    assert tracker.check_and_increment("sess_A", 5) == 1
    assert tracker.check_and_increment("sess_A", 5) == 2
    assert tracker.get_count("sess_A") == 2

    # Session B is isolated within the same process
    assert tracker.check_and_increment("sess_B", 5) == 1
    assert tracker.get_count("sess_B") == 1
    assert tracker.get_count("sess_A") == 2

    # A separate tracker instance is process-local and independent
    fresh_tracker = SessionBudgetTracker()
    assert fresh_tracker.get_count("sess_A") == 0


def test_state_scope_token_budget_tracker():
    """Verify state scope of TokenBudgetTracker: per-process cumulative usage."""
    tracker = TokenBudgetTracker()
    tracker.record_and_check("gemini-3.8-flash", 250, 1000)
    tracker.record_and_check("gemini-3.8-flash", 300, 1000)
    assert tracker.get_usage("gemini-3.8-flash") == 550

    # Separate tracker instance is independent
    fresh_tracker = TokenBudgetTracker()
    assert fresh_tracker.get_usage("gemini-3.8-flash") == 0


def test_state_scope_loop_detector():
    """Verify state scope of LoopDetector: per-process, partitioned per session context."""
    detector = LoopDetector(consecutive_limit=2)

    # Session 1 records call
    res1 = detector.check("sess_1", "search_product", {"q": "laptop"})
    assert res1.is_loop is False

    # Repeating in session 1 trips loop
    res2 = detector.check("sess_1", "search_product", {"q": "laptop"})
    assert res2.is_loop is True

    # Same call in session 2 is isolated and not tripped
    res_other = detector.check("sess_2", "search_product", {"q": "laptop"})
    assert res_other.is_loop is False


def test_state_scope_circuit_breaker():
    """Verify state scope of CircuitBreaker: process-local instance health."""
    cb1 = CircuitBreaker("gemini_primary", failure_threshold=2)
    cb1.record_failure()
    cb1.record_failure()
    assert cb1.state == CircuitState.OPEN

    # Distinct instance has independent health state
    cb2 = CircuitBreaker("gemini_primary", failure_threshold=2)
    assert cb2.state == CircuitState.CLOSED


def test_circuit_breaker_single_probe_concurrency():
    """Verify that concurrent requests in HALF_OPEN state cannot all enter as probes; exactly one probe executes."""
    from concurrent.futures import ThreadPoolExecutor

    cb = CircuitBreaker("test_concurrent_service", failure_threshold=1, recovery_timeout=0.04)
    # Trip to OPEN
    cb.record_failure()
    assert cb.state == CircuitState.OPEN

    # Wait for recovery timeout to transition to HALF_OPEN
    time.sleep(0.06)
    assert cb.state == CircuitState.HALF_OPEN

    probe_invocations = []
    open_rejections = []

    def trial_probe():
        probe_invocations.append(threading.get_ident())
        time.sleep(0.12)  # Hold probe in-flight so concurrent calls see it
        return "probe_success"

    def worker_call():
        try:
            return cb.call(trial_probe)
        except CircuitBreakerOpenError as e:
            open_rejections.append(e)
            return "rejected"

    # Launch 10 concurrent requests simultaneously
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(worker_call) for _ in range(10)]
        results = [f.result() for f in futures]

    # Exactly 1 thread was allowed to run the probe
    assert len(probe_invocations) == 1, f"Expected exactly 1 probe, but {len(probe_invocations)} executed"
    assert results.count("probe_success") == 1
    # The other 9 threads failed fast with CircuitBreakerOpenError
    assert len(open_rejections) == 9
    assert results.count("rejected") == 9

    # Once the probe succeeded, circuit is fully CLOSED and healthy
    assert cb.state == CircuitState.CLOSED
    # Subsequent calls succeed normally
    assert cb.call(lambda: "subsequent_call") == "subsequent_call"


def test_postgres_rate_limiter_fails_closed_on_db_error():
    """Verify that PostgresRateLimiter fails closed with allowed=False when database connection fails."""
    mock_cm = MagicMock()
    mock_cm.get_connection.side_effect = Exception("Database connection refused")

    limiter = PostgresRateLimiter(
        dsn="postgresql://u:p@localhost:5432/db",
        connection_manager=mock_cm,
    )
    res = limiter.check("test_key", max_requests=10, window_seconds=60.0)

    # Must fail closed to prevent abuse during database outages
    assert res.allowed is False
    assert res.remaining == 0
    assert res.retry_after >= 1.0


def test_sqlite_rate_limiter_fails_closed_on_error():
    """Verify that SqliteRateLimiter fails closed when database execution fails."""
    limiter = SqliteRateLimiter(db_path=":memory:")
    # Force connection error
    limiter._shared_conn.close()

    res = limiter.check("test_key", max_requests=10, window_seconds=60.0)
    assert res.allowed is False
    assert res.remaining == 0


"""
AgentShield Reliability Controls Package.

Provides execution limits, distributed rate limiting, tool loop detection,
and circuit breakers for external provider reliability.
"""

from agentshield.reliability.circuit_breaker import (
    CircuitBreaker,
    CircuitBreakerOpenError,
    CircuitState,
)
from agentshield.reliability.config import (
    ReliabilityConfig,
    parse_rate_limit,
)
from agentshield.reliability.limits import (
    ExecutionLimitError,
    OperationCancelledError,
    PayloadSizeLimitError,
    SessionBudgetTracker,
    TokenBudgetExceededError,
    TokenBudgetTracker,
    ToolCallBudgetExceededError,
    ToolExecutionTimeoutError,
    CancellationToken,
    SafeExecutionContext,
    check_arguments_size,
    execute_with_timeout,
)
from agentshield.reliability.loop_detector import (
    LoopCheckResult,
    LoopDetector,
    compute_call_fingerprint,
)
from agentshield.reliability.rate_limiter import (
    BaseRateLimiter,
    InMemoryRateLimiter,
    PostgresRateLimiter,
    RateLimitResult,
    SqliteRateLimiter,
    create_rate_limiter,
)

__all__ = [
    "BaseRateLimiter",
    "CancellationToken",
    "CircuitBreaker",
    "CircuitBreakerOpenError",
    "CircuitState",
    "ExecutionLimitError",
    "InMemoryRateLimiter",
    "LoopCheckResult",
    "LoopDetector",
    "OperationCancelledError",
    "PayloadSizeLimitError",
    "PostgresRateLimiter",
    "RateLimitResult",
    "ReliabilityConfig",
    "SafeExecutionContext",
    "SessionBudgetTracker",
    "SqliteRateLimiter",
    "TokenBudgetExceededError",
    "TokenBudgetTracker",
    "ToolCallBudgetExceededError",
    "ToolExecutionTimeoutError",
    "check_arguments_size",
    "compute_call_fingerprint",
    "create_rate_limiter",
    "execute_with_timeout",
    "parse_rate_limit",
]


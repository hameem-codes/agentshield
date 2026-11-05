"""
Execution limits and resource budget controls for AgentShield.

Enforces execution timeouts, tool-call budgets per session/request,
payload argument size limits, and token budgets.
"""

from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
import json
import logging
import threading
from typing import Any, Callable, Dict, Optional

logger = logging.getLogger("agentshield.reliability.limits")


class ExecutionLimitError(RuntimeError):
    """Base exception for execution limit and resource budget violations."""
    pass


class OperationCancelledError(ExecutionLimitError):
    """Raised when an operation is cancelled due to execution timeout or context invalidation."""
    pass


class ToolExecutionTimeoutError(ExecutionLimitError):
    """Raised when a registered tool callable exceeds its allocated execution timeout."""
    def __init__(self, tool: str, timeout_seconds: float):
        self.tool = tool
        self.timeout_seconds = timeout_seconds
        super().__init__(f"Tool '{tool}' execution timed out after {timeout_seconds:.1f} seconds")


class ToolCallBudgetExceededError(ExecutionLimitError):
    """Raised when an agent or session exceeds maximum permitted tool calls."""
    def __init__(self, context_id: str, call_count: int, limit: int):
        self.context_id = context_id
        self.call_count = call_count
        self.limit = limit
        super().__init__(
            f"Execution budget exceeded: context '{context_id}' reached {call_count} calls (limit: {limit})"
        )


class PayloadSizeLimitError(ExecutionLimitError):
    """Raised when tool arguments or request payload exceeds configured byte limit."""
    def __init__(self, size_bytes: int, limit_bytes: int):
        self.size_bytes = size_bytes
        self.limit_bytes = limit_bytes
        super().__init__(f"Payload size limit exceeded: arguments size {size_bytes}B exceeds limit of {limit_bytes}B")


class TokenBudgetExceededError(ExecutionLimitError):
    """Raised when LLM token usage exceeds configured token budget."""
    def __init__(self, current_tokens: int, budget: int):
        self.current_tokens = current_tokens
        self.budget = budget
        super().__init__(f"Token budget exceeded: cumulative usage {current_tokens} exceeds budget of {budget}")


class CancellationToken:
    """Thread-safe cooperative cancellation token for bounded tool execution.

    Tool callables can inspect `is_cancelled` or call `check_cancelled()` to abort
    work and prevent post-timeout side effects.
    """

    def __init__(self):
        self._cancelled = threading.Event()

    def cancel(self) -> None:
        """Signals cancellation to all consumers of this token."""
        self._cancelled.set()

    @property
    def is_cancelled(self) -> bool:
        """Returns True if execution timeout or cancellation has been triggered."""
        return self._cancelled.is_set()

    def check_cancelled(self) -> None:
        """Raises OperationCancelledError if execution has been cancelled."""
        if self.is_cancelled:
            raise OperationCancelledError("Operation cancelled: tool execution timeout exceeded")


class SafeExecutionContext:
    """Explicit safe execution contract context passed to tool callables.

    Provides side-effect guards ensuring that timed-out tool threads cannot
    silently perform mutations or database operations after execution error.
    """

    def __init__(self, tool_name: str, cancellation_token: CancellationToken):
        self.tool_name = tool_name
        self.cancellation_token = cancellation_token

    @property
    def is_active(self) -> bool:
        return not self.cancellation_token.is_cancelled

    def guard_side_effect(self, action: str = "mutation") -> None:
        """Guards against executing side effects after a timeout has occurred.

        Raises OperationCancelledError if the tool has already timed out.
        """
        if not self.is_active():
            raise OperationCancelledError(
                f"Side effect '{action}' aborted: Tool '{self.tool_name}' timed out and execution context is invalidated"
            )


class SessionBudgetTracker:
    """Thread-safe tracker for tool execution budgets per session or correlation context.

    State Scope:
        - Per-process, thread-safe memory mapping.
        - Partitioned per session or correlation ID (`context_id`).
        - Shared across requests within the SAME process instance.
        - NOT distributed across multiple serverless/container instances.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._counts: Dict[str, int] = {}

    def check_and_increment(self, context_id: str, limit: int) -> int:
        """Increments and asserts that tool call count has not exceeded limit."""
        with self._lock:
            current = self._counts.get(context_id, 0)
            if current >= limit:
                raise ToolCallBudgetExceededError(context_id, current, limit)
            new_count = current + 1
            self._counts[context_id] = new_count
            return new_count

    def get_count(self, context_id: str) -> int:
        with self._lock:
            return self._counts.get(context_id, 0)

    def reset(self, context_id: Optional[str] = None) -> None:
        with self._lock:
            if context_id is not None:
                self._counts.pop(context_id, None)
            else:
                self._counts.clear()


class TokenBudgetTracker:
    """Thread-safe cumulative token budget tracker.

    State Scope:
        - Per-process, thread-safe memory mapping.
        - Cumulative token usage tracked per model or context key.
        - Preserved across requests within the SAME process.
        - NOT distributed across multiple serverless/container instances.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._usage: Dict[str, int] = {}

    def record_and_check(self, context_id: str, tokens: int, budget: int) -> int:
        """Records token usage and verifies cumulative tokens do not exceed budget."""
        with self._lock:
            current = self._usage.get(context_id, 0) + max(0, tokens)
            self._usage[context_id] = current
            if current > budget:
                raise TokenBudgetExceededError(current, budget)
            return current

    def get_usage(self, context_id: str) -> int:
        with self._lock:
            return self._usage.get(context_id, 0)

    def reset(self, context_id: Optional[str] = None) -> None:
        with self._lock:
            if context_id is not None:
                self._usage.pop(context_id, None)
            else:
                self._usage.clear()


def check_arguments_size(arguments: Any, max_bytes: int) -> None:
    """Calculates approximate payload byte size and raises PayloadSizeLimitError if exceeded."""
    if arguments is None or max_bytes <= 0:
        return

    try:
        if isinstance(arguments, (dict, list)):
            size = len(json.dumps(arguments, default=str).encode("utf-8"))
        elif isinstance(arguments, (bytes, bytearray)):
            size = len(arguments)
        else:
            size = len(str(arguments).encode("utf-8"))
    except Exception:
        size = len(str(arguments).encode("utf-8"))

    if size > max_bytes:
        raise PayloadSizeLimitError(size, max_bytes)


def execute_with_timeout(
    func: Callable[..., Any],
    args: tuple = (),
    kwargs: Optional[dict] = None,
    timeout_seconds: float = 30.0,
    tool_name: str = "unknown_tool",
    cancellation_token: Optional[CancellationToken] = None,
) -> Any:
    """Executes func with an enforceable timeout boundary.

    Uses ThreadPoolExecutor with non-blocking shutdown (`wait=False, cancel_futures=True`)
    so the calling thread is immediately released upon timeout without waiting for slow threads.
    When timeout occurs, signals the cooperative CancellationToken to prevent post-timeout side effects.
    """
    if timeout_seconds <= 0:
        return func(*args, **(kwargs or {}))

    token = cancellation_token or CancellationToken()
    executor = ThreadPoolExecutor(max_workers=1)
    try:
        future = executor.submit(func, *args, **(kwargs or {}))
        try:
            return future.result(timeout=timeout_seconds)
        except FuturesTimeoutError:
            token.cancel()
            raise ToolExecutionTimeoutError(tool_name, timeout_seconds)
    finally:
        # Crucial: shutdown(wait=False, cancel_futures=True) ensures the caller
        # is never blocked waiting for a slow/hanging thread to complete.
        executor.shutdown(wait=False, cancel_futures=True)


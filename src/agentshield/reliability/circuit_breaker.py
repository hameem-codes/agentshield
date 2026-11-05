"""
Circuit Breaker and External Provider Reliability for AgentShield.

Protects against cascade failures, repeated timeouts, and quota exhaustion
when interfacing with external providers (such as Google Gemini).
"""

from enum import Enum
import logging
import threading
import time
from typing import Any, Callable, Dict, Optional, Tuple, Type

logger = logging.getLogger("agentshield.reliability.circuit_breaker")


class CircuitState(str, Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitBreakerOpenError(RuntimeError):
    """Raised when an operation is attempted while the circuit breaker is OPEN."""

    def __init__(self, service_name: str, retry_after: float):
        self.service_name = service_name
        self.retry_after = max(1.0, retry_after)
        super().__init__(
            f"Circuit breaker for service '{service_name}' is OPEN due to repeated failures. "
            f"Retry after {self.retry_after:.1f}s."
        )


class CircuitBreaker:
    """Thread-safe circuit breaker protecting external service calls.

    State Scope:
        - Per-process instance.
        - Preserved across calls within the SAME process.
        - NOT distributed across multiple serverless/container instances.
    """

    def __init__(
        self,
        service_name: str = "external_provider",
        failure_threshold: int = 3,
        recovery_timeout: float = 30.0,
        half_open_success_threshold: int = 1,
    ):
        self.service_name = service_name
        self.failure_threshold = max(1, failure_threshold)
        self.recovery_timeout = max(0.01, recovery_timeout)
        self.half_open_success_threshold = max(1, half_open_success_threshold)

        self._lock = threading.Lock()
        self._state = CircuitState.CLOSED
        self._consecutive_failures = 0
        self._consecutive_successes = 0
        self._last_failure_time = 0.0
        self._probe_in_flight = False

    @property
    def state(self) -> CircuitState:
        with self._lock:
            self._reconcile_state()
            return self._state

    def _reconcile_state(self) -> None:
        """Internal transition from OPEN to HALF_OPEN after recovery timeout has elapsed."""
        if self._state == CircuitState.OPEN:
            elapsed = time.time() - self._last_failure_time
            if elapsed >= self.recovery_timeout:
                self._state = CircuitState.HALF_OPEN
                self._consecutive_successes = 0
                self._probe_in_flight = False
                logger.info(f"Circuit breaker for '{self.service_name}' transitioned to HALF_OPEN after {elapsed:.1f}s")
                try:
                    from agentshield.observability.logging import get_operational_logger
                    get_operational_logger().log_circuit_breaker(
                        self.service_name, "OPEN", "HALF_OPEN", f"Recovery timeout ({elapsed:.1f}s)"
                    )
                except Exception:
                    pass

    def reset(self) -> None:
        """Manually resets circuit breaker to CLOSED state."""
        with self._lock:
            self._state = CircuitState.CLOSED
            self._consecutive_failures = 0
            self._consecutive_successes = 0
            self._last_failure_time = 0.0
            self._probe_in_flight = False

    def acquire_execution(self) -> None:
        """Acquires execution permission from the circuit breaker.

        Enforces strict single-probe concurrency: when in HALF_OPEN state, only ONE
        thread may run as the trial probe. Concurrent requests immediately fail fast
        with CircuitBreakerOpenError until the probe determines service health.
        """
        with self._lock:
            self._reconcile_state()
            if self._state == CircuitState.OPEN:
                elapsed = time.time() - self._last_failure_time
                retry_after = max(1.0, self.recovery_timeout - elapsed)
                raise CircuitBreakerOpenError(self.service_name, retry_after)

            if self._state == CircuitState.HALF_OPEN:
                if self._probe_in_flight:
                    elapsed = time.time() - self._last_failure_time
                    retry_after = max(1.0, self.recovery_timeout - elapsed)
                    raise CircuitBreakerOpenError(self.service_name, retry_after)
                self._probe_in_flight = True

    def release_probe(self) -> None:
        """Releases the probe in-flight lock if execution was aborted before record_success/failure."""
        with self._lock:
            self._probe_in_flight = False

    def record_success(self) -> None:
        """Records a successful operation through the circuit."""
        with self._lock:
            self._reconcile_state()
            self._probe_in_flight = False
            if self._state == CircuitState.HALF_OPEN:
                self._consecutive_successes += 1
                if self._consecutive_successes >= self.half_open_success_threshold:
                    self._state = CircuitState.CLOSED
                    self._consecutive_failures = 0
                    self._consecutive_successes = 0
                    logger.info(f"Circuit breaker for '{self.service_name}' recovered and is now CLOSED.")
                    try:
                        from agentshield.observability.logging import get_operational_logger
                        get_operational_logger().log_circuit_breaker(
                            self.service_name, "HALF_OPEN", "CLOSED", "Probe succeeded"
                        )
                    except Exception:
                        pass
            elif self._state == CircuitState.CLOSED:
                self._consecutive_failures = 0

    def record_failure(self, exception: Optional[Exception] = None) -> None:
        """Records a failure from the protected service."""
        with self._lock:
            self._last_failure_time = time.time()
            self._probe_in_flight = False
            if self._state == CircuitState.HALF_OPEN:
                self._state = CircuitState.OPEN
                logger.warning(
                    f"Trial call failed in HALF_OPEN state; circuit breaker for '{self.service_name}' tripped back to OPEN."
                )
                try:
                    from agentshield.observability.logging import get_operational_logger
                    get_operational_logger().log_circuit_breaker(
                        self.service_name, "HALF_OPEN", "OPEN", "Trial probe failed"
                    )
                except Exception:
                    pass
            elif self._state == CircuitState.CLOSED:
                self._consecutive_failures += 1
                if self._consecutive_failures >= self.failure_threshold:
                    self._state = CircuitState.OPEN
                    logger.warning(
                        f"Circuit breaker for '{self.service_name}' tripped to OPEN after "
                        f"{self._consecutive_failures} consecutive failures."
                    )
                    try:
                        from agentshield.observability.logging import get_operational_logger
                        get_operational_logger().log_circuit_breaker(
                            self.service_name, "CLOSED", "OPEN", f"{self._consecutive_failures} consecutive failures"
                        )
                    except Exception:
                        pass

    def call(self, func: Callable[..., Any], *args: Any, **kwargs: Any) -> Any:
        """Executes func wrapped by circuit breaker protection with single-probe concurrency."""
        self.acquire_execution()
        try:
            result = func(*args, **kwargs)
            self.record_success()
            return result
        except Exception as e:
            self.record_failure(e)
            raise
        finally:
            self.release_probe()

    def get_status(self) -> Dict[str, Any]:
        """Provides status and observability telemetry for the circuit breaker."""
        with self._lock:
            self._reconcile_state()
            elapsed = time.time() - self._last_failure_time if self._last_failure_time > 0 else 0.0
            retry_after = max(0.0, self.recovery_timeout - elapsed) if self._state == CircuitState.OPEN else 0.0
            return {
                "service_name": self.service_name,
                "state": self._state.value,
                "consecutive_failures": self._consecutive_failures,
                "failure_threshold": self.failure_threshold,
                "recovery_timeout": self.recovery_timeout,
                "retry_after": retry_after,
            }

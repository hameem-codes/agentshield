"""
Tool-call loop and cycle detector for AgentShield.

Detects consecutive identical calls and cyclic tool execution patterns
without impeding legitimate repeated operations (such as pagination or polling).
"""

from dataclasses import dataclass
import hashlib
import json
import threading
from typing import Any, Dict, List, Optional, Tuple


def compute_call_fingerprint(tool: str, arguments: Any) -> str:
    """Computes a deterministic hash fingerprint of tool name and normalized arguments."""
    try:
        # Canonical JSON representation with sorted keys
        args_str = json.dumps(arguments, sort_keys=True, default=str)
    except Exception:
        args_str = str(arguments)

    payload = f"{tool}:{args_str}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


@dataclass
class LoopCheckResult:
    """Outcome of a loop detection check."""
    is_loop: bool
    loop_type: Optional[str] = None  # "consecutive_identical" or "cyclic_pattern"
    count: int = 0
    cycle_length: int = 0
    pattern_description: str = ""
    reasons: List[str] = None

    def __post_init__(self):
        if self.reasons is None:
            self.reasons = []


class LoopDetector:
    """Tracks tool invocation sequences to detect repetitive loops and cyclical traps.

    State Scope:
        - Per-process, thread-safe memory mapping.
        - Partitioned per session or correlation context (`context_key`).
        - Preserved across requests within the SAME process.
        - NOT distributed across multiple serverless/container instances.
    """

    def __init__(
        self,
        consecutive_limit: int = 3,
        cycle_limit: int = 2,
        history_window: int = 30,
    ):
        self.consecutive_limit = max(2, consecutive_limit)
        self.cycle_limit = max(2, cycle_limit)
        self.history_window = history_window
        self._lock = threading.Lock()
        # session_id/agent_id -> List of (tool, fingerprint)
        self._history: Dict[str, List[Tuple[str, str]]] = {}

    def reset(self, context_key: Optional[str] = None) -> None:
        with self._lock:
            if context_key is not None:
                self._history.pop(context_key, None)
            else:
                self._history.clear()

    def check(
        self,
        context_key: str,
        tool: str,
        arguments: Any,
        record: bool = True,
    ) -> LoopCheckResult:
        """Evaluates whether the proposed tool call forms a forbidden loop.

        If record is True, appends the call to the history window upon evaluation.
        """
        fingerprint = compute_call_fingerprint(tool, arguments)

        with self._lock:
            history = self._history.setdefault(context_key, [])
            current_call = (tool, fingerprint)

            # 1. Check for consecutive identical calls (same tool and exact same arguments)
            consecutive_count = 1
            for prev_tool, prev_fp in reversed(history):
                if prev_tool == tool and prev_fp == fingerprint:
                    consecutive_count += 1
                else:
                    break

            if consecutive_count >= self.consecutive_limit:
                desc = f"Identical call to '{tool}' repeated {consecutive_count} consecutive times with unchanged arguments"
                reasons = [f"Loop detected: {desc}"]
                if record:
                    history.append(current_call)
                    if len(history) > self.history_window:
                        self._history[context_key] = history[-self.history_window:]
                return LoopCheckResult(
                    is_loop=True,
                    loop_type="consecutive_identical",
                    count=consecutive_count,
                    pattern_description=desc,
                    reasons=reasons,
                )

            # 2. Check for cyclic patterns (e.g. A -> B -> A -> B -> A)
            test_history = history + [current_call]
            for cycle_len in (2, 3, 4):
                needed_len = cycle_len * self.cycle_limit
                if len(test_history) >= needed_len:
                    tail = test_history[-needed_len:]
                    base_pattern = tail[:cycle_len]
                    is_cycle = True
                    for rep in range(1, self.cycle_limit):
                        segment = tail[rep * cycle_len : (rep + 1) * cycle_len]
                        if segment != base_pattern:
                            is_cycle = False
                            break

                    if is_cycle:
                        tools_in_cycle = " -> ".join([t[0] for t in base_pattern])
                        desc = f"Cyclic tool pattern [{tools_in_cycle}] repeated {self.cycle_limit} times"
                        reasons = [f"Loop detected: {desc}"]
                        if record:
                            history.append(current_call)
                            if len(history) > self.history_window:
                                self._history[context_key] = history[-self.history_window:]
                        return LoopCheckResult(
                            is_loop=True,
                            loop_type="cyclic_pattern",
                            count=self.cycle_limit,
                            cycle_length=cycle_len,
                            pattern_description=desc,
                            reasons=reasons,
                        )

            # Not a loop: record call in history window
            if record:
                history.append(current_call)
                if len(history) > self.history_window:
                    self._history[context_key] = history[-self.history_window:]

            return LoopCheckResult(is_loop=False)

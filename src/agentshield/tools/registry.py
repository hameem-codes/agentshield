from dataclasses import dataclass, field
from typing import Callable, Any, Dict, Optional

@dataclass
class RegisteredTool:
    name: str
    callable_func: Callable[[Dict[str, Any]], Any]
    metadata: Dict[str, Any] = field(default_factory=dict)
    required_permissions: list[str] = field(default_factory=list)
    idempotent: bool = False
    guarantees_deduplication: bool = True
    read_only: bool = False

    def can_safely_retry(self, has_idempotency_key: bool) -> bool:
        """Determines if a tool in 'outcome_unknown' state can safely be retried.
        A declared idempotent=True tool alone does NOT qualify unless:
        1. It is explicitly read_only (safe queries/reads with no external side-effects), OR
        2. It guarantees downstream deduplication AND has a concrete idempotency key.
        If guarantees_deduplication is False, retries are refused even if idempotent=True.
        """
        if self.read_only:
            return True
        if not has_idempotency_key:
            return False
        # Downstream service must guarantee deduplication for mutating retries
        if self.guarantees_deduplication and (self.idempotent or self.metadata.get("idempotent", False)):
            return True
        return False

class ToolRegistry:
    def __init__(self):
        self._tools: Dict[str, RegisteredTool] = {}

    def register(self, name: str, callable_func: Callable[[Dict[str, Any]], Any], 
                 metadata: Optional[Dict[str, Any]] = None, 
                 required_permissions: Optional[list[str]] = None,
                 idempotent: bool = False,
                 guarantees_deduplication: Optional[bool] = None,
                 read_only: bool = False):
        meta = dict(metadata or {})
        if idempotent:
            meta["idempotent"] = True
        if read_only:
            meta["read_only"] = True

        # Deduplication guarantee defaults to True if declared idempotent, unless explicitly set False
        dedup = guarantees_deduplication if guarantees_deduplication is not None else meta.get("guarantees_deduplication", True)
        if guarantees_deduplication is not None:
            meta["guarantees_deduplication"] = guarantees_deduplication

        self._tools[name] = RegisteredTool(
            name=name,
            callable_func=callable_func,
            metadata=meta,
            required_permissions=required_permissions or [],
            idempotent=idempotent or meta.get("idempotent", False),
            guarantees_deduplication=dedup,
            read_only=read_only or meta.get("read_only", False),
        )

    def get_tool(self, name: str) -> Optional[RegisteredTool]:
        return self._tools.get(name)

    def has_tool(self, name: str) -> bool:
        return name in self._tools

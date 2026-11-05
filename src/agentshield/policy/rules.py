from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
import hashlib
import json

@dataclass
class AgentConfig:
    name: str
    allowed_tools: List[str] = field(default_factory=list)
    denied_tools: List[str] = field(default_factory=list)
    allowed_destinations: List[str] = field(default_factory=list)

@dataclass
class ToolRule:
    tool: str
    max_quantity: float = float('inf')
    max_amount: float = float('inf')
    required_permissions: List[str] = field(default_factory=list)
    allowed_destinations: List[str] = field(default_factory=list)
    argument_schema: Optional[Dict[str, type]] = None

@dataclass
class PolicyConfiguration:
    agents: Dict[str, AgentConfig] = field(default_factory=dict)
    tools: Dict[str, ToolRule] = field(default_factory=dict)

    def compute_version_hash(self) -> str:
        """Deterministically computes a sha256 version hash of the policy configuration."""
        data = {
            "agents": {
                k: {
                    "name": v.name,
                    "allowed_tools": sorted(v.allowed_tools),
                    "denied_tools": sorted(v.denied_tools),
                    "allowed_destinations": sorted(v.allowed_destinations),
                }
                for k, v in sorted(self.agents.items())
            },
            "tools": {
                k: {
                    "tool": v.tool,
                    "max_quantity": v.max_quantity if v.max_quantity != float('inf') else "inf",
                    "max_amount": v.max_amount if v.max_amount != float('inf') else "inf",
                    "required_permissions": sorted(v.required_permissions),
                    "allowed_destinations": sorted(v.allowed_destinations),
                }
                for k, v in sorted(self.tools.items())
            }
        }
        serialized = json.dumps(data, sort_keys=True)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()[:16]

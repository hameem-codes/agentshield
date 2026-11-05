"""Executor-owned secret provider interface and reference resolution for AgentShield.

In accordance with AgentShield's non-negotiable security rules:
- Only the executor holds tool credentials. Agents never call tools directly.
- Agents propose actions using opaque secret references (e.g. secret_ref://vault/stripe_key).
- Reviews and audit logs persist only the opaque reference string, never raw secrets.
- The executor resolves the reference only in memory right before downstream tool invocation.
"""

from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
import os
import re

SECRET_REF_PATTERN = re.compile(r"^(?:secret_ref|vault|env)://([a-zA-Z0-9_\-\./]+)$")


class SecretProvider(ABC):
    """Executor-owned secret provider interface.
    The executor holds tool credentials and resolves opaque secret references
    at execution time. Agents and proposal payloads never hold raw secrets.
    """

    @abstractmethod
    def get_secret(self, secret_id: str) -> Optional[str]:
        """Resolves an opaque secret ID or URI to the raw credential."""
        pass


class DictSecretProvider(SecretProvider):
    """In-memory dictionary secret provider for executor-held credentials."""

    def __init__(self, secrets: Optional[Dict[str, str]] = None):
        self._secrets: Dict[str, str] = dict(secrets or {})

    def set_secret(self, secret_id: str, value: str) -> None:
        self._secrets[secret_id] = value

    def get_secret(self, secret_id: str) -> Optional[str]:
        if secret_id in self._secrets:
            return self._secrets[secret_id]
        basename = secret_id.split("/")[-1]
        return self._secrets.get(basename)


class EnvSecretProvider(SecretProvider):
    """Environment-variable based executor secret provider."""

    def __init__(self, prefix: str = ""):
        self.prefix = prefix

    def get_secret(self, secret_id: str) -> Optional[str]:
        clean_id = secret_id.replace("-", "_").replace("/", "_").upper()
        val = os.environ.get(f"{self.prefix}{clean_id}")
        if val is not None:
            return val
        basename = secret_id.split("/")[-1].replace("-", "_").upper()
        return os.environ.get(f"{self.prefix}{basename}")


def is_secret_reference(value: Any) -> bool:
    """Returns True if the value is an opaque secret reference URI."""
    if isinstance(value, str):
        return bool(SECRET_REF_PATTERN.match(value))
    return False


def resolve_secret_references(data: Any, provider: Optional[SecretProvider]) -> Any:
    """Recursively resolves opaque secret reference URIs in execution arguments.
    Only called by the executor right before tool callable invocation.
    Never persists resolved values back to review records or audit logs.
    """
    if provider is None:
        return data

    if isinstance(data, dict):
        return {k: resolve_secret_references(v, provider) for k, v in data.items()}
    elif isinstance(data, list):
        return [resolve_secret_references(item, provider) for item in data]
    elif isinstance(data, tuple):
        return tuple(resolve_secret_references(item, provider) for item in data)
    elif isinstance(data, str):
        m = SECRET_REF_PATTERN.match(data)
        if m:
            secret_id = m.group(1)
            resolved = provider.get_secret(secret_id)
            if resolved is not None:
                return resolved
        return data
    return data


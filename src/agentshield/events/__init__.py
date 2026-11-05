"""
Security Event and Alert Management package for AgentShield.
"""

from .models import (
    SecurityEvent,
    SecurityAlert,
    SecurityIncident,
    EventType,
    EventSeverity,
    AlertStatus,
    IncidentStatus,
)
from .rules import (
    AlertRule,
    AlertRuleEngine,
    PromptInjectionAlertRule,
    UnauthorizedToolAccessAlertRule,
    RepeatedBlockedActionsAlertRule,
    DataExfiltrationAlertRule,
    SecurityFailureAlertRule,
)
from .store import EventStore, SQLiteEventStore
from .engine import SecurityEventManager

__all__ = [
    "SecurityEvent",
    "SecurityAlert",
    "SecurityIncident",
    "EventType",
    "EventSeverity",
    "AlertStatus",
    "IncidentStatus",
    "AlertRule",
    "AlertRuleEngine",
    "PromptInjectionAlertRule",
    "UnauthorizedToolAccessAlertRule",
    "RepeatedBlockedActionsAlertRule",
    "DataExfiltrationAlertRule",
    "SecurityFailureAlertRule",
    "EventStore",
    "SQLiteEventStore",
    "SecurityEventManager",
]


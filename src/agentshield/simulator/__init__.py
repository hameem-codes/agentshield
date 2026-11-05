"""
AgentShield Attack Simulator module.
Provides deterministic attack scenarios, execution engine, and metric aggregation.
"""

from agentshield.simulator.models import (
    AttackCategory,
    SimulationType,
    Scenario,
    SimulationRun,
    SimulatorSummary,
)
from agentshield.simulator.scenarios import get_default_scenarios, get_scenario
from agentshield.simulator.store import SimulationStore, SqliteSimulationStore, InMemorySimulationStore
from agentshield.simulator.service import SimulatorService

__all__ = [
    "AttackCategory",
    "SimulationType",
    "Scenario",
    "SimulationRun",
    "SimulatorSummary",
    "get_default_scenarios",
    "get_scenario",
    "SimulationStore",
    "SqliteSimulationStore",
    "InMemorySimulationStore",
    "SimulatorService",
]


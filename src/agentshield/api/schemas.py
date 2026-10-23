"""
Typed Pydantic request and response models for AgentShield FastAPI server.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

class HealthResponse(BaseModel):
    status: str
    version: str
    engine: str

class CheckRequest(BaseModel):
    text: str = Field(..., max_length=10000, description="User input text to inspect")

class AuthorizeRequest(BaseModel):
    agent: str = Field(..., max_length=256)
    tool: str = Field(..., max_length=256)
    arguments: Dict[str, Any] = Field(default_factory=dict)
    permissions: List[str] = Field(default_factory=list)

class ExecuteRequest(BaseModel):
    agent: str = Field(..., max_length=256)
    tool: str = Field(..., max_length=256)
    arguments: Dict[str, Any] = Field(default_factory=dict)
    permissions: List[str] = Field(default_factory=list)

class DecisionResponse(BaseModel):
    allowed: bool
    decision: str
    reasons: List[str]
    risk_score: float
    severity: str
    agent: str
    tool: str

class ExecutionResponse(BaseModel):
    decision: DecisionResponse
    execution_status: str
    tool_result: Optional[Any] = None
    error: Optional[str] = None

class EventItem(BaseModel):
    id: int
    timestamp: str
    agent: str
    tool: str
    arguments: Dict[str, Any]
    decision: str
    allowed: bool
    reasons: List[str]
    rules_triggered: List[str]
    risk_score: float
    severity: str
    execution_status: str
    error: Optional[str] = None

class EventsResponse(BaseModel):
    events: List[EventItem]
    total: int

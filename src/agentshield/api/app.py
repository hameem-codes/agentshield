"""
FastAPI application for AgentShield.
The SDK owns all security logic; FastAPI only calls and exposes it.
Endpoints:
  GET  /health
  POST /check
  POST /authorize
  POST /execute (calls only registered fake sandbox tools)
  GET  /events
"""

import os
from typing import Optional
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from agentshield import Shield, ExecutionStatus
from agentshield.audit import SQLiteAuditStore
from agentshield.api.schemas import (
    HealthResponse,
    CheckRequest,
    AuthorizeRequest,
    ExecuteRequest,
    DecisionResponse,
    ExecutionResponse,
    EventsResponse,
    EventItem,
)

# Request size limiter middleware (caps request body size at 1MB default)
MAX_REQUEST_BODY_BYTES = int(os.environ.get("AGENTSHIELD_MAX_BODY_BYTES", 1024 * 1024))

class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_REQUEST_BODY_BYTES:
            return Response(content="Request payload too large", status_code=413)
        return await call_next(request)

def create_app(audit_db_path: Optional[str] = None) -> FastAPI:
    app = FastAPI(title="AgentShield API", version="0.1.0")

    # Request size limiter
    app.add_middleware(RequestSizeLimitMiddleware)

    # CORS configuration from env
    raw_origins = os.environ.get("AGENTSHIELD_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    origins = [orig.strip() for orig in raw_origins.split(",") if orig.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Instantiate AuditStore and Shield
    audit_store = SQLiteAuditStore(db_path=audit_db_path)
    shield = Shield(audit_store=audit_store)

    # Register only FAKE sandbox tools (counter/no real I/O)
    sandbox_counters = {"create_order": 0, "search_product": 0, "get_product": 0}

    def fake_create_order(args):
        sandbox_counters["create_order"] += 1
        return {"order_id": f"ord_{sandbox_counters['create_order']}", "status": "created", "sandbox": True}

    def fake_search_product(args):
        sandbox_counters["search_product"] += 1
        return {"items": ["item1", "item2"], "count": 2, "sandbox": True}

    def fake_get_product(args):
        sandbox_counters["get_product"] += 1
        return {"id": args.get("product_id", "p1"), "price": 99.0, "sandbox": True}

    shield.registry.register("create_order", fake_create_order)
    shield.registry.register("search_product", fake_search_product)
    shield.registry.register("get_product", fake_get_product)

    # Attach to app state for testing inspection
    app.state.shield = shield
    app.state.audit_store = audit_store
    app.state.sandbox_counters = sandbox_counters

    @app.get("/health", response_model=HealthResponse)
    @app.get("/api/health", response_model=HealthResponse)
    def health():
        return HealthResponse(
            status="healthy",
            version="0.1.0",
            engine="AgentShield Runtime",
        )

    @app.post("/check", response_model=DecisionResponse)
    @app.post("/api/check", response_model=DecisionResponse)
    def check_input(req: CheckRequest):
        decision = shield.check(req.text)
        return DecisionResponse(
            allowed=decision.allowed,
            decision=decision.decision.value,
            reasons=decision.reasons,
            risk_score=float(decision.risk_score),
            severity=decision.severity.value,
            agent=decision.agent,
            tool=decision.tool,
        )

    @app.post("/authorize", response_model=DecisionResponse)
    @app.post("/api/authorize", response_model=DecisionResponse)
    def authorize_action(req: AuthorizeRequest):
        decision = shield.authorize(
            agent=req.agent,
            tool=req.tool,
            arguments=req.arguments,
            permissions=req.permissions,
        )
        return DecisionResponse(
            allowed=decision.allowed,
            decision=decision.decision.value,
            reasons=decision.reasons,
            risk_score=float(decision.risk_score),
            severity=decision.severity.value,
            agent=decision.agent,
            tool=decision.tool,
        )

    @app.post("/execute", response_model=ExecutionResponse)
    @app.post("/api/execute", response_model=ExecutionResponse)
    def execute_action(req: ExecuteRequest):
        res = shield.execute(
            agent=req.agent,
            tool=req.tool,
            arguments=req.arguments,
            permissions=req.permissions,
        )
        dec_resp = DecisionResponse(
            allowed=res.decision.allowed,
            decision=res.decision.decision.value,
            reasons=res.decision.reasons,
            risk_score=float(res.decision.risk_score),
            severity=res.decision.severity.value,
            agent=res.decision.agent,
            tool=res.decision.tool,
        )
        return ExecutionResponse(
            decision=dec_resp,
            execution_status=res.execution_status.value,
            tool_result=res.tool_result,
            error=res.error,
        )

    @app.get("/events", response_model=EventsResponse)
    @app.get("/api/events", response_model=EventsResponse)
    def list_events(
        decision: Optional[str] = None,
        agent: Optional[str] = None,
        tool: Optional[str] = None,
        limit: int = 50,
    ):
        records = audit_store.query(
            decision=decision,
            agent=agent,
            tool=tool,
            limit=limit,
        )
        items = [
            EventItem(
                id=r.id or 0,
                timestamp=r.timestamp,
                agent=r.agent,
                tool=r.tool,
                arguments=r.arguments,
                decision=r.decision,
                allowed=r.allowed,
                reasons=r.reasons,
                rules_triggered=r.rules_triggered,
                risk_score=r.risk_score,
                severity=r.severity,
                execution_status=r.execution_status,
                error=r.error,
            )
            for r in records
        ]
        return EventsResponse(events=items, total=len(items))

    return app

app = create_app()

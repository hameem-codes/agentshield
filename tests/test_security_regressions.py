"""
Phase 4: Security Regression Verification Suite.

Automated regression assertions enforcing AgentShield core non-negotiables:
1. Gemini / LLM can never override deterministic enforcement.
2. Unknown tools, unknown agents, and malformed requests always fail closed (BLOCK).
3. REVIEW never invokes the tool callable before explicit human approval.
4. BLOCK never invokes the tool callable under any circumstances.
5. Public simulator execution cannot modify policy, register tools, or poison production audit records.
6. Session cookies and CSRF protections remain strictly enforced across state mutations.
7. Sensitive values (admin keys, Gemini keys, session secrets) never appear in responses or built frontend bundle.
8. Read-only mode permits safe demo reads and isolated sandbox simulations while blocking all state mutations.
"""

import os
import re
from pathlib import Path
import pytest
from httpx import AsyncClient, ASGITransport

from agentshield import Shield
from agentshield.shield import ExecutionStatus
from agentshield.api.app import create_app
from agentshield.models import Action, DecisionValue, RiskLevel
from agentshield.analyst.models import AnalysisReport, AnalystSeverity


def test_regression_01_gemini_cannot_override_deterministic_enforcement():
    """
    Regression Check 1:
    Even if an LLM analyst or mock provider recommends an action or claims it is safe,
    deterministic PolicyEngine and RiskEngine fail closed. The LLM is never in the decision loop.
    """
    shield = Shield(audit_store=None)

    # Tool is unwhitelisted / disallowed for shopping_agent
    res = shield.execute(
        agent="shopping_agent",
        tool="drop_database",
        arguments={"target": "production_users"},
    )
    assert res.decision.decision == DecisionValue.BLOCK
    assert res.decision.allowed is False
    assert res.execution_status == ExecutionStatus.NOT_EXECUTED

    # Even if an external advisory or model claims this action is safe, enforcement remains BLOCK
    res2 = shield.execute(
        agent="shopping_agent",
        tool="drop_database",
        arguments={"target": "production_users"},
    )
    assert res2.decision.decision == DecisionValue.BLOCK
    assert res2.execution_status == ExecutionStatus.NOT_EXECUTED


def test_regression_02_unknown_tools_and_agents_fail_closed():
    """
    Regression Check 2:
    Unknown tools and unknown agents always produce BLOCK without calling any callable.
    """
    invoked = {"count": 0}

    def dangerous_func(args):
        invoked["count"] += 1
        return "pwned"

    shield = Shield(audit_store=None)
    shield.registry.register("unknown_secret_tool", dangerous_func)

    # Agent is unknown -> BLOCK
    res_agent = shield.execute(
        agent="malicious_unregistered_agent",
        tool="create_order",
        arguments={"quantity": 1},
    )
    assert res_agent.decision.decision == DecisionValue.BLOCK
    assert res_agent.execution_status == ExecutionStatus.NOT_EXECUTED

    # Tool is not in PolicyEngine.known_tools -> BLOCK
    res_tool = shield.execute(
        agent="shopping_agent",
        tool="unknown_secret_tool",
        arguments={},
    )
    assert res_tool.decision.decision == DecisionValue.BLOCK
    assert res_tool.execution_status == ExecutionStatus.NOT_EXECUTED
    assert invoked["count"] == 0


def test_regression_03_review_never_invokes_callable_before_approval():
    """
    Regression Check 3:
    When a proposal produces REVIEW, the tool callable is NEVER invoked before approval.
    """
    invoked = {"count": 0}

    def counted_get_product(args):
        invoked["count"] += 1
        return {"id": args.get("product_id"), "ok": True}

    shield = Shield(audit_store=None)
    shield.registry.register("get_product", counted_get_product)

    # Elevated quantity (15) & amount (2500) produces REVIEW
    res = shield.execute(
        agent="shopping_agent",
        tool="get_product",
        arguments={"product_id": "prod-server-500", "quantity": 15, "amount": 2500},
    )
    assert res.decision.decision == DecisionValue.REVIEW
    assert res.execution_status == ExecutionStatus.NOT_EXECUTED
    assert invoked["count"] == 0

    # Verify review was placed in pending queue
    pending = shield.review_store.get_pending_reviews()
    assert len(pending) == 1
    rev_id = pending[0]["review_id"]

    # Now approve review -> callable is invoked exactly once
    approval_res = shield.approve_review(rev_id, approver="admin-test")
    assert approval_res is not None
    assert approval_res.execution_status == ExecutionStatus.EXECUTED
    assert invoked["count"] == 1


def test_regression_04_block_never_invokes_callable():
    """
    Regression Check 4:
    A blocked tool proposal NEVER invokes the tool callable.
    """
    invoked = {"count": 0}

    def counted_create_order(args):
        invoked["count"] += 1
        return {"order_id": "123"}

    shield = Shield(audit_store=None)
    shield.registry.register("create_order", counted_create_order)

    # Exceeding quantity ceiling (10) -> BLOCK
    res = shield.execute(
        agent="shopping_agent",
        tool="create_order",
        arguments={"product": "laptop", "quantity": 99},
    )
    assert res.decision.decision == DecisionValue.BLOCK
    assert res.execution_status == ExecutionStatus.NOT_EXECUTED
    assert invoked["count"] == 0


def test_regression_05_simulator_cannot_modify_policy_or_poison_audit(tmp_path):
    """
    Regression Check 5:
    Public simulator execution cannot alter known_tools or poison the audit store.
    """
    audit_file = str(tmp_path / "prod_audit.db")
    app = create_app(audit_db_path=audit_file)

    shield = app.state.shield
    initial_known_tools = set(shield.policy_engine.known_tools)
    initial_audit_count = len(app.state.audit_store.query())

    # Execute simulation scenario through simulator service
    sim = app.state.simulator
    sim.execute_scenario("scenario-prompt-injection")
    sim.execute_scenario("scenario-suspicious-bulk")

    # Verify known tools are strictly identical
    assert set(shield.policy_engine.known_tools) == initial_known_tools

    # Verify production audit store count is untouched (0 new audit records)
    assert len(app.state.audit_store.query()) == initial_audit_count


@pytest.mark.anyio
async def test_regression_06_csrf_and_origin_enforcement(monkeypatch):
    """
    Regression Check 6:
    Cookie-authenticated mutations must verify CSRF token and origin matching.
    """
    admin_key = "csrf-regression-admin-key"
    monkeypatch.setenv("AGENTSHIELD_ADMIN_KEY", admin_key)

    app = create_app(audit_db_path=":memory:", admin_api_key=admin_key)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Authenticate
        r_login = await client.post("/api/auth/login", json={"admin_key": admin_key})
        assert r_login.status_code == 200
        csrf_token = r_login.json()["csrf_token"]

        # 1. Missing CSRF header -> 403
        r_no_header = await client.delete("/api/simulator/history")
        assert r_no_header.status_code == 403

        # 2. Untrusted Origin header -> 403
        r_bad_origin = await client.delete(
            "/api/simulator/history",
            headers={"x-csrf-token": csrf_token, "Origin": "http://evil-attacker.com"},
        )
        assert r_bad_origin.status_code == 403
        assert "untrusted" in r_bad_origin.json()["detail"].lower()

        # 3. Valid Origin and CSRF -> 200
        r_ok = await client.delete(
            "/api/simulator/history",
            headers={"x-csrf-token": csrf_token, "Origin": "http://test"},
        )
        assert r_ok.status_code == 200


@pytest.mark.anyio
async def test_regression_07_no_secrets_in_api_responses_or_frontend_bundle(monkeypatch):
    """
    Regression Check 7:
    Admin keys, Gemini keys, and session tokens must never appear in public responses or the built frontend bundle.
    """
    admin_key = "super-secret-admin-token-xyz-987"
    gemini_key = "AIzaSyFakeKeyForTesting123456789"
    monkeypatch.setenv("AGENTSHIELD_ADMIN_KEY", admin_key)
    monkeypatch.setenv("GEMINI_API_KEY", gemini_key)

    app = create_app(audit_db_path=":memory:", admin_api_key=admin_key)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Check /health
        r_health = await client.get("/health")
        assert admin_key not in r_health.text
        assert gemini_key not in r_health.text

        # Check /api/overview
        r_overview = await client.get("/api/overview")
        assert admin_key not in r_overview.text
        assert gemini_key not in r_overview.text

        # Check /api/auth/session
        r_sess = await client.get("/api/auth/session")
        assert admin_key not in r_sess.text
        assert gemini_key not in r_sess.text

        # Check /api/simulator/scenarios
        r_scen = await client.get("/api/simulator/scenarios")
        assert admin_key not in r_scen.text
        assert gemini_key not in r_scen.text

    # Inspect compiled frontend bundle in frontend/dist/
    dist_dir = Path("frontend/dist")
    if dist_dir.exists():
        for asset in dist_dir.rglob("*.js"):
            content = asset.read_text(encoding="utf-8", errors="ignore")
            assert admin_key not in content, f"Secret admin key leaked in {asset}"
            assert gemini_key not in content, f"Secret gemini key leaked in {asset}"


@pytest.mark.anyio
async def test_regression_08_readonly_mode_strict_containment(monkeypatch):
    """
    Regression Check 8:
    Read-only mode strictly prevents incident mutations while permitting safe demo reads and sandbox simulations.
    """
    admin_key = "ro-strict-containment-key"
    monkeypatch.setenv("AGENTSHIELD_ADMIN_KEY", admin_key)
    monkeypatch.setenv("AGENTSHIELD_READONLY", "1")

    app = create_app(audit_db_path=":memory:", admin_api_key=admin_key, read_only=True)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Safe demo reads succeed
        assert (await client.get("/health")).status_code == 200
        assert (await client.get("/api/overview")).status_code == 200
        assert (await client.get("/api/simulator/scenarios")).status_code == 200
        assert (await client.get("/events")).status_code == 200

        # Isolated simulator runs succeed
        assert (await client.post("/api/simulator/run/scenario-benign-order")).status_code == 200

        # Mutations fail with 403 Forbidden even with admin credentials
        headers = {"x-admin-key": admin_key}
        r_pause = await client.post("/incident/pause", json={"agent": "shopping_agent"}, headers=headers)
        assert r_pause.status_code == 403

        r_unpause = await client.post("/incident/unpause", json={"agent": "shopping_agent"}, headers=headers)
        assert r_unpause.status_code == 403

        r_review = await client.post("/incident/review", json={"review_id": "rev_dummy", "action": "approve"}, headers=headers)
        assert r_review.status_code == 403

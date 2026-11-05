import os
import tempfile
import pytest
from httpx import AsyncClient, ASGITransport
from agentshield.api.app import create_app


@pytest.fixture
def test_app():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name

    app = create_app(audit_db_path=db_path)
    yield app

    if os.path.exists(db_path):
        try:
            os.remove(db_path)
        except OSError:
            pass


@pytest.mark.anyio
async def test_unauthenticated_policies_endpoint_rejected(test_app):
    """GET /api/policies and GET /policies must fail closed with 401 or 403 if unauthenticated."""
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Without admin key
        res1 = await client.get("/api/policies")
        assert res1.status_code in (401, 403)

        res2 = await client.get("/policies")
        assert res2.status_code in (401, 403)


@pytest.mark.anyio
async def test_unauthenticated_risk_factors_endpoint_rejected(test_app):
    """GET /api/risk/factors and GET /risk/factors must fail closed with 401 or 403 if unauthenticated."""
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Without admin key
        res1 = await client.get("/api/risk/factors")
        assert res1.status_code in (401, 403)

        res2 = await client.get("/risk/factors")
        assert res2.status_code in (401, 403)


@pytest.mark.anyio
async def test_authenticated_policies_endpoint_returns_registered_config(monkeypatch):
    """GET /api/policies returns actual registered policy configuration and rules."""
    monkeypatch.setenv("AGENTSHIELD_ADMIN_KEY", "test-secret-admin-key")
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name
    try:
        app = create_app(audit_db_path=db_path)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get(
                "/api/policies",
                headers={"x-admin-key": "test-secret-admin-key"}
            )
            assert resp.status_code == 200
            data = resp.json()

            # Verify schema structure
            assert "version_hash" in data
            assert isinstance(data["version_hash"], str)
            assert len(data["version_hash"]) > 0

            assert "known_tools" in data
            assert isinstance(data["known_tools"], list)
            assert "create_order" in data["known_tools"]
            assert "refund_order" in data["known_tools"]

            assert "agents" in data
            assert isinstance(data["agents"], list)
            shopping_agent = next((a for a in data["agents"] if a["name"] == "shopping_agent"), None)
            assert shopping_agent is not None
            assert "create_order" in shopping_agent["allowed_tools"]
            assert "refund_order" in shopping_agent["denied_tools"]

            assert "tools" in data
            create_rule = next((t for t in data["tools"] if t["tool"] == "create_order"), None)
            assert create_rule is not None
            assert create_rule["max_quantity"] == 10

            assert "policies" in data
            assert len(data["policies"]) >= 2
            rule_names = [p["name"] for p in data["policies"]]
            assert any("shopping_agent" in name for name in rule_names)
            assert any("create_order" in name for name in rule_names)
    finally:
        if os.path.exists(db_path):
            os.remove(db_path)


@pytest.mark.anyio
async def test_authenticated_risk_factors_endpoint_returns_registered_factors(monkeypatch):
    """GET /api/risk/factors returns actual deterministic factor definitions and thresholds."""
    monkeypatch.setenv("AGENTSHIELD_ADMIN_KEY", "test-secret-admin-key")
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name
    try:
        app = create_app(audit_db_path=db_path)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get(
                "/api/risk/factors",
                headers={"x-admin-key": "test-secret-admin-key"}
            )
            assert resp.status_code == 200
            data = resp.json()

            # Verify schema structure
            assert "factors" in data
            assert isinstance(data["factors"], list)
            assert len(data["factors"]) >= 8

            factor_names = [f["name"] for f in data["factors"]]
            assert "destructive_tool" in factor_names
            assert "financial_impact" in factor_names
            assert "elevated_quantity" in factor_names
            assert "privileged_agent" in factor_names

            # Verify deterministic weights
            dest_factor = next(f for f in data["factors"] if f["name"] == "destructive_tool")
            assert dest_factor["weight"] == 85.0

            assert "severity_thresholds" in data
            thresholds = data["severity_thresholds"]
            assert thresholds["low_max"] == 29.0
            assert thresholds["medium_max"] == 59.0
            assert thresholds["high_max"] == 84.0
    finally:
        if os.path.exists(db_path):
            os.remove(db_path)


@pytest.mark.anyio
async def test_unauthenticated_config_endpoint_rejected(test_app):
    """GET /api/config and GET /config must fail closed with 401 or 403 if unauthenticated."""
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res1 = await client.get("/api/config")
        assert res1.status_code in (401, 403)

        res2 = await client.get("/config")
        assert res2.status_code in (401, 403)


@pytest.mark.anyio
async def test_authenticated_config_endpoint_returns_non_secret_settings(monkeypatch):
    """GET /api/config returns non-secret runtime configuration and never leaks keys or credentials."""
    monkeypatch.setenv("AGENTSHIELD_ADMIN_KEY", "test-secret-admin-key-at-least-32-chars")
    monkeypatch.setenv("GEMINI_API_KEY", "secret-gemini-key-12345")
    monkeypatch.delenv("AGENTSHIELD_DATABASE_URL", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)

    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name
    try:
        app = create_app(audit_db_path=db_path)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get(
                "/api/config",
                headers={"x-admin-key": "test-secret-admin-key-at-least-32-chars"}
            )
            assert resp.status_code == 200
            data = resp.json()

            # Verify non-secret fields present
            assert "environment" in data
            assert "storage_backend" in data
            assert data["storage_backend"] == "sqlite"
            assert "database_configured" in data
            assert data["database_configured"] is False
            assert "max_tool_execution_seconds" in data
            assert "rate_limit_agent" in data
            assert "policy_version_hash" in data
            assert data["admin_auth_configured"] is True

            # Strictly verify NO secrets or credentials in the response
            raw_text = resp.text
            assert "secret-gemini-key-12345" not in raw_text
            assert "test-secret-admin-key" not in raw_text
    finally:
        if os.path.exists(db_path):
            os.remove(db_path)


@pytest.mark.anyio
async def test_policies_and_risk_endpoints_allowed_in_readonly_mode(monkeypatch):
    """Verifies that read-only mode permits GET /api/policies and GET /api/risk/factors."""
    monkeypatch.setenv("AGENTSHIELD_READONLY", "1")
    monkeypatch.setenv("AGENTSHIELD_ADMIN_KEY", "test-secret-admin-key")
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name
    try:
        app = create_app(audit_db_path=db_path)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Policies endpoint permitted in read-only mode with auth
            p_resp = await client.get(
                "/api/policies",
                headers={"x-admin-key": "test-secret-admin-key"}
            )
            assert p_resp.status_code == 200

            # 2. Risk factors endpoint permitted in read-only mode with auth
            r_resp = await client.get(
                "/api/risk/factors",
                headers={"x-admin-key": "test-secret-admin-key"}
            )
            assert r_resp.status_code == 200

            # 3. Mutation endpoint is blocked in read-only mode
            mut_resp = await client.post(
                "/incident/review",
                json={"review_id": "rev-1", "action": "approve"},
                headers={"x-admin-key": "test-secret-admin-key"}
            )
            assert mut_resp.status_code == 403
            assert "read-only mode" in mut_resp.json()["detail"].lower()
    finally:
        if os.path.exists(db_path):
            os.remove(db_path)

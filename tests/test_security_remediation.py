"""
Security remediation tests covering:
1. Persistent and cryptographic session management with cross-instance verification & revocation.
2. CSRF token and Origin protection on cookie-authenticated state mutations.
3. Strict public sandbox tool boundary enforcement (rejecting non-sandbox tools).
4. Public payload size restrictions (rejecting payloads > 64KB).
5. Analyst endpoint authentication and input sanitization.
"""

import os
import tempfile
import time
import pytest
from httpx import AsyncClient, ASGITransport

from agentshield.api.app import create_app
from agentshield.api.sessions import SqliteSessionStore, SessionManager


@pytest.fixture
def app():
    return create_app(audit_db_path=":memory:")


@pytest.mark.anyio
async def test_session_persistence_and_revocation(tmp_path, monkeypatch):
    """Verifies cryptographic session tokens work across instances and durable revocation in SQLite."""
    admin_key = "secure-master-key-xyz-789"
    monkeypatch.setenv("AGENTSHIELD_ADMIN_KEY", admin_key)

    audit_path = str(tmp_path / "audit.db")
    sessions_path = str(tmp_path / "sessions.db")

    # Instance 1: Logs in and creates session
    app1 = create_app(audit_db_path=audit_path, sessions_db_path=sessions_path)
    transport1 = ASGITransport(app=app1)
    async with AsyncClient(transport=transport1, base_url="http://test") as client1:
        login_resp = await client1.post("/api/auth/login", json={"admin_key": admin_key})
        assert login_resp.status_code == 200
        session_cookie = login_resp.cookies.get("agentshield_session")
        csrf_cookie = login_resp.cookies.get("agentshield_csrf")
        assert session_cookie is not None
        assert csrf_cookie is not None

        # Verify session is active on Instance 1
        sess_resp = await client1.get("/api/auth/session")
        assert sess_resp.json()["authenticated"] is True

    # Instance 2: Shares same key & sessions DB (simulating serverless rotation or companion worker)
    app2 = create_app(audit_db_path=audit_path, sessions_db_path=sessions_path)
    transport2 = ASGITransport(app=app2)
    async with AsyncClient(transport=transport2, base_url="http://test", cookies={"agentshield_session": session_cookie}) as client2:
        # Instance 2 validates the signed session without shared process memory
        sess_resp2 = await client2.get("/api/auth/session")
        assert sess_resp2.status_code == 200
        assert sess_resp2.json()["authenticated"] is True

        # Access protected endpoint on Instance 2
        events_resp = await client2.get("/api/security/events")
        assert events_resp.status_code == 200

        # Instance 2 logs out (revokes session in SQLite store)
        logout_resp = await client2.post("/api/auth/logout")
        assert logout_resp.status_code == 200

    # Instance 1: Re-uses the now-revoked session cookie
    async with AsyncClient(transport=transport1, base_url="http://test", cookies={"agentshield_session": session_cookie}) as client1_again:
        sess_revoked = await client1_again.get("/api/auth/session")
        assert sess_revoked.json()["authenticated"] is False

        # Protected endpoint now rejects with 401
        events_revoked = await client1_again.get("/api/security/events")
        assert events_revoked.status_code == 401


@pytest.mark.anyio
async def test_session_tampering_and_expiry(tmp_path, monkeypatch):
    """Verifies that tampered or expired tokens fail authentication with 401."""
    admin_key = "test-secret-key-456"
    monkeypatch.setenv("AGENTSHIELD_ADMIN_KEY", admin_key)
    sessions_path = str(tmp_path / "sessions.db")

    app_instance = create_app(audit_db_path=":memory:", sessions_db_path=sessions_path)
    transport = ASGITransport(app=app_instance)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Login to get valid token
        resp = await client.post("/api/auth/login", json={"admin_key": admin_key})
        valid_cookie = resp.cookies["agentshield_session"]

        # 1. Tamper with token signature
        tampered_cookie = valid_cookie[:-5] + "aaaaa"
        async with AsyncClient(transport=transport, base_url="http://test", cookies={"agentshield_session": tampered_cookie}) as bad_client:
            r1 = await bad_client.get("/api/security/events")
            assert r1.status_code == 401

        # 2. Expired token generated with negative TTL
        store = SqliteSessionStore(db_path=sessions_path)
        expired_mgr = SessionManager(admin_key=admin_key, store=store, ttl_seconds=-10)
        expired_token, _ = expired_mgr.create_session("admin")
        async with AsyncClient(transport=transport, base_url="http://test", cookies={"agentshield_session": expired_token}) as exp_client:
            r2 = await exp_client.get("/api/security/events")
            assert r2.status_code == 401


@pytest.mark.anyio
async def test_csrf_and_origin_protection(tmp_path, monkeypatch):
    """Verifies CSRF tokens and Origin checks are enforced on cookie-authenticated state mutations."""
    admin_key = "csrf-secret-key-101"
    monkeypatch.setenv("AGENTSHIELD_ADMIN_KEY", admin_key)

    app_instance = create_app(audit_db_path=":memory:", sessions_db_path=str(tmp_path / "sess.db"))
    transport = ASGITransport(app=app_instance)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Login
        login_resp = await client.post("/api/auth/login", json={"admin_key": admin_key})
        session_token = login_resp.cookies["agentshield_session"]
        csrf_token = login_resp.cookies["agentshield_csrf"]

        cookies = {
            "agentshield_session": session_token,
            "agentshield_csrf": csrf_token,
        }

        # Case 1: Valid cookie + valid CSRF token + trusted Origin -> 200
        headers_ok = {
            "x-csrf-token": csrf_token,
            "origin": "http://localhost:5173",
        }
        async with AsyncClient(transport=transport, base_url="http://test", cookies=cookies) as auth_client:
            r_ok = await auth_client.post("/incident/pause", json={"agent": "agent_a"}, headers=headers_ok)
            assert r_ok.status_code == 200
            assert r_ok.json()["status"] == "paused"

        # Case 2: Cookie authentication missing x-csrf-token header -> 403 Forbidden
        headers_no_csrf = {
            "origin": "http://localhost:5173",
        }
        async with AsyncClient(transport=transport, base_url="http://test", cookies=cookies) as auth_client:
            r_no_csrf = await auth_client.post("/incident/pause", json={"agent": "agent_a"}, headers=headers_no_csrf)
            assert r_no_csrf.status_code == 403
            assert "CSRF token verification failed" in r_no_csrf.json()["detail"]

        # Case 3: Cookie authentication with mismatching x-csrf-token -> 403 Forbidden
        headers_bad_csrf = {
            "x-csrf-token": "wrong_csrf_token_value",
            "origin": "http://localhost:5173",
        }
        async with AsyncClient(transport=transport, base_url="http://test", cookies=cookies) as auth_client:
            r_bad_csrf = await auth_client.post("/incident/pause", json={"agent": "agent_a"}, headers=headers_bad_csrf)
            assert r_bad_csrf.status_code == 403
            assert "CSRF token verification failed" in r_bad_csrf.json()["detail"]

        # Case 4: Cookie authentication from untrusted cross-site origin -> 403 Forbidden
        headers_evil_origin = {
            "x-csrf-token": csrf_token,
            "origin": "https://evil-attacker-site.com",
        }
        async with AsyncClient(transport=transport, base_url="http://test", cookies=cookies) as auth_client:
            r_evil = await auth_client.post("/incident/pause", json={"agent": "agent_a"}, headers=headers_evil_origin)
            assert r_evil.status_code == 403
            assert "Untrusted request origin" in r_evil.json()["detail"]

        # Case 5: Direct API key (CLI) bypasses CSRF requirement
        headers_cli = {
            "x-admin-key": admin_key,
        }
        r_cli = await client.post("/incident/pause", json={"agent": "agent_cli"}, headers=headers_cli)
        assert r_cli.status_code == 200
        assert r_cli.json()["status"] == "paused"


@pytest.mark.anyio
async def test_public_sandbox_tool_boundary(app):
    """Verifies that public execution strictly rejects non-sandbox tools."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Allowed fake sandbox tool
        r_allowed = await client.post("/execute", json={
            "agent": "shopping_agent",
            "tool": "create_order",
            "arguments": {"product": "shoes", "quantity": 1},
        })
        assert r_allowed.status_code == 200
        assert r_allowed.json()["execution_status"] == "executed"

        # Non-sandbox tool prohibited through public endpoint
        r_prohibited = await client.post("/execute", json={
            "agent": "attacker",
            "tool": "system_terminal_exec",
            "arguments": {"cmd": "id"},
        })
        assert r_prohibited.status_code == 403
        assert "is not an authorized public sandbox tool" in r_prohibited.json()["detail"]


@pytest.mark.anyio
async def test_public_payload_size_limit(app):
    """Verifies that oversized payloads are rejected on public endpoints."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Oversized headers / content-length > 64KB
        headers = {"content-length": "70000"}
        r_oversized = await client.post(
            "/check",
            json={"text": "hello"},
            headers=headers,
        )
        assert r_oversized.status_code == 413
        assert "payload exceeds public limit of 64KB" in r_oversized.json()["detail"]


@pytest.mark.anyio
async def test_analyst_endpoint_protection(monkeypatch):
    """Verifies analyst endpoints require admin authentication and validate inputs."""
    monkeypatch.setenv("AGENTSHIELD_ADMIN_KEY", "analyst-admin-key-777")
    app_instance = create_app(audit_db_path=":memory:")
    transport = ASGITransport(app=app_instance)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Unauthenticated calls rejected with 401
        r1 = await client.post("/incident/report", json={"incident_id": "inc_1"})
        assert r1.status_code == 401

        r2 = await client.get("/incident/report/inc_1")
        assert r2.status_code == 401

        # 2. Authenticated call with invalid/malformed incident_id rejected with 400
        auth_headers = {"x-admin-key": "analyst-admin-key-777"}
        r_bad_id = await client.get("/incident/report/../../etc/passwd", headers=auth_headers)
        # Router or regex catches path traversal / invalid format
        assert r_bad_id.status_code in (400, 404)

        r_bad_post = await client.post(
            "/incident/report",
            json={"incident_id": "invalid ID with spaces!"},
            headers=auth_headers,
        )
        assert r_bad_post.status_code in (400, 422)

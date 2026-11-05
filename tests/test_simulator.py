"""
Comprehensive test suite for AgentShield Attack Simulator:
1. All 7 attack scenarios execution against Shield pipeline (including genuine REVIEW).
2. Actual decision recording and expected-versus-actual comparison.
3. Batch simulation execution and batch size limits.
4. Error handling on unknown or malformed scenario IDs.
5. Runtime exception handling producing explicit FAILED status without synthetic BLOCKs.
6. Failure isolation from decision statistics (preventing metric inflation).
7. Administrative authorization and read-only protection on history deletion.
8. Execution isolation from production audit ledger.
9. Deterministic repeated execution.
"""

import os
import pytest
from httpx import AsyncClient, ASGITransport

from agentshield.api.app import create_app
from agentshield.simulator import (
    AttackCategory,
    SimulationType,
    get_default_scenarios,
    get_scenario,
    SimulatorService,
    InMemorySimulationStore,
    SqliteSimulationStore,
)
from agentshield.simulator.models import SimulationRun
from agentshield import Shield


def test_scenario_registry_completeness():
    """Verifies that all 7 attack scenarios (including genuine REVIEW) are present and valid."""
    scenarios = get_default_scenarios()
    assert len(scenarios) == 7

    scenario_ids = [s.id for s in scenarios]
    assert "scenario-benign-order" in scenario_ids
    assert "scenario-prompt-injection" in scenario_ids
    assert "scenario-unauthorized-tool" in scenario_ids
    assert "scenario-data-exfiltration" in scenario_ids
    assert "scenario-privilege-escalation" in scenario_ids
    assert "scenario-suspicious-bulk" in scenario_ids
    assert "scenario-suspicious-legitimate" in scenario_ids

    # Verify each scenario has valid metadata
    for sc in scenarios:
        assert sc.name
        assert sc.description
        assert sc.attack_category in AttackCategory
        assert sc.simulation_type in SimulationType
        assert sc.expected_decision in ("ALLOW", "REVIEW", "BLOCK")
        assert sc.explanation


def test_simulator_service_individual_scenarios():
    """Verifies that each scenario executes against the Shield engine without artificial overrides."""
    shield = Shield(audit_store=None)
    store = InMemorySimulationStore()
    service = SimulatorService(shield=shield, store=store)

    # 1. Benign order -> ALLOW
    run1 = service.execute_scenario("scenario-benign-order")
    assert run1.scenario_id == "scenario-benign-order"
    assert run1.actual_decision == "ALLOW"
    assert run1.expectation_matched is True
    assert run1.latency_ms >= 0

    # 2. Prompt injection -> BLOCK
    run2 = service.execute_scenario("scenario-prompt-injection")
    assert run2.scenario_id == "scenario-prompt-injection"
    assert run2.actual_decision == "BLOCK"
    assert run2.severity == "CRITICAL"
    assert run2.expectation_matched is True

    # 3. Unauthorized tool -> BLOCK
    run3 = service.execute_scenario("scenario-unauthorized-tool")
    assert run3.scenario_id == "scenario-unauthorized-tool"
    assert run3.actual_decision == "BLOCK"
    assert run3.expectation_matched is True

    # 4. Data exfiltration -> BLOCK
    run4 = service.execute_scenario("scenario-data-exfiltration")
    assert run4.scenario_id == "scenario-data-exfiltration"
    assert run4.actual_decision == "BLOCK"
    assert run4.expectation_matched is True

    # 5. Privilege escalation -> BLOCK
    run5 = service.execute_scenario("scenario-privilege-escalation")
    assert run5.scenario_id == "scenario-privilege-escalation"
    assert run5.actual_decision == "BLOCK"
    assert run5.expectation_matched is True

    # 6. Suspicious bulk -> BLOCK
    run6 = service.execute_scenario("scenario-suspicious-bulk")
    assert run6.scenario_id == "scenario-suspicious-bulk"
    assert run6.actual_decision == "BLOCK"
    assert run6.expectation_matched is True

    # 7. Suspicious legitimate inquiry -> genuine REVIEW
    run7 = service.execute_scenario("scenario-suspicious-legitimate")
    assert run7.scenario_id == "scenario-suspicious-legitimate"
    assert run7.actual_decision == "REVIEW"
    assert run7.expected_decision == "REVIEW"
    assert run7.severity == "HIGH"
    assert run7.risk_score == 65.0
    assert run7.expectation_matched is True

    # Check store records
    assert store.count_runs() == 7
    assert store.count_failures() == 0
    summary = service.get_summary()
    assert summary.total_runs == 7
    assert summary.allow_count == 1
    assert summary.review_count == 1
    assert summary.block_count == 5
    assert summary.failed_runs == 0
    assert summary.expectation_matches == 7
    assert summary.expectation_match_rate == 100.0


def test_simulator_runtime_exception_produces_failed_status_without_block():
    """
    Verifies that when an internal exception occurs during execution:
    1. execution_status is FAILED.
    2. actual_decision is None (never a synthetic BLOCK).
    3. risk_score and severity are None (not invented).
    4. rules_triggered is empty (not invented).
    5. expectation_matched is False.
    6. safe diagnostic explanation preserves category without secrets.
    """
    class CrashingShield:
        def execute(self, *args, **kwargs):
            raise RuntimeError("Database connection timed out with api_key=secret-super-1234")

    store = InMemorySimulationStore()
    service = SimulatorService(shield=CrashingShield(), store=store)

    run = service.execute_scenario("scenario-benign-order")
    assert run.execution_status == "FAILED"
    assert run.actual_decision is None
    assert run.actual_decision != "BLOCK"
    assert run.risk_score is None
    assert run.severity is None
    assert run.rules_triggered == []
    assert run.expectation_matched is False
    assert run.error_category == "RuntimeError"
    assert "secret-super-1234" not in run.error
    assert "[REDACTED]" in run.error
    assert "RuntimeError" in run.error

    # Verify failure is stored separately
    assert store.count_failures() == 1
    assert store.count_runs() == 0  # not in evaluated decisions!

    # Verify summary excludes failed runs from decision statistics
    summary = service.get_summary()
    assert summary.total_runs == 0
    assert summary.allow_count == 0
    assert summary.review_count == 0
    assert summary.block_count == 0
    assert summary.failed_runs == 1
    assert summary.expectation_matches == 0
    assert summary.expectation_match_rate == 0.0


def test_failed_runs_do_not_inflate_decision_metrics():
    """
    Verifies that a mix of successful runs and failed runs correctly:
    1. Accumulates ALLOW/REVIEW/BLOCK only from successful runs.
    2. Excludes failed runs from total_runs and expectation_match_rate.
    3. Exposes failed_runs count separately.
    """
    store = InMemorySimulationStore()
    shield = Shield(audit_store=None)
    service = SimulatorService(shield=shield, store=store)

    # 1. Run legitimate REVIEW scenario
    run_rev = service.execute_scenario("scenario-suspicious-legitimate")
    assert run_rev.actual_decision == "REVIEW"

    # 2. Run legitimate ALLOW scenario
    run_allow = service.execute_scenario("scenario-benign-order")
    assert run_allow.actual_decision == "ALLOW"

    # 3. Record a failed run
    fail_run = SimulationRun(
        run_id="sim_fail_test",
        scenario_id="scenario-prompt-injection",
        scenario_name="Prompt Injection Instruction Override",
        attack_category="PROMPT_INJECTION",
        timestamp=1000.0,
        actual_decision=None,
        expected_decision="BLOCK",
        expectation_matched=False,
        risk_score=None,
        severity=None,
        latency_ms=10.0,
        reasons=["ConnectionRefusedError: Host unreachable"],
        rules_triggered=[],
        execution_status="FAILED",
        error_category="ConnectionRefusedError",
        error="ConnectionRefusedError: Host unreachable",
    )
    store.record_failure(fail_run)

    # Check store counts
    assert store.count_runs() == 2
    assert store.count_failures() == 1

    summary = service.get_summary()
    assert summary.total_runs == 2  # exactly the 2 successful evaluations
    assert summary.allow_count == 1
    assert summary.review_count == 1
    assert summary.block_count == 0
    assert summary.failed_runs == 1
    assert summary.expectation_matches == 2
    assert summary.expectation_match_rate == 100.0


def test_sqlite_store_failure_isolation(tmp_path):
    """Verifies that SqliteSimulationStore stores failures in a dedicated table."""
    db_file = str(tmp_path / "sim_test.db")
    store = SqliteSimulationStore(db_file)

    shield = Shield(audit_store=None)
    service = SimulatorService(shield=shield, store=store)

    # Run successful scenario
    run = service.execute_scenario("scenario-suspicious-legitimate")
    assert run.actual_decision == "REVIEW"
    assert store.count_runs() == 1
    assert store.count_failures() == 0

    # Inject failure
    class FailCheckShield:
        def check(self, payload):
            raise TimeoutError("Model endpoint timeout with token=xyz987")

    fail_service = SimulatorService(shield=FailCheckShield(), store=store)
    fail_run = fail_service.execute_scenario("scenario-prompt-injection")
    assert fail_run.execution_status == "FAILED"
    assert fail_run.actual_decision is None
    assert "xyz987" not in fail_run.error
    assert "[REDACTED]" in fail_run.error

    assert store.count_runs() == 1
    assert store.count_failures() == 1

    # Both runs retrievable by run_id
    retrieved_ok = store.get_run(run.run_id)
    assert retrieved_ok is not None
    assert retrieved_ok.actual_decision == "REVIEW"

    retrieved_fail = store.get_run(fail_run.run_id)
    assert retrieved_fail is not None
    assert retrieved_fail.execution_status == "FAILED"
    assert retrieved_fail.actual_decision is None

    # Summary excludes failure from decisions
    summary = store.get_summary()
    assert summary.total_runs == 1
    assert summary.review_count == 1
    assert summary.failed_runs == 1
    assert summary.expectation_match_rate == 100.0


def test_deterministic_repeated_runs():
    """Verifies repeated simulation runs yield identical decisions and risk scores."""
    shield = Shield(audit_store=None)
    store = InMemorySimulationStore()
    service = SimulatorService(shield=shield, store=store)

    run_a = service.execute_scenario("scenario-prompt-injection")
    run_b = service.execute_scenario("scenario-prompt-injection")

    assert run_a.actual_decision == run_b.actual_decision
    assert run_a.risk_score == run_b.risk_score
    assert run_a.severity == run_b.severity
    assert run_a.reasons == run_b.reasons


@pytest.mark.anyio
async def test_api_simulator_scenarios_listing():
    """Verifies GET /api/simulator/scenarios and GET /api/simulator/scenarios/{id}."""
    app = create_app(audit_db_path=":memory:")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # List all
        resp = await client.get("/api/simulator/scenarios")
        assert resp.status_code == 200
        scenarios = resp.json()
        assert len(scenarios) == 7

        # Get specific
        resp_single = await client.get("/api/simulator/scenarios/scenario-suspicious-legitimate")
        assert resp_single.status_code == 200
        data = resp_single.json()
        assert data["id"] == "scenario-suspicious-legitimate"
        assert data["expected_decision"] == "REVIEW"

        # Non-existent scenario -> 404
        resp_404 = await client.get("/api/simulator/scenarios/non-existent-scenario")
        assert resp_404.status_code == 404

        # Malformed scenario ID -> 400
        resp_400 = await client.get("/api/simulator/scenarios/invalid!id@with$special")
        assert resp_400.status_code == 400


@pytest.mark.anyio
async def test_api_simulator_single_run_and_history():
    """Verifies POST /api/simulator/run/{id}, history, and run inspection."""
    app = create_app(audit_db_path=":memory:")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Execute single
        resp_run = await client.post("/api/simulator/run/scenario-benign-order")
        assert resp_run.status_code == 200
        run_data = resp_run.json()
        assert run_data["scenario_id"] == "scenario-benign-order"
        assert run_data["actual_decision"] == "ALLOW"
        assert run_data["expectation_matched"] is True
        run_id = run_data["run_id"]

        # Inspect specific run
        resp_get = await client.get(f"/api/simulator/runs/{run_id}")
        assert resp_get.status_code == 200
        assert resp_get.json()["run_id"] == run_id

        # Query history
        resp_hist = await client.get("/api/simulator/history")
        assert resp_hist.status_code == 200
        history = resp_hist.json()
        assert len(history) >= 1
        assert history[0]["run_id"] == run_id

        # Query summary/benchmarks
        resp_bench = await client.get("/api/simulator/benchmarks")
        assert resp_bench.status_code == 200
        bench_data = resp_bench.json()
        assert bench_data["total_runs"] >= 1
        assert bench_data["allow_count"] >= 1
        assert "failed_runs" in bench_data


@pytest.mark.anyio
async def test_api_simulator_batch_execution():
    """Verifies POST /api/simulator/run-batch executes multiple scenarios."""
    app = create_app(audit_db_path=":memory:")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Execute batch of 3 scenarios
        payload = {
            "scenario_ids": [
                "scenario-benign-order",
                "scenario-suspicious-legitimate",
                "scenario-prompt-injection"
            ]
        }
        resp = await client.post("/api/simulator/run-batch", json=payload)
        assert resp.status_code == 200
        runs = resp.json()
        assert len(runs) == 3
        assert runs[0]["actual_decision"] == "ALLOW"
        assert runs[1]["actual_decision"] == "REVIEW"
        assert runs[2]["actual_decision"] == "BLOCK"

        # Batch with exceeding size (> 20) -> 400/422
        huge_payload = {"scenario_ids": ["scenario-benign-order"] * 25}
        resp_huge = await client.post("/api/simulator/run-batch", json=huge_payload)
        assert resp_huge.status_code in (400, 422)


@pytest.mark.anyio
async def test_api_simulator_history_clear_authorization_and_readonly(monkeypatch):
    """Verifies clear history requires admin authentication and is blocked in read-only mode."""
    admin_key = "sim-admin-secret-key-999"
    monkeypatch.setenv("AGENTSHIELD_ADMIN_KEY", admin_key)

    # 1. Normal mode (mutations permitted)
    app = create_app(audit_db_path=":memory:")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Run a scenario
        await client.post("/api/simulator/run/scenario-benign-order")

        # Unauthenticated clear -> 401
        r_unauth = await client.delete("/api/simulator/history")
        assert r_unauth.status_code == 401

        # Authenticated clear -> 200
        headers = {"x-admin-key": admin_key}
        r_auth = await client.delete("/api/simulator/history", headers=headers)
        assert r_auth.status_code == 200
        assert r_auth.json()["status"] == "cleared"

        # Verify history is now empty
        hist = await client.get("/api/simulator/history")
        assert len(hist.json()) == 0

    # 2. Read-only mode
    monkeypatch.setenv("AGENTSHIELD_READONLY", "1")
    app_ro = create_app(audit_db_path=":memory:")
    transport_ro = ASGITransport(app=app_ro)
    async with AsyncClient(transport=transport_ro, base_url="http://test") as client_ro:
        # Running scenario in isolated sandbox is allowed
        r_run = await client_ro.post("/api/simulator/run/scenario-benign-order")
        assert r_run.status_code == 200

        # Clearing history is BLOCKED in read-only mode -> 403
        headers = {"x-admin-key": admin_key}
        r_clear_blocked = await client_ro.delete("/api/simulator/history", headers=headers)
        assert r_clear_blocked.status_code == 403
        assert "read-only mode" in r_clear_blocked.json()["detail"].lower()


@pytest.mark.anyio
async def test_simulator_storage_isolation_across_all_outcome_types():
    """Verifies that simulator runs producing ALLOW, REVIEW, and BLOCK do not contaminate
    the production audit ledger, production review queue, or production event store."""
    admin_key = "isolation-test-admin"
    app = create_app(audit_db_path=":memory:", admin_api_key=admin_key)
    transport = ASGITransport(app=app)

    # Initial production counts
    assert len(app.state.audit_store.query()) == 0
    assert len(app.state.review_store.get_pending_reviews()) == 0
    assert len(app.state.event_store.query_events()) == 0
    assert len(app.state.event_store.query_alerts()) == 0
    assert len(app.state.event_store.query_incidents()) == 0

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. ALLOW scenario: scenario-benign-order
        r_allow = await client.post("/api/simulator/run/scenario-benign-order")
        assert r_allow.status_code == 200
        assert r_allow.json()["actual_decision"] == "ALLOW"

        # 2. REVIEW scenario: scenario-suspicious-legitimate
        r_review = await client.post("/api/simulator/run/scenario-suspicious-legitimate")
        assert r_review.status_code == 200
        assert r_review.json()["actual_decision"] == "REVIEW"

        # 3. BLOCK scenario: scenario-prompt-injection
        r_block = await client.post("/api/simulator/run/scenario-prompt-injection")
        assert r_block.status_code == 200
        assert r_block.json()["actual_decision"] == "BLOCK"

        # VERIFY PRODUCTION STORES REMAIN COMPLETELY UNCONTAMINATED
        assert len(app.state.audit_store.query()) == 0, "Simulation wrote into production audit store"
        assert len(app.state.review_store.get_pending_reviews()) == 0, "Simulation wrote into production review queue"
        assert len(app.state.event_store.query_events()) == 0, "Simulation wrote into production event store"
        assert len(app.state.event_store.query_alerts()) == 0, "Simulation created production alert"
        assert len(app.state.event_store.query_incidents()) == 0, "Simulation created production incident"

        # VERIFY SIMULATOR ISOLATED STORES HOLD THE SIMULATED TELEMETRY
        assert len(app.state.sim_review_store.get_pending_reviews()) == 1, "Simulated review not recorded in sim_review_store"
        assert len(app.state.sim_event_store.query_events()) >= 3, "Simulated events not recorded in sim_event_store"
        assert len(app.state.simulation_store.list_runs()) == 3, "Simulation runs not recorded in simulation_store"


@pytest.mark.anyio
async def test_simulator_review_queue_preservation_and_approval_isolation():
    """Verifies that:
    1. Simulated reviews are visible in the dashboard review queue with simulated=True.
    2. Simulated reviews can be approved through the existing review endpoint without executing real operations.
    3. Approving a simulated review does not write an entry into the production cryptographic audit ledger.
    4. Production review queue remains strictly isolated."""
    admin_key = "review-iso-admin"
    app = create_app(audit_db_path=":memory:", admin_api_key=admin_key)
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Trigger review scenario in simulator
        r_sim = await client.post("/api/simulator/run/scenario-suspicious-legitimate")
        assert r_sim.status_code == 200
        assert r_sim.json()["actual_decision"] == "REVIEW"

        # 1. Query reviews with source='production' -> 0 reviews
        headers = {"x-admin-key": admin_key}
        r_prod = await client.get("/incident/reviews?source=production", headers=headers)
        assert r_prod.status_code == 200
        assert r_prod.json()["count"] == 0

        # 2. Query reviews with source='simulation' -> 1 simulated review
        r_sim_q = await client.get("/incident/reviews?source=simulation", headers=headers)
        assert r_sim_q.status_code == 200
        assert r_sim_q.json()["count"] == 1
        sim_item = r_sim_q.json()["reviews"][0]
        assert sim_item["simulated"] is True
        review_id = sim_item["review_id"]

        # 3. Default query (used by frontend dashboard) includes simulated review for demo workflow
        r_default = await client.get("/incident/reviews", headers=headers)
        assert r_default.status_code == 200
        assert r_default.json()["count"] == 1
        assert r_default.json()["reviews"][0]["review_id"] == review_id

        # 4. Approve the simulated review via POST /incident/review
        r_approve = await client.post(
            "/incident/review",
            json={"review_id": review_id, "action": "approve"},
            headers=headers,
        )
        assert r_approve.status_code == 200
        approve_data = r_approve.json()
        assert approve_data["status"] == "approved"
        assert approve_data["simulated"] is True

        # 5. Production audit store STILL has 0 records (crypto chain not polluted)
        assert len(app.state.audit_store.query()) == 0
        # 6. Production review queue STILL has 0 records
        assert len(app.state.review_store.get_pending_reviews()) == 0
        # 7. Simulator review queue is now cleared (item was approved in isolated store)
        assert len(app.state.sim_review_store.get_pending_reviews()) == 0


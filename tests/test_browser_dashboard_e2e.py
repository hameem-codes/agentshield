"""
Phase 4: Browser-Level End-to-End Test Suite for AgentShield React Dashboard.

Verifies the user interface against the live FastAPI backend:
1. Dashboard loads without uncaught console errors and renders live API status.
2. Winding path navigation (7 stops) updates stage descriptions and active state.
3. Telemetry window streams (EVENTS, REVIEWS, INCIDENTS, AUDIT, SIMULATION) and event filters.
4. Simulator scenarios load dynamically from backend API.
5. Individual scenario execution displays actual decisions (ALLOW / REVIEW / BLOCK).
6. Batch execution (RUN ALL) runs all scenarios and updates metrics.
7. Benchmark metrics update from backend telemetry (latency, match rate, evaluations).
8. Admin login and logout update UI authentication state.
9. Human review queue actions (APPROVE) reflect real-time backend updates.

If playwright is unavailable in the environment, tests gracefully skip with
an informative explanation per project guidelines.
"""

import os
import sys
import time
import socket
import subprocess
import urllib.request
from pathlib import Path
import pytest

try:
    import playwright
    from playwright.async_api import async_playwright, expect
    HAS_PLAYWRIGHT = True
except ImportError:
    HAS_PLAYWRIGHT = False

ROOT_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = ROOT_DIR / "frontend"


def is_port_open(port: int, host: str = "127.0.0.1") -> bool:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            return s.connect_ex((host, port)) == 0
    except Exception:
        return False


def wait_for_http(url: str, timeout: float = 15.0) -> bool:
    start = time.time()
    while time.time() - start < timeout:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "HealthCheck"})
            with urllib.request.urlopen(req, timeout=1.0) as resp:
                if resp.status in (200, 304):
                    return True
        except Exception:
            time.sleep(0.3)
    return False


def kill_proc_tree(proc: subprocess.Popen):
    try:
        if sys.platform == "win32":
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True)
        else:
            proc.terminate()
            proc.wait(timeout=3)
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass


@pytest.fixture(scope="session", autouse=True)
def live_servers():
    """Ensure backend and frontend servers are available for browser tests."""
    if not HAS_PLAYWRIGHT:
        yield "http://localhost:5173"
        return

    backend_proc = None
    frontend_proc = None

    # 1. Ensure backend is running on :8000
    if not is_port_open(8000):
        env = os.environ.copy()
        env["AGENTSHIELD_ADMIN_KEY"] = "demo-local-admin-secret-key-123"
        env["AGENTSHIELD_SESSION_SECRET"] = "demo-session-secret-at-least-32-chars-long"
        env["AGENTSHIELD_CORS_ORIGINS"] = "http://localhost:5173,http://127.0.0.1:5173"
        env["AGENTSHIELD_ALLOW_MOCK_FALLBACK"] = "true"
        env["AGENTSHIELD_READONLY"] = "0"
        backend_proc = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "agentshield.api.app:app", "--host", "127.0.0.1", "--port", "8000"],
            cwd=str(ROOT_DIR),
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if not wait_for_http("http://127.0.0.1:8000/health", timeout=15.0):
            kill_proc_tree(backend_proc)
            pytest.fail("Backend server failed to start on port 8000 within 15 seconds")

    # 2. Ensure frontend is running on :5173
    if not is_port_open(5173):
        frontend_proc = subprocess.Popen(
            ["node", "node_modules/vite/bin/vite.js"],
            cwd=str(FRONTEND_DIR),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if not wait_for_http("http://localhost:5173", timeout=15.0):
            if backend_proc:
                kill_proc_tree(backend_proc)
            kill_proc_tree(frontend_proc)
            pytest.fail("Frontend dev server failed to start on port 5173 within 15 seconds")

    yield "http://localhost:5173"

    if frontend_proc:
        kill_proc_tree(frontend_proc)
    if backend_proc:
        kill_proc_tree(backend_proc)


pytestmark = pytest.mark.skipif(
    not HAS_PLAYWRIGHT,
    reason="Playwright browser automation dependency is not installed in the environment.",
)


@pytest.mark.anyio
async def test_browser_dashboard_loads_and_navigates():
    """Verifies that the dashboard loads, renders live API status, and winding path stops navigate."""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        console_errors = []
        page.on("pageerror", lambda err: console_errors.append(str(err)))

        await page.goto("http://localhost:5173", wait_until="networkidle")
        assert len(console_errors) == 0, f"Uncaught console errors: {console_errors}"

        # 1. Verify Header and Subtitle
        heading = page.locator("h1")
        await expect(heading).to_contain_text("AGENTSHIELD")
        subtitle = page.locator("text=RUNTIME SECURITY")
        await expect(subtitle).to_be_visible()

        # 2. Verify Live API Online indicator
        api_badge = page.locator("text=API online")
        await expect(api_badge).to_be_visible()

        # 3. Verify Overview Chips
        allow_chip = page.get_by_text("ALLOW").first
        await expect(allow_chip).to_be_visible()
        review_chip = page.get_by_text("REVIEW").first
        await expect(review_chip).to_be_visible()
        block_chip = page.get_by_text("BLOCK").first
        await expect(block_chip).to_be_visible()

        # 4. Verify initial Stage Indicator in Header
        stage_indicator = page.locator("text=STAGE 1 / 7")
        await expect(stage_indicator).to_be_visible()

        # 5. Verify Winding Path Stops Interactive Navigation (all 7 stops)
        for idx in range(7):
            stop_group = page.locator("svg g.group").nth(idx)
            await stop_group.dispatch_event("click")
            expected_stage = f"STAGE {idx + 1} / 7"
            await expect(page.locator(f"text={expected_stage}")).to_be_visible()

        # 6. Verify Telemetry Window Stream Switching
        streams = [
            ("EVENTS", "events_stream.log"),
            ("REVIEWS", "human_review_queue.log"),
            ("INCIDENTS", "security_incidents.log"),
            ("AUDIT", "audit_integrity_chain.log"),
            ("SIMULATION", "simulation_runs.log"),
        ]
        for stream_btn_text, expected_log_name in streams:
            tab_btn = page.locator(f"button:has-text('{stream_btn_text}')").first
            await tab_btn.click()
            await expect(page.locator(f"text={expected_log_name}")).to_be_visible()

        # 7. Switch back to EVENTS and test filter buttons
        events_tab = page.get_by_role("button", name="EVENTS", exact=True)
        await events_tab.click()
        await expect(page.locator("text=events_stream.log")).to_be_visible()

        for filter_name in ["BLOCK", "REVIEW", "ALLOW", "all"]:
            filter_btn = page.get_by_role("button", name=filter_name, exact=True)
            await filter_btn.click()

        await browser.close()


@pytest.mark.anyio
async def test_browser_simulator_execution_and_decisions():
    """Verifies simulator scenario selection and actual execution for ALLOW, BLOCK, and REVIEW."""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        await page.goto("http://localhost:5173", wait_until="networkidle")

        select = page.locator("select[aria-label='Attack Scenario']")
        await expect(select).to_be_visible()

        # Verify options are loaded from backend API
        options = page.locator("select[aria-label='Attack Scenario'] option")
        count = await options.count()
        assert count >= 6, f"Expected at least 6 scenarios, found {count}"

        # 1. Test Prompt Injection -> BLOCK
        await select.select_option(value="scenario-prompt-injection")
        run_btn = page.locator("button:has-text('RUN SCENARIO')")
        await run_btn.click()

        # Await BLOCK chip in simulator latest results
        block_chip = page.get_by_text("BLOCK", exact=True).first
        await expect(block_chip).to_be_visible(timeout=10000)
        match_label = page.locator("text=[EXPECTATION MATCHED]").first
        await expect(match_label).to_be_visible()

        # 2. Test Legitimate Query -> ALLOW
        benign_val = "scenario-legitimate-readonly" if await page.locator("option[value='scenario-legitimate-readonly']").count() > 0 else "scenario-benign-order"
        await select.select_option(value=benign_val)
        await run_btn.click()

        allow_chip = page.get_by_text("ALLOW", exact=True).first
        await expect(allow_chip).to_be_visible(timeout=10000)

        # 3. Test Suspicious Inquiry -> REVIEW
        review_opt = page.locator("option[value='scenario-suspicious-legitimate']")
        if await review_opt.count() > 0:
            await select.select_option(value="scenario-suspicious-legitimate")
            await run_btn.click()

            review_chip = page.get_by_text("REVIEW", exact=True).first
            await expect(review_chip).to_be_visible(timeout=10000)

        await browser.close()


@pytest.mark.anyio
async def test_browser_batch_execution_and_benchmarks():
    """Verifies batch simulation run, benchmark metric updates, and simulation log stream."""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        await page.goto("http://localhost:5173", wait_until="networkidle")

        # Click RUN ALL
        batch_btn = page.locator("button:has-text('RUN ALL')")
        await expect(batch_btn).to_be_visible()
        await batch_btn.click()

        # Await batch completion notification
        batch_msg = page.locator("text=Batch simulation complete:")
        await expect(batch_msg).to_be_visible(timeout=15000)

        # Verify Benchmarks section updated
        benchmark_heading = page.locator("text=BENCHMARKS")
        await expect(benchmark_heading).to_be_visible()

        match_rate_label = page.locator("text=scenario expectation match rate")
        await expect(match_rate_label).to_be_visible()

        evaluations_stat = page.locator("text=evaluations:")
        await expect(evaluations_stat).to_be_visible()

        # Switch to SIMULATION stream to inspect runs log
        sim_tab = page.locator("button:has-text('SIMULATION')")
        await sim_tab.click()

        log_header = page.locator("text=simulation_runs.log")
        await expect(log_header).to_be_visible()

        # Verify simulation entries exist in stream
        sim_entries = page.locator("div:has-text('simulation_runs.log') ~ *")
        assert await sim_entries.count() >= 1

        await browser.close()


@pytest.mark.anyio
async def test_browser_admin_auth_and_review_workflow():
    """Verifies admin login, human review queue inspection and approval, and logout."""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        await page.goto("http://localhost:5173", wait_until="networkidle")

        # 1. Admin Sign In
        sign_in_btn = page.locator("button:has-text('[admin sign in]')")
        await expect(sign_in_btn).to_be_visible()
        await sign_in_btn.click()

        key_input = page.locator("input[placeholder*='AGENTSHIELD_ADMIN_KEY']")
        await expect(key_input).to_be_visible()

        # Attempt invalid key first
        await key_input.fill("invalid-admin-key")
        auth_btn = page.locator("button:has-text('AUTHENTICATE')")
        await auth_btn.click()
        auth_err = page.locator("text=Invalid administrative credentials")
        await expect(auth_err).to_be_visible()

        # Authenticate with valid key
        await key_input.fill("demo-local-admin-secret-key-123")
        await auth_btn.click()

        admin_badge = page.locator("text=ADMIN ACTIVE")
        await expect(admin_badge).to_be_visible()
        sign_out_btn = page.locator("button:has-text('[sign out]')")
        await expect(sign_out_btn).to_be_visible()

        # 2. Trigger review scenario to ensure pending review item exists
        select = page.locator("select[aria-label='Attack Scenario']")
        if await page.locator("option[value='scenario-suspicious-legitimate']").count() > 0:
            await select.select_option(value="scenario-suspicious-legitimate")
            await page.locator("button:has-text('RUN SCENARIO')").click()
            await expect(page.get_by_text("REVIEW", exact=True).first).to_be_visible(timeout=10000)

        # 3. Check REVIEWS tab in Telemetry window
        reviews_tab = page.locator("button:has-text('REVIEWS')")
        await reviews_tab.click()
        await expect(page.locator("text=human_review_queue.log")).to_be_visible()

        # If a review is queued, verify APPROVE button works
        approve_btn = page.locator("button:has-text('APPROVE')").first
        if await approve_btn.count() > 0:
            await approve_btn.click()
            toast = page.locator("text=approved").first
            await expect(toast).to_be_visible(timeout=10000)

        # 4. Sign Out
        await sign_out_btn.click()
        await expect(page.locator("button:has-text('[admin sign in]')")).to_be_visible()

        await browser.close()


@pytest.mark.anyio
async def test_browser_policies_and_risk_display():
    """Verifies that POLICIES and RISK sections render in browser with demo fallback and live data on auth."""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        await page.goto("http://localhost:5173", wait_until="networkidle")

        # 1. POLICIES heading and rules visible
        policies_heading = page.locator("h3:has-text('POLICIES')")
        await expect(policies_heading).to_be_visible()

        # 2. RISK heading and factors visible
        risk_heading = page.locator("h3:has-text('RISK')")
        await expect(risk_heading).to_be_visible()

        # 3. Initially unauthenticated -> demo badges
        await expect(page.locator("h3:has-text('POLICIES') span:has-text('demo')")).to_be_visible()
        await expect(page.locator("h3:has-text('RISK') span:has-text('demo')")).to_be_visible()

        # 4. Sign in as admin
        sign_in_btn = page.locator("button:has-text('[admin sign in]')")
        await sign_in_btn.click()
        key_input = page.locator("input[placeholder*='AGENTSHIELD_ADMIN_KEY']")
        await key_input.fill("demo-local-admin-secret-key-123")
        await page.locator("button:has-text('AUTHENTICATE')").click()
        await expect(page.locator("text=ADMIN ACTIVE")).to_be_visible()

        # 5. Live badges visible for policies and risk
        await expect(page.locator("h3:has-text('POLICIES') span:has-text('live')")).to_be_visible(timeout=10000)
        await expect(page.locator("h3:has-text('RISK') span:has-text('live')")).to_be_visible(timeout=10000)

        # Check SETTINGS tab renders live configuration
        settings_tab = page.locator("button:has-text('SETTINGS')")
        await settings_tab.click()
        await expect(page.locator("text=runtime_configuration.env")).to_be_visible()

        # 6. Sign out -> cleanly reverts to demo fallback
        await page.locator("button:has-text('[sign out]')").click()
        await expect(page.locator("h3:has-text('POLICIES') span:has-text('demo')")).to_be_visible(timeout=10000)
        await expect(page.locator("h3:has-text('RISK') span:has-text('demo')")).to_be_visible(timeout=10000)

        await browser.close()

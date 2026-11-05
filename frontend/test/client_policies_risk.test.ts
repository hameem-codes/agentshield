import test from "node:test";
import assert from "node:assert/strict";
import { ApiClient } from "../src/api/client.ts";
import { DEMO_POLICIES, DEMO_RISK_FACTORS } from "../src/mock/events.ts";

test("ApiClient getPolicies - successful response handling", async () => {
  const mockPayload = {
    version_hash: "hash-abc-123",
    known_tools: ["create_order", "refund_order"],
    agents: [{ name: "shopping_agent", allowed_tools: ["create_order"], denied_tools: ["refund_order"], allowed_destinations: [] }],
    tools: [{ tool: "create_order", max_quantity: 10, max_amount: null, required_permissions: [], allowed_destinations: [] }],
    policies: [
      { id: "pol-1", name: "shopping_agent tool access", type: "agent_allowlist", target: "shopping_agent", description: "Allowed tools: create_order" }
    ]
  };

  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/policies") || urlStr.includes("/policies")) {
        return new Response(JSON.stringify(mockPayload), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      return new Response("Not Found", { status: 404 });
    };

    const client = new ApiClient("http://127.0.0.1:8000");
    const res = await client.getPolicies();

    assert.equal(res.version_hash, "hash-abc-123");
    assert.deepEqual(res.known_tools, ["create_order", "refund_order"]);
    assert.equal(res.policies.length, 1);
    assert.equal(res.policies[0].name, "shopping_agent tool access");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ApiClient getRiskFactors - successful response handling", async () => {
  const mockPayload = {
    factors: [
      { id: "rf-1", name: "destructive_tool", weight: 85, description: "Destructive operation" },
      { id: "rf-2", name: "financial_impact", weight: 40, description: "Financial transaction" }
    ],
    severity_thresholds: {
      low_max: 29,
      medium_max: 59,
      high_max: 84
    }
  };

  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/risk/factors") || urlStr.includes("/risk/factors")) {
        return new Response(JSON.stringify(mockPayload), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      return new Response("Not Found", { status: 404 });
    };

    const client = new ApiClient("http://127.0.0.1:8000");
    const res = await client.getRiskFactors();

    assert.equal(res.factors.length, 2);
    assert.equal(res.factors[0].name, "destructive_tool");
    assert.equal(res.severity_thresholds.high_max, 84);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ApiClient getPolicies & getRiskFactors - offline fallback behavior", async () => {
  const originalFetch = globalThis.fetch;
  try {
    // Simulate offline or 403 Forbidden error (unauthenticated)
    globalThis.fetch = async () => {
      throw new Error("Failed to fetch: connection refused (offline)");
    };

    const client = new ApiClient("http://127.0.0.1:8000");

    // Both requests reject on offline / failure
    await assert.rejects(async () => {
      await client.getPolicies();
    }, /Failed to fetch/);

    await assert.rejects(async () => {
      await client.getRiskFactors();
    }, /Failed to fetch/);

    // Verify UI fallback simulation:
    // When API fails or returns error, UI falls back cleanly to DEMO_POLICIES and DEMO_RISK_FACTORS
    let apiPolicies = null;
    let apiRiskFactors = null;

    try {
      apiPolicies = await client.getPolicies();
    } catch {
      apiPolicies = null; // fallback to demo
    }

    try {
      apiRiskFactors = await client.getRiskFactors();
    } catch {
      apiRiskFactors = null; // fallback to demo
    }

    const displayedPolicies = (apiPolicies && apiPolicies.length > 0) ? apiPolicies : DEMO_POLICIES;
    const isPoliciesLive = Boolean(apiPolicies && apiPolicies.length > 0);

    const displayedRiskFactors = (apiRiskFactors && apiRiskFactors.length > 0) ? apiRiskFactors : DEMO_RISK_FACTORS;
    const isRiskLive = Boolean(apiRiskFactors && apiRiskFactors.length > 0);

    assert.equal(isPoliciesLive, false, "Must indicate demo mode when offline");
    assert.equal(displayedPolicies, DEMO_POLICIES, "Must fall back to DEMO_POLICIES");
    assert.equal(displayedPolicies.length >= 2, true);

    assert.equal(isRiskLive, false, "Must indicate demo mode when offline");
    assert.equal(displayedRiskFactors, DEMO_RISK_FACTORS, "Must fall back to DEMO_RISK_FACTORS");
    assert.equal(displayedRiskFactors.length >= 3, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ApiClient getRuntimeConfig - returns non-secret settings", async () => {
  const mockConfig = {
    environment: "development",
    read_only: false,
    storage_backend: "sqlite",
    database_configured: false,
    analyst_provider: "mock",
    analyst_model: "mock-analyst-v1",
    mock_fallback_enabled: true,
    max_tool_execution_seconds: 30.0,
    max_tool_calls_per_session: 50,
    max_arguments_bytes: 65536,
    max_body_bytes: 1048576,
    max_token_budget: 100000,
    rate_limit_agent: "100/minute",
    rate_limit_tool: "60/minute",
    rate_limit_public: "120/60s",
    rate_limit_analyst: "20/60s",
    loop_consecutive_limit: 3,
    loop_cycle_limit: 2,
    circuit_breaker_failure_threshold: 3,
    circuit_breaker_recovery_timeout: 30.0,
    policy_version_hash: "pol-hash-test-999",
    admin_auth_configured: true,
  };

  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url: string | URL | Request) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/config") || urlStr.includes("/config")) {
        return new Response(JSON.stringify(mockConfig), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      return new Response("Not Found", { status: 404 });
    };

    const client = new ApiClient("http://127.0.0.1:8000");
    const cfg = await client.getRuntimeConfig();

    assert.equal(cfg.environment, "development");
    assert.equal(cfg.storage_backend, "sqlite");
    assert.equal(cfg.max_tool_execution_seconds, 30.0);
    assert.equal(cfg.admin_auth_configured, true);
    // Verify no secret fields exist
    assert.equal((cfg as any).api_key, undefined);
    assert.equal((cfg as any).admin_key, undefined);
    assert.equal((cfg as any).database_url, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


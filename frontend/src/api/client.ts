export interface ApiDecisionResponse {
  allowed: boolean;
  decision: "ALLOW" | "REVIEW" | "BLOCK";
  reasons: string[];
  risk_score: number;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  agent: string;
  tool: string;
}

export interface ApiExecutionResponse {
  decision: ApiDecisionResponse;
  execution_status: "executed" | "not_executed" | "error";
  tool_result?: unknown;
  error?: string | null;
}

export interface ApiEventItem {
  id: number;
  timestamp: string;
  agent: string;
  tool: string;
  arguments: Record<string, unknown>;
  decision: "ALLOW" | "REVIEW" | "BLOCK";
  allowed: boolean;
  reasons: string[];
  rules_triggered: string[];
  risk_score: number;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  execution_status: "executed" | "not_executed" | "error";
  error?: string | null;
}

export interface ApiEventsResponse {
  events: ApiEventItem[];
  total: number;
}

export interface ApiHealthResponse {
  status: string;
  version: string;
  engine: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async getHealth(): Promise<ApiHealthResponse> {
    const res = await fetch(`${this.baseUrl}/health`);
    if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
    return res.json();
  }

  async getEvents(limit: number = 50): Promise<ApiEventsResponse> {
    const res = await fetch(`${this.baseUrl}/events?limit=${limit}`);
    if (!res.ok) throw new Error(`Failed to fetch events: ${res.statusText}`);
    return res.json();
  }

  async authorize(
    agent: string,
    tool: string,
    args: Record<string, unknown> = {},
    permissions: string[] = []
  ): Promise<ApiDecisionResponse> {
    const res = await fetch(`${this.baseUrl}/authorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent, tool, arguments: args, permissions }),
    });
    if (!res.ok) throw new Error(`Authorize failed: ${res.statusText}`);
    return res.json();
  }

  async execute(
    agent: string,
    tool: string,
    args: Record<string, unknown> = {},
    permissions: string[] = []
  ): Promise<ApiExecutionResponse> {
    const res = await fetch(`${this.baseUrl}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent, tool, arguments: args, permissions }),
    });
    if (!res.ok) throw new Error(`Execute failed: ${res.statusText}`);
    return res.json();
  }
}

export const api = new ApiClient();

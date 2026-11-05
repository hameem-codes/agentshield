# AgentShield
Open-source, framework-independent Python runtime security SDK for tool-using AI agents. Agent proposes action -> AgentShield authenticates the agent, validates, applies deterministic policy -> ALLOW / REVIEW / BLOCK -> execute only if permitted -> audit.

## Non-negotiable rules
- LLM and RAG are never the final authority. Deterministic policy fails closed.
- Unknown tool, unknown agent, malformed request, explicit denial => BLOCK.
- BLOCK never invokes the tool callable. ALLOW invokes it exactly once per execute().
- Risk score can escalate to REVIEW/BLOCK, never turn a denial into ALLOW.
- Validate normalized arguments, then execute those exact frozen values.
- Destinations are allowlisted by parsed hostname, never substring.
- Only the executor holds tool credentials. Agents never call tools directly.
- Audit the authorization decision and the execution status separately. Include the policy version hash. Redact secrets.
- SDK owns security logic. FastAPI exposes it. React only displays it.
- The public/demo API runs only fake sandbox tools and is read-only for incident controls.
- No invented metrics, no claims of perfect security, no claim without a reproducible test.

## Stack
Python 3.12/3.13, src-layout, dataclasses/enums, pytest, custom PolicyEngine (PolicyEngine.known_tools is the source of truth), ToolRegistry + shield.execute(), RiskEngine, SQLite (stdlib) behind an AuditStore interface, FastAPI + Pydantic, React + TypeScript + Vite + Tailwind in /frontend.

## Design spec (frontend)
Page #0e0e0e with a 36px faint grid; cream #f4ecd0, ink #17150d, pink #ff8fb1, green #3ddc97, yellow #f3b82b. Fonts: Archivo (800, italic 900) and DM Sans. No bordered rounded card boxes: sections are text on the grid (pink uppercase italic heading plus short paragraph). Only ALLOW/REVIEW/BLOCK chips (colored fill, 3px black border, 4px 4px 0 black shadow) and one small events window. Winding bezier SVG path with 7 numbered stops: Propose, Validate, Risk, Policy, Decision, Execute, Audit. Uneven text placement. Works at phone width.

## Working style
Inspect first. Change narrowly. Never overwrite working code. No new dependencies unless the prompt names them. Never print or commit secrets or .env. Run tests. Report changed files, pass/fail counts and failures only. Never claim a command ran without its output.

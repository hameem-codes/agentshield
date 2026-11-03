# AgentShield

AgentShield is an open-source runtime security and control layer for AI agents.

## Core Architecture
An AI agent can propose an action (e.g., calling a tool or API). AgentShield sits strictly between the AI agent and the real tool. It intercepts the proposed action, runs deterministic policies, and evaluates risk before allowing, reviewing, or blocking the execution. Crucially, the LLM is NOT the final security authority.

```
+--------------------+        +-----------------------+        +---------------+
|     AI Agent       | -----> |      AgentShield      | -----> | External Tool |
| (Proposes Action)  |        | (Runtime Interceptor) |        | / API Action  |
+--------------------+        +-----------------------+        +---------------+
                                      |       |
                         [Evaluate Policy]   [Human Review]
                                      |       |
                                  [Blocked / Allowed]
```

## Features & Screens

AgentShield includes a retro 16-bit pixel-art security dashboard providing full runtime visibility and control:

- **Overview Dashboard**: Agent runtime metrics, active risk score indicators, real-time security activity stream, attention queue, and quick actions.
- **Events Screen**: Complete audit trail of every intercepted agent action with real-time search, multi-attribute filters, and slide-over event payload inspection drawer.
- **Human-in-the-Loop Review**: Dedicated review queue for high-risk actions requiring administrative approval, complete with argument inspection, policy checks, denial reasons, and batch approval.
- **Policies & Agents**: Centralized security policy management (allowed tools, rate limits, domain restrictions, behavior rules) alongside a full agent runtime registry.
- **Security Benchmarks**: Evaluates protection effectiveness against OWASP Agentic vectors (prompt injection, tool misuse, privilege escalation, SSRF, volume limits), comparing baseline execution against AgentShield protected mode.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS
- **Styling**: 16-bit pixel-art design system, stepped borders (`.pixel-corners`), custom SVG pixel assets
- **Icons**: Lucide Icons & handcrafted crisp pixel SVGs

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm / pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/hameem-codes/agentshield.git
cd agentshield

# Install dependencies
npm install

# Start the local development server
npm run dev
```

### Production Build & Linting

```bash
# Build production bundle
npm run build

# Run Oxlint
npm run lint
```

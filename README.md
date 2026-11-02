# 🧠 Engram 2.1 — Production Reliability, Continuity, and Security Hardening

**The Universal, Portable Memory Layer for AI Agents — powered by [Walrus](https://walrus.xyz).**

Engram enables authorized AI agents (Claude, Cursor, Copilot, Antigravity, Gemini, CrewAI, AutoGen, LangChain) to remember, retrieve, understand, and seamlessly continue useful work across different models, platforms, devices, and sessions.

The user never has to repeatedly explain who they are, their technology stack, previous decisions, architectural choices, or what happened in previous sessions.

---

## ⚡ Engram 2.1 Production Hardening Pillars

### 1. Security & Trust Hardening (Zero-Trust Architecture)
* **Fail-Closed Secrets:** Automatically fails closed in production if `ENGRAM_SIGNING_SECRET` is missing or insecure (<16 chars).
* **Zero-Downtime Secret Rotation:** Supports seamless cryptographic key rotation via `ENGRAM_PREVIOUS_SIGNING_SECRET`.
* **Real-Time Token Revocation:** Instant revocation of `eng_live_` API keys across both REST and MCP protocols.
* **Anti-IDOR Authorization:** Centralized server-side team membership validation (`authorizeMemoryAccess`) prevents unauthorized cross-tenant data access.
* **Credential Redaction:** Automatic redaction of raw tokens, private keys, and query parameters from URLs and application logs.

### 2. Storage Reliability & Data Integrity
* **Explicit Persistence States:** Truthful states (`confirmed_durable`, `pending`, `local_mock`, `failed`, `recovery_required`). Engram never falsely claims on-chain anchoring when unanchored.
* **Idempotent Write-Ahead Pipeline:** Cryptographic idempotency keys prevent duplicate writes, conserving on-chain storage units.
* **Resilient Retry Queue:** Automatic exponential backoff with jitter and background recovery processing for transient storage outages.
* **Cryptographic Content Hashing:** Deterministic SHA-256 verification and runtime tamper detection.
* **Truthful Retention Contracts:** Accurate representation of decentralized blob storage lifecycle and Sui epoch expiration.

### 3. Intelligent Memory Engine
* **5 Structured Memory Categories:** `episodic` (events/experiences), `semantic` (facts/knowledge), `procedural` (rules/workflows), `project` (decisions/architecture/progress), `relational` (people/teams/entities).
* **8-Stage Lifecycle Pipeline:** `CAPTURE` → `CLASSIFY` → `CONSOLIDATE` → `VALIDATE` → `UPDATE` → `RETRIEVE` → `DECAY` → `FORGET`.
* **Hybrid Retrieval Scoring:** Blends semantic query matching (45%), entity graph link analysis (30%), recency half-life (15%), and importance weighting (10%).
* **Smart Conflict Resolution:** Automatically identifies when newer statements update older preferences (e.g. migrating backend stack from Python to TypeScript) and supersedes outdated memories while preserving audit history.

### 4. Continuous Context & Cross-Agent Handoffs
* **Zero-Cold-Start Agent Handoffs:** Departing agents record structured task states, handoff notes, next actions, and unresolved questions. Any subsequent agent picks up work immediately.
* **Verifiable Snapshots:** Export and restore project context using tamper-proof SHA-256 snapshot checksums.
* **Quick-Resume Brief:** Generates concise, agent-ready Markdown injected directly into any fresh agent session.

### 5. Multi-Language SDK & Agent Integrations
* **Python SDK (`engram-memory`):** Clean, standard-library Python SDK (`from engram import remember, recall, handoff`) with offline caching and provenance tracking.
* **Model Context Protocol (MCP):** Serverless HTTP endpoint (`/api/mcp`) and stdio CLI package (`engram-walrus`) exposing `engram_remember`, `engram_recall`, `engram_tidy`, `engram_handoff`, and `engram_snapshot`.
* **Cross-Platform:** Works with Claude Desktop, Cursor IDE, Google Antigravity, Gemini CLI, Windsurf, ChatGPT, and iOS/Android workflows.

---

## 🚀 Quick Start

### 1. Python SDK

```bash
pip install engram-memory
```

```python
from engram import remember, recall, handoff

# Remember a durable architectural choice
remember("We use Supabase PostgreSQL for metadata and Walrus for decentralized blob storage", type="decision")

# Recall before answering questions that depend on past context
memories = recall("What database do we use?")
for m in memories:
    print(f"[{m.type}] {m.text}")

# Zero-cold-start agent handoff
handoff(
    project_id="proj_alpha",
    from_agent="Claude Code",
    to_agent="Cursor IDE",
    task_state="Milestone 3 complete",
    notes="Finished continuity engine and verified 13/13 tests.",
    next_actions=["Deploy to Vercel"]
)
```

### 2. Model Context Protocol (MCP) Setup

Add to your MCP client config (`~/.cursor/mcp.json` or `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "engram": {
      "url": "https://engram-pearl.vercel.app/mcp?token=YOUR_ENGRAM_API_KEY"
    }
  }
}
```

Or run via the official npm CLI package:

```bash
npx -y engram-walrus --key=YOUR_ENGRAM_API_KEY
```

### 3. Local Development & Web Dashboard

```bash
pnpm install

# Run Vite web dashboard + local API server
pnpm dev

# Build for production
pnpm run build
```

---

## 🧪 Comprehensive Automated Test Suites

Engram 2.1 maintains 100% passing test coverage across 73 automated tests and benchmarks:

```bash
pnpm run test:all
```

| Suite | Focus Area | Passing Tests |
| :--- | :--- | :---: |
| `packages/engram-mcp/test.mjs` | MCP Package Protocol & Utilities | **5 / 5** |
| `scripts/phase5-test.mjs` | CLI & NPM Subprocess Integration | **PASS** |
| `scripts/phase6-test.mjs` | Conflict Engine & Walrus Epoch Staking | **PASS** |
| `scripts/security-regression-test.mjs` | Fail-Closed Secrets, Anti-IDOR, Token Revocation | **14 / 14** |
| `scripts/storage-reliability-test.mjs` | Idempotency, Retries, SHA-256 Hashing, Retention | **10 / 10** |
| `scripts/intelligence-engine-test.mjs` | 5 Categories, Lifecycle, Hybrid Scoring, Conflict | **10 / 10** |
| `scripts/continuity-engine-test.mjs` | Context Tracking, Handoffs, Snapshots, REST/MCP | **13 / 13** |
| `scripts/retrieval-quality-eval.mjs` | Scientific Retrieval Benchmark (Recall@k, MRR, nDCG) | **PASS (MRR 1.000)** |
| `scripts/engram-2.1-regression-test.mjs` | Workstreams A–F: Continuity, Leases, Parity, Security | **15 / 15** |
| `packages/engram-py/tests/test_sdk.py` | Python SDK Models, Fallback, Provenance | **5 / 5** |
| **Total Test Suite** | **All Core Verification Suites & Evaluation Benchmarks** | **73 / 73 PASS** |

---

## 📂 Repository Architecture

```
engram/
├── api/                       # Serverless REST & MCP endpoints (Vercel / Express)
│   ├── _lib/                  # Core engineering engines
│   │   ├── auth.ts            # Centralized authentication & IDOR authorization
│   │   ├── continuity.ts      # Cross-agent handoff & context snapshot engine
│   │   ├── intelligence.ts    # 5-category memory lifecycle & hybrid retrieval
│   │   ├── storage.ts         # Idempotent write-ahead retry queue & sha256 hashing
│   │   ├── token.ts           # Dynamic HMAC rotation & token lifecycle
│   │   └── security.ts        # Secret scanners & credential URL redaction
│   ├── continuity.ts          # REST endpoints for cross-agent continuity
│   ├── remember.ts            # Intelligent memory persistence endpoint
│   ├── recall.ts              # Hybrid semantic retrieval endpoint
│   ├── storage.ts             # Storage queue status & recovery endpoint
│   └── mcp.ts                 # Streamable HTTP MCP server (5 registered tools)
├── packages/
│   ├── engram-mcp/            # engram-walrus v0.2.0 NPM package
│   └── engram-py/             # engram-memory v2.0.0 Python SDK
├── scripts/                   # Automated regression test harnesses
├── src/                       # React 19 + Tailwind v4 Web Application
└── server/                    # Local Express development server
```

---

## 📜 License

MIT License. Built for the decentralized future of autonomous AI agents.

# Engram — Product & Architecture Handoff

> **Status:** Production-Ready Evolution (Phases 1–4 Complete).
> Cross-platform, verifiable persistent memory for AI agents on Walrus.

---

## 1. System Overview

Engram has evolved from a hackathon prototype into a full-fledged cross-platform memory platform supporting:
1. **Personal Memory**: Individual users obtain scoped API keys (`eng_usr_...`), sync context across mobile (iOS/Android), desktop (Claude Desktop, Cursor), and CLI (`npx engram-walrus`). Personal memories are strictly isolated and private.
2. **Team Memory**: Collaborative shared memory spaces with role controls. Shared decisions, stack configs, and conventions are accessible to all team members without manual copying.
3. **Usage Plans & Ceilings**:
   - **Personal Free Plan**: 1 user account, 50 saves/day, cross-device sync, Seal encryption on Walrus.
   - **Free Team Plan**: Up to 3 team members (strictly enforced), 150 shared saves/day, 1 shared team brain.
   - **Pro Tier**: Scaled limits, unlimited team members, dedicated multi-epoch Walrus storage.
4. **NPM Package (`engram-walrus`)**: Official CLI package published on NPM, now supporting `--key=eng_...` cloud connectivity, direct MemWal bridge, or offline mock.
5. **Modern Frontend & Dashboard**: Replaced the hackathon chat demo with a high-conversion landing page and authenticated user dashboard (`/dashboard`) featuring API key management, team member invites, real-time usage progress bars, and a semantic memory explorer.

---

## 2. Directory Structure & Key Files

```
engram/
├── api/
│   ├── _lib/
│   │   ├── auth.ts              # Session extraction & Supabase / eng_ key authentication
│   │   ├── db.ts                # Database DAL exports & Plan Limits
│   │   ├── memwal.ts            # MemWal relayer & mock factory
│   │   └── supabase.ts          # Supabase client initializers
│   ├── auth.ts                  # /api/auth (register, login, me, logout)
│   ├── keys.ts                  # /api/keys (create, list, revoke)
│   ├── teams.ts                 # /api/teams (create, list, invite, members)
│   ├── usage.ts                 # /api/usage (daily quota counters vs ceilings)
│   ├── recall.ts                # /api/recall (semantic memory search)
│   └── remember.ts              # /api/remember (durable memory persistence)
├── mcp/
│   ├── auth-db.mjs              # Core database abstraction (Supabase + local SQLite fallback)
│   ├── engram-http.mjs          # MCP Streamable HTTP transport (authenticates eng_ keys)
│   └── token.mjs                # Legacy stateless space token helper
├── packages/
│   └── engram-mcp/              # Published NPM package: engram-walrus
│       ├── bin.mjs              # CLI entry point (supports --key, --url, --room)
│       ├── core.mjs             # MCP tool handlers & cloudBackend adapter
│       └── package.json         # Package configuration (v0.1.0)
├── src/
│   ├── context/
│   │   └── AuthContext.tsx      # React authentication state & token persistence
│   ├── pages/
│   │   ├── DocsPage.tsx         # Comprehensive official documentation hub (/docs)
│   │   ├── LoginPage.tsx        # Sign-in page with quick demo accounts
│   │   ├── RegisterPage.tsx     # Sign-up page with plan feature summary
│   │   ├── DashboardPage.tsx    # User dashboard (Keys, Teams, Usage, Explorer)
│   │   ├── SetupPage.tsx        # Setup snippet selector wizard
│   │   └── TokenPage.tsx        # Legacy space token provisioning
│   ├── components/
│   │   └── Chrome.tsx           # Responsive Nav & Footer with auth status
│   ├── App.tsx                  # Upgraded high-conversion landing page
│   └── main.tsx                 # App router wrapped with AuthProvider
├── supabase/
│   └── schema.sql               # PostgreSQL schema (profiles, teams, keys, usage, RLS)
└── scripts/
    └── phase1-test.mjs          # End-to-end backend test suite
```

---

## 3. Database Schema & Dual-Mode Storage

The database schema (`supabase/schema.sql`) defines:
- `profiles`: User accounts, emails, plan tiers (`free_personal`, `free_team`, `pro`).
- `teams`: Team spaces with owner reference.
- `team_members`: Association table enforcing team memberships and roles.
- `api_keys`: SHA-256 hashed keys prefixed with `eng_usr_` (personal) or `eng_team_` (team).
- `usage_daily`: Daily counters (`saves_count`, `recalls_count`) tracking consumption against plan ceilings.
- `memories_meta`: Metadata indices linking Walrus blob IDs and memory types.

### Dual-Mode Storage Engine
The backend (`mcp/auth-db.mjs`) automatically detects whether Supabase tables are ready:
1. **Supabase Cloud Mode**: Active when tables exist in the configured Supabase project.
2. **Local SQLite Fallback**: Uses Node 22 native `node:sqlite` (`engram-local.db`) with identical table structures, transactions, and foreign keys. This guarantees zero-downtime offline execution during development and testing.

---

## 4. MCP Server & Streamable HTTP Protocol

The streamable HTTP endpoint (`mcp/engram-http.mjs`) operates on port 8796 (or 8787 via dev proxy):
- Authenticates requests via `Authorization: Bearer <key>` or `?token=<key>`.
- Recognizes `eng_usr_...` (namespaces storage to `usr_<id>`) and `eng_team_...` (namespaces to `team_<id>`).
- Enforces daily usage quotas before writing memories.
- Returns JSON-RPC 2.0 payloads over Server-Sent Events (SSE) according to the MCP specification (`Accept: application/json, text/event-stream`).

---

## 5. Verification & Test Coverage

All phases have been verified via automated suites and build pipelines:
- **Phase 1 Backend Verification** (`scripts/phase1-test.mjs`):
  - User profiles & plan limits: Passed.
  - API key generation, validation & revocation: Passed.
  - Team spaces & strict 3-member limit: Passed (4th member blocked).
  - Daily usage tracking & 50-save quota block: Passed.
  - Live MCP HTTP session initialization, remember & recall: Passed.
- **Frontend Build Verification** (`pnpm build`):
  - Vite v8 production build completed cleanly in ~1.9s with 0 errors.
- **NPM Package Verification** (`node packages/engram-mcp/bin.mjs --help`):
  - Stdio transport & CLI argument parsing tested successfully.

---

## 6. How to Run & Develop

```bash
# 1. Run web frontend & backend API dev servers concurrently:
pnpm dev

# 2. Run MCP HTTP Streamable endpoint standalone:
node mcp/engram-http.mjs

# 3. Run verified backend test suite:
node scripts/phase1-test.mjs

# 4. Run CLI package locally:
node packages/engram-mcp/bin.mjs --help
```

# Security Policy

Engram takes the security of agent memories, authentication tokens, team credentials, and decentralized Walrus blob storage seriously. This document outlines our vulnerability disclosure process, supported versions, and security architecture guarantees.

---

## Supported Versions

Only the latest release and active commits on the `main` branch receive active security updates.

| Version / Branch | Supported          |
| ---------------- | ------------------ |
| `main`           | :white_check_mark: |
| < 1.0.0          | :x:                |

---

## Reporting a Vulnerability

If you discover a security vulnerability in Engram (including MCP server endpoints, Walrus blob encryption, multi-tenant team isolation, or Supabase Row-Level Security):

1. **Do not open a public GitHub issue.**
2. Report it privately at https://github.com/Ipramking/engram/security/advisories/new (GitHub private vulnerability reporting).
3. Include detailed steps to reproduce the vulnerability, including:
   - Impacted endpoints or MCP tools (e.g., `remember`, `recall`, `tidy`, `teams`, `keys`)
   - Reproduction script or curl commands
   - Proof of concept demonstrating unintended access across personal or team boundaries

### Response Timeline & SLA
- **Initial Response:** Within 24 hours of report receipt.
- **Triage & Assessment:** Within 48 hours.
- **Fix & Patch Deployment:** Critical severity (P0) within 72 hours; High severity within 7 days.
- **Public Disclosure:** Coordinated disclosure after the fix is verified in production.

---

## Security Model & Threat Boundaries

### 1. Multi-Tenant Memory Isolation
- Memories stored in `memories_meta` are strictly partitioned by `user_id` and `team_id`.
- The MCP endpoints and REST APIs (`/api/remember`, `/api/recall`, `/api/memories`, `/api/chat`) enforce server-side ownership and team membership validation on every single request.
- Row-Level Security (RLS) is enabled in Postgres as defense-in-depth.

### 2. Walrus Blob Storage & Encryption
- Every memory blob written to Walrus storage includes on-chain transaction metadata.
- Memory text is stored in Engram's Supabase Postgres database, which is encrypted at rest by Supabase, and is only reachable through the authenticated API.
- Memories written through the Walrus path go via the MemWal SDK, which handles encryption of Walrus blobs; Engram itself does not add a separate encryption layer.

### 3. Agent Prompt Injection Defense
- Retrieved memories are treated as untrusted data inputs.
- Memory content recalled by the MCP server is framed explicitly as historical observation data and is sanitized to prevent prompt injections from usurping system instructions.

### 4. Credential & Key Safety
- Supabase service-role keys and master Walrus publisher private keys are kept strictly server-side and never bundled into frontend assets or client builds.
- User API keys use cryptographic hashing and prefix scoping (`eng_...`) with revocation capabilities.

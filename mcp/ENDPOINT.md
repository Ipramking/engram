# Engram Hosted Endpoint — Spaces & Shared Memory

Instead of everyone running a local daemon, connect your AI agents to Engram over **Streamable HTTP**. Use it alone for your own portable memory, or share a URL across your whole team — no local install, no per-person sign-in.

```
 Single User / Teammates ─► https://<host>/mcp?token=<TOKEN>&room=<room> ─► Walrus
                             (stateless HMAC signed tokens, tenant-isolated)
```

---

## Three Access Tiers

1. **Solo · local (stdio)**:
   - Run `npx engram-walrus login` and add `npx -y engram-walrus` to your desktop/CLI AI clients.
   - Zero hosting infrastructure; writes directly to your own private Walrus account.
2. **Solo · hosted (URL)**:
   - Click **"Create your space"** on `/setup/token` to receive an instant stateless signed token.
   - Works across desktop, web (claude.ai custom connectors), and mobile.
3. **Team · hosted (URL)**:
   - Same instant provisioning as solo hosted, but the connector URL is shared across your team.
   - Rooms (`?room=frontend`, `?room=backend`) subdivide your space.

---

## Architecture & Multi-Tenancy

### Stateless Signed Tokens
Tokens are HMAC-SHA256 bearer credentials signed with `ENGRAM_SIGNING_SECRET`:
```
v1.<base64url(payload)>.<base64url(HMAC_SHA256(payload, ENGRAM_SIGNING_SECRET))>
payload = { "tid": "<random 12-byte urlsafe id>", "iat": <unix seconds> }
```

### Tenant Isolation
Isolation is enforced server-side by namespace:
- **Hosted Tenants**: `team:<tid>:<roomSlug>`
- **Legacy Self-Host**: `team:<roomSlug>` (backward compatible with `ENGRAM_TEAM_TOKEN`)

Tenants sharing the same room name under different `tid` values never collide.

---

## Security Model & Caveats

- **Namespace-Level Isolation**: All hosted tenants' memories live under the host's Walrus gateway account (`ENGRAM_CREDS_JSON`). The host holds the account keys. End-to-end on-chain per-member capability delegation (ExecutorCap) is the long-term roadmap upgrade.
- **Bearer Tokens**: Tokens act as bearer keys without revocation in the MVP. Store tokens securely.
- **Personal Scope Protection**: The HTTP endpoint only mounts `team:*` namespaces and never exposes personal (`me`) memory pools.
- **Rate Limiting**: Space provisioning via `POST /api/provision` is rate-limited (in-memory per-IP bucket) to prevent abuse.

---

## Running & Testing Locally

```bash
# Run multi-tenant HTTP server with mock storage
ENGRAM_SIGNING_SECRET=local-secret-123 ENGRAM_MCP_BACKEND=mock node mcp/engram-http.mjs

# Run integration tests
node scripts/multitenant-test.mjs
```

---

## Self-Hosting on Render

1. Click the **Deploy to Render** button or create a Blueprint using `render.yaml`.
2. Configure environment variables in the Render dashboard:
   - `ENGRAM_MCP_BACKEND = bridge`
   - `ENGRAM_SIGNING_SECRET = <strong-random-secret>`
   - `ENGRAM_TEAM_TOKEN = <optional-legacy-token>`
   - `ENGRAM_CREDS_JSON = <contents of ~/.memwal/credentials.json>`
3. Deploy & connect agents using your custom domain or Render URL.

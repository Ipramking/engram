// Serverless Streamable HTTP MCP Endpoint for Engram (JSON-RPC 2.0)
// Works 24/7 on Vercel at /api/mcp and /mcp with zero cold-start session loss.
import { randomUUID } from "node:crypto";
import {
  memwalFor,
  decodeMemory,
  normalizeRecall,
  recallMaxDistance,
  MEMORY_TYPES,
  type Scope,
} from "./_lib/memwal.js";
import { validateApiKey, getApiKeyRow, checkAndIncrementUsage, getProfile, getUsage, PLAN_LIMITS } from "./_lib/db.js";
import { fetchScopeRows, isSupersededRoom, formatMemoryLine, searchMemories } from "./_lib/search.js";
import { expandQueryTerms } from "./_lib/llm.js";
import { verify, verifyLiveKey } from "./_lib/token.js";
import { getUserFromRequest, authorizeMemoryAccess, keyCan, permissionError } from "./_lib/auth.js";
import { getSupabaseAdmin } from "./_lib/supabase.js";
import { sanitizeMemoryText } from "./_lib/security.js";
import { executeMemoryCreationLifecycle } from "./_lib/lifecycle.js";
import {
  getOrCreateProjectContext,
  authorizeProjectAccess,
  recordAgentHandoff,
  getLatestHandoff,
  generateContinuitySnapshot,
  restoreContinuitySnapshot,
  formatQuickResumeBrief,
} from "./_lib/continuity.js";

const KEYS_URL = "https://engram-pearl.vercel.app/dashboard?tab=keys";
const HOST = (globalThis as any).process?.env?.ENGRAM_MCP_HOST || "https://engram-pearl.vercel.app";

/** 401 that tells MCP clients where to sign in (OAuth protected-resource metadata, RFC 9728). */
function unauthorized(res: any) {
  res.setHeader("WWW-Authenticate", `Bearer resource_metadata="${HOST}/.well-known/oauth-protected-resource"`);
  return res.status(401);
}

/** Reads the exp claim of an eng_live_ token without trusting it, to explain expiry. */
function liveKeyExp(token: string): number | null {
  try {
    const encoded = token.slice("eng_live_".length).split(".")[0];
    const exp = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"))?.exp;
    return typeof exp === "number" ? exp : null;
  } catch {
    return null;
  }
}

const TOOLS = [
  {
    name: "engram_remember",
    description:
      "Store durable knowledge worth reusing later in personal or team Walrus memory. " +
      "Pick one type: decision, config, gotcha, person, preference, or plan. " +
      "Never store raw secrets or API keys.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "The self-contained fact to remember" },
        type: { type: "string", enum: MEMORY_TYPES, description: "Memory category" },
        scope: { type: "string", enum: ["personal", "team"], default: "personal" },
        team_code: { type: "string", description: "Shared team ID or code (when scope is team)" },
      },
      required: ["text", "type"],
    },
  },
  {
    name: "engram_recall",
    description:
      "Recall the memories most relevant to a query from personal or team Walrus memory. " +
      "Call before answering questions that depend on past decisions, configs, plans, or people.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search keywords or natural language question" },
        scope: { type: "string", enum: ["personal", "team"], default: "personal" },
        team_code: { type: "string", description: "Shared team ID or code (when scope is team)" },
      },
      required: ["query"],
    },
  },
  {
    name: "engram_tidy",
    description:
      "Review stored memories and report likely-duplicate or superseded memories to consolidate.",
    inputSchema: {
      type: "object",
      properties: {
        scope: { type: "string", enum: ["personal", "team"], default: "personal" },
      },
    },
  },
  {
    name: "engram_handoff",
    description:
      "Record or inspect a continuous context handoff between AI agents (Claude, Cursor, Copilot, Antigravity, Gemini). " +
      "Preserves task state, notes, unresolved questions, and immediate next actions with zero context loss.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project identifier (optional)" },
        action: {
          type: "string",
          enum: ["record", "latest", "resume_brief"],
          default: "record",
          description: "Action to perform: record a handoff, get latest handoff, or generate quick-resume brief",
        },
        from_agent: { type: "string", description: "Name of the departing agent (e.g., Claude Code, Cursor, Antigravity)" },
        to_agent: { type: "string", description: "Name of the resuming agent (e.g., Next Agent, Cursor, Claude)" },
        task_state: { type: "string", description: "Current state of work (e.g., in_progress, milestone_2_complete, blocked)" },
        handoff_notes: { type: "string", description: "Important context, work completed, and things the next agent needs to know" },
        next_actions: {
          type: "array",
          items: { type: "string" },
          description: "Immediate step-by-step next tasks for the resuming agent",
        },
        unresolved_questions: {
          type: "array",
          items: { type: "string" },
          description: "Open questions or blockers needing user or agent attention",
        },
        scope: { type: "string", enum: ["personal", "team"], default: "personal" },
        team_code: { type: "string", description: "Shared team ID or code (when scope is team)" },
      },
    },
  },
  {
    name: "engram_snapshot",
    description:
      "Create, verify, or restore exportable continuity snapshots of active project context and memory state.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project identifier (optional)" },
        action: {
          type: "string",
          enum: ["generate", "restore", "brief"],
          default: "brief",
          description: "Snapshot action: generate a new verifiable snapshot, restore an existing one, or view markdown brief",
        },
        snapshot_json: { type: "string", description: "Full JSON snapshot string required when action is 'restore'" },
        scope: { type: "string", enum: ["personal", "team"], default: "personal" },
        team_code: { type: "string", description: "Shared team ID or code (when scope is team)" },
      },
    },
  },
  {
    name: "engram_recent",
    description:
      "List the most recently saved memories, newest first, with dates and ids. " +
      "Use when the user asks what was saved lately, or to find something whose wording you don't know.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "How many to return (1-50, default 10)" },
        type: { type: "string", enum: MEMORY_TYPES, description: "Only this memory type" },
        include_replaced: { type: "boolean", description: "Also list memories replaced by newer ones" },
        scope: { type: "string", enum: ["personal", "team"], default: "personal" },
        team_code: { type: "string", description: "Shared team ID or code (when scope is team)" },
      },
    },
  },
  {
    name: "engram_get",
    description: "Fetch one memory by the id shown in engram_recall or engram_recent results.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Memory id" },
        scope: { type: "string", enum: ["personal", "team"], default: "personal" },
        team_code: { type: "string", description: "Shared team ID or code (when scope is team)" },
      },
      required: ["id"],
    },
  },
  {
    name: "engram_whoami",
    description:
      "Show which Engram account, key and scope this connection uses, when the key expires, and today's usage. " +
      "Use to diagnose missing memories or authorization errors.",
    inputSchema: { type: "object", properties: {} },
  },
];

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

  if (req.method === "OPTIONS") return res.status(200).end();

  const sessionId = (req.headers["mcp-session-id"] as string) || `mcp_${randomUUID()}`;
  res.setHeader("Mcp-Session-Id", sessionId);

  if (req.method === "GET") {
    // No server-initiated SSE stream: the MCP spec says to answer a stream request with 405.
    if (String(req.headers.accept || "").includes("text/event-stream")) {
      return res.status(405).json({ error: "SSE stream not supported; use POST" });
    }
    return res.status(200).json({
      ok: true,
      name: "engram-mcp",
      version: "1.0.0",
      protocol: "streamable-http",
      tools: TOOLS.map((t) => t.name),
      message: "Engram MCP endpoint active. Connect your MCP client via POST with ?token=YOUR_API_KEY",
    });
  }

  if (req.method === "DELETE") {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Authenticate token or API key
  const rawUrl = req.url || "";
  const searchParams = new URLSearchParams(rawUrl.split("?")[1] || "");
  const token =
    (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim() ||
    (req.query?.token as string) ||
    searchParams.get("token") ||
    "";

  let userId: string | null = null;
  let teamId: string | null = null;
  let defaultScope: Scope = "personal";
  const room = (req.query?.room as string) || searchParams.get("room") || "my-space";

  let callerUser: any = null;
  // What kind of credential this is, for engram_whoami.
  let keyMeta: { kind: string; kid?: string; exp?: number } = { kind: "none" };

  if (token && token.startsWith("eng_live_")) {
    const live = verifyLiveKey(token);
    if (!live?.uid) {
      const exp = liveKeyExp(token);
      const message =
        exp && exp * 1000 < Date.now()
          ? `Unauthorized: this Engram key expired on ${new Date(exp * 1000).toISOString().slice(0, 10)}. Create a new key at ${KEYS_URL}`
          : `Unauthorized: invalid Engram key. Create a new key at ${KEYS_URL}`;
      return unauthorized(res).json({ jsonrpc: "2.0", error: { code: -32001, message }, id: null });
    }
    const keyRow = live.kid ? await getApiKeyRow(live.kid) : null;
    if (live.kid) {
      const active = Boolean(keyRow?.is_active);
      if (!active) {
        return unauthorized(res).json({
          jsonrpc: "2.0",
          error: { code: -32001, message: `Unauthorized: this Engram key was revoked. Create a new key at ${KEYS_URL}` },
          id: null,
        });
      }
    }
    keyMeta = { kind: "link key (30-day)", kid: live.kid, exp: live.exp };
    userId = live.uid;
    teamId = live.tid || null;
    defaultScope = live.scope || "personal";
    callerUser = {
      id: userId,
      apiKey: { id: live.kid || "live", user_id: userId, scope: defaultScope, team_id: teamId, room, permissions: keyRow?.permissions || "read_write" },
    };
  } else if (token && token.startsWith("eng_")) {
    const apiKey = await validateApiKey(token);
    if (!apiKey) {
      return unauthorized(res).json({
        jsonrpc: "2.0",
        error: { code: -32001, message: `Unauthorized: this Engram key is invalid or was revoked. Create a new key at ${KEYS_URL}` },
        id: null,
      });
    }
    keyMeta = { kind: "permanent key", kid: apiKey.id };
    userId = apiKey.user_id;
    teamId = apiKey.team_id || null;
    defaultScope = (apiKey.scope as Scope) || "personal";
    callerUser = {
      id: userId,
      apiKey,
    };
  } else if (token) {
    const verifiedTid = verify(token);
    if (verifiedTid?.tid) {
      keyMeta = { kind: "space token" };
      userId = verifiedTid.tid;
      callerUser = { id: userId };
    } else {
      const user = await getUserFromRequest(req);
      if (user) {
        userId = user.id;
        callerUser = user;
        teamId = user.apiKey?.team_id || null;
        defaultScope = (user.apiKey?.scope as Scope) || "personal";
      } else {
        return unauthorized(res).json({
          jsonrpc: "2.0",
          error: { code: -32001, message: "Unauthorized: invalid token" },
          id: null,
        });
      }
    }
  } else {
    return unauthorized(res).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Unauthorized: sign in with Engram, or connect with your link from the dashboard" },
      id: null,
    });
  }

  const handleSingleRpc = async (msg: any) => {
    if (!msg || typeof msg !== "object") return null;
    const { id, method, params } = msg;

    if (method === "initialize") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: params?.protocolVersion || "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "engram-mcp", version: "1.0.0" },
        },
      };
    }

    if (method === "notifications/initialized" || method === "notifications/cancelled") {
      return null;
    }

    if (method === "ping") {
      return { jsonrpc: "2.0", id, result: {} };
    }

    if (method === "tools/list") {
      return {
        jsonrpc: "2.0",
        id,
        result: { tools: TOOLS },
      };
    }

    if (method === "tools/call") {
      const toolName = params?.name;
      const args = params?.arguments || {};
      const requestedScope = (args.scope as Scope) || defaultScope || "personal";
      const requestedTeamCode = args.team_code || teamId;

      // Centralized authorization enforcement:
      const auth = await authorizeMemoryAccess({
        user: callerUser,
        requestedScope,
        requestedTeamCode,
      });

      if (!auth.authorized) {
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: `Error: ${auth.error}` }],
            isError: true,
          },
        };
      }

      // Scoped keys: read tools need read access, saving needs write, maintenance needs full access.
      const need: "read" | "write" | "manage" | null =
        toolName === "engram_whoami" ? null
        : ["engram_recall", "engram_recent", "engram_get"].includes(toolName) ? "read"
        : toolName === "engram_remember" ? "write"
        : "manage";
      if (need && !keyCan(callerUser, need)) {
        return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: `Error: ${permissionError(need)}` }], isError: true } };
      }

      const scope: Scope = auth.effectiveScope;
      const activeTeamId = auth.effectiveTeamId || "default";
      const ns = scope === "team" ? activeTeamId : `usr_${userId}`;
      const supabase = getSupabaseAdmin();

      try {
        if (toolName === "engram_remember") {
          const rawText = String(args.text || "").trim();
          if (!rawText) {
            return {
              jsonrpc: "2.0",
              id,
              result: {
                content: [{ type: "text", text: "Error: text is required for engram_remember." }],
                isError: true,
              },
            };
          }

          const resLifecycle = await executeMemoryCreationLifecycle({
            user: callerUser,
            text: rawText,
            type: args.type,
            scope,
            teamCode: activeTeamId,
            source: 'agent_mcp',
          });

          if (!resLifecycle.ok) {
            return {
              jsonrpc: "2.0",
              id,
              result: {
                content: [{ type: "text", text: `Error: ${resLifecycle.error}` }],
                isError: true,
              },
            };
          }

          const suffix = [
            resLifecycle.blobId ? `blob_id=${resLifecycle.blobId}` : `storage_state=${resLifecycle.storageState}`,
            resLifecycle.superseded.length > 0 ? `superseded=${resLifecycle.superseded.length}` : "",
            resLifecycle.isDuplicate ? "duplicate=cached" : "",
          ]
            .filter(Boolean)
            .join(", ");

          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: `Remembered (${resLifecycle.type}, ${scope}): ${resLifecycle.cleanText} [${suffix}]`,
                },
              ],
            },
          };
        }

        if (toolName === "engram_recall") {
          const query = String(args.query || "").trim();
          if (userId) {
            await checkAndIncrementUsage({
              entityType: scope === "team" ? "team" : "user",
              entityId: scope === "team" ? activeTeamId : userId,
              operation: "recall",
            });
          }

          const results: Array<{ type: string; text: string; blobId?: string }> = [];
          const seen = new Set<string>();

          try {
            const mem = memwalFor(scope, ns);
            const raw = await Promise.race([
              mem.recall({ query, topK: 8, maxDistance: recallMaxDistance() }),
              new Promise((resolve) => setTimeout(() => resolve([]), 3500)),
            ]);
            for (const item of normalizeRecall(raw)) {
              const dec = decodeMemory(sanitizeMemoryText(item.text));
              const k = dec.text.toLowerCase();
              if (!seen.has(k)) {
                seen.add(k);
                results.push({ type: dec.type, text: dec.text, blobId: item.blobId });
              }
            }
          } catch (e) {
            console.warn("[api/mcp] Walrus recall fallback:", e);
          }

          // Database matches come first: they carry dates and ids. Walrus vector hits fill in after.
          const dbResults: Array<{ type: string; text: string; created_at?: string; id?: string }> = [];
          const dbSeen = new Set<string>();
          if (supabase && userId) {
            const found = await searchMemories(supabase, {
              scope,
              userId,
              teamId: scope === "team" && activeTeamId !== "default" ? activeTeamId : null,
              query,
              limit: 10,
              expand: expandQueryTerms,
            });
            const live = found.rows.map((r) => ({ ...r, text: decodeMemory(sanitizeMemoryText(r.text)).text }));
            for (const row of live) {
              const k = row.text.toLowerCase();
              if (dbResults.length >= 10 || dbSeen.has(k)) continue;
              dbSeen.add(k);
              dbResults.push({ type: row.type || "decision", text: row.text, created_at: row.created_at, id: row.id });
            }
          }
          const walrusOnly = results.filter((r) => !dbResults.some((d) => d.text.toLowerCase() === r.text.toLowerCase()));
          const lines = [
            ...dbResults.map((m, i) => formatMemoryLine(i, m)),
            ...walrusOnly.slice(0, Math.max(0, 10 - dbResults.length)).map(
              (m, i) => `${dbResults.length + i + 1}. [${m.type}] ${m.text} (from Walrus${m.blobId ? `, blob ${m.blobId}` : ""})`
            ),
          ];

          const formatted =
            lines.length > 0
              ? lines.join("\n")
              : `No memories in ${scope} scope match "${query}". Try engram_recent to see what is saved, or different wording.`;

          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: formatted }],
            },
          };
        }

        if (toolName === "engram_recent" || toolName === "engram_get") {
          if (!supabase || !userId) {
            return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: "Error: memory database unavailable." }], isError: true } };
          }
          const isGet = toolName === "engram_get";
          const memoryId = String(args.id || "").trim();
          if (isGet && !memoryId) {
            return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: "Error: id is required." }], isError: true } };
          }
          const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 50);
          const rows = await fetchScopeRows(supabase, {
            scope,
            userId,
            teamId: scope === "team" && activeTeamId !== "default" ? activeTeamId : null,
            limit: isGet ? 1 : args.include_replaced ? limit : limit + 50,
            type: isGet ? undefined : args.type,
            id: isGet ? memoryId : undefined,
          });
          const list = rows
            .filter((r) => isGet || args.include_replaced || !isSupersededRoom(r.room))
            .slice(0, isGet ? 1 : limit)
            .map((r) => ({
              type: r.type || "decision",
              text: decodeMemory(sanitizeMemoryText(r.text)).text,
              created_at: r.created_at,
              id: r.id,
              replaced: isSupersededRoom(r.room),
            }));
          const text = list.length
            ? list.map((m, i) => formatMemoryLine(i, m)).join("\n")
            : isGet
              ? `No memory with id ${memoryId} in ${scope} scope.`
              : `No memories saved in ${scope} scope yet.`;
          return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text }] } };
        }

        if (toolName === "engram_whoami") {
          const profile = userId ? await getProfile(userId).catch(() => null) : null;
          const plan = profile?.plan_tier || "free_personal";
          const usage = userId
            ? await getUsage(scope === "team" ? "team" : "user", scope === "team" ? activeTeamId : userId).catch(() => null)
            : null;
          const daily = (PLAN_LIMITS as any)[plan]?.dailySaves ?? (PLAN_LIMITS as any).free_personal?.dailySaves;
          const lines = [
            `Endpoint: https://${req.headers.host || "engram-pearl.vercel.app"}/mcp (hosted, cloud memory)`,
            `Account: ${profile?.email || userId || "unknown"} · plan ${plan}`,
            `Credential: ${keyMeta.kind}${keyMeta.kid ? ` (key id ${keyMeta.kid})` : ""}`,
            keyMeta.exp ? `Key expires: ${new Date(keyMeta.exp * 1000).toISOString().slice(0, 10)}` : "Key expires: never (until revoked)",
            `Default scope: ${defaultScope}${teamId ? ` · team ${teamId}` : ""}`,
            usage ? `Today: ${usage.saves_count ?? 0}${daily ? `/${daily}` : ""} saves, ${usage.recalls_count ?? 0} recalls` : "",
            `Manage keys: ${KEYS_URL}`,
          ].filter(Boolean);
          return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: lines.join("\n") }] } };
        }

        if (toolName === "engram_tidy") {
          const items: Array<{ id: string; type: string; text: string; blobId?: string }> = [];
          if (supabase && userId) {
            let dbQuery = supabase
              .from("memories_meta")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(100);

            if (scope === "team") {
              dbQuery = dbQuery.eq("team_id", activeTeamId);
            } else {
              dbQuery = dbQuery.eq("user_id", userId).is("team_id", null);
            }

            const { data: rows } = await dbQuery;
            for (const r of rows || []) {
              if ((r.room || "").startsWith("superseded_by:")) continue;
              items.push({ id: r.id, type: r.type, text: r.text, blobId: r.blob_id });
            }
          }

          const duplicates: string[] = [];
          for (let i = 0; i < items.length; i++) {
            for (let j = i + 1; j < items.length; j++) {
              const a = items[i].text.toLowerCase();
              const b = items[j].text.toLowerCase();
              if (a === b || (a.length > 20 && (a.includes(b) || b.includes(a)))) {
                duplicates.push(`• Duplicate candidate: "${items[i].text}" vs "${items[j].text}"`);
              }
            }
          }

          const summary =
            duplicates.length > 0
              ? `Found ${duplicates.length} duplicate/overlapping memory pairs across ${items.length} active memories:\n${duplicates.join("\n")}`
              : `All ${items.length} active memories in ${scope} scope are clean with 0 duplicates detected.`;

          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: summary }],
            },
          };
        }

        if (toolName === "engram_handoff") {
          const pId = String(args.project_id || (userId ? `proj_${userId.slice(0, 8)}` : "default_proj"));
          const handoffAction = String(args.action || "record");

          const context = await getOrCreateProjectContext({
            projectId: pId,
            userId: userId || "mcp_user",
            scope,
            teamId: activeTeamId !== 'default' ? activeTeamId : null,
          });
          const authCheck = await authorizeProjectAccess({ userId: userId || "mcp_user", context });
          if (!authCheck.authorized) {
            return {
              jsonrpc: "2.0",
              id,
              result: {
                content: [{ type: "text", text: `Error: ${authCheck.reason || "Forbidden: unauthorized access to project."}` }],
                isError: true,
              },
            };
          }

          if (handoffAction === "latest") {
            const latest = await getLatestHandoff(pId);
            if (!latest) {
              return {
                jsonrpc: "2.0",
                id,
                result: {
                  content: [{ type: "text", text: `No active agent handoff found for project "${pId}".` }],
                },
              };
            }
            const brief = [
              `# Latest Agent Handoff (${latest.id})`,
              `- From: ${latest.fromAgent} → To: ${latest.toAgent}`,
              `- Task State: ${latest.taskState}`,
              `- Recorded: ${latest.createdAt}`,
              `- Notes: ${latest.handoffNotes}`,
            ];
            if (latest.nextActions?.length) {
              brief.push(`### Next Actions:\n${latest.nextActions.map((a: string) => `- [ ] ${a}`).join("\n")}`);
            }
            if (latest.unresolvedQuestions?.length) {
              brief.push(`### Unresolved Questions:\n${latest.unresolvedQuestions.map((q: string) => `- ❓ ${q}`).join("\n")}`);
            }
            return {
              jsonrpc: "2.0",
              id,
              result: {
                content: [{ type: "text", text: brief.join("\n") }],
              },
            };
          }

          if (handoffAction === "resume_brief") {
            const snap = await generateContinuitySnapshot({
              projectId: pId,
              userId: userId || "mcp_user",
              scope,
              teamId: scope === "team" ? activeTeamId : null,
            });
            const brief = formatQuickResumeBrief(snap);
            return {
              jsonrpc: "2.0",
              id,
              result: {
                content: [{ type: "text", text: brief }],
              },
            };
          }

          // Default: record
          const notes = String(args.handoff_notes || "").trim();
          if (!notes) {
            return {
              jsonrpc: "2.0",
              id,
              result: {
                content: [{ type: "text", text: "Error: handoff_notes is required to record a continuity handoff." }],
                isError: true,
              },
            };
          }

          const handoff = await recordAgentHandoff({
            projectId: pId,
            userId: userId || "mcp_user",
            teamId: context.teamId,
            fromAgent: String(args.from_agent || "Agent"),
            toAgent: String(args.to_agent || "Next Agent"),
            taskState: String(args.task_state || "in_progress"),
            handoffNotes: notes,
            nextActions: Array.isArray(args.next_actions) ? args.next_actions : [],
            unresolvedQuestions: Array.isArray(args.unresolved_questions) ? args.unresolved_questions : [],
          });

          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: `✓ Context handoff recorded [${handoff.id}] for project "${pId}". Departing agent: "${handoff.fromAgent}". Task state: "${handoff.taskState}". Resuming agents will inherit this context seamlessly.`,
                },
              ],
            },
          };
        }

        if (toolName === "engram_snapshot") {
          const pId = String(args.project_id || (userId ? `proj_${userId.slice(0, 8)}` : "default_proj"));
          const snapAction = String(args.action || "brief");

          if (snapAction === "restore") {
            const rawJson = args.snapshot_json;
            if (!rawJson) {
              return {
                jsonrpc: "2.0",
                id,
                result: {
                  content: [{ type: "text", text: "Error: snapshot_json string is required for action='restore'." }],
                  isError: true,
                },
              };
            }
            const resRestore = await restoreContinuitySnapshot({
              snapshotJson: rawJson,
              userId: userId || "mcp_user",
              targetProjectId: pId,
            });
            if (!resRestore.verified) {
              return {
                jsonrpc: "2.0",
                id,
                result: {
                  content: [{ type: "text", text: `Error: ${resRestore.error || "Snapshot integrity verification failed."}` }],
                  isError: true,
                },
              };
            }
            return {
              jsonrpc: "2.0",
              id,
              result: {
                content: [
                  {
                    type: "text",
                    text: `✓ Continuity snapshot verified and restored for project "${pId}". Checksum: ${resRestore.snapshot?.checksum}`,
                  },
                ],
              },
            };
          }

          // Generate or Brief
          const snapshot = await generateContinuitySnapshot({
            projectId: pId,
            userId: userId || "mcp_user",
            scope,
            teamId: scope === "team" ? activeTeamId : null,
          });

          if (snapAction === "generate") {
            return {
              jsonrpc: "2.0",
              id,
              result: {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(snapshot, null, 2),
                  },
                ],
              },
            };
          }

          // Default: brief
          const brief = formatQuickResumeBrief(snapshot);
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: brief }],
            },
          };
        }

        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Unknown tool: ${toolName}` },
        };
      } catch (err: any) {
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: `Engram tool error: ${err?.message || String(err)}` }],
            isError: true,
          },
        };
      }
    }

    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    };
  };

  if (Array.isArray(req.body)) {
    const responses = (await Promise.all(req.body.map(handleSingleRpc))).filter(Boolean);
    if (responses.length === 0) return res.status(202).end();
    return res.status(200).json(responses);
  }

  const response = await handleSingleRpc(req.body);
  if (!response) return res.status(202).end();
  return res.status(200).json(response);
}

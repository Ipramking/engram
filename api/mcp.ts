// Serverless Streamable HTTP MCP Endpoint for Engram (JSON-RPC 2.0)
// Works 24/7 on Vercel at /api/mcp and /mcp with zero cold-start session loss.
import { randomUUID } from "node:crypto";
import {
  memwalFor,
  encodeMemory,
  decodeMemory,
  normalizeRecall,
  blobIdOf,
  recallMaxDistance,
  MEMORY_TYPES,
  type Scope,
} from "./_lib/memwal.js";
import { validateApiKey, isApiKeyActive, checkAndIncrementUsage } from "./_lib/db.js";
import { verify, verifyLiveKey } from "./_lib/token.js";
import { getUserFromRequest, authorizeMemoryAccess } from "./_lib/auth.js";
import { getSupabaseAdmin } from "./_lib/supabase.js";
import { detectAndResolveConflicts } from "./_lib/conflicts.js";
import { scanForSecrets, sanitizeMemoryText } from "./_lib/security.js";
import { writeMemoryWithRetry, verifyMemoryIntegrity } from "./_lib/storage.js";
import {
  getOrCreateProjectContext,
  recordAgentHandoff,
  getLatestHandoff,
  generateContinuitySnapshot,
  restoreContinuitySnapshot,
  formatQuickResumeBrief,
} from "./_lib/continuity.js";

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
];

function scoreMatch(query: string, text: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const words = q.replace(/[^a-z0-9\s_-]/g, " ").split(/\s+/).filter((w) => w.length > 1);
  if (words.length === 0) return 1;
  const lower = text.toLowerCase();
  let score = 0;
  if (lower.includes(q)) score += 5;
  for (const w of words) {
    if (lower.includes(w)) score += 1;
  }
  return score;
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

  if (req.method === "OPTIONS") return res.status(200).end();

  const sessionId = (req.headers["mcp-session-id"] as string) || `mcp_${randomUUID()}`;
  res.setHeader("Mcp-Session-Id", sessionId);

  if (req.method === "GET") {
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
    (req.query?.token as string) ||
    searchParams.get("token") ||
    (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();

  let userId: string | null = null;
  let teamId: string | null = null;
  let defaultScope: Scope = "personal";
  const room = (req.query?.room as string) || searchParams.get("room") || "my-space";

  let callerUser: any = null;

  if (token && token.startsWith("eng_live_")) {
    const live = verifyLiveKey(token);
    if (!live?.uid) {
      return res.status(401).json({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Unauthorized: invalid Engram live API key" },
        id: null,
      });
    }
    if (live.kid) {
      const active = await isApiKeyActive(live.kid);
      if (!active) {
        return res.status(401).json({
          jsonrpc: "2.0",
          error: { code: -32001, message: "Unauthorized: invalid or revoked Engram API key" },
          id: null,
        });
      }
    }
    userId = live.uid;
    teamId = live.tid || null;
    defaultScope = live.scope || "personal";
    callerUser = {
      id: userId,
      apiKey: { id: live.kid || "live", user_id: userId, scope: defaultScope, team_id: teamId, room },
    };
  } else if (token && token.startsWith("eng_")) {
    const apiKey = await validateApiKey(token);
    if (!apiKey) {
      return res.status(401).json({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Unauthorized: invalid or revoked Engram API key" },
        id: null,
      });
    }
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
        return res.status(401).json({
          jsonrpc: "2.0",
          error: { code: -32001, message: "Unauthorized: invalid token" },
          id: null,
        });
      }
    }
  } else {
    return res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Unauthorized: missing ?token= or Authorization header" },
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

      const scope: Scope = auth.effectiveScope;
      const activeTeamId = auth.effectiveTeamId || "default";
      const ns = scope === "team" ? activeTeamId : `usr_${userId}`;
      const supabase = getSupabaseAdmin();

      try {
        if (toolName === "engram_remember") {
          const rawText = String(args.text || "").trim();
          const type = MEMORY_TYPES.includes(args.type) ? args.type : "decision";
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

          const secretScan = scanForSecrets(rawText);
          if (secretScan.hasSecret) {
            return {
              jsonrpc: "2.0",
              id,
              result: {
                content: [{ type: "text", text: secretScan.reason! }],
                isError: true,
              },
            };
          }

          if (userId) {
            await checkAndIncrementUsage({
              entityType: scope === "team" ? "team" : "user",
              entityId: scope === "team" ? activeTeamId : userId,
              operation: "save",
            });
          }

          const cleanText = sanitizeMemoryText(rawText);
          const mem = memwalFor(scope, ns);
          const encoded = encodeMemory(type, cleanText);

          const writeRes = await writeMemoryWithRetry({
            mem,
            encodedText: encoded,
            type,
            cleanText,
            userId: userId || 'anon',
            scope,
            teamId: scope === 'team' && activeTeamId !== 'default' ? activeTeamId : null,
          });

          const blobId = writeRes.blobId;
          const storageState = writeRes.storageState;

          let supersededCount = 0;
          if (supabase && userId) {
            await supabase.from("memories_meta").insert({
              user_id: userId,
              team_id: scope === "team" && activeTeamId !== "default" ? activeTeamId : null,
              room,
              type,
              text: cleanText,
              blob_id: blobId ?? null,
            });
            const conflicts = await detectAndResolveConflicts({
              userId,
              teamId: scope === "team" && activeTeamId !== "default" ? activeTeamId : null,
              scope,
              newText: cleanText,
              newType: type,
              newBlobId: blobId,
            });
            supersededCount = conflicts.supersededList.length;
          }

          const suffix = [
            blobId ? `blob_id=${blobId}` : `storage_state=${storageState}`,
            supersededCount > 0 ? `superseded=${supersededCount}` : "",
            writeRes.isDuplicate ? "duplicate=cached" : "",
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
                  text: `Remembered (${type}, ${scope}): ${cleanText} [${suffix}]`,
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

          if (supabase && userId) {
            let dbQuery = supabase
              .from("memories_meta")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(100);

            if (scope === "team" && activeTeamId !== "default") {
              dbQuery = dbQuery.eq("team_id", activeTeamId);
            } else {
              dbQuery = dbQuery.eq("user_id", userId).is("team_id", null);
            }

            const { data: rows } = await dbQuery;
            if (rows && rows.length > 0) {
              const scored = rows
                .filter((r: any) => !(r.room || "").startsWith("superseded_by:"))
                .map((r: any) => {
                  const dec = decodeMemory(sanitizeMemoryText(r.text));
                  return {
                    type: r.type || dec.type || "decision",
                    text: dec.text,
                    blobId: r.blob_id || undefined,
                    score: scoreMatch(query, `${r.type || ""} ${dec.text}`),
                  };
                })
                .filter((r) => r.score > 0)
                .sort((a, b) => b.score - a.score);

              for (const s of scored) {
                const k = s.text.toLowerCase();
                if (!seen.has(k) && results.length < 10) {
                  seen.add(k);
                  results.push({ type: s.type, text: s.text, blobId: s.blobId });
                }
              }
            }
          }

          const formatted =
            results.length > 0
              ? results
                  .map(
                    (m, i) =>
                      `${i + 1}. [${m.type}] ${m.text}${m.blobId ? ` (blob: ${m.blobId})` : ""}`
                  )
                  .join("\n")
              : `No matching memories found in ${scope} scope for "${query}".`;

          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: formatted }],
            },
          };
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

          if (handoffAction === "latest") {
            const latest = getLatestHandoff(pId);
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
            const snap = generateContinuitySnapshot({
              projectId: pId,
              userId: userId || "mcp_user",
              scope,
              teamId: activeTeamId,
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

          const handoff = recordAgentHandoff({
            projectId: pId,
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
            const resRestore = restoreContinuitySnapshot(rawJson);
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
          const snapshot = generateContinuitySnapshot({
            projectId: pId,
            userId: userId || "mcp_user",
            scope,
            teamId: activeTeamId,
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

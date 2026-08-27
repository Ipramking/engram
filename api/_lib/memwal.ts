// Shared Walrus Memory client factory. Chooses the real relayer-backed
// MemWal when credentials are present, otherwise the offline MemWalMock so the
// whole app runs with zero setup. Scope maps to (account + namespace):
//   personal -> your account,        namespace "me"
//   team     -> shared team account, namespace "team:<code>"
import { MemWal, MemWalMock } from "@mysten-incubation/memwal";

export type Scope = "personal" | "team";

export type MemwalClient = {
  remember(text: string): Promise<any>;
  rememberAndWait(text: string, meta?: unknown, opts?: unknown): Promise<any>;
  waitForRememberJob(jobId: string): Promise<any>;
  recall(args: { query: string; topK?: number; maxDistance?: number }): Promise<any>;
  health?(): Promise<any>;
};

const RELAYER_DEFAULT = "https://relayer-staging.memory.walrus.xyz";

export function isMock(): boolean {
  return Boolean(process.env.ENGRAM_USE_MOCK) || !process.env.MEMWAL_PRIVATE_KEY;
}

// The offline mock ranks by literal token overlap, so semantically-related but
// differently-worded queries score high distances. Relax the cutoff for the
// mock; keep it tight on the real relayer, which uses semantic embeddings.
export function recallMaxDistance(): number {
  return isMock() ? 0.95 : 0.7;
}

function build(namespace: string, key?: string, accountId?: string): MemwalClient {
  if (isMock() || !key || !accountId) {
    return MemWalMock.create({ namespace }) as unknown as MemwalClient;
  }
  return MemWal.create({
    key,
    accountId,
    serverUrl: process.env.MEMWAL_SERVER_URL ?? RELAYER_DEFAULT,
    namespace,
  }) as unknown as MemwalClient;
}

// Cache one client per namespace so the mock persists within a process.
const cache = new Map<string, MemwalClient>();

export function memwalFor(scope: Scope, teamCode = "default"): MemwalClient {
  const ns = scope === "team" ? `team:${teamCode}` : "me";
  let client = cache.get(ns);
  if (!client) {
    const key =
      scope === "team"
        ? process.env.TEAM_MEMWAL_PRIVATE_KEY ?? process.env.MEMWAL_PRIVATE_KEY
        : process.env.MEMWAL_PRIVATE_KEY;
    const accountId =
      scope === "team"
        ? process.env.TEAM_MEMWAL_ACCOUNT_ID ?? process.env.MEMWAL_ACCOUNT_ID
        : process.env.MEMWAL_ACCOUNT_ID;
    client = build(ns, key, accountId);
    cache.set(ns, client);
  }
  return client;
}

export const MEMORY_TYPES = ["decision", "config", "gotcha", "person", "preference"] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];

// We encode the tag as a compact prefix so it survives store -> recall even
// though recall returns plain text. `[decision] We moved the DB...`
const TAG_RE = /^\[(decision|config|gotcha|person|preference)\]\s*/i;

export function encodeMemory(type: MemoryType, text: string): string {
  return `[${type}] ${text.trim()}`;
}

export function decodeMemory(raw: string): { type: MemoryType | "note"; text: string } {
  const m = raw.match(TAG_RE);
  if (m) return { type: m[1].toLowerCase() as MemoryType, text: raw.replace(TAG_RE, "").trim() };
  return { type: "note", text: raw.trim() };
}

// Normalize the various recall return shapes into a flat array.
export function normalizeRecall(res: any): { text: string; blobId?: string }[] {
  const rows = res?.results ?? res ?? [];
  return (Array.isArray(rows) ? rows : []).map((r: any) => ({
    text: r?.text ?? String(r),
    blobId: r?.blob_id ?? r?.blobId,
  }));
}

// Pull a blob id out of whatever remember/job shape we get back.
export function blobIdOf(job: any): string | undefined {
  return job?.blob_id ?? job?.blobId ?? job?.result?.blob_id ?? job?.job?.blob_id;
}

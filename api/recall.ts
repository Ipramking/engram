// Explicit recall — powers the "what do you remember about…" search box.
import {
  memwalFor,
  normalizeRecall,
  decodeMemory,
  recallMaxDistance,
  type Scope,
} from "./_lib/memwal.js";
import { getUserFromRequest } from "./_lib/auth.js";
import { checkAndIncrementUsage, isTeamMember } from "./_lib/db.js";
import { getSupabaseAdmin } from "./_lib/supabase";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { query = "", scope = "personal", teamCode = "default", topK = 10, includeSuperseded = false } = req.body ?? {};

  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized: authentication required to access memory." });
  }

  if (scope === "team") {
    if (!teamCode || teamCode === "default") {
      return res.status(400).json({ error: "teamCode (team ID) is required for team scope." });
    }
    const isMember = await isTeamMember(user.id, teamCode);
    if (!isMember) {
      return res.status(403).json({ error: "Forbidden: you are not an active member of this team." });
    }
  }

  await checkAndIncrementUsage({
    entityType: scope === 'team' ? 'team' : 'user',
    entityId: scope === 'team' ? teamCode : user.id,
    operation: 'recall',
    planTier: user.plan_tier,
  }).catch(() => {});

  const ns = scope === 'team' ? teamCode : `usr_${user.id}`;
  const mem = memwalFor(scope as Scope, ns);
  const r = await mem.recall({ query, topK, maxDistance: recallMaxDistance() });

  // Check superseded memories from metadata store
  const supersededMap = new Map<string, string>();
  const supabase = getSupabaseAdmin();
  if (supabase && user) {
    try {
      let q = supabase.from('memories_meta').select('blob_id, room').like('room', 'superseded_by:%');
      if (scope === 'team' && teamCode !== 'default') {
        q = q.eq('team_id', teamCode);
      } else {
        q = q.eq('user_id', user.id);
      }
      const { data: supersededRows } = await q;
      if (supersededRows) {
        for (const row of supersededRows) {
          if (row.blob_id) {
            const supersededBy = row.room?.replace('superseded_by:', '') || 'latest';
            supersededMap.set(row.blob_id, supersededBy);
          }
        }
      }
    } catch {}
  }

  let results = normalizeRecall(r).map((m) => {
    const isSuperseded = m.blobId ? supersededMap.has(m.blobId) : false;
    const supersededBy = m.blobId ? supersededMap.get(m.blobId) : null;
    return {
      ...decodeMemory(m.text),
      blobId: m.blobId,
      isSuperseded,
      supersededBy,
    };
  });

  if (!includeSuperseded) {
    results = results.filter((m) => !m.isSuperseded);
  }

  res.status(200).json({ ok: true, results });
}

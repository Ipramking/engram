// Shared lexical recall used by REST /api/recall and the hosted MCP tools, so every client
// ranks memories the same way. Filler words never count, and a memory must cover enough of
// the query's meaningful terms to be returned at all.

const STOPWORDS = new Set(
  (
    'a an and are as at be been but by can could did do does doing for from had has have how i if in into is it its ' +
    'me my no not of on or our ours should so than that the their them then there these they this those to too us ' +
    'was we were what when where which who whom why will with would you your yours about any all also just only ' +
    'tell know remember recall please use used using get got make made thing things'
  ).split(' '),
)

function stem(w: string) {
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3)
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2)
  if (w.length > 4 && w.endsWith('es')) return w.slice(0, -2)
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1)
  return w
}

export function terms(text: string): string[] {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .map(stem)
}

export interface Ranked<T> {
  row: T
  score: number
  coverage: number
}

/** Coverage = share of distinct query terms found in the memory (exact or as a word prefix). */
export function scoreText(query: string, text: string, type?: string) {
  const q = Array.from(new Set(terms(query)))
  if (q.length === 0) return { score: 0, coverage: 0 }
  const words = terms(`${type || ''} ${text}`)
  const set = new Set(words)
  let hit = 0
  for (const t of q) {
    if (set.has(t) || (t.length >= 4 && words.some((w) => w.startsWith(t) || (w.length >= 4 && t.startsWith(w))))) hit++
  }
  const coverage = hit / q.length
  const phrase = String(text || '').toLowerCase().includes(String(query || '').trim().toLowerCase()) ? 0.25 : 0
  return { score: coverage + phrase, coverage }
}

/** Minimum share of query terms a memory must contain to count as relevant. */
export function minCoverage(query: string) {
  const n = new Set(terms(query)).size
  return n <= 2 ? 0.5 : n <= 4 ? 0.4 : 0.34
}

export function rank<T>(rows: T[], query: string, textOf: (r: T) => string, typeOf?: (r: T) => string | undefined): Ranked<T>[] {
  const floor = minCoverage(query)
  return rows
    .map((row, i) => {
      const s = scoreText(query, textOf(row), typeOf?.(row))
      // Small recency tiebreak: rows arrive newest first.
      return { row, coverage: s.coverage, score: s.score + (rows.length - i) / (rows.length * 1000) }
    })
    .filter((r) => r.coverage >= floor)
    .sort((a, b) => b.score - a.score)
}

export const isSupersededRoom = (room?: string | null) => Boolean(room && room.startsWith('superseded_by:'))

/** Newest rows in the caller's scope. Personal never includes team rows. */
export async function fetchScopeRows(
  supabase: any,
  opts: { scope: 'personal' | 'team'; userId: string; teamId?: string | null; limit?: number; type?: string; id?: string },
) {
  let q = supabase
    .from('memories_meta')
    .select('id, type, text, blob_id, created_at, room, team_id')
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(opts.limit ?? 500, 1), 1000))
  q = opts.scope === 'team' && opts.teamId ? q.eq('team_id', opts.teamId) : q.eq('user_id', opts.userId).is('team_id', null)
  if (opts.type && opts.type !== 'all') q = q.eq('type', opts.type)
  if (opts.id) q = q.eq('id', opts.id)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data || []) as Array<{ id: string; type: string; text: string; blob_id: string | null; created_at: string; room: string | null; team_id: string | null }>
}

export function formatMemoryLine(i: number, m: { type: string; text: string; created_at?: string; id?: string; replaced?: boolean }) {
  const date = m.created_at ? String(m.created_at).slice(0, 10) : 'unknown date'
  return `${i + 1}. [${m.type}] ${m.text} (saved ${date}${m.replaced ? ', replaced' : ''}${m.id ? `, id ${m.id}` : ''})`
}

/** Plain lowercase words for the database search (Postgres does its own stemming). */
export function rawTerms(text: string): string[] {
  return Array.from(
    new Set(
      String(text || '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 1 && w.length <= 40 && !STOPWORDS.has(w)),
    ),
  )
}

type Row = { id: string; type: string; text: string; blob_id: string | null; created_at: string; room: string | null; team_id: string | null }

/**
 * Recall for MCP and the bots. Uses the database search function (full text + fuzzy) when the
 * 2.4 migration is installed, widens the query with related terms when few memories match, and
 * otherwise falls back to the in-process lexical ranking.
 */
export async function searchMemories(
  supabase: any,
  opts: {
    scope: 'personal' | 'team'
    userId: string
    teamId?: string | null
    query: string
    limit?: number
    expand?: (query: string) => Promise<string[]>
  },
): Promise<{ rows: Row[]; method: 'search' | 'lexical'; expanded: string[] }> {
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 50)
  const base = rawTerms(opts.query)
  const run = (terms: string[]) =>
    supabase.rpc('search_memories', {
      p_user: opts.userId,
      p_team: opts.scope === 'team' ? opts.teamId || null : null,
      p_query: opts.query,
      p_terms: terms,
      p_limit: limit,
    })

  const first = await run(base)
  if (first.error) {
    const rows = (await fetchScopeRows(supabase, { scope: opts.scope, userId: opts.userId, teamId: opts.teamId })).filter((r) => !isSupersededRoom(r.room))
    return { rows: rank(rows, opts.query, (r) => r.text, (r) => r.type).slice(0, limit).map((x) => x.row), method: 'lexical', expanded: [] }
  }

  let rows: Row[] = first.data || []
  let expanded: string[] = []
  if (rows.length < 3 && opts.expand) {
    expanded = (await opts.expand(opts.query)).filter((w) => !base.includes(w))
    if (expanded.length) {
      const second = await run([...base, ...expanded])
      if (!second.error) {
        const seen = new Set(rows.map((r) => r.id))
        rows = [...rows, ...(second.data || []).filter((r: Row) => !seen.has(r.id))]
      }
    }
  }
  return { rows: rows.slice(0, limit), method: 'search', expanded }
}

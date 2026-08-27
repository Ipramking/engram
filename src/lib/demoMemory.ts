// Client-side memory for the landing DEMO only. Real memory lives on Walrus via
// the MCP — this is a faithful, in-browser stand-in so the demo works on static
// hosting (persists across turns, instant, no server state). Recall uses token
// overlap with a substring fallback to approximate semantic matching.
export type DemoMem = { type: string; text: string; blobId: string }

const stores = new Map<string, DemoMem[]>()
let counter = 0

const toks = (s: string) =>
  Array.from(new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2)))

function score(query: string, text: string): number {
  const q = toks(query)
  const t = toks(text)
  if (!q.length || !t.length) return 0
  let hits = 0
  for (const qt of q) if (t.some((tt) => tt === qt || tt.includes(qt) || qt.includes(tt))) hits++
  return hits / q.length
}

export function demoRemember(ns: string, type: string, text: string): DemoMem {
  const m: DemoMem = { type, text: text.trim(), blobId: `demo-${String(++counter).padStart(4, '0')}` }
  const arr = stores.get(ns) ?? []
  arr.unshift(m)
  stores.set(ns, arr)
  return m
}

export function demoRecall(ns: string, query: string, topK = 6): DemoMem[] {
  const arr = stores.get(ns) ?? []
  return arr
    .map((m) => ({ m, s: score(query, m.text) }))
    .filter((x) => x.s >= 0.25)
    .sort((a, b) => b.s - a.s)
    .slice(0, topK)
    .map((x) => x.m)
}

export function demoReset() {
  stores.clear()
  counter = 0
}

// Offline fallback if /api/answer isn't reachable (fully static deploy).
export function clientReply(recalled: DemoMem[], lastUser: string): string {
  if (recalled.length)
    return `Here's what I remember relevant to that:\n${recalled.map((r) => `• ${r.text}`).join('\n')}`
  return `Got it: “${lastUser}”. Tell me a decision, config, gotcha, person — or ask me to remember a plan — and I'll keep it.`
}

const TYPE_WORDS: [RegExp, string][] = [
  [/\b(decid|chose|moved|switch|migrat|because|instead of)\b/, 'decision'],
  [/\b(env|url|set in|config|port|token|variable|dashboard|\.env)\b/, 'config'],
  [/\b(bug|error|fails?|gotcha|workaround|fix|instead|doesn'?t work)\b/, 'gotcha'],
  [/\b(leads|prefers|owns|timezone|handles|works on|met )\b/, 'person'],
  [/\b(i prefer|i want|i like|always|never|my goal)\b/, 'preference'],
]

export function clientExtract(userText: string): { type: string; text: string }[] {
  const t = userText.trim()
  if (t.length < 4) return []
  const lower = t.toLowerCase()
  const ask = lower.match(/\b(remember|save|store|keep|note)( this| that)?\b[:,-]?\s*/)
  if (ask) {
    const body = t.slice((ask.index ?? 0) + ask[0].length).trim() || t
    return [{ type: 'plan', text: body }]
  }
  if (t.endsWith('?')) return []
  for (const [re, type] of TYPE_WORDS) if (re.test(lower)) return [{ type, text: t }]
  return []
}

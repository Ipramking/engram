import { useEffect, useRef, useState } from 'react'
import { Brain, Lock, Users, Play, RotateCcw, Search } from 'lucide-react'
import type { ChatMsg, Memory, Scope } from '../types'
import { getHealth, inspectorLink } from '../lib/api'
import { demoRecall, demoRemember, demoReset, clientReply, clientExtract } from '../lib/demoMemory'

const TYPE_META: Record<string, { label: string; dot: string; cls: string }> = {
  decision: { label: 'decision', dot: '#9b8dff', cls: 'text-violet-200 border-violet-400/30 bg-violet-400/10' },
  config: { label: 'config', dot: '#7fd7e6', cls: 'text-sky-200 border-sky-400/30 bg-sky-400/10' },
  gotcha: { label: 'gotcha', dot: '#f0c07a', cls: 'text-amber-200 border-amber-400/30 bg-amber-400/10' },
  person: { label: 'person', dot: '#e4a79c', cls: 'text-rose-100 border-rose/30 bg-rose/10' },
  preference: { label: 'preference', dot: '#f2a6c0', cls: 'text-pink-200 border-pink-400/30 bg-pink-400/10' },
  plan: { label: 'plan', dot: '#8fe0b8', cls: 'text-emerald-100 border-emerald-400/30 bg-emerald-400/10' },
  note: { label: 'note', dot: '#a99ab0', cls: 'text-mut border-line bg-surface-2' },
}

type Step = { label: string; hint: string } & (
  | { kind: 'send'; text: string }
  | { kind: 'scope'; scope: Scope }
)

const TOUR: Step[] = [
  { kind: 'send', label: 'Tell it a decision', hint: 'It captures a durable fact', text: 'We moved the DB to Neon Postgres today because the Render free tier expired.' },
  { kind: 'send', label: 'Ask about it', hint: 'It recalls what you stored', text: "What's my database setup?" },
  { kind: 'send', label: 'Remember a teammate', hint: 'A fact about a person', text: "Ada leads frontend, prefers Tailwind, she's in WAT timezone." },
  { kind: 'send', label: 'Save a plan', hint: 'Store on request — any content', text: 'Remember this plan: 1) ship the MCP endpoint, 2) record the demo video, 3) submit before the deadline.' },
  { kind: 'scope', scope: 'team', label: 'Switch to Team', hint: 'A separate, shared memory' },
  { kind: 'send', label: 'Ask in Team scope', hint: 'Personal facts stay private', text: 'What do we know so far?' },
]

function TypeTag({ type }: { type: string }) {
  const m = TYPE_META[type] ?? TYPE_META.note
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ${m.cls}`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.dot }} />
      {m.label}
    </span>
  )
}

function BlobProof({ blobId }: { blobId?: string }) {
  if (!blobId) return null
  const link = inspectorLink(blobId)
  const short = blobId.length > 16 ? `${blobId.slice(0, 7)}…${blobId.slice(-4)}` : blobId
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] text-faint">
      <button onClick={() => navigator.clipboard?.writeText(blobId)} title="Copy Walrus blob id" className="transition-colors hover:text-rose">
        {short}
      </button>
      {link && (
        <a href={link} target="_blank" rel="noreferrer" className="text-rose/80 hover:text-rose">
          inspect ↗
        </a>
      )}
    </span>
  )
}

function MemoryRow({ m }: { m: Memory }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2/60 px-3 py-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <TypeTag type={m.type} />
        <BlobProof blobId={m.blobId} />
      </div>
      <p className="text-[13px] leading-snug text-txt/90">{m.text}</p>
    </div>
  )
}

export default function Demo() {
  const [scope, setScope] = useState<Scope>('personal')
  const [teamCode] = useState('sui-lagos')
  const [model, setModel] = useState('')
  const [status, setStatus] = useState<{ mock: boolean; llm: boolean }>({ mock: true, llm: false })
  const [threads, setThreads] = useState<Record<string, ChatMsg[]>>({})
  const [sessions, setSessions] = useState<Record<string, Memory[]>>({})
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState(0)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Memory[]>([])

  const scrollRef = useRef<HTMLDivElement>(null)
  const scopeKey = scope === 'team' ? `team:${teamCode}` : 'personal'
  const messages = threads[scopeKey] ?? []
  const session = sessions[scopeKey] ?? []
  const setMessages = (v: ChatMsg[] | ((p: ChatMsg[]) => ChatMsg[])) =>
    setThreads((t) => ({ ...t, [scopeKey]: typeof v === 'function' ? (v as (p: ChatMsg[]) => ChatMsg[])(t[scopeKey] ?? []) : v }))
  const setSession = (v: Memory[] | ((p: Memory[]) => Memory[])) =>
    setSessions((s) => ({ ...s, [scopeKey]: typeof v === 'function' ? (v as (p: Memory[]) => Memory[])(s[scopeKey] ?? []) : v }))

  useEffect(() => { getHealth().then((h) => setStatus({ mock: h.mock, llm: h.llm })) }, [])
  useEffect(() => { setResults([]); setQuery('') }, [scopeKey])
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [messages, busy])

  async function send(text: string) {
    const content = text.trim()
    if (!content || busy) return
    setInput('')
    const history = [...messages, { role: 'user' as const, content }]
    setMessages([...history, { role: 'assistant', content: '', pending: true }])
    setBusy(true)
    const recalled = demoRecall(scopeKey, content).map((m) => ({ type: m.type, text: m.text, blobId: m.blobId }))
    try {
      let reply = ''
      let facts: { type: string; text: string }[] = []
      try {
        const r = await fetch('/api/answer', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ messages: history.map((m) => ({ role: m.role, content: m.content })), recalled, scope, model: model || undefined }),
        })
        if (!r.ok) throw new Error('no api')
        const j = await r.json()
        reply = j.reply
        facts = j.remembered ?? []
      } catch {
        reply = clientReply(demoRecall(scopeKey, content), content)
        facts = clientExtract(content)
      }
      const remembered = facts.map((f) => demoRemember(scopeKey, f.type, f.text))
      setMessages([...history, { role: 'assistant', content: reply, recalled, remembered }])
      if (remembered.length) setSession((s) => [...remembered, ...s])
    } finally {
      setBusy(false)
    }
  }

  function runRecall() {
    if (!query.trim()) return
    setResults(demoRecall(scopeKey, query))
  }

  function runStep() {
    const s = TOUR[step]
    if (!s) return
    if (s.kind === 'send') send(s.text)
    else setScope(s.scope)
    setStep((i) => Math.min(i + 1, TOUR.length))
  }

  const cur = TOUR[step]
  const scopeLabel = scope === 'team' ? `team · ${teamCode}` : 'personal'

  return (
    <div className="overflow-hidden rounded-3xl border border-line glass shadow-2xl shadow-black/40">
      {/* top bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <span className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-violet/50" />
            <span className="h-2.5 w-2.5 rounded-full bg-faint/50" />
          </span>
          <span className="ml-1 font-mono text-[11px] text-faint">engram · live demo</span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-line bg-bg/40 p-0.5 text-xs">
            {(['personal', 'team'] as Scope[]).map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`rounded-full px-3 py-1 transition ${scope === s ? 'bg-gradient-to-r from-rose to-violet text-bg font-medium' : 'text-mut hover:text-txt'}`}
              >
                {s === 'personal' ? (
                  <span className="inline-flex items-center gap-1.5"><Lock size={12} /> Personal</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5"><Users size={12} /> Team</span>
                )}
              </button>
            ))}
          </div>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            title="Switch models — memory persists across all of them"
            className="hidden rounded-full border border-line bg-bg/40 px-3 py-1 text-xs text-mut outline-none focus:border-rose sm:block"
          >
            <option value="">default model</option>
            <option value="openai/gpt-oss-20b">GPT-OSS 20B</option>
            <option value="openai/gpt-oss-120b">GPT-OSS 120B</option>
            <option value="qwen/qwen3.8-27b">Qwen 3.8 27B</option>
          </select>
          <span className="flex items-center gap-1.5 rounded-full border border-line bg-bg/40 px-2.5 py-1 text-[10.5px] text-mut">
            <span className={`h-1.5 w-1.5 rounded-full ${status.mock ? 'bg-amber-400' : 'bg-emerald-400'}`} />
            {status.mock ? 'demo memory' : 'Walrus live'}
          </span>
        </div>
      </div>

      {/* guided tour rail */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-bg/30 px-4 py-2.5 sm:px-5">
        <span className="mr-1 text-[11px] font-medium tracking-widest text-faint uppercase">Guided tour</span>
        {TOUR.map((s, i) => (
          <span
            key={i}
            className={`rounded-full px-2.5 py-1 text-[11px] transition ${
              i < step ? 'text-rose/70 line-through decoration-rose/30' : i === step ? 'bg-rose/15 text-rose ring-1 ring-rose/30' : 'text-faint'
            }`}
          >
            {i + 1}. {s.label}
          </span>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {step < TOUR.length ? (
            <button
              onClick={runStep}
              disabled={busy}
              className="rounded-full bg-gradient-to-r from-rose to-violet px-4 py-1.5 text-xs font-medium text-bg transition hover:opacity-90 disabled:opacity-40"
            >
              {cur?.kind === 'scope' ? (
                <span className="inline-flex items-center gap-1.5">→ {cur.label}</span>
              ) : (
                <span className="inline-flex items-center gap-1.5"><Play size={12} /> Run: {cur?.label}</span>
              )}
            </button>
          ) : (
            <button onClick={() => { demoReset(); setStep(0); setThreads({}); setSessions({}); setScope('personal') }} className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-1.5 text-xs text-mut hover:text-txt">
              <RotateCcw size={12} /> Restart tour
            </button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px]">
        {/* chat */}
        <div className="flex min-h-[440px] flex-col border-b border-line lg:border-b-0 lg:border-r">
          <div ref={scrollRef} className="max-h-[520px] min-h-[360px] flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            {messages.length === 0 && (
              <div className="grid h-full place-items-center px-6 text-center">
                <div className="max-w-sm">
                  <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-rose to-violet text-bg animate-float"><Brain size={26} /></div>
                  <p className="mb-1 font-display text-xl text-txt">Watch it remember</p>
                  <p className="text-sm text-mut">Hit <span className="text-rose">Run</span> on the guided tour above — or just type a decision, config, gotcha, or a fact about someone.</p>
                </div>
              </div>
            )}
            {messages.map((m, i) => <Bubble key={i} m={m} />)}
          </div>

          <div className="border-t border-line p-3 sm:p-4">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
                rows={1}
                placeholder={`Tell Engram something worth remembering (${scopeLabel})…`}
                className="max-h-40 min-h-[44px] flex-1 resize-none rounded-2xl border border-line bg-bg/40 px-3.5 py-3 text-sm text-txt outline-none transition focus:border-rose/60"
              />
              <button
                onClick={() => send(input)}
                disabled={busy || !input.trim()}
                className="h-[44px] rounded-2xl bg-gradient-to-r from-rose to-violet px-5 text-sm font-medium text-bg transition hover:opacity-90 disabled:opacity-40"
              >
                {busy ? '…' : 'Send'}
              </button>
            </div>
          </div>
        </div>

        {/* memory panel */}
        <aside className="flex max-h-[600px] flex-col bg-bg/20 p-4">
          <div className="mb-3 flex gap-1.5">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runRecall()}
              placeholder="recall… e.g. deploy setup"
              className="flex-1 rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-sm text-txt outline-none focus:border-rose/60"
            />
            <button onClick={runRecall} className="grid place-items-center rounded-xl border border-line bg-surface-2 px-3 text-rose transition hover:border-rose/50"><Search size={15} /></button>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5">
            {results.length > 0 && (
              <section className="space-y-1.5">
                <p className="text-[10.5px] font-medium tracking-widest text-faint uppercase">Recall results · {scopeLabel}</p>
                {results.map((m, i) => <MemoryRow key={`r${i}`} m={m} />)}
              </section>
            )}
            <section className="space-y-1.5">
              <p className="text-[10.5px] font-medium tracking-widest text-faint uppercase">Stored on Walrus ({session.length})</p>
              {session.length === 0 && <p className="text-xs leading-relaxed text-faint">Durable facts land here — each with its verifiable Walrus blob id.</p>}
              {session.map((m, i) => <MemoryRow key={`s${i}`} m={m} />)}
            </section>
          </div>
        </aside>
      </div>
    </div>
  )
}

function Bubble({ m }: { m: ChatMsg }) {
  if (m.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md border border-violet/25 bg-violet/15 px-4 py-2.5 text-sm text-txt">{m.content}</div>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      {m.recalled && m.recalled.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-faint">
          <span className="text-rose/70">↩ recalled {m.recalled.length}</span>
          {m.recalled.map((r, i) => (
            <span key={i} className="rounded-full border border-line bg-surface-2/60 px-2 py-0.5">{r.text.length > 44 ? r.text.slice(0, 44) + '…' : r.text}</span>
          ))}
        </div>
      )}
      <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-line bg-surface-2/60 px-4 py-2.5 text-sm whitespace-pre-wrap text-txt/90">
        {m.pending ? <span className="text-mut">thinking<span className="caret" /></span> : m.content}
      </div>
      {m.remembered && m.remembered.length > 0 && (
        <div className="flex max-w-[88%] flex-col gap-1.5">
          {m.remembered.map((r, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl border border-rose/25 bg-rose/[0.06] px-3 py-2">
              <Brain size={14} className="text-rose" />
              <TypeTag type={r.type} />
              <span className="flex-1 truncate text-[12.5px] text-txt/90" title={r.text}>{r.text}</span>
              <BlobProof blobId={r.blobId} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

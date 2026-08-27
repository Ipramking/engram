import { useEffect, useRef, useState } from 'react'
import type { ChatMsg, Memory, Scope } from './types'
import { getHealth, inspectorLink, pinMemory, recallMemories, sendChat } from './lib/api'

const TYPE_META: Record<string, { label: string; cls: string }> = {
  decision: { label: 'decision', cls: 'text-violet-300 bg-violet-500/10 border-violet-500/30' },
  config: { label: 'config', cls: 'text-sky-300 bg-sky-500/10 border-sky-500/30' },
  gotcha: { label: 'gotcha', cls: 'text-amber-300 bg-amber-500/10 border-amber-500/30' },
  person: { label: 'person', cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' },
  preference: { label: 'preference', cls: 'text-pink-300 bg-pink-500/10 border-pink-500/30' },
  note: { label: 'note', cls: 'text-slate-300 bg-slate-500/10 border-slate-500/30' },
}

const SUGGESTIONS = [
  'We moved the DB to Neon Postgres today because the Render free tier expired.',
  'DATABASE_URL is set in the Render dashboard env, not in .env.',
  "Ada leads frontend, prefers Tailwind, she's in WAT timezone.",
  "What's my database setup?",
]

function BlobProof({ blobId }: { blobId?: string }) {
  if (!blobId) return null
  const link = inspectorLink(blobId)
  const short = blobId.length > 16 ? `${blobId.slice(0, 8)}…${blobId.slice(-4)}` : blobId
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-mut">
      <button
        onClick={() => navigator.clipboard?.writeText(blobId)}
        title="Copy blob id"
        className="hover:text-txt transition-colors"
      >
        {short}
      </button>
      {link && (
        <a href={link} target="_blank" rel="noreferrer" className="text-brand hover:underline">
          inspect ↗
        </a>
      )}
    </span>
  )
}

function TypeTag({ type }: { type: string }) {
  const m = TYPE_META[type] ?? TYPE_META.note
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${m.cls}`}>
      {m.label}
    </span>
  )
}

function MemoryRow({ m }: { m: Memory }) {
  return (
    <div className="rounded-lg border border-line bg-panel-2 px-3 py-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <TypeTag type={m.type} />
        <BlobProof blobId={m.blobId} />
      </div>
      <p className="text-[13px] leading-snug text-txt">{m.text}</p>
    </div>
  )
}

export default function App() {
  const [scope, setScope] = useState<Scope>('personal')
  const [teamCode, setTeamCode] = useState('sui-lagos')
  const [model, setModel] = useState('')
  const [status, setStatus] = useState<{ mock: boolean; llm: boolean }>({ mock: true, llm: false })
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [pinType, setPinType] = useState('decision')
  const [busy, setBusy] = useState(false)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Memory[]>([])
  const [session, setSession] = useState<Memory[]>([])
  const [panelOpen, setPanelOpen] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getHealth().then((h) => setStatus({ mock: h.mock, llm: h.llm }))
  }, [])
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  async function send(text: string) {
    const content = text.trim()
    if (!content || busy) return
    setInput('')
    const history = [...messages, { role: 'user' as const, content }]
    setMessages([...history, { role: 'assistant', content: '', pending: true }])
    setBusy(true)
    try {
      const res = await sendChat(
        history.map((m) => ({ role: m.role, content: m.content })),
        scope,
        teamCode,
        model || undefined,
      )
      setMessages([
        ...history,
        {
          role: 'assistant',
          content: res.reply,
          recalled: res.recalled,
          remembered: res.remembered,
        },
      ])
      if (res.remembered?.length) setSession((s) => [...res.remembered, ...s])
    } catch (e: any) {
      setMessages([...history, { role: 'assistant', content: `⚠️ ${e.message ?? 'request failed'}` }])
    } finally {
      setBusy(false)
    }
  }

  async function pin() {
    const text = input.trim()
    if (!text || busy) return
    setBusy(true)
    try {
      const m = await pinMemory(text, pinType, scope, teamCode)
      setSession((s) => [m, ...s])
      setInput('')
    } catch (e: any) {
      alert(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function runRecall() {
    if (!query.trim()) return
    const r = await recallMemories(query, scope, teamCode)
    setResults(r.results)
  }

  const scopeLabel = scope === 'team' ? `team · ${teamCode}` : 'personal'

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col px-3 sm:px-5">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-3 py-4">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand to-brand-2 text-ink">
            <span className="text-lg font-black">E</span>
          </div>
          <div>
            <h1 className="text-lg leading-none font-semibold text-txt">Engram</h1>
            <p className="text-[11px] text-mut">portable memory for your agent · Walrus</p>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-line bg-panel p-0.5 text-sm">
            {(['personal', 'team'] as Scope[]).map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`rounded-md px-3 py-1 transition-colors ${
                  scope === s ? 'bg-brand text-ink font-medium' : 'text-mut hover:text-txt'
                }`}
              >
                {s === 'personal' ? '🔒 Personal' : '👥 Team'}
              </button>
            ))}
          </div>
          {scope === 'team' && (
            <input
              value={teamCode}
              onChange={(e) => setTeamCode(e.target.value)}
              placeholder="join code"
              className="w-28 rounded-lg border border-line bg-panel px-2 py-1 text-sm text-txt outline-none focus:border-brand"
            />
          )}
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            title="Switch models — memory persists across all of them"
            className="hidden rounded-lg border border-line bg-panel px-2 py-1 text-sm text-txt outline-none focus:border-brand sm:block"
          >
            <option value="">default model</option>
            <option value="openai/gpt-oss-20b">GPT-OSS 20B</option>
            <option value="openai/gpt-oss-120b">GPT-OSS 120B</option>
            <option value="qwen/qwen3.8-27b">Qwen 3.8 27B</option>
            <option value="qwen/qwen3.6-27b">Qwen 3.6 27B</option>
          </select>
          <StatusPill mock={status.mock} llm={status.llm} />
          <button
            onClick={() => setPanelOpen((o) => !o)}
            className="rounded-lg border border-line bg-panel px-3 py-1 text-sm text-mut hover:text-txt lg:hidden"
          >
            🧠 Memory
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex min-h-0 flex-1 gap-4 pb-4">
        <main className="flex min-h-0 flex-1 flex-col rounded-2xl border border-line bg-panel/60 backdrop-blur">
          <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 && <Empty scope={scopeLabel} onPick={(t) => send(t)} />}
            {messages.map((m, i) => (
              <Bubble key={i} m={m} />
            ))}
          </div>

          <div className="border-t border-line p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send(input)
                  }
                }}
                rows={1}
                placeholder={`Message Engram (${scopeLabel})…`}
                className="max-h-40 min-h-[42px] flex-1 resize-none rounded-xl border border-line bg-panel-2 px-3 py-2.5 text-sm text-txt outline-none focus:border-brand"
              />
              <button
                onClick={() => send(input)}
                disabled={busy || !input.trim()}
                className="h-[42px] rounded-xl bg-brand px-4 text-sm font-medium text-ink disabled:opacity-40"
              >
                {busy ? '…' : 'Send'}
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-mut">
              <span>Force-remember as</span>
              <select
                value={pinType}
                onChange={(e) => setPinType(e.target.value)}
                className="rounded border border-line bg-panel-2 px-1.5 py-0.5 text-txt outline-none"
              >
                {Object.keys(TYPE_META)
                  .filter((t) => t !== 'note')
                  .map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
              </select>
              <button
                onClick={pin}
                disabled={busy || !input.trim()}
                className="text-brand hover:underline disabled:opacity-40"
              >
                📌 Pin this
              </button>
              <span className="ml-auto font-mono">
                {scopeLabel} · {status.mock ? 'mock' : 'walrus'}
              </span>
            </div>
          </div>
        </main>

        <aside
          className={`${
            panelOpen ? 'fixed inset-0 z-20 bg-ink/95 p-4' : 'hidden'
          } flex-col lg:static lg:z-auto lg:flex lg:w-80 lg:bg-transparent lg:p-0`}
        >
          <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-line bg-panel/60 p-3 backdrop-blur">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-txt">Memory · {scopeLabel}</h2>
              <button onClick={() => setPanelOpen(false)} className="text-mut lg:hidden">
                ✕
              </button>
            </div>
            <div className="flex gap-1.5">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runRecall()}
                placeholder="recall… e.g. deploy setup"
                className="flex-1 rounded-lg border border-line bg-panel-2 px-2 py-1.5 text-sm text-txt outline-none focus:border-brand"
              />
              <button onClick={runRecall} className="rounded-lg bg-brand-2 px-2.5 text-sm text-white">
                🔎
              </button>
            </div>
            <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto">
              {results.length > 0 && (
                <section className="space-y-1.5">
                  <p className="text-[11px] font-medium tracking-wide text-mut uppercase">Recall results</p>
                  {results.map((m, i) => (
                    <MemoryRow key={`r${i}`} m={m} />
                  ))}
                </section>
              )}
              <section className="space-y-1.5">
                <p className="text-[11px] font-medium tracking-wide text-mut uppercase">
                  Stored this session ({session.length})
                </p>
                {session.length === 0 && (
                  <p className="text-xs text-mut">
                    Nothing yet. Tell Engram a decision, config, gotcha or person — it captures
                    durable facts automatically and shows the Walrus blob id here.
                  </p>
                )}
                {session.map((m, i) => (
                  <MemoryRow key={`s${i}`} m={m} />
                ))}
              </section>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function StatusPill({ mock, llm }: { mock: boolean; llm: boolean }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-line bg-panel px-2.5 py-1 text-[11px]">
      <span className={`h-2 w-2 rounded-full ${mock ? 'bg-amber-400' : 'bg-emerald-400'}`} />
      <span className="text-mut">{mock ? 'mock memory' : 'Walrus live'}</span>
      <span className="text-line">|</span>
      <span className="text-mut">{llm ? 'LLM' : 'offline'}</span>
    </div>
  )
}

function Empty({ scope, onPick }: { scope: string; onPick: (t: string) => void }) {
  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-2 text-2xl text-ink">
        🧠
      </div>
      <h2 className="mb-1 text-lg font-semibold text-txt">An agent that actually remembers</h2>
      <p className="mb-5 text-sm text-mut">
        Tell it a decision, config, gotcha or teammate. It stores durable facts on Walrus ({scope})
        and recalls them across sessions, devices, and models.
      </p>
      <div className="space-y-1.5 text-left">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="block w-full rounded-lg border border-line bg-panel-2 px-3 py-2 text-left text-sm text-txt hover:border-brand"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

function Bubble({ m }: { m: ChatMsg }) {
  if (m.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-2/20 px-3.5 py-2 text-sm text-txt">
          {m.content}
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      {m.recalled && m.recalled.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-mut">
          <span>↩ recalled {m.recalled.length}:</span>
          {m.recalled.map((r, i) => (
            <span key={i} className="rounded border border-line bg-panel-2 px-1.5 py-0.5">
              {r.text.length > 40 ? r.text.slice(0, 40) + '…' : r.text}
            </span>
          ))}
        </div>
      )}
      <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-line bg-panel-2 px-3.5 py-2 text-sm whitespace-pre-wrap text-txt">
        {m.pending ? <span className="text-mut">thinking…</span> : m.content}
      </div>
      {m.remembered && m.remembered.length > 0 && (
        <div className="flex max-w-[85%] flex-col gap-1.5">
          {m.remembered.map((r, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-1.5"
            >
              <span className="text-sm">🧠</span>
              <TypeTag type={r.type} />
              <span className="flex-1 truncate text-[12px] text-txt" title={r.text}>
                {r.text}
              </span>
              <BlobProof blobId={r.blobId} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

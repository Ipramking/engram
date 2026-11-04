import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, Check, Plug, Send, Sparkles } from 'lucide-react'
import { ENGRAM_PROMPT } from '../../lib/promptText'
import type { Dashboard } from './data'
import { MEMORY_TYPES } from './data'
import type { TabId } from './types'
import { Button, CopyButton, Panel, Skeleton, TYPE_META, TypeBadge, inputCls, relTime, useToast } from './ui'
import { ConnectionCard } from './ConnectionCard'

const PROMPT_FLAG = 'engram.promptInstalled'

function greeting() {
  const h = new Date().getHours()
  return h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export function Overview({ d, name, go, onCreateKey }: { d: Dashboard; name: string; go: (t: TabId) => void; onCreateKey: () => void }) {
  const toast = useToast()
  const [promptDone, setPromptDone] = useState(() => {
    try {
      return localStorage.getItem(PROMPT_FLAG) === '1'
    } catch {
      return false
    }
  })
  const [text, setText] = useState('')
  const [type, setType] = useState<string>('decision')
  const [saving, setSaving] = useState(false)

  const usedKeys = d.keys.filter((k) => k.last_used_at)
  const memCount = d.recentStats?.active ?? d.recent.length
  const recalls = d.usage?.personal.recalls ?? 0
  const steps = [
    {
      done: usedKeys.length > 0,
      title: 'Connect your first AI app',
      body: 'Pick the app you use most — Claude, ChatGPT, Cursor, Claude Code… Each guide takes about a minute.',
      action: (
        <Button size="sm" variant="primary" onClick={() => go('connect')}>
          Choose an app <ArrowRight size={14} />
        </Button>
      ),
    },
    {
      done: memCount > 0,
      title: 'Save your first memory',
      body: 'Tell your AI “remember that…”, or type a fact in the box below. Good memories are one sentence with the reason.',
      action: (
        <Button size="sm" onClick={() => document.getElementById('quick-save')?.focus()}>
          Write one now
        </Button>
      ),
    },
    {
      done: recalls > 0 || usedKeys.length > 1,
      title: 'Recall it from a different app',
      body: 'Open another app you connected and ask about what you saved. That moment is the whole point of Engram.',
      action: (
        <Button size="sm" onClick={() => go('connect')}>
          Connect a second app
        </Button>
      ),
    },
    {
      done: promptDone,
      optional: true,
      title: 'Teach your AI when to save',
      body: 'Paste the memory rules into your AI’s custom instructions so it saves decisions and gotchas without being asked.',
      action: (
        <CopyButton
          value={ENGRAM_PROMPT}
          label="Copy memory rules"
          onCopied={() => {
            setPromptDone(true)
            try {
              localStorage.setItem(PROMPT_FLAG, '1')
            } catch {
              /* private mode */
            }
          }}
        />
      ),
    },
  ]
  const doneCount = steps.filter((s) => s.done).length
  const allDone = doneCount === steps.length
  const nextIdx = steps.findIndex((s) => !s.done)

  async function quickSave(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setSaving(true)
    const r = await d.saveMemory({ text: text.trim(), type, scope: 'personal' })
    setSaving(false)
    if (r.ok) {
      setText('')
      toast(
        r.superseded.length
          ? `Saved. It replaced an older ${type}: “${r.superseded[0].oldText.slice(0, 60)}…”`
          : 'Saved. Every connected app can recall it now.',
      )
    } else toast(r.error, 'error')
  }

  return (
    <div className="space-y-6">
      <header className="mb-2">
        <p className="eyebrow">{greeting()}</p>
        <h1 className="text-balance mt-2 font-display text-[34px] leading-[1.02] text-txt sm:text-[46px]">
          {name}, <em className="text-gradient italic">one memory</em> for every AI you use.
        </h1>
        <p className="mt-3 max-w-[64ch] text-[14.5px] leading-relaxed text-mut">
          Engram keeps the facts that matter — decisions, setup values, gotchas, people, preferences and plans — and lets
          Claude, ChatGPT, Gemini, Cursor and your terminal agents all read the same notes. Tell one app, and the others know.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* Start here */}
        <Panel className="p-5 sm:p-7">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow">{allDone ? 'All set' : 'Start here'}</p>
              <h2 className="mt-1 font-display text-[22px] text-txt">
                {allDone ? 'Engram is working across your apps' : 'Four steps to a working memory'}
              </h2>
            </div>
            <ProgressRing value={doneCount} total={steps.length} />
          </div>
          <ol className="space-y-2.5">
            {steps.map((s, i) => {
              const isNext = i === nextIdx
              return (
                <li
                  key={s.title}
                  className={`rounded-2xl border p-4 transition ${
                    isNext ? 'border-rose/35 bg-rose/[0.05]' : 'border-line/70 bg-bg/30'
                  }`}
                >
                  <div className="flex gap-3.5">
                    <span
                      className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-xl border font-mono text-[12px] ${
                        s.done ? 'border-rose/40 bg-rose text-bg' : isNext ? 'border-rose/50 text-rose' : 'border-line-2 text-faint'
                      }`}
                    >
                      {s.done ? <Check size={14} strokeWidth={2.6} /> : i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[14px] font-medium ${s.done ? 'text-mut line-through decoration-faint/60' : 'text-txt'}`}>
                        {s.title}
                        {s.optional && <span className="ml-2 font-mono text-[10.5px] uppercase tracking-wider text-faint">optional</span>}
                      </p>
                      {!s.done && <p className="mt-1 max-w-[58ch] text-[13px] leading-relaxed text-mut">{s.body}</p>}
                      {!s.done && isNext && <div className="mt-3">{s.action}</div>}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        </Panel>

        <div className="space-y-6">
          <ConnectionCard d={d} onCreateKey={onCreateKey} />

          <div className="grid grid-cols-2 gap-3">
            <Stat label="Active memories" value={d.loading ? null : memCount} />
            <Stat
              label="Saves today"
              value={d.usage ? d.usage.personal.saves : d.loading ? null : 0}
              suffix={d.usage ? `/ ${d.usage.personal.dailyLimit}` : undefined}
            />
            <Stat label="Recalls today" value={d.usage ? recalls : d.loading ? null : 0} />
            <Stat label="Apps connected" value={d.loading ? null : usedKeys.length} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Quick save */}
        <Panel className="p-5 sm:p-7">
          <p className="eyebrow">Quick save</p>
          <h2 className="mt-1 font-display text-[21px] text-txt">Write a memory yourself</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-mut">
            Works from your phone too. Pick what kind of fact it is, write one clear sentence, include the why.
          </p>
          <form onSubmit={quickSave} className="mt-4 space-y-3">
            <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {MEMORY_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  aria-pressed={type === t}
                  title={TYPE_META[t].hint}
                  className={`ring-focus shrink-0 rounded-xl border px-3 py-1.5 text-[12px] transition ${
                    type === t ? 'border-rose/50 bg-rose/10 text-txt' : 'border-line-2 text-mut hover:text-txt'
                  }`}
                >
                  {TYPE_META[t].label}
                </button>
              ))}
            </div>
            <textarea
              id="quick-save"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder={
                type === 'gotcha'
                  ? 'e.g. The Supabase CLI has no Windows binary on npm, so use the standalone .exe.'
                  : type === 'config'
                    ? 'e.g. Production DATABASE_URL lives in the Render dashboard, not in .env.'
                    : 'e.g. We moved auth to Clerk on 3 Nov because Supabase magic links kept landing in spam.'
              }
              className={`${inputCls} resize-none`}
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] text-faint">Saved to your personal memory</span>
              <Button type="submit" variant="primary" disabled={saving || !text.trim()}>
                <Send size={14} /> {saving ? 'Saving…' : 'Save memory'}
              </Button>
            </div>
          </form>
        </Panel>

        {/* Recent */}
        <Panel className="p-5 sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Latest</p>
              <h2 className="mt-1 font-display text-[21px] text-txt">Recently remembered</h2>
            </div>
            <Button size="sm" variant="ghost" onClick={() => go('memories')}>
              View all <ArrowRight size={14} />
            </Button>
          </div>
          <div className="mt-4 space-y-2">
            {d.loading ? (
              [0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)
            ) : d.recent.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line-2 p-6 text-center text-[13px] text-mut">
                <Sparkles size={18} className="mx-auto mb-2 text-rose" />
                Nothing saved yet. Your first memory will show up here.
              </div>
            ) : (
              d.recent.slice(0, 5).map((m) => (
                <div key={m.id} className="rounded-2xl border border-line/70 bg-bg/35 px-4 py-3">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <TypeBadge type={m.type} />
                    <span className="tabular font-mono text-[11px] text-faint">{relTime(m.createdAt)}</span>
                  </div>
                  <p className="line-clamp-2 text-[13px] leading-relaxed text-txt/90">{m.text}</p>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      <Panel className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-violet/30 bg-violet/10 text-violet-soft">
          <Plug size={19} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium text-txt">Not sure how any of this works?</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-mut">
            The guide explains memory types, personal vs team memory, and what to do when an app says “Unauthorized”.
          </p>
        </div>
        <Button onClick={() => go('guide')}>Read the guide</Button>
      </Panel>
    </div>
  )
}

function Stat({ label, value, suffix }: { label: string; value: number | null; suffix?: string }) {
  return (
    <div className="panel rounded-2xl px-4 py-3.5">
      <p className="eyebrow">{label}</p>
      {value === null ? (
        <Skeleton className="mt-2 h-7 w-14" />
      ) : (
        <p className="tabular mt-1 font-display text-[28px] leading-none text-txt">
          {value}
          {suffix && <span className="ml-1 font-sans text-[13px] text-faint">{suffix}</span>}
        </p>
      )}
    </div>
  )
}

function ProgressRing({ value, total }: { value: number; total: number }) {
  const r = 20
  const c = 2 * Math.PI * r
  return (
    <div className="relative h-14 w-14 shrink-0" aria-label={`${value} of ${total} steps done`}>
      <svg viewBox="0 0 48 48" className="h-14 w-14 -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="var(--color-line-2)" strokeWidth="3" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="url(#ring)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (value / total) * c}
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.22,1,0.36,1)' }}
        />
        <defs>
          <linearGradient id="ring" x1="0" x2="1">
            <stop offset="0" stopColor="#e4a79c" />
            <stop offset="1" stopColor="#9b8dff" />
          </linearGradient>
        </defs>
      </svg>
      <span className="tabular absolute inset-0 grid place-items-center font-mono text-[12px] text-txt">
        {value}/{total}
      </span>
    </div>
  )
}

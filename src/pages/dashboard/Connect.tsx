import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowUpRight, BookOpenCheck, Eye, PenLine } from 'lucide-react'
import { ENGRAM_PROMPT } from '../../lib/promptText'
import type { Dashboard } from './data'
import { maskSecret, maskUrl } from './data'
import { CLIENTS, GROUPS, SIGN_IN_CONFIG } from './clients'
import type { ClientGroup, ConnectCtx } from './clients'
import { ConnectionCard } from './ConnectionCard'
import { Callout, CodeBlock, CopyButton, PageHeader, Panel, Segmented, Steps } from './ui'

const INIT_COMMANDS = 'npx engram-walrus login\nnpx engram-walrus init'

function buildCtx(d: Dashboard, telegramBot: string | null): ConnectCtx | null {
  const cred = d.credential
  if (!cred || !cred.url) return null
  const { token, url } = cred
  const saveLink = (t: string) => `${d.origin}/api/remember?token=${encodeURIComponent(t)}&type=decision&text=ONE_SENTENCE_FACT`
  const active = d.recent.filter((m) => !m.isSuperseded)
  const lines = active.map((m, i) => `${i + 1}. [${(m.type || 'decision').toUpperCase()}] ${m.text}`)

  const instructions = (t: string) => {
    const head = `You can use my Engram memory.
1. Treat the memories below as true facts about my projects, setup, people and preferences.
2. When I state a new decision, config, gotcha, person, preference or plan, or ask you to remember something, end your reply with a link:
[Save to Engram](${saveLink(t)})
Replace "decision" with the right type and ONE_SENTENCE_FACT with the fact, URL-encoded.

MY MEMORIES:
`
    let body = ''
    for (const l of lines) {
      if ((head + body + l).length > 1480) break
      body += l + '\n'
    }
    return head + (body || '- (none saved yet)')
  }

  const pack = `Here is my Engram memory (${active.length} active facts). Use it as ground truth for this chat.
When I tell you something worth keeping, end your reply with a link so I can save it:
[Save to Engram](${saveLink(token)})

${lines.join('\n') || '- (none saved yet)'}`

  return {
    mcpUrl: `${d.origin}/mcp`,
    telegramBot,
    url,
    maskedUrl: maskUrl(url),
    token,
    maskedToken: maskSecret(token),
    origin: d.origin,
    prompt: ENGRAM_PROMPT,
    pack,
    chatInstructions: instructions(token),
    maskedChatInstructions: instructions(maskSecret(token)),
  }
}

export function Connect({ d, onCreateKey }: { d: Dashboard; onCreateKey: () => void }) {
  const [group, setGroup] = useState<'all' | ClientGroup>('all')
  const [selected, setSelected] = useState<string>('claude')
  const [showPrompt, setShowPrompt] = useState(false)
  const detailRef = useRef<HTMLDivElement>(null)
  const [telegramBot, setTelegramBot] = useState<string | null>(null)
  useEffect(() => {
    fetch('/api/connect/telegram-info')
      .then((r) => r.json())
      .then((t) => setTelegramBot(t?.enabled ? t.username || null : null))
      .catch(() => {})
  }, [])
  const ctx = buildCtx(d, telegramBot)

  const list = CLIENTS.filter((c) => group === 'all' || c.group === group)
  const client = CLIENTS.find((c) => c.id === selected) || CLIENTS[0]

  function pick(id: string) {
    setSelected(id)
    if (window.matchMedia('(max-width: 1023px)').matches) {
      setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Connect"
        title="Plug Engram into the apps you already use"
        intro="Pick an app and follow its steps. Every guide uses the same connection link, so a memory saved in one app is there in all the others."
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Panel className="p-5 sm:p-6">
          <p className="eyebrow">Fastest on a computer</p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-mut">
            Two commands set up every AI app Engram can find (Claude Code, Claude Desktop, Cursor, VS Code, Windsurf, Gemini CLI,
            Codex). It asks before each change and keeps backups.
          </p>
          <div className="mt-3">
            <CodeBlock label="Terminal" display={INIT_COMMANDS} value={INIT_COMMANDS} />
          </div>
        </Panel>
        <ConnectionCard d={d} onCreateKey={onCreateKey} compact />
      </div>

      <div className="mb-4 overflow-x-auto no-scrollbar">
        <Segmented
          ariaLabel="App category"
          value={group}
          onChange={setGroup}
          options={[{ id: 'all', label: 'All apps' }, ...GROUPS.map((g) => ({ id: g.id, label: g.label }))]}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,330px)_minmax(0,1fr)]">
        {/* Picker */}
        <nav aria-label="Apps" className="space-y-1.5 lg:sticky lg:top-6 lg:self-start">
          {list.map((c) => {
            const on = c.id === client.id
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => pick(c.id)}
                aria-current={on}
                className={`ring-focus group flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition duration-200 ${
                  on ? 'border-rose/40 bg-rose/[0.07]' : 'border-transparent hover:border-line-2 hover:bg-surface/50'
                }`}
              >
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border font-display text-[15px] ${
                    on ? 'border-rose/40 bg-rose/15 text-rose' : 'border-line-2 bg-surface/60 text-mut'
                  }`}
                >
                  {c.name[0]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-txt">{c.name}</span>
                  <span className="block truncate text-[12px] text-faint">{c.tagline}</span>
                </span>
                <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-wider text-faint sm:block">
                  {GROUPS.find((g) => g.id === c.group)?.hint}
                </span>
              </button>
            )
          })}
        </nav>

        {/* Guide */}
        <div ref={detailRef} className="scroll-mt-20">
          <Panel as="article" className="p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="eyebrow">{client.method}</p>
                <h2 className="mt-1 font-display text-[28px] leading-tight text-txt">{client.name}</h2>
                <p className="mt-1 text-[13px] text-mut">{client.tagline}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {client.platforms.map((p) => (
                  <span key={p} className="rounded-lg border border-line-2 px-2 py-0.5 font-mono text-[10.5px] text-mut">
                    {p}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-[12px]">
              <Capability on={client.reads} icon={<Eye size={13} />} label="Reads your memory" />
              <Capability on={client.writes} icon={<PenLine size={13} />} label="Saves new memories" />
            </div>

            {SIGN_IN_CONFIG[client.id] && (
              <div className="mt-6 rounded-2xl border border-rose/30 bg-rose/[0.04] p-4 sm:p-5">
                <p className="eyebrow mb-3 !text-rose">Recommended · no key to paste</p>
                <Steps
                  items={[
                    <>In a terminal, run <code>npx engram-walrus login</code> and approve the code in your browser. This device gets its own key, saved locally.</>,
                    <>Add Engram to {client.name} with the config below. It contains no secret.</>,
                    <>Restart {client.name}. To check the connection any time, run <code>npx engram-walrus doctor</code>.</>,
                  ]}
                />
                <div className="mt-4">
                  <CodeBlock
                    label={SIGN_IN_CONFIG[client.id].label}
                    display={SIGN_IN_CONFIG[client.id].display}
                    value={SIGN_IN_CONFIG[client.id].value}
                  />
                </div>
              </div>
            )}

            <div className="mt-6">
              <p className="eyebrow mb-3">{SIGN_IN_CONFIG[client.id] ? 'Or connect with your link' : 'Steps'}</p>
              {ctx ? (
                <Steps items={client.steps(ctx)} />
              ) : (
                <p className="text-[13px] text-mut">{d.credential ? 'Preparing your link…' : 'Create a key first — the guide fills in your link automatically.'}</p>
              )}
            </div>

            {ctx && client.snippets && (
              <div className="mt-6 space-y-3">
                {client.snippets(ctx).map((s) => (
                  <CodeBlock key={s.label} label={s.label} display={s.display} value={s.value} wrap={s.wrap} />
                ))}
                <p className="text-[12px] text-faint">The key is hidden on screen; the copy button copies the full value.</p>
              </div>
            )}

            {client.links && (
              <div className="mt-4 flex flex-wrap gap-2">
                {client.links.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    target="_blank"
                    rel="noreferrer"
                    className="ring-focus inline-flex h-8 items-center gap-1.5 rounded-xl border border-line-2 px-3 text-xs text-txt transition hover:border-rose/45"
                  >
                    {l.label} <ArrowUpRight size={13} className="text-rose" />
                  </a>
                ))}
              </div>
            )}

            <div className="mt-6 rounded-2xl border border-line/70 bg-bg/35 p-4">
              <p className="mb-1 flex items-center gap-2 text-[13px] font-medium text-txt">
                <BookOpenCheck size={15} className="text-rose" /> Check it worked
              </p>
              <div className="text-[13px] leading-relaxed text-mut [&_code]:font-mono [&_code]:text-champagne">{client.verify}</div>
            </div>

            {client.note && (
              <div className="mt-4">
                <Callout tone="warn">{client.note}</Callout>
              </div>
            )}
          </Panel>

          <Panel className="mt-6 p-5 sm:p-7">
            <p className="eyebrow">Make it automatic</p>
            <h3 className="mt-1 font-display text-[21px] text-txt">Teach your AI when to save and recall</h3>
            <p className="mt-1.5 max-w-[62ch] text-[13px] leading-relaxed text-mut">
              Connecting gives your AI the tools. These memory rules tell it <i>when</i> to use them: recall before answering about your
              work, save decisions, configs and gotchas, and never save secrets. Paste them into the app's custom instructions,
              <code className="mx-1 font-mono text-[12px] text-champagne">CLAUDE.md</code>,
              <code className="mx-1 font-mono text-[12px] text-champagne">AGENTS.md</code> or
              <code className="mx-1 font-mono text-[12px] text-champagne">GEMINI.md</code>.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <CopyButton value={ENGRAM_PROMPT} label="Copy memory rules" variant="primary" size="md" />
              <button
                type="button"
                onClick={() => setShowPrompt((s) => !s)}
                className="ring-focus h-10 rounded-2xl px-3 text-[13px] text-mut transition hover:text-txt"
              >
                {showPrompt ? 'Hide rules' : 'Read the rules'}
              </button>
            </div>
            {showPrompt && (
              <pre className="panel-inset mt-4 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-2xl p-4 font-mono text-[12px] leading-relaxed text-mut">
                {ENGRAM_PROMPT}
              </pre>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}

function Capability({ on, icon, label }: { on: boolean; icon: ReactNode; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 ${
        on ? 'border-rose/30 bg-rose/[0.06] text-txt' : 'border-line-2 text-faint line-through'
      }`}
    >
      <span className={on ? 'text-rose' : ''}>{icon}</span>
      {label}
    </span>
  )
}

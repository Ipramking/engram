import type { ReactNode } from 'react'
import { ArrowRight, Fingerprint, MessageSquare, Database, Repeat } from 'lucide-react'
import type { TabId } from './types'
import { MEMORY_TYPES } from './data'
import { Button, PageHeader, Panel, TYPE_META, TypeBadge } from './ui'

const EXAMPLES: Record<string, string> = {
  decision: 'Moved the database to Neon Postgres on 3 Aug because Render’s free tier expired.',
  config: 'DATABASE_URL is set in the Render dashboard, not in .env.',
  gotcha: 'The Supabase CLI has no Windows binary on npm — use the standalone .exe.',
  person: 'Adaeze leads frontend, prefers Tailwind v4, works on WAT.',
  preference: 'Every screen must work on both phone and desktop.',
  plan: 'Launch: 1) publish the CLI, 2) open signups, 3) post the demo video.',
}

const TROUBLE: Array<{ q: string; a: ReactNode; go?: { tab: TabId; label: string } }> = [
  {
    q: '“Unauthorized” or “authentication required to access memory”',
    a: (
      <>
        The app's key no longer works. Connection links expire 30 days after you copy them, and revoked keys stop at once. Open
        Keys, press <b>Test</b> on the key, then create a <b>permanent key</b> and paste the new link into the app. Restart the app
        afterwards so it picks up the change.
      </>
    ),
    go: { tab: 'keys', label: 'Open Keys' },
  },
  {
    q: 'Recall misses things I saved in another app',
    a: (
      <>
        The app is probably set up with the old <code>npx engram-walrus --key=…</code> command. The npm release (0.1.0) ignores the
        key and uses a separate local store, so it can't see your cloud memory. Replace it with the connection link from the Connect
        guide. Also search with the words you used when saving — recall matches wording, not just meaning.
      </>
    ),
    go: { tab: 'connect', label: 'Fix the setup' },
  },
  {
    q: 'Engram doesn’t show up in the app’s tools',
    a: (
      <>
        Quit the app completely and reopen it — most apps only read MCP config at start-up. Check the JSON is valid (one
        <code>mcpServers</code> block, no trailing commas). On Windows, follow the <code>cmd /c npx</code> tip in the guide and make
        sure Node.js 18+ is installed.
      </>
    ),
  },
  {
    q: 'ChatGPT won’t let me add a connector',
    a: <>Custom connectors need Developer mode, which is only on paid plans in the web app. Use the custom-instructions method instead — it works on every plan and on phones.</>,
  },
  {
    q: 'My new memory is marked “replaced”',
    a: <>Engram marks an older memory as replaced when a newer one on the same topic contradicts it. Turn on <b>Show replaced</b> in Memories to review them, and delete anything that's wrong.</>,
    go: { tab: 'memories', label: 'Open Memories' },
  },
  {
    q: 'Saves are being refused',
    a: <>You've hit today's save limit. Recall still works, and the counter resets at midnight UTC. If an agent is saving too often, tighten its memory rules.</>,
    go: { tab: 'usage', label: 'See usage' },
  },
]

export function Guide({ go }: { go: (t: TabId) => void }) {
  return (
    <div>
      <PageHeader
        eyebrow="Guide"
        title="How Engram works, in plain words"
        intro="Five minutes here saves an hour of guessing. If something isn't working, jump to Troubleshooting at the bottom."
      />

      {/* Flow */}
      <Panel className="p-5 sm:p-8">
        <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
          <FlowStep icon={<MessageSquare size={18} />} title="You tell any AI" body="“Remember that we chose Paystack for payouts.” Or it notices a decision on its own." />
          <ArrowRight className="mx-auto hidden text-faint md:block" size={18} />
          <FlowStep icon={<Database size={18} />} title="Engram stores the fact" body="As one short, typed memory in your personal or team space — never the whole chat." />
          <ArrowRight className="mx-auto hidden text-faint md:block" size={18} />
          <FlowStep icon={<Repeat size={18} />} title="Every other AI recalls it" body="Tomorrow, in Cursor or on your phone, ask “which payment provider?” and it answers." />
        </div>
      </Panel>

      <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section>
          <h2 className="font-display text-[22px] text-txt">What gets remembered</h2>
          <p className="mt-1.5 max-w-[60ch] text-[13.5px] leading-relaxed text-mut">
            Six kinds of facts that stay true for weeks. Small talk, one-off questions and secrets are left out on purpose.
          </p>
          <ul className="mt-5 space-y-2.5">
            {MEMORY_TYPES.map((t) => (
              <li key={t} className="rounded-2xl border border-line/70 bg-bg/30 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <TypeBadge type={t} />
                  <span className="text-[12.5px] text-mut">{TYPE_META[t].hint}</span>
                </div>
                <p className="mt-2 text-[13px] italic leading-relaxed text-txt/85">“{EXAMPLES[t]}”</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-6">
          <Panel className="p-5 sm:p-6">
            <h2 className="font-display text-[21px] text-txt">Personal or team</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-rose/30 bg-rose/[0.05] p-4">
                <p className="text-[13.5px] font-medium text-txt">Personal</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-mut">Only you and your keys. Your preferences, side projects, how you like to work.</p>
              </div>
              <div className="rounded-2xl border border-violet/30 bg-violet/[0.06] p-4">
                <p className="text-[13.5px] font-medium text-txt">Team</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-mut">Everyone in the team. Architecture decisions, shared config, who owns what.</p>
              </div>
            </div>
            <p className="mt-3 text-[12.5px] leading-relaxed text-faint">A key belongs to one of the two, so an app connected with a team key writes to the team.</p>
          </Panel>

          <Panel className="p-5 sm:p-6">
            <h2 className="font-display text-[21px] text-txt">When does my AI save?</h2>
            <ul className="mt-3 space-y-2.5 text-[13px] leading-relaxed text-mut">
              <li><b className="font-medium text-txt">Always:</b> when you say “remember that…”, “save this” or “note that…”.</li>
              <li><b className="font-medium text-txt">On its own:</b> only if you've added the memory rules to the app's instructions. Then it saves decisions, configs and gotchas as they come up.</li>
              <li><b className="font-medium text-txt">Never:</b> passwords, API keys, seed phrases or private data — the rules forbid it and Engram filters obvious secrets.</li>
            </ul>
            <Button size="sm" className="mt-4" onClick={() => go('connect')}>
              Get the memory rules
            </Button>
          </Panel>

          <Panel className="flex gap-4 p-5 sm:p-6">
            <Fingerprint size={20} className="mt-0.5 shrink-0 text-rose" />
            <div>
              <h2 className="font-display text-[19px] text-txt">Keep your keys private</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-mut">
                Anyone with a key can read and change that memory. Never paste one into a chat, an issue or a repo. If it happens,
                revoke it on the Keys page right away and make a new one. Use one key per app so revoking is painless.
              </p>
            </div>
          </Panel>
        </section>
      </div>

      <section className="mt-12">
        <h2 className="font-display text-[24px] text-txt">Troubleshooting</h2>
        <p className="mt-1.5 text-[13.5px] text-mut">The problems people actually hit, and what fixes them.</p>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {TROUBLE.map((t) => (
            <Panel as="article" key={t.q} className="flex flex-col p-5">
              <h3 className="text-[14px] font-medium text-txt">{t.q}</h3>
              <p className="mt-2 flex-1 text-[13px] leading-relaxed text-mut [&_b]:font-medium [&_b]:text-txt [&_code]:font-mono [&_code]:text-[12px] [&_code]:text-champagne">
                {t.a}
              </p>
              {t.go && (
                <div className="mt-4">
                  <Button size="sm" variant="ghost" onClick={() => go(t.go!.tab)}>
                    {t.go.label} <ArrowRight size={13} />
                  </Button>
                </div>
              )}
            </Panel>
          ))}
        </div>
      </section>
    </div>
  )
}

function FlowStep({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-line/70 bg-bg/35 p-4">
      <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl border border-rose/30 bg-rose/10 text-rose">{icon}</div>
      <p className="font-display text-[18px] text-txt">{title}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-mut">{body}</p>
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ArrowUpRight, Download, Layers, Plus, Search, Sparkles, Trash2 } from 'lucide-react'
import type { Dashboard } from './data'
import { MEMORY_TYPES, isWalrusBlobId } from './data'
import type { Memory, MemoryStats, Scope } from './types'
import {
  Button, Callout, Confirm, CopyButton, Empty, Field, PageHeader, Segmented, Sheet, Skeleton, TYPE_META, TypeBadge,
  inputCls, relTime, useToast,
} from './ui'

const WALRUSCAN = 'https://walruscan.com/mainnet/blob/'

function download(name: string, mime: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export function Memories({ d }: { d: Dashboard }) {
  const toast = useToast()
  const [scope, setScope] = useState<Scope>('personal')
  const [teamId, setTeamId] = useState<string>('')
  const [type, setType] = useState('all')
  const [showReplaced, setShowReplaced] = useState(false)
  const [query, setQuery] = useState('')
  const [applied, setApplied] = useState('')
  const [view, setView] = useState<'list' | 'timeline'>('list')
  const [items, setItems] = useState<Memory[]>([])
  const [stats, setStats] = useState<MemoryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inspect, setInspect] = useState<Memory | null>(null)
  const [adding, setAdding] = useState(false)
  const [toDelete, setToDelete] = useState<Memory | null>(null)
  const [dupes, setDupes] = useState<Memory[] | null>(null)
  const [busy, setBusy] = useState(false)

  const effectiveTeam = teamId || d.teams[0]?.id || ''

  const load = useCallback(async () => {
    if (scope === 'team' && !effectiveTeam) {
      setItems([])
      setStats(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const r = await d.listMemories({ scope, teamId: effectiveTeam, type, includeSuperseded: showReplaced, search: applied })
    if (r.ok) {
      setItems(r.memories)
      setStats(r.stats)
    } else setError(r.error)
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, effectiveTeam, type, showReplaced, applied, d.listMemories])

  useEffect(() => {
    load()
  }, [load])

  function search(e: FormEvent) {
    e.preventDefault()
    setApplied(query)
  }

  function findDupes() {
    const seen = new Set<string>()
    const out: Memory[] = []
    for (const m of items.filter((x) => !x.isSuperseded)) {
      const k = m.text.trim().toLowerCase()
      if (seen.has(k)) out.push(m)
      else seen.add(k)
    }
    if (!out.length) toast(`No exact duplicates among the ${items.length} memories shown.`, 'info')
    else setDupes(out)
  }

  async function removeDupes() {
    if (!dupes) return
    setBusy(true)
    let n = 0
    for (const m of dupes) if ((await d.deleteMemory(m.id)).ok) n++
    setBusy(false)
    setDupes(null)
    toast(`Removed ${n} duplicate${n === 1 ? '' : 's'}.`)
    load()
  }

  async function remove() {
    if (!toDelete) return
    setBusy(true)
    const r = await d.deleteMemory(toDelete.id)
    setBusy(false)
    if (r.ok) {
      setItems((xs) => xs.filter((x) => x.id !== toDelete.id))
      setInspect(null)
      toast('Memory deleted.')
    } else toast(r.error, 'error')
    setToDelete(null)
  }

  function exportAs(fmt: 'json' | 'md') {
    if (!items.length) return
    const stamp = new Date().toISOString().slice(0, 10)
    if (fmt === 'json') return download(`engram-${scope}-${stamp}.json`, 'application/json', JSON.stringify(items, null, 2))
    const body = items
      .map((m, i) => {
        const proof = isWalrusBlobId(m.blobId) ? `\n- Walrus blob: ${WALRUSCAN}${m.blobId}` : ''
        return `### ${i + 1}. ${TYPE_META[m.type]?.label || m.type}${m.isSuperseded ? ' (replaced)' : ''}\n${m.text}\n- Saved: ${m.createdAt || 'unknown'}${proof}\n`
      })
      .join('\n')
    download(`engram-${scope}-${stamp}.md`, 'text/markdown', `# Engram memories — ${scope}\nExported ${new Date().toISOString()}\n\n${body}`)
  }

  const byDay = items.reduce<Record<string, Memory[]>>((acc, m) => {
    const k = m.createdAt ? new Date(m.createdAt).toDateString() : 'Unknown date'
    ;(acc[k] ||= []).push(m)
    return acc
  }, {})

  return (
    <div>
      <PageHeader
        eyebrow="Memories"
        title="Everything your AIs remember"
        intro="Search, check and clean up what Engram knows. When a new decision contradicts an old one, Engram marks the old one as replaced rather than deleting it, so you can see how your thinking changed."
        actions={
          <>
            <Button variant="primary" onClick={() => setAdding(true)}>
              <Plus size={15} /> Add memory
            </Button>
            <Button onClick={findDupes} disabled={!items.length}>
              <Sparkles size={14} /> Find duplicates
            </Button>
            <Button onClick={() => exportAs('md')} disabled={!items.length} aria-label="Export as Markdown">
              <Download size={14} /> .md
            </Button>
            <Button onClick={() => exportAs('json')} disabled={!items.length} aria-label="Export as JSON">
              <Download size={14} /> .json
            </Button>
          </>
        }
      />

      {/* Toolbar */}
      <div className="panel mb-5 space-y-3 rounded-[22px] p-3.5 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              ariaLabel="Memory scope"
              value={scope}
              onChange={setScope}
              options={[
                { id: 'personal', label: 'Personal' },
                { id: 'team', label: 'Team' },
              ]}
            />
            {scope === 'team' && d.teams.length > 1 && (
              <select
                aria-label="Team"
                value={effectiveTeam}
                onChange={(e) => setTeamId(e.target.value)}
                className="ring-focus h-10 rounded-2xl border border-line-2 bg-bg/80 px-3 text-[13px] text-txt"
              >
                {d.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <form onSubmit={search} className="relative min-w-0 flex-1">
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                if (!e.target.value) setApplied('')
              }}
              placeholder="Search memories — press Enter"
              aria-label="Search memories"
              className={`${inputCls} h-10 py-0 pl-10`}
            />
          </form>
          <Segmented
            ariaLabel="View"
            value={view}
            onChange={setView}
            options={[
              { id: 'list', label: 'List' },
              { id: 'timeline', label: 'Timeline' },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
            {['all', ...MEMORY_TYPES].map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={type === t}
                onClick={() => setType(t)}
                className={`ring-focus shrink-0 rounded-xl border px-3 py-1.5 text-[12px] transition ${
                  type === t ? 'border-rose/50 bg-rose/10 text-txt' : 'border-line-2 text-mut hover:text-txt'
                }`}
              >
                {t === 'all' ? 'All types' : TYPE_META[t].label}
              </button>
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-mut">
            <input
              type="checkbox"
              checked={showReplaced}
              onChange={(e) => setShowReplaced(e.target.checked)}
              className="h-4 w-4 accent-[#e4a79c]"
            />
            Show replaced
          </label>
        </div>
      </div>

      {stats && !loading && (
        <p className="tabular mb-4 font-mono text-[11.5px] text-faint">
          {stats.active} active{showReplaced ? ` · ${stats.superseded} replaced` : ''}
          {applied && ` · matching “${applied}”`}
        </p>
      )}

      {error ? (
        <Callout tone="warn" title="Couldn't load memories" action={<Button size="sm" onClick={load}>Retry</Button>}>
          {error}
        </Callout>
      ) : scope === 'team' && !effectiveTeam ? (
        <Empty icon={<Layers size={20} />} title="No team yet">
          Team memory is shared by everyone in a team. Create one on the Teams page, then switch back here.
        </Empty>
      ) : loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Empty
          icon={<Layers size={20} />}
          title={applied || type !== 'all' ? 'Nothing matches' : 'No memories yet'}
          action={<Button variant="primary" onClick={() => setAdding(true)}><Plus size={14} /> Add memory</Button>}
        >
          {applied || type !== 'all'
            ? 'Try a broader search or another type.'
            : 'Connect an app and say “remember that…”, or add your first memory here.'}
        </Empty>
      ) : view === 'list' ? (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((m) => (
            <MemoryCard key={m.id} m={m} onOpen={() => setInspect(m)} />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(byDay).map(([day, ms]) => (
            <section key={day}>
              <h3 className="eyebrow mb-3">{day}</h3>
              <ol className="relative space-y-3 border-l border-line-2 pl-5">
                {ms.map((m) => (
                  <li key={m.id} className="relative">
                    <span
                      className="absolute -left-[25px] top-4 h-2.5 w-2.5 rounded-full ring-4 ring-bg"
                      style={{ background: TYPE_META[m.type]?.color || '#e4a79c' }}
                    />
                    <MemoryCard m={m} onOpen={() => setInspect(m)} />
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}

      <Inspector m={inspect} onClose={() => setInspect(null)} onDelete={(m) => setToDelete(m)} />

      <AddMemory
        open={adding}
        onClose={() => setAdding(false)}
        d={d}
        defaultScope={scope}
        defaultTeam={effectiveTeam}
        onSaved={() => {
          setAdding(false)
          load()
        }}
      />

      <Confirm
        open={Boolean(toDelete)}
        title="Delete this memory?"
        confirmLabel="Delete"
        busy={busy}
        onConfirm={remove}
        onClose={() => setToDelete(null)}
      >
        Connected apps won't recall it any more. This can't be undone.
        <blockquote className="mt-3 rounded-xl border border-line-2 bg-bg/50 p-3 text-txt">{toDelete?.text}</blockquote>
      </Confirm>

      <Confirm
        open={Boolean(dupes)}
        title={`Remove ${dupes?.length || 0} duplicate${dupes?.length === 1 ? '' : 's'}?`}
        confirmLabel="Remove duplicates"
        busy={busy}
        onConfirm={removeDupes}
        onClose={() => setDupes(null)}
      >
        These memories have exactly the same text as another one. The oldest copy of each stays.
      </Confirm>
    </div>
  )
}

function MemoryCard({ m, onOpen }: { m: Memory; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`ring-focus panel group block w-full rounded-[20px] p-4 text-left transition duration-200 hover:border-rose/35 sm:p-5 ${
        m.isSuperseded ? 'opacity-60' : ''
      }`}
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TypeBadge type={m.type} />
          {m.isSuperseded && <span className="font-mono text-[10.5px] uppercase tracking-wider text-faint">replaced</span>}
        </div>
        <span className="tabular font-mono text-[11px] text-faint">{relTime(m.createdAt)}</span>
      </div>
      <p className={`line-clamp-4 text-[13.5px] leading-relaxed text-txt/90 ${m.isSuperseded ? 'line-through decoration-faint' : ''}`}>
        {m.text}
      </p>
    </button>
  )
}

function Inspector({ m, onClose, onDelete }: { m: Memory | null; onClose: () => void; onDelete: (m: Memory) => void }) {
  if (!m) return null
  const onWalrus = isWalrusBlobId(m.blobId)
  const rows: Array<[string, ReactNode]> = [
    ['Type', <TypeBadge type={m.type} />],
    ['Status', m.isSuperseded ? 'Replaced by a newer memory' : 'Active — apps recall this'],
    ['Saved', m.createdAt ? new Date(m.createdAt).toLocaleString() : 'Unknown'],
    [
      'Stored in',
      onWalrus ? (
        <a className="inline-flex items-center gap-1 text-rose hover:underline" href={`${WALRUSCAN}${m.blobId}`} target="_blank" rel="noreferrer">
          Walrus mainnet <ArrowUpRight size={12} />
        </a>
      ) : (
        'Engram cloud database'
      ),
    ],
    ['Memory ID', <span className="break-all font-mono text-[12px]">{m.id}</span>],
  ]
  if (m.supersededBy) rows.push(['Replaced by', <span className="break-all font-mono text-[12px]">{m.supersededBy}</span>])

  return (
    <Sheet
      open
      onClose={onClose}
      eyebrow="Memory details"
      title={TYPE_META[m.type]?.label || 'Memory'}
      footer={
        <div className="flex gap-2">
          <CopyButton value={m.text} label="Copy text" size="md" className="flex-1" />
          <Button variant="danger" onClick={() => onDelete(m)}>
            <Trash2 size={14} /> Delete
          </Button>
        </div>
      }
    >
      <p className={`whitespace-pre-wrap text-[15px] leading-relaxed text-txt ${m.isSuperseded ? 'line-through decoration-faint' : ''}`}>
        {m.text}
      </p>
      <p className="mt-3 text-[12.5px] leading-relaxed text-faint">{TYPE_META[m.type]?.hint}.</p>
      <dl className="mt-6 divide-y divide-line/70 rounded-2xl border border-line/70">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 px-4 py-3 text-[13px]">
            <dt className="text-faint">{k}</dt>
            <dd className="min-w-0 text-txt">{v}</dd>
          </div>
        ))}
      </dl>
      {!onWalrus && (
        <p className="mt-4 text-[12px] leading-relaxed text-faint">
          This memory lives in Engram's cloud database. Only memories written through the Walrus bridge have an on-chain blob you can verify.
        </p>
      )}
    </Sheet>
  )
}

function AddMemory({
  open,
  onClose,
  onSaved,
  d,
  defaultScope,
  defaultTeam,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  d: Dashboard
  defaultScope: Scope
  defaultTeam: string
}) {
  const toast = useToast()
  const [text, setText] = useState('')
  const [type, setType] = useState('decision')
  const [scope, setScope] = useState<Scope>(defaultScope)
  const [teamId, setTeamId] = useState(defaultTeam)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setScope(defaultScope)
      setTeamId(defaultTeam)
      setError(null)
    }
  }, [open, defaultScope, defaultTeam])

  const looksSecret = /(sk-|gsk_|eng_(usr|live)_|AKIA|-----BEGIN|password\s*[:=])/i.test(text)

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setSaving(true)
    setError(null)
    const r = await d.saveMemory({ text: text.trim(), type, scope, teamId: scope === 'team' ? teamId : undefined })
    setSaving(false)
    if (!r.ok) return setError(r.error)
    setText('')
    toast(r.superseded.length ? 'Saved. It replaced an older memory on the same topic.' : 'Memory saved.')
    onSaved()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow="New memory"
      title="Add a memory"
      footer={
        <div className="flex gap-2">
          <Button className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" variant="primary" type="submit" form="add-memory" disabled={saving || !text.trim() || (scope === 'team' && !teamId)}>
            {saving ? 'Saving…' : 'Save memory'}
          </Button>
        </div>
      }
    >
      <form id="add-memory" onSubmit={save} className="space-y-5">
        <Field label="What should your AIs remember?" hint="One self-contained sentence. Include the reason and, for decisions, the date.">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="We chose Paystack over Flutterwave on 3 Nov because payouts settle next day."
            className={`${inputCls} resize-none`}
          />
        </Field>
        {looksSecret && (
          <Callout tone="warn" title="This looks like a secret">
            Don't store passwords or API keys in memory. Save where the secret lives instead, e.g. “Stripe key is in Vercel env”.
          </Callout>
        )}
        <div>
          <span className="mb-2 block text-[12.5px] font-medium text-txt">Type</span>
          <div className="grid grid-cols-2 gap-2">
            {MEMORY_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={type === t}
                onClick={() => setType(t)}
                className={`ring-focus rounded-2xl border px-3 py-2.5 text-left transition ${
                  type === t ? 'border-rose/50 bg-rose/[0.07]' : 'border-line-2 hover:border-line-2 hover:bg-surface/50'
                }`}
              >
                <span className="block text-[13px] text-txt">{TYPE_META[t].label}</span>
                <span className="block text-[11.5px] leading-snug text-faint">{TYPE_META[t].hint}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="mb-2 block text-[12.5px] font-medium text-txt">Who can recall it</span>
          <Segmented
            ariaLabel="Scope"
            value={scope}
            onChange={setScope}
            options={[
              { id: 'personal', label: 'Only me' },
              { id: 'team', label: 'My team' },
            ]}
          />
          {scope === 'team' &&
            (d.teams.length ? (
              <select
                aria-label="Team"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className={`${inputCls} mt-3`}
              >
                {d.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="mt-2 text-[12.5px] text-faint">You aren't in a team yet. Create one on the Teams page.</p>
            ))}
        </div>
        {error && <p className="text-[13px] text-rose">{error}</p>}
      </form>
    </Sheet>
  )
}


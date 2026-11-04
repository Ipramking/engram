import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Plus, UserPlus, Users } from 'lucide-react'
import type { Dashboard } from './data'
import type { Team, TeamMember } from './types'
import { Button, Empty, Field, PageHeader, Panel, Sheet, Skeleton, Steps, fmtDate, inputCls, useToast } from './ui'

const FREE_SEATS = 3

export function Teams({ d, onCreateKey }: { d: Dashboard; onCreateKey: () => void }) {
  const toast = useToast()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [email, setEmail] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)

  const team: Team | undefined = d.teams.find((t) => t.id === selectedId) || d.teams[0]
  const seats = d.usage?.teams.find((t) => t.teamId === team?.id)?.maxMembers || FREE_SEATS
  const full = members.length >= seats

  useEffect(() => {
    if (!team) return
    let live = true
    setMembersLoading(true)
    d.loadMembers(team.id).then((m) => {
      if (live) {
        setMembers(m)
        setMembersLoading(false)
      }
    })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team?.id])

  async function invite(e: FormEvent) {
    e.preventDefault()
    if (!team || !email.trim()) return
    setInviting(true)
    setInviteError(null)
    const r = await d.invite(team.id, email.trim(), 'member')
    setInviting(false)
    if (!r.ok) return setInviteError(r.error)
    toast(`Added ${email.trim()} to ${team.name}.`)
    setEmail('')
    setMembers(await d.loadMembers(team.id))
  }

  return (
    <div>
      <PageHeader
        eyebrow="Teams"
        title="A shared memory for people who build together"
        intro="Team memory is separate from your personal memory. Everyone in the team, and every app they connect with a team key, reads and writes the same pool."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={15} /> New team
          </Button>
        }
      />

      <Panel className="mb-6 p-5 sm:p-6">
        <p className="eyebrow mb-3">How teams work</p>
        <Steps
          items={[
            <><b>Create a team</b> and give it the project's name.</>,
            <><b>Add teammates by email.</b> They need an Engram account with that email first.</>,
            <>Each person makes a <b>team key</b> (Keys → New key → A team memory) and connects their apps with it.</>,
            <>Decisions any of you save are then recalled by everyone's AI. Personal memories stay private.</>,
          ]}
        />
      </Panel>

      {d.loading ? (
        <Skeleton className="h-48" />
      ) : d.teams.length === 0 ? (
        <Empty icon={<Users size={20} />} title="No teams yet" action={<Button variant="primary" onClick={() => setCreating(true)}><Plus size={14} /> Create a team</Button>}>
          The free plan includes teams of up to {FREE_SEATS} people.
        </Empty>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
          <nav aria-label="Your teams" className="space-y-1.5">
            {d.teams.map((t) => {
              const on = t.id === team?.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  aria-current={on}
                  className={`ring-focus flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition ${
                    on ? 'border-violet/40 bg-violet/[0.08]' : 'border-transparent hover:border-line-2 hover:bg-surface/50'
                  }`}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-violet/30 bg-violet/10 font-display text-violet-soft">
                    {t.name[0]?.toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-medium text-txt">{t.name}</span>
                    <span className="block text-[12px] text-faint">Since {fmtDate(t.created_at)}</span>
                  </span>
                </button>
              )
            })}
          </nav>

          {team && (
            <Panel as="article" className="p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line/70 pb-5">
                <div>
                  <h2 className="font-display text-[26px] leading-tight text-txt">{team.name}</h2>
                  <p className="mt-1 text-[13px] text-mut">Free team plan · shared memory pool</p>
                </div>
                <div className="text-right">
                  <p className="tabular font-display text-[26px] leading-none text-txt">
                    {members.length}
                    <span className="font-sans text-[13px] text-faint"> / {seats}</span>
                  </p>
                  <p className="eyebrow mt-1">seats used</p>
                </div>
              </div>

              <div className="mt-5">
                <p className="eyebrow mb-3">Members</p>
                {membersLoading ? (
                  <Skeleton className="h-24" />
                ) : (
                  <ul className="space-y-2">
                    {members.map((m) => (
                      <li key={m.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line/70 bg-bg/35 px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-surface-2 font-mono text-[12px] uppercase text-mut">
                            {m.email[0]}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[13.5px] text-txt">{m.email}</p>
                            <p className="text-[11.5px] text-faint">Joined {fmtDate(m.created_at)}</p>
                          </div>
                        </div>
                        <span className="shrink-0 font-mono text-[10.5px] uppercase tracking-wider text-mut">{m.role}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <form onSubmit={invite} className="mt-6 border-t border-line/70 pt-5">
                <Field
                  label="Add a teammate"
                  hint={full ? `This team has used all ${seats} free seats.` : 'They need an Engram account with this email.'}
                >
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="teammate@studio.ng"
                      disabled={full}
                      className={`${inputCls} flex-1`}
                    />
                    <Button type="submit" variant="primary" disabled={full || inviting || !email.trim()}>
                      <UserPlus size={14} /> {inviting ? 'Adding…' : 'Add'}
                    </Button>
                  </div>
                </Field>
                {inviteError && <p className="mt-2 text-[13px] text-rose">{inviteError}</p>}
              </form>

              <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-line/70 bg-bg/35 p-4 sm:flex-row sm:items-center">
                <p className="flex-1 text-[13px] leading-relaxed text-mut">
                  Next: make a team key so your apps can use <b className="font-medium text-txt">{team.name}</b>'s memory.
                </p>
                <Button size="sm" onClick={onCreateKey}>
                  Create team key
                </Button>
              </div>
            </Panel>
          )}
        </div>
      )}

      <CreateTeam open={creating} onClose={() => setCreating(false)} d={d} onCreated={(t) => setSelectedId(t.id)} />
    </div>
  )
}

function CreateTeam({ open, onClose, d, onCreated }: { open: boolean; onClose: () => void; d: Dashboard; onCreated: (t: Team) => void }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    const r = await d.createTeam(name.trim())
    setBusy(false)
    if (!r.ok) return setError(r.error)
    toast(`Created ${r.team.name}.`)
    setName('')
    onCreated(r.team)
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow="New team"
      title="Create a team"
      footer={
        <div className="flex gap-2">
          <Button className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" variant="primary" type="submit" form="create-team" disabled={busy || !name.trim()}>
            {busy ? 'Creating…' : 'Create team'}
          </Button>
        </div>
      }
    >
      <form id="create-team" onSubmit={submit} className="space-y-4">
        <Field label="Team name" hint="Usually the project or product you work on together.">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lagos Life studio" maxLength={60} className={inputCls} />
        </Field>
        {error && <p className="text-[13px] text-rose">{error}</p>}
      </form>
    </Sheet>
  )
}

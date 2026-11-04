import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Activity, KeyRound, Plus, Trash2 } from 'lucide-react'
import type { Dashboard } from './data'
import { liveKeyExpiry, maskSecret } from './data'
import type { ApiKey, Scope } from './types'
import {
  Button, Callout, CodeBlock, Confirm, CopyButton, Empty, Field, PageHeader, Panel, Segmented, Sheet, Skeleton,
  fmtDate, inputCls, relTime, useToast,
} from './ui'

const NAME_IDEAS = ['Laptop · Cursor', 'Phone · Claude', 'Claude Code', 'ChatGPT', 'Work desktop']

export function Keys({ d, onCreateKey }: { d: Dashboard; onCreateKey: () => void }) {
  const toast = useToast()
  const [revoking, setRevoking] = useState<ApiKey | null>(null)
  const [busy, setBusy] = useState(false)
  const [tests, setTests] = useState<Record<string, string>>({})

  async function revoke() {
    if (!revoking) return
    setBusy(true)
    const r = await d.revokeKey(revoking.id)
    setBusy(false)
    toast(r.ok ? `Revoked “${revoking.name}”. Apps using it are disconnected.` : r.error, r.ok ? 'ok' : 'error')
    setRevoking(null)
  }

  async function test(k: ApiKey) {
    setTests((t) => ({ ...t, [k.id]: 'Testing…' }))
    const r = await d.testConnection(k.connectorUrl)
    setTests((t) => ({ ...t, [k.id]: r.ok ? `Working · ${r.ms} ms` : `Failed · ${r.error}` }))
  }

  return (
    <div>
      <PageHeader
        eyebrow="Keys"
        title="Keys decide who can read and write your memory"
        intro="Make one key per app or device. If a laptop is lost or a key ends up in a chat, revoke just that key and nothing else breaks."
        actions={
          <Button variant="primary" onClick={onCreateKey}>
            <Plus size={15} /> New key
          </Button>
        }
      />

      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <Panel className="p-5">
          <p className="eyebrow">Connection link</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-mut">
            The link each key shows below is <b className="font-medium text-txt">valid for 30 days</b> from when you copy it. Fine
            for trying things out. Copy it again from here when it runs out.
          </p>
        </Panel>
        <Panel className="p-5">
          <p className="eyebrow">Permanent key</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-mut">
            Shown <b className="font-medium text-txt">once</b>, when you create it. It never expires until you revoke it — use it for
            config files and apps you keep.
          </p>
        </Panel>
      </div>

      {d.loading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : d.keys.length === 0 ? (
        <Empty icon={<KeyRound size={20} />} title="No keys yet" action={<Button variant="primary" onClick={onCreateKey}><Plus size={14} /> Create a key</Button>}>
          A key connects an app to your memory. Create one for the first app you want to use.
        </Empty>
      ) : (
        <ul className="space-y-3">
          {d.keys.map((k) => {
            const exp = liveKeyExpiry(k.liveKey)
            const isActive = d.credential?.key.id === k.id
            return (
              <li key={k.id}>
                <Panel as="article" className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-[15px] font-medium text-txt">{k.name}</h3>
                        <span
                          className={`rounded-lg border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider ${
                            k.scope === 'team' ? 'border-violet/35 text-violet-soft' : 'border-rose/35 text-rose'
                          }`}
                        >
                          {k.scope}
                        </span>
                        {isActive && <span className="font-mono text-[10.5px] uppercase tracking-wider text-faint">used in guides</span>}
                      </div>
                      <dl className="tabular mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-faint">
                        <div>
                          <dt className="inline">Key </dt>
                          <dd className="inline font-mono text-mut">{maskSecret(k.key_prefix, 14)}</dd>
                        </div>
                        <div>
                          <dt className="inline">Created </dt>
                          <dd className="inline text-mut">{fmtDate(k.created_at)}</dd>
                        </div>
                        <div>
                          <dt className="inline">Last used </dt>
                          <dd className="inline text-mut">{relTime(k.last_used_at)}</dd>
                        </div>
                        {exp && (
                          <div>
                            <dt className="inline">Link valid to </dt>
                            <dd className="inline text-mut">{fmtDate(exp)}</dd>
                          </div>
                        )}
                      </dl>
                      {tests[k.id] && <p className="mt-2 font-mono text-[11.5px] text-mut" role="status">{tests[k.id]}</p>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <CopyButton value={k.connectorUrl} label="Copy link" />
                      <Button size="sm" onClick={() => test(k)}>
                        <Activity size={13} /> Test
                      </Button>
                      {!isActive && (
                        <Button size="sm" variant="ghost" onClick={() => d.setActiveKeyId(k.id)}>
                          Use in guides
                        </Button>
                      )}
                      <Button size="sm" variant="danger" onClick={() => setRevoking(k)} aria-label={`Revoke ${k.name}`}>
                        <Trash2 size={13} /> Revoke
                      </Button>
                    </div>
                  </div>
                </Panel>
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-6">
        <Callout tone="warn" title="Keep keys out of chats and repos">
          Anyone with a key or link can read and change that memory. If one is pasted into a chat, an issue or a commit, revoke it here
          straight away and create a new one.
        </Callout>
      </div>

      <Confirm
        open={Boolean(revoking)}
        title={`Revoke “${revoking?.name}”?`}
        confirmLabel="Revoke key"
        busy={busy}
        onConfirm={revoke}
        onClose={() => setRevoking(null)}
      >
        Every app using this key or its link stops connecting immediately. Your memories are not deleted.
      </Confirm>
    </div>
  )
}

export function CreateKeySheet({ open, onClose, d }: { open: boolean; onClose: () => void; d: Dashboard }) {
  const [name, setName] = useState('')
  const [scope, setScope] = useState<Scope>('personal')
  const [teamId, setTeamId] = useState('')
  const [room, setRoom] = useState('my-space')
  const [advanced, setAdvanced] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ rawKey: string; connectorUrl: string } | null>(null)

  useEffect(() => {
    if (open) {
      setName('')
      setScope('personal')
      setTeamId(d.teams[0]?.id || '')
      setRoom('my-space')
      setAdvanced(false)
      setError(null)
      setCreated(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    const r = await d.createKey({ name: name.trim(), scope, teamId, room: room.trim() || 'my-space' })
    setSaving(false)
    if (r.ok) setCreated({ rawKey: r.rawKey, connectorUrl: r.connectorUrl })
    else setError(r.error)
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow={created ? 'Key created' : 'New key'}
      title={created ? 'Copy it now' : 'Create a permanent key'}
      footer={
        created ? (
          <Button variant="primary" className="w-full" onClick={onClose}>
            I've copied it
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              variant="primary"
              type="submit"
              form="create-key"
              disabled={saving || !name.trim() || (scope === 'team' && !teamId)}
            >
              {saving ? 'Creating…' : 'Create key'}
            </Button>
          </div>
        )
      }
    >
      {created ? (
        <div className="space-y-4">
          <Callout tone="ok" title="This is the only time you'll see this key">
            Engram stores only a fingerprint of it. The setup guides now use this key until you leave the page.
          </Callout>
          <CodeBlock label="Permanent key" display={maskSecret(created.rawKey, 16)} value={created.rawKey} />
          <CodeBlock label="Connection link (never expires)" display={created.connectorUrl.replace(created.rawKey, maskSecret(created.rawKey, 16)).replace(encodeURIComponent(created.rawKey), maskSecret(created.rawKey, 16))} value={created.connectorUrl} wrap />
          <p className="text-[12.5px] leading-relaxed text-faint">
            Store it in your password manager or straight in the app's config. Don't paste it into a chat.
          </p>
        </div>
      ) : (
        <form id="create-key" onSubmit={submit} className="space-y-5">
          <Field label="Where will you use it?" hint="A name that tells you which app or device to disconnect if you revoke it.">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Laptop · Cursor" maxLength={60} className={inputCls} />
          </Field>
          <div className="-mt-2 flex flex-wrap gap-1.5">
            {NAME_IDEAS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setName(n)}
                className="ring-focus rounded-lg border border-line-2 px-2.5 py-1 text-[11.5px] text-mut transition hover:text-txt"
              >
                {n}
              </button>
            ))}
          </div>
          <div>
            <span className="mb-2 block text-[12.5px] font-medium text-txt">Which memory can it use?</span>
            <Segmented
              ariaLabel="Key scope"
              value={scope}
              onChange={setScope}
              options={[
                { id: 'personal', label: 'My personal memory' },
                { id: 'team', label: 'A team memory' },
              ]}
            />
            {scope === 'team' &&
              (d.teams.length ? (
                <select aria-label="Team" value={teamId} onChange={(e) => setTeamId(e.target.value)} className={`${inputCls} mt-3`}>
                  {d.teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="mt-2 text-[12.5px] text-faint">Create a team on the Teams page first.</p>
              ))}
          </div>
          <div>
            <button type="button" onClick={() => setAdvanced((a) => !a)} className="text-[12.5px] text-mut underline-offset-2 hover:text-txt hover:underline">
              {advanced ? 'Hide advanced' : 'Advanced: room'}
            </button>
            {advanced && (
              <div className="mt-3">
                <Field label="Room" hint="Rooms split one memory into separate shelves. Leave it as my-space unless you need isolation per project.">
                  <input value={room} onChange={(e) => setRoom(e.target.value)} className={`${inputCls} font-mono`} />
                </Field>
              </div>
            )}
          </div>
          {error && <p className="text-[13px] text-rose">{error}</p>}
        </form>
      )}
    </Sheet>
  )
}

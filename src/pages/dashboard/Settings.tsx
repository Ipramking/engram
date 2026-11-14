import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Check, Download, Eye, EyeOff, KeyRound, LifeBuoy, LogOut, ShieldCheck, Trash2, UserRound } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import type { Dashboard } from './data'
import type { TabId } from './types'
import { Button, Callout, Confirm, Field, PageHeader, Panel, Sheet, inputCls, useToast } from './ui'
import { downloadMemories } from './exportFile'

const REPO = 'https://github.com/Ipramking/engram'

function Section({
  icon,
  title,
  hint,
  danger = false,
  children,
}: {
  icon: ReactNode
  title: string
  hint: ReactNode
  danger?: boolean
  children: ReactNode
}) {
  return (
    <Panel className={`p-5 sm:p-6 ${danger ? 'border-rose-deep/40' : ''}`}>
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-bg/60 text-rose">{icon}</span>
        <div className="min-w-0">
          <h2 className="font-display text-[20px] leading-tight text-txt">{title}</h2>
          <p className="mt-1 max-w-[62ch] text-[13px] leading-relaxed text-mut">{hint}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </Panel>
  )
}

export function Settings({ d, go, onSignOut }: { d: Dashboard; go: (t: TabId) => void; onSignOut: () => void }) {
  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Your account"
        intro="Your profile, password and sign-in. Connected apps and keys are on the Keys page; limits and plans are under Usage."
      />
      <div className="grid max-w-3xl gap-5">
        <ProfileSection d={d} />
        <PasswordSection d={d} />
        <SecuritySection d={d} go={go} onSignOut={onSignOut} />
        <DataSection d={d} />
        <HelpSection />
        <DeleteSection d={d} go={go} />
      </div>
    </div>
  )
}

/* ── Profile ── */

function ProfileSection({ d }: { d: Dashboard }) {
  const { user, refreshUser } = useAuth()
  const toast = useToast()
  const saved = user?.name ?? ''
  const [name, setName] = useState(saved)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clean = name.replace(/\s+/g, ' ').trim()
  const dirty = clean.length > 0 && clean !== saved
  const plan = (d.usage?.plan || user?.plan_tier || 'free_personal').replace(/_/g, ' ')

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!dirty || busy) return
    setBusy(true)
    setError(null)
    const r = await d.updateProfile(clean)
    setBusy(false)
    if (!r.ok) return setError(r.error)
    await refreshUser()
    setName(clean)
    toast('Name updated.')
  }

  return (
    <Section icon={<UserRound size={17} />} title="Profile" hint="How Engram greets you. Your email is what you sign in with.">
      <form onSubmit={save} className="space-y-4">
        <Field label="Email" hint="Used to sign in. Changing it isn't supported yet.">
          <input value={user?.email ?? ''} readOnly aria-readonly className={`${inputCls} cursor-default text-mut`} />
        </Field>
        <Field label="Display name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            autoComplete="name"
            className={inputCls}
          />
        </Field>
        {error && (
          <p role="alert" className="text-[13px] text-rose">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-mono text-[11px] uppercase tracking-wider text-faint">{plan} plan</span>
          <Button variant="primary" type="submit" disabled={!dirty || busy}>
            {busy ? 'Saving…' : 'Save name'}
          </Button>
        </div>
      </form>
    </Section>
  )
}

/* ── Password ── */

function PasswordSection({ d }: { d: Dashboard }) {
  const { user } = useAuth()
  const toast = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const rules = [
    { ok: next.length >= 8 && next.length <= 128, label: '8 to 128 characters' },
    { ok: next.length > 0 && next !== current, label: 'Different from your current password' },
    { ok: next.length > 0 && next === again, label: 'Both new passwords match' },
  ]
  const ready = current.length > 0 && rules.every((r) => r.ok)
  const type = show ? 'text' : 'password'

  // Typing again clears the previous result.
  const edit = (set: (v: string) => void) => (e: { target: { value: string } }) => {
    set(e.target.value)
    setError(null)
    setDone(false)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!ready || busy) return
    setBusy(true)
    setError(null)
    setDone(false)
    const r = await d.changePassword(current, next)
    setBusy(false)
    if (!r.ok) {
      if (r.wrongPassword) setCurrent('')
      return setError(r.error)
    }
    setCurrent('')
    setNext('')
    setAgain('')
    setShow(false)
    setDone(true)
    toast('Password changed.')
  }

  return (
    <Section
      icon={<ShieldCheck size={17} />}
      title="Password"
      hint="Pick something you don't use anywhere else. A password manager is the easiest way to keep it."
    >
      <form onSubmit={submit} className="space-y-4">
        {/* Lets password managers file the new password under the right account. */}
        <input type="text" name="username" autoComplete="username" value={user?.email ?? ''} readOnly tabIndex={-1} aria-hidden className="sr-only" />
        <Field label="Current password">
          <input
            type={type}
            value={current}
            onChange={edit(setCurrent)}
            autoComplete="current-password"
            maxLength={128}
            className={inputCls}
          />
        </Field>
        <Field label="New password">
          <input type={type} value={next} onChange={edit(setNext)} autoComplete="new-password" maxLength={128} className={inputCls} />
        </Field>
        <Field label="Confirm new password">
          <input type={type} value={again} onChange={edit(setAgain)} autoComplete="new-password" maxLength={128} className={inputCls} />
        </Field>

        <ul className="space-y-1.5" aria-label="Password rules">
          {rules.map((r) => (
            <li key={r.label} className={`flex items-center gap-2 text-[12.5px] ${r.ok ? 'text-txt' : 'text-faint'}`}>
              {r.ok ? <Check size={13} className="text-rose" /> : <span aria-hidden className="ml-[3px] mr-[3px] h-1.5 w-1.5 rounded-full bg-faint/60" />}
              {r.label}
            </li>
          ))}
        </ul>

        {error && (
          <p role="alert" className="text-[13px] text-rose">
            {error}
          </p>
        )}
        {done && (
          <Callout tone="ok" title="Password changed">
            Use the new one next time you sign in. Apps connected with a key keep working, and browsers that are already signed in stay
            signed in until their session expires. If you think a key or a session was exposed, disconnect your apps below.
          </Callout>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-pressed={show}
            className="ring-focus inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-[12.5px] text-mut transition hover:text-txt"
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />} {show ? 'Hide passwords' : 'Show passwords'}
          </button>
          <Button variant="primary" type="submit" disabled={!ready || busy}>
            {busy ? 'Changing…' : 'Change password'}
          </Button>
        </div>
      </form>
    </Section>
  )
}

/* ── Sign-in and connected apps ── */

function SecuritySection({ d, go, onSignOut }: { d: Dashboard; go: (t: TabId) => void; onSignOut: () => void }) {
  const toast = useToast()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const n = d.keys.length

  async function disconnectAll() {
    setBusy(true)
    const r = await d.revokeAllKeys()
    setBusy(false)
    setConfirming(false)
    if (r.failed) toast(`Disconnected ${r.revoked}, but ${r.failed} could not be revoked. Try again.`, 'error')
    else toast(`Disconnected ${r.revoked} app${r.revoked === 1 ? '' : 's'}.`)
  }

  return (
    <Section
      icon={<KeyRound size={17} />}
      title="Sign-in and connected apps"
      hint="Every connected app, computer and phone has its own key. If a device is lost or a key may have leaked, disconnect everything and reconnect only what you use."
    >
      <div className="divide-y divide-line/70 rounded-2xl border border-line/70">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[14px] font-medium text-txt">This browser</p>
            <p className="mt-0.5 text-[12.5px] text-mut">Signing out here doesn't touch your connected apps.</p>
          </div>
          <Button onClick={onSignOut}>
            <LogOut size={14} /> Sign out
          </Button>
        </div>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[14px] font-medium text-txt">
              {d.loading ? 'Connected apps' : n === 0 ? 'No connected apps' : `${n} connected app${n === 1 ? '' : 's'}`}
            </p>
            <p className="mt-0.5 text-[12.5px] text-mut">Claude, ChatGPT, computers running the CLI, shortcuts and scripts.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => go('keys')}>Review keys</Button>
            <Button variant="danger" onClick={() => setConfirming(true)} disabled={d.loading || n === 0}>
              Disconnect all
            </Button>
          </div>
        </div>
      </div>

      <Confirm
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Disconnect every app?"
        confirmLabel={`Disconnect ${n} app${n === 1 ? '' : 's'}`}
        busy={busy}
        onConfirm={disconnectAll}
      >
        <p>
          This revokes all {n} key{n === 1 ? '' : 's'}: connectors such as Claude, keys saved by <code className="font-mono text-[12px]">engram-walrus login</code> on
          your computers, phone shortcuts and scripts. They stop working immediately.
        </p>
        <p className="mt-3">Your memories aren't touched. Reconnect an app from the Connect page when you want it back.</p>
      </Confirm>
    </Section>
  )
}

/* ── Your data ── */

function DataSection({ d }: { d: Dashboard }) {
  const toast = useToast()
  const [busy, setBusy] = useState<'json' | 'md' | null>(null)

  async function exportAll(fmt: 'json' | 'md') {
    setBusy(fmt)
    const r = await d.exportMemories({ scope: 'personal' })
    setBusy(null)
    if (!r.ok) return toast(r.error, 'error')
    if (!r.memories.length) return toast('You have no personal memories to export yet.', 'info')
    downloadMemories(r.memories, 'personal', fmt)
    toast(`Exported ${r.memories.length} memor${r.memories.length === 1 ? 'y' : 'ies'}.`)
  }

  return (
    <Section
      icon={<Download size={17} />}
      title="Your data"
      hint="Download every personal memory, replaced ones included. Team memories are exported from the Memories page."
    >
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => exportAll('md')} disabled={busy !== null}>
          <Download size={14} /> {busy === 'md' ? 'Preparing…' : 'Markdown'}
        </Button>
        <Button onClick={() => exportAll('json')} disabled={busy !== null}>
          <Download size={14} /> {busy === 'json' ? 'Preparing…' : 'JSON'}
        </Button>
      </div>
    </Section>
  )
}

/* ── Help and legal ── */

function HelpSection() {
  const link = 'ring-focus rounded-lg px-1 text-rose underline-offset-2 hover:underline'
  return (
    <Section icon={<LifeBuoy size={17} />} title="Help and legal" hint="Guides, policies and where to report a problem.">
      <ul className="grid gap-2 text-[13.5px] sm:grid-cols-2">
        <li>
          <Link to="/docs" className={link}>Documentation</Link>
        </li>
        <li>
          <Link to="/privacy" className={link}>Privacy Policy</Link>
        </li>
        <li>
          <Link to="/terms" className={link}>Terms of Service</Link>
        </li>
        <li>
          <a href={`${REPO}/issues`} target="_blank" rel="noreferrer" className={link}>Report a problem</a>
        </li>
        <li>
          <a href={`${REPO}/security/advisories/new`} target="_blank" rel="noreferrer" className={link}>Report a security issue</a>
        </li>
      </ul>
    </Section>
  )
}

/* ── Delete account ── */

function DeleteSection({ d, go }: { d: Dashboard; go: (t: TabId) => void }) {
  const { logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function deleteAccount() {
    setBusy(true)
    setError(null)
    const r = await d.deleteAccount()
    setBusy(false)
    if (!r.ok) return setError(r.error)
    await logout()
    window.location.href = '/'
  }

  return (
    <Section
      danger
      icon={<Trash2 size={17} />}
      title="Delete account"
      hint={
        <>
          Permanently deletes your account, memories, keys and connected apps. Export your memories first if you want a copy (
          <button type="button" className="text-rose underline-offset-2 hover:underline" onClick={() => go('memories')}>
            Memories → Export
          </button>
          ). Copies already written to Walrus may remain there until their storage period ends.
        </>
      }
    >
      <Button variant="danger" onClick={() => setOpen(true)}>
        <Trash2 size={14} /> Delete account
      </Button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Delete account"
        title="This can't be undone"
        footer={
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button className="flex-1" variant="danger" onClick={deleteAccount} disabled={busy || confirmText !== 'DELETE'}>
              {busy ? 'Deleting…' : 'Delete everything'}
            </Button>
          </div>
        }
      >
        <p className="text-[13.5px] leading-relaxed text-mut">
          Every app connected to Engram stops working immediately. Type <b className="font-medium text-txt">DELETE</b> to confirm.
        </p>
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="DELETE"
          aria-label="Type DELETE to confirm"
          className={`${inputCls} mt-4 font-mono`}
        />
        {error && (
          <p role="alert" className="mt-3 text-[13px] text-rose">
            {error}
          </p>
        )}
      </Sheet>
    </Section>
  )
}

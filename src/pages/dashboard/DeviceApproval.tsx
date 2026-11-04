import { useEffect, useState } from 'react'
import { Terminal } from 'lucide-react'
import type { Dashboard } from './data'
import { Button, Callout, Sheet, useToast } from './ui'

/** Approves a `engram-walrus login` request from a terminal, identified by its short code. */
export function DeviceApproval({ d, code, onDone }: { d: Dashboard; code: string; onDone: () => void }) {
  const toast = useToast()
  const [info, setInfo] = useState<{ deviceName: string; status: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    d.deviceInfo(code).then((r) => {
      if (!live) return
      if (r.ok) setInfo({ deviceName: r.deviceName, status: r.status })
      else setError(r.error)
    })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  async function decide(approve: boolean) {
    setBusy(true)
    const r = await d.decideDevice(code, approve)
    setBusy(false)
    if (!r.ok) return setError(r.error)
    toast(approve ? `Approved. “${r.keyName || info?.deviceName}” is connecting now.` : 'Request denied.', approve ? 'ok' : 'info')
    onDone()
  }

  const pending = info?.status === 'pending'

  return (
    <Sheet
      open
      onClose={onDone}
      eyebrow="Terminal sign-in"
      title="Connect this terminal?"
      footer={
        pending ? (
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => decide(false)} disabled={busy}>
              Deny
            </Button>
            <Button className="flex-1" variant="primary" onClick={() => decide(true)} disabled={busy}>
              {busy ? 'Approving…' : 'Approve'}
            </Button>
          </div>
        ) : (
          <Button className="w-full" onClick={onDone}>
            Close
          </Button>
        )
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-2xl border border-line/70 bg-bg/40 p-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-rose/30 bg-rose/10 text-rose">
            <Terminal size={18} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] text-txt">{info?.deviceName || 'Loading…'}</p>
            <p className="font-mono text-[12px] tracking-wider text-faint">{code}</p>
          </div>
        </div>
        {error ? (
          <Callout tone="warn" title="Can't use this code">
            {error}
          </Callout>
        ) : info && !pending ? (
          <Callout tone="info">This request is {info.status}. Run the login command again in your terminal for a new code.</Callout>
        ) : (
          <p className="text-[13.5px] leading-relaxed text-mut">
            Only approve if the code above matches the one in your terminal. Approving creates a permanent key named after this
            device, which you can revoke any time on the Keys page.
          </p>
        )}
      </div>
    </Sheet>
  )
}

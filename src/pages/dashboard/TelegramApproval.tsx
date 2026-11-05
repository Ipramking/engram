import { useState } from 'react'
import { Send } from 'lucide-react'
import type { Dashboard } from './data'
import { Button, Callout, Sheet, useToast } from './ui'

/** Links a Telegram chat to this account after the user confirms the bot's one-time code. */
export function TelegramApproval({ d, code, onDone }: { d: Dashboard; code: string; onDone: () => void }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function approve() {
    setBusy(true)
    const r = await d.approveTelegram(code)
    setBusy(false)
    if (!r.ok) return setError(r.error)
    toast('Telegram connected. The bot has sent you a confirmation.')
    onDone()
  }

  return (
    <Sheet
      open
      onClose={onDone}
      eyebrow="Telegram"
      title="Connect this Telegram chat?"
      footer={
        <div className="flex gap-2">
          <Button className="flex-1" onClick={onDone}>
            Cancel
          </Button>
          <Button className="flex-1" variant="primary" onClick={approve} disabled={busy || Boolean(error)}>
            <Send size={14} /> {busy ? 'Connecting…' : 'Connect'}
          </Button>
        </div>
      }
    >
      {error ? (
        <Callout tone="warn" title="Can't connect">
          {error}
        </Callout>
      ) : (
        <p className="text-[13.5px] leading-relaxed text-mut">
          The chat that sent you this link will be able to save memories and search your personal memory. Only continue if you
          just messaged the Engram bot yourself. You can disconnect any time by sending <code className="font-mono text-champagne">/unlink</code>.
        </p>
      )}
    </Sheet>
  )
}

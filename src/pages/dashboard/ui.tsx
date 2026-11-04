import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Check, CircleAlert, CircleCheck, Copy, Info, TriangleAlert, X } from 'lucide-react'

/* ── Toasts (replaces window.alert) ── */

type Toast = { id: number; tone: 'ok' | 'error' | 'info'; text: string }
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t.slice(-2), { id, tone, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:pr-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`anim-toast pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-2xl border px-4 py-3 text-[13px] shadow-2xl backdrop-blur-xl ${
              t.tone === 'error'
                ? 'border-rose-deep/50 bg-[#2a1517]/95 text-champagne'
                : 'border-line-2 bg-surface-2/95 text-txt'
            }`}
          >
            {t.tone === 'error' ? (
              <CircleAlert size={16} className="mt-0.5 shrink-0 text-rose" />
            ) : t.tone === 'info' ? (
              <Info size={16} className="mt-0.5 shrink-0 text-violet-soft" />
            ) : (
              <CircleCheck size={16} className="mt-0.5 shrink-0 text-rose" />
            )}
            <span className="leading-snug">{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)

/* ── Buttons ── */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-rose to-[#cfa1d8] text-bg font-medium shadow-[0_10px_30px_-12px_rgba(228,167,156,0.6)] hover:brightness-105',
  secondary: 'border border-line-2 bg-surface/70 text-txt hover:border-rose/45 hover:bg-surface-2/80',
  ghost: 'text-mut hover:text-txt hover:bg-surface/60',
  danger: 'border border-rose-deep/40 bg-rose-deep/10 text-rose hover:bg-rose-deep/20',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'h-8 px-3 text-xs gap-1.5 rounded-xl' : 'h-10 px-4 text-[13px] gap-2 rounded-2xl'
  return (
    <button
      type="button"
      {...rest}
      className={`ring-focus inline-flex shrink-0 items-center justify-center whitespace-nowrap transition duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 ${sz} ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

export function CopyButton({
  value,
  label = 'Copy',
  copiedLabel = 'Copied',
  variant = 'secondary',
  size = 'sm',
  className = '',
  onCopied,
}: {
  value: string
  label?: string
  copiedLabel?: string
  variant?: Variant
  size?: 'sm' | 'md'
  className?: string
  onCopied?: () => void
}) {
  const [done, setDone] = useState(false)
  const toast = useToast()
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setDone(true)
      onCopied?.()
      setTimeout(() => setDone(false), 1800)
    } catch {
      toast('Your browser blocked the clipboard. Select the text and copy it manually.', 'error')
    }
  }
  return (
    <Button variant={variant} size={size} onClick={copy} className={className} aria-label={done ? copiedLabel : label}>
      {done ? <Check size={14} className={variant === 'primary' ? '' : 'text-rose'} /> : <Copy size={14} />}
      <span>{done ? copiedLabel : label}</span>
    </Button>
  )
}

/* ── Layout primitives ── */

export function Panel({ children, className = '', as: As = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' }) {
  return <As className={`panel rounded-[22px] ${className}`}>{children}</As>
}

export function PageHeader({ eyebrow, title, intro, actions }: { eyebrow: string; title: ReactNode; intro: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-7 flex flex-col gap-4 sm:mb-9 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0 max-w-2xl">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="text-balance mt-2 font-display text-[30px] leading-[1.05] text-txt sm:text-[38px]">{title}</h1>
        <p className="mt-3 max-w-[62ch] text-[14px] leading-relaxed text-mut">{intro}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function SectionTitle({ title, hint, action }: { title: string; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-display text-[20px] leading-tight text-txt">{title}</h2>
        {hint && <p className="mt-1 max-w-[62ch] text-[13px] leading-relaxed text-mut">{hint}</p>}
      </div>
      {action}
    </div>
  )
}

export function Callout({ tone = 'info', title, children, action }: { tone?: 'info' | 'warn' | 'ok'; title?: string; children: ReactNode; action?: ReactNode }) {
  const Icon = tone === 'warn' ? TriangleAlert : tone === 'ok' ? CircleCheck : Info
  const tint =
    tone === 'warn'
      ? 'border-[#e0b48f]/30 bg-[#e0b48f]/[0.06]'
      : tone === 'ok'
        ? 'border-rose/30 bg-rose/[0.06]'
        : 'border-violet/30 bg-violet/[0.07]'
  const ic = tone === 'warn' ? 'text-[#e0b48f]' : tone === 'ok' ? 'text-rose' : 'text-violet-soft'
  return (
    <div className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-start ${tint}`}>
      <Icon size={17} className={`mt-0.5 shrink-0 ${ic}`} />
      <div className="min-w-0 flex-1 text-[13px] leading-relaxed text-mut">
        {title && <p className="mb-0.5 font-medium text-txt">{title}</p>}
        {children}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="space-y-3">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3 text-[13.5px] leading-relaxed text-mut">
          <span className="tabular mt-px grid h-6 w-6 shrink-0 place-items-center rounded-lg border border-rose/30 bg-rose/10 font-mono text-[11px] text-rose">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1 [&_b]:font-medium [&_b]:text-txt [&_code]:rounded-md [&_code]:bg-bg/80 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px] [&_code]:text-champagne">
            {it}
          </div>
        </li>
      ))}
    </ol>
  )
}

/** Shows `display` (masked) but copies `value` (full). */
export function CodeBlock({ label, display, value, wrap = false }: { label: string; display: string; value: string; wrap?: boolean }) {
  return (
    <div className="panel-inset overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between gap-2 border-b border-line/70 px-3.5 py-2">
        <span className="truncate font-mono text-[11px] text-faint">{label}</span>
        <CopyButton value={value} size="sm" variant="ghost" />
      </div>
      <pre
        className={`no-scrollbar overflow-x-auto px-3.5 py-3 font-mono text-[12px] leading-relaxed text-champagne/95 ${
          wrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'
        }`}
      >
        {display}
      </pre>
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T
  onChange: (v: T) => void
  options: Array<{ id: T; label: string }>
  ariaLabel: string
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="panel-inset inline-flex rounded-2xl p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={`ring-focus rounded-xl px-3.5 py-1.5 text-[12.5px] transition duration-200 ${
            value === o.id ? 'bg-surface-2 text-txt shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]' : 'text-mut hover:text-txt'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-medium text-txt">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[12px] leading-relaxed text-faint">{hint}</span>}
    </label>
  )
}

export const inputCls =
  'ring-focus w-full rounded-2xl border border-line-2 bg-bg/80 px-3.5 py-2.5 text-[13.5px] text-txt placeholder:text-faint transition focus:border-rose/50'

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-xl ${className}`} />
}

export function Empty({ icon, title, children, action }: { icon: ReactNode; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-[22px] border border-dashed border-line-2 px-6 py-12 text-center">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-line-2 bg-surface/60 text-rose">{icon}</div>
      <h3 className="font-display text-[19px] text-txt">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-[46ch] text-[13px] leading-relaxed text-mut">{children}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}

/* ── Overlay: slide-over on desktop, bottom sheet on phones ── */

export function Sheet({ open, onClose, title, eyebrow, children, footer }: { open: boolean; onClose: () => void; title: string; eyebrow?: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>('input,textarea,select,button')?.focus(), 60)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
      clearTimeout(t)
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={title}>
      <div className="anim-fade absolute inset-0 bg-[#07040a]/75 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={ref}
        className="anim-sheet absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-[26px] border border-line-2 bg-[#150e1a] shadow-2xl sm:anim-drawer sm:inset-y-3 sm:left-auto sm:right-3 sm:max-h-none sm:w-[460px] sm:rounded-[26px]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line/80 px-5 pb-4 pt-5">
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h2 className="mt-1 font-display text-[22px] leading-tight text-txt">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ring-focus grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line-2 text-mut transition hover:text-txt"
          >
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="border-t border-line/80 px-5 py-4">{footer}</div>}
      </div>
    </div>
  )
}

/* ── Memory type badge (palette-only tints; glyph + label so color is never the only signal) ── */

export const TYPE_META: Record<string, { label: string; color: string; hint: string }> = {
  decision: { label: 'Decision', color: '#e4a79c', hint: 'A choice and the reason behind it' },
  config: { label: 'Config', color: '#9b8dff', hint: 'A setup value, port, or where a secret lives' },
  gotcha: { label: 'Gotcha', color: '#e0b48f', hint: 'A pitfall and the fix that worked' },
  person: { label: 'Person', color: '#f0d0c8', hint: 'A stable fact about someone you work with' },
  preference: { label: 'Preference', color: '#c7a6e0', hint: 'How you like things done' },
  plan: { label: 'Plan', color: '#b7c0ff', hint: 'A roadmap, spec, or task list' },
}

export function TypeBadge({ type }: { type?: string }) {
  const meta = TYPE_META[type || 'decision'] || TYPE_META.decision
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider"
      style={{ color: meta.color, borderColor: `${meta.color}40`, background: `${meta.color}12` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
      {meta.label}
    </span>
  )
}

export function relTime(iso?: string | null) {
  if (!iso) return 'never'
  const d = new Date(iso)
  const s = Math.round((Date.now() - d.getTime()) / 1000)
  if (Number.isNaN(s)) return '—'
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function fmtDate(d: Date | string) {
  const x = typeof d === 'string' ? new Date(d) : d
  return x.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function Confirm({
  open,
  title,
  children,
  confirmLabel,
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex gap-2">
          <Button className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" variant="danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="text-[13.5px] leading-relaxed text-mut">{children}</div>
    </Sheet>
  )
}

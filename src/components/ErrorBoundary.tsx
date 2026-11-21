import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

const ISSUES = 'https://github.com/Ipramking/engram/issues/new'

interface Props {
  children: ReactNode
  /** "page" replaces one dashboard page and leaves the navigation; "screen" replaces the whole app. */
  variant?: 'page' | 'screen'
}

/**
 * A render error in React unmounts the whole tree, which looks like a blank page. This catches it
 * and shows what happened, plus a way out.
 */
export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[engram] render error:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const screen = this.props.variant === 'screen'
    const button =
      'ring-focus inline-flex h-10 items-center justify-center rounded-2xl px-4 text-[13px] transition active:scale-[0.98]'
    return (
      <div role="alert" className={screen ? 'grid min-h-dvh place-items-center bg-bg px-5 py-10 text-txt' : ''}>
        <div className="panel mx-auto max-w-xl rounded-[22px] p-6 sm:p-8">
          <p className="eyebrow">Something went wrong</p>
          <h1 className="mt-2 font-display text-[26px] leading-tight text-txt">This page hit a problem</h1>
          <p className="mt-3 text-[14px] leading-relaxed text-mut">
            Your memories and keys are safe; nothing was lost. Reload the page. If it happens again, report it and include the
            detail below.
          </p>
          <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-line bg-bg/60 p-3 font-mono text-[12px] text-mut">
            {`${error.name}: ${error.message}`}
          </pre>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className={`${button} bg-gradient-to-r from-rose to-[#cfa1d8] font-medium text-bg hover:brightness-105`}
            >
              Reload the page
            </button>
            <a
              href={screen ? '/' : '/dashboard'}
              className={`${button} border border-line-2 bg-surface/70 text-txt hover:border-rose/45`}
            >
              {screen ? 'Go to the home page' : 'Back to the dashboard'}
            </a>
            <a
              href={ISSUES}
              target="_blank"
              rel="noreferrer"
              className={`${button} text-mut hover:text-txt`}
            >
              Report it
            </a>
          </div>
        </div>
      </div>
    )
  }
}

import type { ChatMsg, Memory, Scope } from '../types'

const INSPECTOR_BASE =
  import.meta.env.VITE_INSPECTOR_BASE ?? 'https://walruscan.com/testnet/blob/'

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const msg = await r.json().catch(() => ({}))
    throw new Error((msg as any).error || r.statusText)
  }
  return r.json() as Promise<T>
}

export function sendChat(
  messages: { role: string; content: string }[],
  scope: Scope,
  teamCode: string,
  model?: string,
) {
  return post<{ reply: string; recalled: Memory[]; remembered: Memory[] }>('/api/chat', {
    messages,
    scope,
    teamCode,
    model,
  })
}

export function pinMemory(text: string, type: string, scope: Scope, teamCode: string) {
  return post<Memory>('/api/remember', { text, type, scope, teamCode })
}

export function recallMemories(query: string, scope: Scope, teamCode: string) {
  return post<{ results: Memory[] }>('/api/recall', { query, scope, teamCode })
}

export async function getHealth() {
  try {
    const r = await fetch('/api/health')
    return (await r.json()) as { mock: boolean; llm: boolean; health: any }
  } catch {
    return { mock: true, llm: false, health: null }
  }
}

export function inspectorLink(blobId?: string): string | null {
  if (!blobId || blobId.startsWith('mock-') || blobId.startsWith('demo-')) return null
  return INSPECTOR_BASE + blobId
}

export type { ChatMsg }

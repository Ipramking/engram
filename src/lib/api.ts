import type { ChatMsg, Memory, Scope } from '../types'

const INSPECTOR_BASE =
  import.meta.env.VITE_INSPECTOR_BASE ?? 'https://walruscan.com/mainnet/blob/'

export async function safeJson<T = any>(res: Response): Promise<T> {
  const text = await res.text().catch(() => '')
  if (!text || !text.trim()) {
    return {} as T
  }
  try {
    return JSON.parse(text) as T
  } catch {
    return { error: text } as T
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await safeJson<any>(r)
  if (!r.ok) {
    throw new Error(data?.error || r.statusText)
  }
  return data as T
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
    return (await safeJson(r)) as { mock: boolean; llm: boolean; health: any }
  } catch {
    return { mock: true, llm: false, health: null }
  }
}

export function inspectorLink(blobId?: string): string | null {
  if (!blobId || blobId.startsWith('mock-') || blobId.startsWith('demo-')) return null
  return INSPECTOR_BASE + blobId
}

export type { ChatMsg }

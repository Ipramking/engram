// Memories captured while offline wait here and are sent when the connection returns.
const KEY = 'engram.shareQueue'

export interface QueuedMemory {
  text: string
  type: string
  queuedAt: string
}

export function readQueue(): QueuedMemory[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

function writeQueue(items: QueuedMemory[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(-50)))
  } catch {
    /* storage full or blocked */
  }
}

export function enqueue(item: QueuedMemory) {
  writeQueue([...readQueue(), item])
}

/** Sends queued memories; keeps any that fail. Returns how many were saved. */
export async function flushQueue(token: string): Promise<number> {
  const items = readQueue()
  if (!items.length || !navigator.onLine) return 0
  const left: QueuedMemory[] = []
  let saved = 0
  for (const it of items) {
    try {
      const res = await fetch('/api/remember', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: it.text, type: it.type, scope: 'personal' }),
      })
      if (res.ok) saved++
      else if (res.status >= 500 || res.status === 429) left.push(it)
    } catch {
      left.push(it)
    }
  }
  writeQueue(left)
  return saved
}

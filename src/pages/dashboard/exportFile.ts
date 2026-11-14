import { isWalrusBlobId } from './data'
import type { Memory } from './types'
import { TYPE_META } from './ui'

const WALRUSCAN = 'https://walruscan.com/mainnet/blob/'

/** Saves text as a file through the browser's download flow. */
export function downloadFile(name: string, mime: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/** Downloads memories as JSON or Markdown, named after the scope and today's date. */
export function downloadMemories(memories: Memory[], scope: string, fmt: 'json' | 'md') {
  const stamp = new Date().toISOString().slice(0, 10)
  if (fmt === 'json') {
    return downloadFile(`engram-${scope}-${stamp}.json`, 'application/json', JSON.stringify(memories, null, 2))
  }
  const body = memories
    .map((m, i) => {
      const proof = isWalrusBlobId(m.blobId) ? `\n- Walrus blob: ${WALRUSCAN}${m.blobId}` : ''
      return `### ${i + 1}. ${TYPE_META[m.type]?.label || m.type}${m.isSuperseded ? ' (replaced)' : ''}\n${m.text}\n- Saved: ${m.createdAt || 'unknown'}${proof}\n`
    })
    .join('\n')
  downloadFile(`engram-${scope}-${stamp}.md`, 'text/markdown', `# Engram memories — ${scope}\nExported ${new Date().toISOString()}\n\n${body}`)
}

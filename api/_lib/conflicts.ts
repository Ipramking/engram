// Smart Conflict Resolution & Superseding Memories Engine for Engram
// Detects when a new memory contradicts or supersedes an older architectural decision,
// configuration, or workflow preference, and marks the older memory as superseded.
import { getSupabaseAdmin } from './supabase'

export interface MemoryRecord {
  id: string
  userId?: string | null
  teamId?: string | null
  room?: string
  type: string
  text: string
  blobId?: string | null
  createdAt?: string
  isSuperseded?: boolean
  supersededBy?: string | null
}

// Key subjects commonly updated in developer and team workflows
const ENTITY_DOMAINS: Record<string, string[]> = {
  database: ['db', 'database', 'postgres', 'postgresql', 'supabase', 'neon', 'mongo', 'mongodb', 'mysql', 'sqlite', 'redis', 'dynamodb'],
  hosting: ['host', 'hosting', 'render', 'vercel', 'fly.io', 'aws', 'gcp', 'cloudflare', 'railway', 'heroku', 'deploy', 'deployment'],
  auth: ['auth', 'authentication', 'supabase auth', 'clerk', 'nextauth', 'jwt', 'session', 'oauth', 'passkey'],
  frontend: ['react', 'next', 'nextjs', 'vite', 'tailwind', 'css', 'styled-components', 'ui', 'vue', 'svelte'],
  package_manager: ['pnpm', 'npm', 'yarn', 'bun'],
  branch: ['git', 'branch', 'main', 'master', 'pr', 'trunk'],
}

// Common transitional phrases indicating a superseded choice
const TRANSITION_PATTERNS = [
  /(?:moved|migrated|switched|shifted|upgraded|transferred)\s+(?:(?:the\s+)?(?:\w+\s+)?from\s+(?<old>\w+)\s+)?to\s+(?<new>\w+)/i,
  /(?:now\s+using|now\s+use|switched\s+to|migrated\s+to|using)\s+(?<new>\w+)\s+(?:instead\s+of|rather\s+than|over)\s+(?<old>\w+)/i,
  /(?:replaced|deprecated|superseded|retired)\s+(?<old>\w+)\s+(?:with|by|for)\s+(?<new>\w+)/i,
  /(?:no\s+longer\s+use|stopped\s+using)\s+(?<old>\w+)/i,
]

function extractKeywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s_-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2)
  )
}

function findMatchingDomain(text: string): string | null {
  const words = extractKeywords(text)
  for (const [domain, keywords] of Object.entries(ENTITY_DOMAINS)) {
    const hits = keywords.filter((k) => words.has(k))
    if (hits.length > 0) return domain
  }
  return null
}

export function evaluateContradiction(
  newText: string,
  newType: string,
  oldText: string,
  oldType: string
): { isContradiction: boolean; reason: string } {
  // Only decisions and configurations typically supersede each other
  if (!['decision', 'config', 'preference'].includes(newType)) {
    return { isContradiction: false, reason: '' }
  }
  if (!['decision', 'config', 'preference'].includes(oldType)) {
    return { isContradiction: false, reason: '' }
  }

  const newLower = newText.toLowerCase()
  const oldLower = oldText.toLowerCase()

  // 1. Check explicit transition phrasing
  for (const pattern of TRANSITION_PATTERNS) {
    const match = newLower.match(pattern)
    if (match && match.groups) {
      const oldTarget = match.groups.old?.toLowerCase()
      if (oldTarget && oldLower.includes(oldTarget)) {
        return {
          isContradiction: true,
          reason: `Superseded transition: ${match[0]} (replaces "${oldTarget}")`,
        }
      }
    }
  }

  // 2. Domain & high entity overlap check
  const newDomain = findMatchingDomain(newText)
  const oldDomain = findMatchingDomain(oldText)

  if (newDomain && oldDomain && newDomain === oldDomain) {
    const newWords = extractKeywords(newText)
    const oldWords = extractKeywords(oldText)
    const intersection = [...newWords].filter((w) => oldWords.has(w))

    // If they share common technical domain keywords (e.g. database, db, postgres)
    // and both make an assertion about that domain
    if (intersection.length >= 2) {
      const hasChangeIndicator =
        /moved|migrated|now|switched|replaced|instead|new|upgrade|changed|current/i.test(newText)
      if (hasChangeIndicator) {
        return {
          isContradiction: true,
          reason: `Domain match on "${newDomain}": newer memory supersedes earlier setup`,
        }
      }
    }
  }

  return { isContradiction: false, reason: '' }
}

export async function detectAndResolveConflicts({
  userId,
  teamId,
  scope,
  newText,
  newType,
  newBlobId,
}: {
  userId?: string | null
  teamId?: string | null
  scope: 'personal' | 'team'
  newText: string
  newType: string
  newBlobId?: string
}): Promise<{
  supersededList: Array<{
    id: string
    blobId?: string | null
    oldText: string
    reason: string
  }>
}> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return { supersededList: [] }

  try {
    let query = supabase
      .from('memories_meta')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (scope === 'team' && teamId) {
      query = query.eq('team_id', teamId)
    } else if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data: existingRows, error } = await query
    if (error || !existingRows || existingRows.length === 0) {
      return { supersededList: [] }
    }

    const supersededList: Array<{
      id: string
      blobId?: string | null
      oldText: string
      reason: string
    }> = []

    for (const row of existingRows) {
      // Skip if already superseded
      if (row.room && row.room.startsWith('superseded_by:')) continue

      const evalResult = evaluateContradiction(newText, newType, row.text, row.type)
      if (evalResult.isContradiction) {
        const supersededMarker = `superseded_by:${newBlobId || 'latest'}`
        await supabase
          .from('memories_meta')
          .update({ room: supersededMarker })
          .eq('id', row.id)

        supersededList.push({
          id: row.id,
          blobId: row.blob_id,
          oldText: row.text,
          reason: evalResult.reason,
        })
      }
    }

    return { supersededList }
  } catch (err) {
    console.error('Error resolving memory conflicts:', err)
    return { supersededList: [] }
  }
}

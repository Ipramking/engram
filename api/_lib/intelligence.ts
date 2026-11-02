// Engram 2.1 Intelligent Memory Engine: 5 Categories, Lifecycle Pipeline, Hybrid Retrieval & Entity Graph
import { randomUUID } from 'node:crypto'
import {
  MEMORY_CATEGORIES,
  MEMORY_TYPES,
  type MemoryCategory,
  type MemoryType,
} from './types.js'
import { computeContentHash } from './storage.js'
import { scanForSecrets, sanitizeMemoryText } from './security.js'

export { MEMORY_CATEGORIES, type MemoryCategory }

export type MemorySensitivity = 'public' | 'internal' | 'confidential' | 'secret'
export type MemoryStatus = 'active' | 'superseded' | 'archived' | 'forgotten'
export type MemorySource = 'explicit_user' | 'agent_mcp' | 'conversation_extraction' | 'document_import'

export interface StructuredMemory {
  id: string
  userId: string
  teamId?: string | null
  scope: 'personal' | 'team'
  category: MemoryCategory
  subtype: string
  text: string
  entities: string[]
  confidence: number // 0.0 - 1.0
  importance: number // 1 - 5
  sensitivity: MemorySensitivity
  status: MemoryStatus
  source: MemorySource
  version: number
  previousVersionId?: string | null
  createdAt: string
  updatedAt: string
  blobId?: string | null
  contentHash: string
  evidenceExplanation?: string
}

export interface CaptureMemoryInput {
  userId: string
  scope: 'personal' | 'team'
  teamId?: string | null
  text: string
  type?: string
  source?: MemorySource
  confidence?: number
  importance?: number
  blobId?: string | null
  existingMemories?: Array<{ id: string; text: string; type: string; category?: string; room?: string }>
}

export interface LifecycleResult {
  memory: StructuredMemory
  isDuplicate: boolean
  duplicateOf?: string
  supersededMemories: Array<{ id: string; oldText: string; reason: string }>
}

/**
 * Maps any legacy subtype (decision, config, etc.) or top-level category to
 * normalized 5-category taxonomy.
 */
export function mapSubtypeToCategory(val: string = ''): { category: MemoryCategory; subtype: string } {
  const norm = String(val).trim().toLowerCase()
  if (norm === 'decision' || norm === 'plan' || norm === 'milestone') {
    return { category: 'project', subtype: norm }
  }
  if (norm === 'preference' || norm === 'gotcha' || norm === 'workflow' || norm === 'instruction') {
    return { category: 'procedural', subtype: norm }
  }
  if (norm === 'config' || norm === 'fact' || norm === 'architecture' || norm === 'setup') {
    return { category: 'semantic', subtype: norm }
  }
  if (norm === 'person' || norm === 'team_member' || norm === 'contact' || norm === 'relationship') {
    return { category: 'relational', subtype: norm }
  }
  if (norm === 'event' || norm === 'conversation' || norm === 'session' || norm === 'episodic') {
    return { category: 'episodic', subtype: norm }
  }
  if (MEMORY_CATEGORIES.includes(norm as MemoryCategory)) {
    return { category: norm as MemoryCategory, subtype: norm }
  }
  return { category: 'semantic', subtype: norm || 'fact' }
}

export const COMMON_STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'what', 'how', 'our', 'are', 'was', 'were',
  'is', 'in', 'to', 'of', 'on', 'we', 'do', 'does', 'did', 'by', 'as', 'at',
  'an', 'a', 'be', 'or', 'if', 'my', 'your', 'their', 'this', 'that', 'from',
  'it', 'its', 'so', 'can', 'will', 'have', 'has', 'had', 'been', 'which', 'who',
])

export const COMMON_TECH_ENTITIES = [
  'typescript', 'javascript', 'python', 'rust', 'go', 'golang', 'solidity', 'move',
  'react', 'next', 'nextjs', 'vite', 'tailwind', 'vue', 'svelte',
  'postgres', 'postgresql', 'supabase', 'neon', 'mysql', 'sqlite', 'redis', 'mongodb', 'dynamodb',
  'docker', 'kubernetes', 'aws', 'gcp', 'vercel', 'render', 'railway', 'cloudflare',
  'walrus', 'sui', 'memwal', 'mcp', 'openai', 'anthropic', 'groq', 'gemini', 'claude',
]

export const ENTITY_ALIASES: Record<string, string> = {
  postgresql: 'postgres',
  reactjs: 'react',
  nextjs: 'next',
  golang: 'go',
  k8s: 'kubernetes',
  javascript: 'js',
  typescript: 'ts',
  vitejs: 'vite',
  tailwindcss: 'tailwind',
}

export function canonicalEntity(entity: string): string {
  const norm = entity.toLowerCase().trim()
  return ENTITY_ALIASES[norm] || norm
}

/**
 * Extracts key named entities and domain subjects for knowledge graph links.
 */
export function extractEntities(text: string): string[] {
  if (!text) return []
  const found = new Set<string>()
  const clean = text.toLowerCase()

  // 1. Technical stack & infrastructure match
  for (const tech of COMMON_TECH_ENTITIES) {
    const re = new RegExp(`\\b${tech}\\b`, 'i')
    if (re.test(clean)) {
      found.add(tech)
    }
  }

  // 2. Capitalized Proper Nouns / Names (e.g. Ada, Chizzy, Docker, Render)
  const words = text.split(/[\s,;:.!?()\[\]"']+/)
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    if (w.length >= 3 && /^[A-Z][a-z0-9_-]+$/.test(w)) {
      const lower = w.toLowerCase()
      if (!['the', 'this', 'that', 'with', 'when', 'what', 'here', 'have', 'from', 'today', 'will', 'user'].includes(lower)) {
        found.add(w)
      }
    }
  }

  // 3. URLs, hostnames, environment variables
  const envMatches = text.match(/\b[A-Z0-9_]{3,}(?:_URL|_KEY|_SECRET|_ENV|_PORT|_DB)\b/g)
  if (envMatches) {
    for (const em of envMatches) found.add(em)
  }

  return Array.from(found)
}

/**
 * Heuristic importance classifier (1 = minor observation, 5 = critical system decision/blocker).
 */
export function assessImportance(typeOrCategory: string, text: string): number {
  const t = text.toLowerCase()
  if (/critical|security|fatal|vulnerability|must always|never|breaking change|production/i.test(t)) {
    return 5
  }
  if (typeOrCategory === 'decision' || typeOrCategory === 'project') {
    return 4
  }
  if (typeOrCategory === 'config' || typeOrCategory === 'gotcha') {
    return 3
  }
  if (typeOrCategory === 'preference' || typeOrCategory === 'person') {
    return 3
  }
  if (t.length > 100) return 3
  return 2
}

/**
 * Sensitivity scanner for memory records.
 */
export function assessSensitivity(text: string): MemorySensitivity {
  const t = text.toLowerCase()
  if (/password|credential|private key|token|secret/i.test(t)) return 'secret'
  if (/internal|confidential|nda|proprietary|salary|revenue/i.test(t)) return 'confidential'
  if (/team|project|repo|endpoint|database|setup/i.test(t)) return 'internal'
  return 'public'
}

/**
 * Token-based Jaccard similarity to detect duplicate memories.
 */
export function computeJaccardSimilarity(textA: string, textB: string): number {
  const getTokens = (t: string) =>
    new Set(
      t
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 2)
    )
  const a = getTokens(textA)
  const b = getTokens(textB)
  if (a.size === 0 || b.size === 0) return 0

  let intersection = 0
  for (const token of a) {
    if (b.has(token)) intersection++
  }
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

// Common domain patterns for conflict evaluation
const DOMAINS: Record<string, string[]> = {
  database: ['database', 'db', 'postgres', 'postgresql', 'supabase', 'neon', 'mongodb', 'mysql', 'sqlite'],
  backend: ['backend', 'api', 'server', 'node', 'express', 'python', 'fastapi', 'typescript', 'django'],
  frontend: ['frontend', 'ui', 'client', 'react', 'next', 'vite', 'tailwind', 'vue'],
  auth: ['auth', 'authentication', 'session', 'jwt', 'clerk', 'supabase auth', 'oauth'],
  hosting: ['host', 'hosting', 'deploy', 'render', 'vercel', 'fly', 'aws', 'railway'],
  package_manager: ['package manager', 'pnpm', 'npm', 'yarn', 'bun'],
}

/**
 * Evaluates whether a new memory updates or supersedes an older memory.
 * E.g.: "I prefer Python for backend" -> "I have moved all backend projects to TypeScript".
 */
export function evaluateContradiction(
  newText: string,
  newType: string,
  oldText: string,
  oldType: string
): { isContradiction: boolean; reason: string } {
  const nLow = newText.toLowerCase()
  const oLow = oldText.toLowerCase()

  // 1. Explicit replacement patterns
  const transitionRegex = /\b(?:moved|migrated|switched|shifted|upgraded|transferred|replaced|now using|using)\b/i
  if (transitionRegex.test(nLow)) {
    // Check for common domain keywords
    for (const [domain, keywords] of Object.entries(DOMAINS)) {
      const newHasDomain = keywords.some((k) => nLow.includes(k))
      const oldHasDomain = keywords.some((k) => oLow.includes(k))
      if (newHasDomain && oldHasDomain) {
        return {
          isContradiction: true,
          reason: `Domain update on "${domain}": newer statement updates previous ${domain} setup`,
        }
      }
    }
  }

  // 2. Direct preference / instruction negation
  if (/no longer|stopped using|deprecated|instead of|rather than/i.test(nLow)) {
    const oTokens = oldText.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
    const hits = oTokens.filter((w) => nLow.includes(w))
    if (hits.length >= 1) {
      return {
        isContradiction: true,
        reason: `Explicit override: newer statement supersedes previous choice ("${hits[0]}")`,
      }
    }
  }

  return { isContradiction: false, reason: '' }
}

/**
 * Executes the full memory intelligence pipeline:
 * CAPTURE -> CLASSIFY -> VALIDATE -> CONSOLIDATE -> UPDATE
 */
export function executeLifecyclePipeline(input: CaptureMemoryInput): LifecycleResult {
  const {
    userId,
    scope,
    teamId,
    text: rawText,
    type: requestedType = 'decision',
    source = 'explicit_user',
    confidence = source === 'explicit_user' ? 1.0 : 0.85,
    blobId = null,
    existingMemories = [],
  } = input

  // 1. CAPTURE & VALIDATE
  const cleanText = sanitizeMemoryText(rawText)
  const secretCheck = scanForSecrets(cleanText)
  if (secretCheck.hasSecret) {
    throw new Error(secretCheck.reason)
  }

  // 2. CLASSIFY & METADATA ENRICHMENT
  const { category, subtype } = mapSubtypeToCategory(requestedType)
  const entities = extractEntities(cleanText)
  const importance = input.importance ?? assessImportance(subtype, cleanText)
  const sensitivity = assessSensitivity(cleanText)
  const contentHash = computeContentHash(subtype, cleanText)
  const now = new Date().toISOString()

  // 3. CONSOLIDATE (Duplicate detection)
  let isDuplicate = false
  let duplicateOf: string | undefined
  for (const existing of existingMemories) {
    if (existing.room?.startsWith('superseded_by:')) continue
    const similarity = computeJaccardSimilarity(cleanText, existing.text)
    if (similarity >= 0.85) {
      isDuplicate = true
      duplicateOf = existing.id
      break
    }
  }

  // 4. UPDATE & CONFLICT RESOLUTION
  const supersededMemories: Array<{ id: string; oldText: string; reason: string }> = []
  for (const existing of existingMemories) {
    if (existing.room?.startsWith('superseded_by:')) continue
    const conflict = evaluateContradiction(cleanText, subtype, existing.text, existing.type)
    if (conflict.isContradiction) {
      supersededMemories.push({
        id: existing.id,
        oldText: existing.text,
        reason: conflict.reason,
      })
    }
  }

  const memory: StructuredMemory = {
    id: randomUUID(),
    userId,
    teamId: teamId || null,
    scope,
    category,
    subtype,
    text: cleanText,
    entities,
    confidence,
    importance,
    sensitivity,
    status: 'active',
    source,
    version: 1,
    createdAt: now,
    updatedAt: now,
    blobId,
    contentHash,
  }

  return {
    memory,
    isDuplicate,
    duplicateOf,
    supersededMemories,
  }
}

export interface HybridScoreOptions {
  now?: number
  halfLifeDays?: number
}

export interface ScoredMemory extends StructuredMemory {
  score: number
  matchReasons: string[]
  keywordScore: number
  entityMatchScore: number
  recencyScore: number
  importanceScore: number
}

/**
 * Hybrid retrieval scoring engine:
 * Combines semantic keyword matching, entity graph links with canonical aliases,
 * recency decay, and importance weighting.
 */
export function scoreMemoryHybrid(
  memory: StructuredMemory,
  query: string,
  opts?: HybridScoreOptions
): ScoredMemory {
  const qLower = query.trim().toLowerCase()
  const textLower = memory.text.toLowerCase()
  const matchReasons: string[] = []

  let keywordScore = 0
  let entityMatchScore = 0

  if (!qLower) {
    keywordScore = 1.0
  } else if (textLower.includes(qLower)) {
    keywordScore = 1.0
    matchReasons.push(`Exact phrase match on "${query.trim()}"`)
  } else {
    const qWords = qLower
      .split(/[^a-z0-9_]+/)
      .filter((w) => w.length >= 2 && !COMMON_STOP_WORDS.has(w))
    if (qWords.length === 0) {
      keywordScore = 0.5
    } else {
      let hits = 0
      for (const w of qWords) {
        if (textLower.includes(w)) hits++
      }
      keywordScore = hits / qWords.length
      if (hits > 0) {
        matchReasons.push(`Keyword match (${hits}/${qWords.length} terms)`)
      }
    }
  }

  // Entity graph score with canonical alias resolution
  const qEntities = extractEntities(query)
  if (memory.entities && memory.entities.length > 0 && qEntities.length > 0) {
    const memCanonical = new Set(memory.entities.map(canonicalEntity))
    const entityHits = qEntities.filter((qe) => memCanonical.has(canonicalEntity(qe)))
    if (entityHits.length > 0) {
      entityMatchScore = entityHits.length / qEntities.length
      matchReasons.push(`Entity link: [${entityHits.join(', ')}]`)
    }
  }

  // Recency decay: half-life default 30 days
  const now = opts?.now ?? Date.now()
  const halfLifeDays = opts?.halfLifeDays ?? 30
  const ageMs = Math.max(0, now - new Date(memory.createdAt || now).getTime())
  const ageDays = ageMs / 86400000
  const recencyScore = Math.exp(-Math.LN2 * (ageDays / halfLifeDays))

  // Importance weighting (1 to 5 scale normalized to 0.2 to 1.0)
  const importanceScore = (memory.importance || 3) / 5
  if (memory.importance >= 4) {
    matchReasons.push(`High priority memory (importance ${memory.importance}/5)`)
  }

  // Category match
  if (qLower.includes(memory.category) || qLower.includes(memory.subtype)) {
    keywordScore = Math.min(1.0, keywordScore + 0.2)
    matchReasons.push(`Category match on "${memory.category}"`)
  }

  // Zero-relevance guard: if query is non-empty and there are zero keyword or entity hits, score is 0
  if (qLower && keywordScore === 0 && entityMatchScore === 0) {
    return {
      ...memory,
      score: 0,
      matchReasons: [],
      keywordScore: 0,
      entityMatchScore: 0,
      recencyScore: parseFloat(recencyScore.toFixed(3)),
      importanceScore: parseFloat(importanceScore.toFixed(3)),
      evidenceExplanation: 'No relevance: query terms do not match memory content',
    }
  }

  // Penalty if superseded
  const isSuperseded = memory.status === 'superseded'
  const penalty = isSuperseded ? 0.05 : 1.0

  const totalScore =
    ((keywordScore * 0.45) +
      (entityMatchScore * 0.30) +
      (recencyScore * 0.15) +
      (importanceScore * 0.10)) *
    penalty

  return {
    ...memory,
    score: parseFloat(totalScore.toFixed(4)),
    matchReasons,
    keywordScore: parseFloat(keywordScore.toFixed(3)),
    entityMatchScore: parseFloat(entityMatchScore.toFixed(3)),
    recencyScore: parseFloat(recencyScore.toFixed(3)),
    importanceScore: parseFloat(importanceScore.toFixed(3)),
    evidenceExplanation: matchReasons.join('; ') || 'General semantic relevance',
  }
}

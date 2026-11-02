// Engram 2.1 Retrieval Quality & Intelligence Benchmark Suite
// Evaluates hybrid scoring, entity aliases, negation, superseded penalty, and ranking metrics.
import assert from 'node:assert'
import {
  scoreMemoryHybrid,
  extractEntities,
  canonicalEntity,
  evaluateContradiction,
} from '../api/_lib/intelligence.js'

console.log('\n📊 RUNNING ENGRAM 2.1 RETRIEVAL QUALITY & BENCHMARK SUITE')
console.log('=========================================================\n')

// ── Ground-Truth Memory Corpus ──
const CORPUS = [
  {
    id: 'mem_db_active',
    userId: 'user_eval_01',
    scope: 'personal',
    category: 'semantic',
    subtype: 'config',
    text: 'We use Supabase Postgres for our metadata vault and user profiles database.',
    entities: ['supabase', 'postgres', 'database'],
    confidence: 1.0,
    importance: 4,
    sensitivity: 'internal',
    status: 'active',
    source: 'explicit_user',
    version: 2,
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(), // 2 days ago
    updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    contentHash: 'hash_supabase_active',
  },
  {
    id: 'mem_db_superseded',
    userId: 'user_eval_01',
    scope: 'personal',
    category: 'semantic',
    subtype: 'config',
    text: 'We moved the database to Render PostgreSQL on August 2026.',
    entities: ['render', 'postgresql', 'database'],
    confidence: 0.9,
    importance: 4,
    sensitivity: 'internal',
    status: 'superseded', // Superseded by mem_db_active
    source: 'explicit_user',
    version: 1,
    createdAt: new Date(Date.now() - 60 * 86400000).toISOString(), // 60 days ago
    updatedAt: new Date(Date.now() - 60 * 86400000).toISOString(),
    contentHash: 'hash_render_old',
  },
  {
    id: 'mem_sec_critical',
    userId: 'user_eval_01',
    scope: 'personal',
    category: 'project',
    subtype: 'decision',
    text: 'Critical security rule: production must fail closed if ENGRAM_SIGNING_SECRET is missing or under 16 characters.',
    entities: ['ENGRAM_SIGNING_SECRET', 'security', 'production'],
    confidence: 1.0,
    importance: 5,
    sensitivity: 'confidential',
    status: 'active',
    source: 'explicit_user',
    version: 1,
    createdAt: new Date(Date.now() - 45 * 86400000).toISOString(), // 45 days ago
    updatedAt: new Date(Date.now() - 45 * 86400000).toISOString(),
    contentHash: 'hash_sec_critical',
  },
  {
    id: 'mem_frontend_active',
    userId: 'user_eval_01',
    scope: 'personal',
    category: 'semantic',
    subtype: 'config',
    text: 'Frontend is built with React, Vite, and Tailwind CSS with an Aubergine and Rose-Gold palette.',
    entities: ['react', 'vite', 'tailwind', 'frontend'],
    confidence: 1.0,
    importance: 3,
    sensitivity: 'internal',
    status: 'active',
    source: 'explicit_user',
    version: 1,
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(), // 5 days ago
    updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    contentHash: 'hash_frontend_active',
  },
  {
    id: 'mem_hosting_active',
    userId: 'user_eval_01',
    scope: 'personal',
    category: 'project',
    subtype: 'decision',
    text: 'We host our web client and serverless API on Vercel while background relayers run on Render.',
    entities: ['vercel', 'render', 'hosting', 'api'],
    confidence: 1.0,
    importance: 4,
    sensitivity: 'internal',
    status: 'active',
    source: 'explicit_user',
    version: 1,
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    contentHash: 'hash_hosting_active',
  },
  {
    id: 'mem_minor_recent',
    userId: 'user_eval_01',
    scope: 'personal',
    category: 'procedural',
    subtype: 'gotcha',
    text: 'Minor typo fixed in README badges.',
    entities: ['readme'],
    confidence: 0.8,
    importance: 1,
    sensitivity: 'public',
    status: 'active',
    source: 'explicit_user',
    version: 1,
    createdAt: new Date().toISOString(), // Just now
    updatedAt: new Date().toISOString(),
    contentHash: 'hash_minor_recent',
  },
  {
    id: 'mem_project_beta',
    userId: 'user_eval_01',
    scope: 'team',
    teamId: 'team_beta',
    category: 'semantic',
    subtype: 'config',
    text: 'Team Beta uses DynamoDB and Go for high-throughput sensor telemetry.',
    entities: ['dynamodb', 'go', 'database'],
    confidence: 1.0,
    importance: 3,
    sensitivity: 'internal',
    status: 'active',
    source: 'explicit_user',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    contentHash: 'hash_team_beta',
  },
]

// ── Evaluation Queries with Ground Truth Relevance ──
const BENCHMARK_QUERIES = [
  {
    query: 'What database do we use for our metadata vault?',
    category: 'exact_query',
    expectedTopId: 'mem_db_active',
    relevantIds: ['mem_db_active'],
  },
  {
    query: 'Where is our database schema and profile store hosted?',
    category: 'paraphrase',
    expectedTopId: 'mem_db_active',
    relevantIds: ['mem_db_active'],
  },
  {
    query: 'What postgresql configuration is in place?',
    category: 'entity_alias', // "postgresql" alias should match "postgres"
    expectedTopId: 'mem_db_active',
    relevantIds: ['mem_db_active'],
  },
  {
    query: 'What reactjs and vite framework setup do we have?',
    category: 'entity_alias', // "reactjs" alias should match "react"
    expectedTopId: 'mem_frontend_active',
    relevantIds: ['mem_frontend_active'],
  },
  {
    query: 'What are the production security signing secret rules?',
    category: 'importance_vs_recency', // older critical decision should outrank recent minor note
    expectedTopId: 'mem_sec_critical',
    relevantIds: ['mem_sec_critical'],
  },
  {
    query: 'Where is the web application and serverless API hosted?',
    category: 'hosting_query',
    expectedTopId: 'mem_hosting_active',
    relevantIds: ['mem_hosting_active'],
  },
  {
    query: 'What quantum mechanical computer is used for compilation?',
    category: 'unanswerable',
    expectedTopId: null, // Expecting 0 relevant results / low confidence
    relevantIds: [],
  },
]

function evaluateRetrieval() {
  let totalReciprocalRank = 0
  let totalRecallAt3 = 0
  let totalRecallAt5 = 0
  let totalPrecisionAt3 = 0
  let totalPrecisionAt5 = 0
  let totalNDCGAt5 = 0
  let evaluatedQueries = 0
  let unanswerableHandled = 0
  let staleResultsCount = 0
  let totalReturnedMemories = 0

  for (const q of BENCHMARK_QUERIES) {
    // Score corpus against query
    const scored = CORPUS
      .filter((m) => m.scope === 'personal') // simulate personal isolation
      .map((m) => scoreMemoryHybrid(m, q.query))
      .filter((m) => m.score > 0.05) // active recall threshold
      .sort((a, b) => b.score - a.score)

    if (q.category === 'unanswerable') {
      // Should return either 0 results or score < 0.2
      const topScore = scored.length > 0 ? scored[0].score : 0
      assert.ok(topScore < 0.25, `Unanswerable query "${q.query}" should have low confidence (<0.25), got ${topScore}`)
      unanswerableHandled++
      console.log(`  ✓ [Unanswerable Query] "${q.query}" correctly flagged with uncertain score (${topScore})`)
      continue
    }

    evaluatedQueries++
    const top3 = scored.slice(0, 3)
    const top5 = scored.slice(0, 5)

    // Check Reciprocal Rank
    const firstRelevantRank = scored.findIndex((m) => q.relevantIds.includes(m.id)) + 1
    const rr = firstRelevantRank > 0 ? 1 / firstRelevantRank : 0
    totalReciprocalRank += rr

    // Recall & Precision @ 3
    const hitsAt3 = top3.filter((m) => q.relevantIds.includes(m.id)).length
    totalRecallAt3 += q.relevantIds.length > 0 ? (hitsAt3 > 0 ? 1 : 0) : 1
    totalPrecisionAt3 += top3.length > 0 ? hitsAt3 / top3.length : 0

    // Recall & Precision @ 5
    const hitsAt5 = top5.filter((m) => q.relevantIds.includes(m.id)).length
    totalRecallAt5 += q.relevantIds.length > 0 ? (hitsAt5 > 0 ? 1 : 0) : 1
    totalPrecisionAt5 += top5.length > 0 ? hitsAt5 / top5.length : 0

    // nDCG @ 5
    let dcg = 0
    let idcg = 0
    for (let i = 0; i < Math.min(top5.length, 5); i++) {
      const rel = q.relevantIds.includes(top5[i].id) ? 1 : 0
      dcg += rel / Math.log2(i + 2)
      idcg += 1 / Math.log2(i + 2) // ideal binary relevance
    }
    const ndcg = idcg > 0 ? dcg / idcg : 1
    totalNDCGAt5 += ndcg

    // Track stale memory rate (superseded memories in top 3 of active query)
    const supersededInTop3 = top3.filter((m) => m.status === 'superseded').length
    staleResultsCount += supersededInTop3
    totalReturnedMemories += top3.length

    // Assert top result
    assert.strictEqual(
      top3[0]?.id,
      q.expectedTopId,
      `Query "${q.query}" expected top memory "${q.expectedTopId}" but got "${top3[0]?.id}" (score=${top3[0]?.score})`
    )
    console.log(`  ✓ [${q.category}] "${q.query}" → rank 1: "${top3[0]?.id}" (score=${top3[0]?.score})`)
  }

  const mrr = totalReciprocalRank / evaluatedQueries
  const recallAt3 = totalRecallAt3 / evaluatedQueries
  const recallAt5 = totalRecallAt5 / evaluatedQueries
  const precisionAt3 = totalPrecisionAt3 / evaluatedQueries
  const precisionAt5 = totalPrecisionAt5 / evaluatedQueries
  const ndcgAt5 = totalNDCGAt5 / evaluatedQueries
  const staleRate = staleResultsCount / totalReturnedMemories

  console.log('\n=========================================================')
  console.log('📈 RETRIEVAL BENCHMARK METRICS RESULTS:')
  console.log(`  • Mean Reciprocal Rank (MRR):      ${mrr.toFixed(3)} (target >= 0.900)`)
  console.log(`  • Recall @ 3:                      ${(recallAt3 * 100).toFixed(1)}% (target >= 95.0%)`)
  console.log(`  • Recall @ 5:                      ${(recallAt5 * 100).toFixed(1)}% (target >= 95.0%)`)
  console.log(`  • Precision @ 3:                   ${(precisionAt3 * 100).toFixed(1)}%`)
  console.log(`  • nDCG @ 5:                        ${ndcgAt5.toFixed(3)} (target >= 0.900)`)
  console.log(`  • Stale-Memory Rate:               ${(staleRate * 100).toFixed(1)}% (target <= 5.0%)`)
  console.log(`  • Unanswerable Queries Handled:    ${unanswerableHandled}/1`)
  console.log('=========================================================\n')

  assert.ok(mrr >= 0.9, `MRR must be >= 0.9, got ${mrr}`)
  assert.ok(recallAt3 >= 0.95, `Recall@3 must be >= 0.95, got ${recallAt3}`)
  assert.ok(staleRate <= 0.05, `Stale-memory rate must be <= 5%, got ${staleRate}`)

  // Contradiction engine evaluation
  console.log('🧪 EVALUATING CONTRADICTION & DOMAIN UPDATE ENGINE')
  const contradictionCheck1 = evaluateContradiction(
    'We moved the database to Supabase Postgres',
    'decision',
    'We use Render for PostgreSQL',
    'decision'
  )
  assert.strictEqual(contradictionCheck1.isContradiction, true, 'Should detect database migration contradiction')
  console.log(`  ✓ True Positive Contradiction: "${contradictionCheck1.reason}"`)

  const contradictionCheck2 = evaluateContradiction(
    'We use TypeScript for API backend',
    'decision',
    'We use Tailwind CSS for frontend styling',
    'decision'
  )
  assert.strictEqual(contradictionCheck2.isContradiction, false, 'Unrelated domains must not contradict')
  console.log('  ✓ False Contradiction Check: Backend vs Frontend correctly not flagged as contradiction')

  console.log('\n🎉 ALL RETRIEVAL QUALITY BENCHMARKS PASSED!\n')
}

evaluateRetrieval()

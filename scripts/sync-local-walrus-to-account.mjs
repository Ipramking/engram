// Syncs local Walrus Memory store (~/.memwal/credentials.json) into the Engram Cloud account
import 'dotenv/config'
import { getSupabaseAdmin } from '../api/_lib/supabase.ts'
import { pickBackend, dec, TYPES } from '../mcp/engram-core.mjs'

const TARGET_USER_EMAIL = 'corewealthaffiliate@gmail.com'

async function sync() {
  console.log(`Starting sync from local Walrus account to ${TARGET_USER_EMAIL}...`)

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    console.error('Supabase admin client not available')
    process.exit(1)
  }

  // 1. Resolve Target User Profile
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('id, email, name')
    .eq('email', TARGET_USER_EMAIL)
    .single()

  if (profErr || !profile) {
    console.error('Target user profile not found:', profErr?.message)
    process.exit(1)
  }

  const userId = profile.id
  console.log(`✓ Target user resolved: ${profile.name} (${profile.email}, id: ${userId})`)

  // 2. Fetch all memories from local Walrus bridge
  const backend = pickBackend()
  console.log(`✓ Active bridge backend: ${backend.kind}`)

  const broadQueries = [
    'meridian', 'protocol', 'stickman', 'youtube', 'hackathon',
    'solutions', 'drips', 'wave', 'engram', 'sui', 'walrus',
    'tally', 'decision', 'config', 'plan', 'preference', 'gotcha',
    'the', 'is', 'on', 'in', 'and'
  ]

  const uniqueMemories = new Map()

  for (const q of broadQueries) {
    try {
      const rows = await backend.recall('me', q)
      for (const r of rows) {
        const rawText = r.text || ''
        const lines = rawText.split('\n')
        for (const line of lines) {
          const stripped = line.replace(/^\d+\.\s+\[score=[^\]]+\]\s+\[written=[^\]]+\]\s*/i, '').trim()
          if (!stripped || stripped.includes('undefined') || stripped.length < 10) continue
          if (stripped.startsWith('(') && stripped.includes('duplicate copies')) continue

          const decoded = dec(stripped)
          const textKey = decoded.text.toLowerCase().slice(0, 100)

          if (!uniqueMemories.has(textKey)) {
            uniqueMemories.set(textKey, {
              type: TYPES.includes(decoded.type) ? decoded.type : 'note',
              text: decoded.text,
              raw: stripped,
            })
          }
        }
      }
    } catch (err) {
      console.warn(`Query "${q}" returned warning:`, err?.message)
    }
  }

  console.log(`✓ Harvested ${uniqueMemories.size} unique memories from Walrus account.`)

  // 3. Insert each memory into memories_meta for this user
  let inserted = 0
  let skipped = 0

  for (const item of uniqueMemories.values()) {
    // Check if already in DB
    const { data: existing } = await supabase
      .from('memories_meta')
      .select('id')
      .eq('user_id', userId)
      .eq('text', item.text)
      .limit(1)

    if (existing && existing.length > 0) {
      skipped++
      continue
    }

    const { error: insertErr } = await supabase.from('memories_meta').insert({
      user_id: userId,
      room: 'my-space',
      type: item.type,
      text: item.text,
      blob_id: 'walrus-migrated',
    })

    if (insertErr) {
      console.warn(`Failed to insert "${item.text.slice(0, 40)}":`, insertErr.message)
    } else {
      inserted++
    }
  }

  console.log(`\n======================================================`)
  console.log(`🎉 SYNC COMPLETE!`)
  console.log(`   Total Memories Processed: ${uniqueMemories.size}`)
  console.log(`   Newly Inserted: ${inserted}`)
  console.log(`   Already Existing: ${skipped}`)
  console.log(`   User: ${profile.email} (${userId})`)
  console.log(`======================================================\n`)

  process.exit(0)
}

sync().catch((err) => {
  console.error('Fatal sync error:', err)
  process.exit(1)
})

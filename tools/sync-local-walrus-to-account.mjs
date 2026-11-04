// Syncs local Walrus Memory store (~/.memwal/credentials.json) into the Engram Cloud account
import 'dotenv/config'
import { getSupabaseAdmin } from '../api/_lib/supabase.ts'
import { pickBackend, dec, TYPES } from '../mcp/engram-core.mjs'
import { createApiKey, listApiKeys } from '../mcp/auth-db.mjs'

const TARGET_USER_EMAIL = process.argv[2] || process.env.TARGET_EMAIL || 'corewealthaffiliate@gmail.com'

async function sync() {
  console.log(`Starting sync from local Walrus account to ${TARGET_USER_EMAIL}...`)

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    console.error('Supabase admin client not available')
    process.exit(1)
  }

  // 1. Resolve Target User Profile
  let { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('id, email, name')
    .eq('email', TARGET_USER_EMAIL)
    .single()

  if (profErr || !profile) {
    console.log(`Profile for ${TARGET_USER_EMAIL} not found in database. Provisioning account...`)
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email: TARGET_USER_EMAIL,
      password: process.env.TARGET_PASSWORD || 'Samuel.13',
      email_confirm: true,
      user_metadata: { name: 'Ifrenzy' },
    })

    if (createError && !/already.*registered/i.test(createError.message)) {
      console.error('Failed to provision user:', createError.message)
      process.exit(1)
    }

    let uid = createData?.user?.id
    if (!uid) {
      // If already registered in auth, look up user by email
      const { data: userList } = await supabase.auth.admin.listUsers()
      const found = userList?.users?.find(u => u.email === TARGET_USER_EMAIL)
      if (found) uid = found.id
    }

    if (!uid) {
      console.error('Could not obtain or create user ID in Supabase Auth.')
      process.exit(1)
    }

    // Insert into profiles
    const { data: newProfile, error: insProfErr } = await supabase.from('profiles').upsert({
      id: uid,
      email: TARGET_USER_EMAIL,
      name: 'Ifrenzy',
      plan_tier: 'free_personal',
    }).select().single()

    if (insProfErr) {
      console.error('Failed to create profile row:', insProfErr.message)
      process.exit(1)
    }

    profile = newProfile
    console.log(`✓ Successfully provisioned account for ${profile.name} (${profile.email}, id: ${profile.id})`)
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

  // 4. Check or Create API key for user
  const existingKeys = await listApiKeys(userId)
  let activeKey = existingKeys.find(k => k.is_active)
  let rawKeyString = null
  if (!activeKey) {
    const createdKey = await createApiKey({
      userId,
      scope: 'personal',
      name: 'Default Personal Key',
      room: 'my-space',
    })
    activeKey = createdKey
    rawKeyString = createdKey.rawKey
  }

  console.log(`\n======================================================`)
  console.log(`🎉 SYNC COMPLETE!`)
  console.log(`   Total Memories Processed: ${uniqueMemories.size}`)
  console.log(`   Newly Inserted: ${inserted}`)
  console.log(`   Already Existing: ${skipped}`)
  console.log(`   User: ${profile.name} (${profile.email}, id: ${userId})`)
  if (rawKeyString) {
    console.log(`   🔑 NEW API KEY GENERATED: ${rawKeyString}`)
  } else if (activeKey) {
    console.log(`   🔑 ACTIVE API KEY PREFIX: ${activeKey.key_prefix}...`)
  }
  console.log(`======================================================\n`)

  process.exit(0)
}

sync().catch((err) => {
  console.error('Fatal sync error:', err)
  process.exit(1)
})

import 'dotenv/config'
import { getSupabaseAdmin, createApiKey, listApiKeys, validateApiKey, revokeApiKey, getUsage, checkAndIncrementUsage } from '../mcp/auth-db.mjs'
import { randomUUID } from 'node:crypto'

async function run() {
  console.log('Testing live connection to Supabase cloud tables...')
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    throw new Error('Supabase admin client could not be initialized.')
  }

  // 1. Test profiles table query
  console.log('1. Checking profiles table...')
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, email').limit(5)
  if (pErr) throw new Error(`Profiles check failed: ${pErr.message}`)
  console.log(`✓ Profiles table reachable. Count: ${profiles.length}`)

  // 2. Test api_keys table with a test user ID
  console.log('2. Testing API key generation & persistence...')
  const testUserId = randomUUID()
  const key = await createApiKey({
    userId: testUserId,
    name: 'Supabase Cloud Verification Key',
    scope: 'personal',
    room: 'cloud-test',
  })
  console.log(`✓ API key created in Supabase: ${key.key_prefix || key.keyPrefix}...`)

  const validated = await validateApiKey(key.rawKey)
  if (!validated) throw new Error('API key validation failed')
  console.log('✓ API key validated against Supabase')

  // 3. Test usage_daily tracking in Supabase
  console.log('3. Testing daily usage tracking in Supabase...')
  const inc = await checkAndIncrementUsage({
    entityType: 'user',
    entityId: testUserId,
    plan: 'free_personal',
    isSave: true,
  })
  console.log(`✓ Usage incremented in Supabase. Current saves: ${inc.saves}`)

  const usage = await getUsage('user', testUserId)
  console.log(`✓ Usage fetched from Supabase: ${usage.saves_count} saves`)

  // 4. Cleanup test key
  await revokeApiKey(key.id, testUserId)
  console.log('✓ Test API key revoked cleanly')

  console.log('\n🎉 SUPABASE LIVE CLOUD CONNECTION VERIFIED!')
}

run().catch((e) => {
  console.error('Test failed:', e)
  process.exit(1)
})

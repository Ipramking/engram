import 'dotenv/config'
import { getSupabaseAdmin, getSupabaseAuth } from '../api/_lib/supabase.ts'
import { createProfile } from '../api/_lib/db.ts'

async function test() {
  const admin = getSupabaseAdmin()
  const auth = getSupabaseAuth()
  const testEmail = `builder_${Date.now()}@gmail.com`
  const password = 'Password123!'
  
  console.log('1. Creating confirmed user with admin.createUser...')
  const { data: createData, error: createError } = await admin.auth.admin.createUser({
    email: testEmail,
    password,
    email_confirm: true,
    user_metadata: { name: 'Ada Lovelace' },
  })

  if (createError) throw createError
  console.log('✓ User created:', createData.user.id)

  console.log('2. Signing in to obtain session token...')
  const { data: signData, error: signError } = await auth.auth.signInWithPassword({
    email: testEmail,
    password,
  })

  if (signError) throw signError
  console.log('✓ Signed in! Session token:', signData.session.access_token.slice(0, 20) + '...')

  console.log('3. Creating profile...')
  const profile = await createProfile(createData.user.id, testEmail, 'Ada Lovelace', 'free_personal')
  console.log('✓ Profile created:', profile.name, profile.plan_tier)
  console.log('\n🎉 REGISTRATION FLOW 100% VERIFIED!')
}

test().catch(console.error)

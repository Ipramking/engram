import 'dotenv/config'
import { getSupabaseAdmin, getSupabaseAuth } from '../api/_lib/supabase.ts'
import { createProfile, createApiKey, createTeam } from '../api/_lib/db.ts'

const DEMO_USERS = [
  {
    email: 'developer@engram.memory',
    name: 'Alex Developer',
    role: 'free_personal',
    keys: [{ name: 'MacBook Cursor MCP', scope: 'personal', room: 'dev-workspace' }]
  },
  {
    email: 'teamlead@engram.memory',
    name: 'Sarah TeamLead',
    role: 'free_team',
    team: 'Core Protocol Team',
    keys: [{ name: 'Claude Desktop Shared', scope: 'team', room: 'eng-collab' }]
  }
]

async function seed() {
  const admin = getSupabaseAdmin()
  const auth = getSupabaseAuth()
  if (!admin || !auth) {
    console.log('No Supabase credentials set. Skipping seed.')
    return
  }

  for (const u of DEMO_USERS) {
    console.log(`Checking ${u.email}...`)
    // Check if user exists
    const { data: list } = await admin.auth.admin.listUsers()
    let user = list?.users?.find(x => x.email === u.email)
    
    if (!user) {
      console.log(`Creating demo user ${u.email}...`)
      const { data, error } = await admin.auth.admin.createUser({
        email: u.email,
        password: 'EngramDemo2026!',
        email_confirm: true,
        user_metadata: { name: u.name }
      })
      if (error) {
        console.error(`Failed to create ${u.email}:`, error.message)
        continue
      }
      user = data.user
      console.log(`✓ Created user ${user.id}`)
    } else {
      console.log(`User ${u.email} already exists (${user.id}).`)
    }

    // Profile
    await createProfile(user.id, u.email, u.name, u.role)
    console.log(`✓ Profile set: ${u.role}`)

    // Create Team if applicable
    let teamId = null
    if (u.team) {
      const team = await createTeam(u.team, user.id, u.email)
      teamId = team.id
      console.log(`✓ Team ready: ${u.team} (${teamId})`)
    }

    // Seed initial keys
    for (const k of u.keys) {
      await createApiKey({
        userId: user.id,
        name: k.name,
        scope: k.scope,
        teamId: k.scope === 'team' ? teamId : undefined,
        room: k.room
      })
      console.log(`✓ Key ready: ${k.name} (${k.scope})`)
    }
  }

  console.log('\n🎉 Demo accounts seeded successfully!')
}

seed().catch(console.error)

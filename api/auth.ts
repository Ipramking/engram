import { getSupabaseAuth, getSupabaseAdmin, authApi } from './_lib/supabase.js'
import { createProfile, getProfile } from './_lib/db.js'
import { getUserFromRequest } from './_lib/auth.js'
import { signSession } from './_lib/token.js'

export default async function handler(req: any, res: any) {
  const rawUrl = req.url || ''
  const urlPath = rawUrl.split('?')[0] || ''
  const searchParams = new URLSearchParams(rawUrl.split('?')[1] || '')
  const querySubpath = req.query?.subpath || req.query?.action || searchParams.get('subpath') || searchParams.get('action') || ''
  const path = querySubpath && !urlPath.endsWith('/' + querySubpath) ? `${urlPath}/${querySubpath}` : urlPath
  const action = req.body?.action || querySubpath
  const method = req.method

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (method === 'OPTIONS') return res.status(200).end()

  try {
    // ── Health Check ──
    if (path.endsWith('/health') || action === 'health' || querySubpath === 'health') {
      const env = ((globalThis as any).process?.env ?? {}) as Record<string, string | undefined>
      const mock = Boolean(env.ENGRAM_USE_MOCK) || !env.MEMWAL_PRIVATE_KEY
      return res.status(200).json({ mock, llm: Boolean(env.GROQ_API_KEY) })
    }

    // ── Register ──
    if (path.endsWith('/register') || action === 'register') {
      const { email, password, name } = req.body || {}
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' })
      }

      const supabaseAdmin = getSupabaseAdmin()
      const supabaseAuth = getSupabaseAuth()

      if (supabaseAdmin && supabaseAuth) {
        const { data: createData, error: createError } = await authApi(supabaseAdmin).admin.createUser({
          email: email.trim(),
          password,
          email_confirm: true,
          user_metadata: { name: name?.trim() || email.split('@')[0] },
        })

        if (createError) {
          if (/already.*registered/i.test(createError.message)) {
            return res.status(400).json({ error: 'This email is already registered. Please sign in instead.' })
          }
          return res.status(400).json({ error: createError.message })
        }

        const newUser = createData.user
        let profile: any = null
        if (newUser) {
          profile = await createProfile(newUser.id, newUser.email!, name, 'free_personal')
        }

        const { data: signData, error: signError } = await authApi(supabaseAuth).signInWithPassword({
          email: email.trim(),
          password,
        })

        if (signError && newUser) {
          const fallbackToken = signSession({
            id: newUser.id,
            email: newUser.email!,
            name: profile?.name || name?.trim() || newUser.email!.split('@')[0],
            plan_tier: 'free_personal',
          })
          return res.status(200).json({
            ok: true,
            user: profile || newUser,
            session: { access_token: fallbackToken },
            message: 'Registered successfully.',
          })
        }

        return res.status(200).json({
          ok: true,
          user: {
            ...signData.user,
            name: name?.trim() || (signData.user?.email || email).split('@')[0],
            plan_tier: 'free_personal',
          },
          session: signData.session,
          message: 'Registered successfully.',
        })
      }

      // Fallback registration when Supabase is offline
      const mockId = 'usr_' + Buffer.from(email.trim().toLowerCase()).toString('hex').slice(0, 16)
      const profile = await createProfile(mockId, email.trim(), name, 'free_personal')
      const sessionToken = signSession(profile)
      return res.status(200).json({ ok: true, user: profile, session: { access_token: sessionToken } })
    }

    // ── Login ──
    if (path.endsWith('/login') || action === 'login') {
      const { email, password } = req.body || {}
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' })
      }

      const supabaseAuth = getSupabaseAuth()
      if (supabaseAuth) {
        const { data, error } = await authApi(supabaseAuth).signInWithPassword({
          email: email.trim(),
          password,
        })

        if (error) {
          return res.status(401).json({ error: error.message })
        }

        const profile = await getProfile(data.user.id)
        return res.status(200).json({
          ok: true,
          user: {
            ...data.user,
            name: profile?.name || data.user.email?.split('@')[0],
            plan_tier: profile?.plan_tier || 'free_personal',
          },
          session: data.session,
        })
      }

      // Fallback login
      const mockId = 'usr_' + Buffer.from(email.trim().toLowerCase()).toString('hex').slice(0, 16)
      const profile = await getProfile(mockId) || await createProfile(mockId, email.trim(), '', 'free_personal')
      const sessionToken = signSession(profile)
      return res.status(200).json({
        ok: true,
        user: profile,
        session: { access_token: sessionToken },
      })
    }

    // ── Me / Current User ──
    if (path.endsWith('/me') || action === 'me' || method === 'GET') {
      const user = await getUserFromRequest(req)
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized: invalid or missing session.' })
      }
      return res.status(200).json({ ok: true, user })
    }

    // ── Logout ──
    if (path.endsWith('/logout') || action === 'logout') {
      return res.status(200).json({ ok: true, message: 'Logged out.' })
    }

    return res.status(404).json({ error: 'Auth endpoint not found.' })
  } catch (err: any) {
    console.error('[api/auth] error:', err)
    return res.status(500).json({ error: err?.message || 'Authentication error.' })
  }
}

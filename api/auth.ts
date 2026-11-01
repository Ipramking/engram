import { getSupabaseAuth, getSupabaseAdmin } from './_lib/supabase'
import { createProfile, getProfile } from './_lib/db'
import { getUserFromRequest } from './_lib/auth'

export default async function handler(req: any, res: any) {
  const rawUrl = req.url || ''
  const urlPath = rawUrl.split('?')[0] || ''
  const querySubpath = req.query?.subpath || new URLSearchParams(rawUrl.split('?')[1] || '').get('subpath') || ''
  const path = querySubpath && !urlPath.endsWith('/' + querySubpath) ? `${urlPath}/${querySubpath}` : urlPath
  const method = req.method

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (method === 'OPTIONS') return res.status(200).end()

  try {
    // ── Register ──
    if (path.endsWith('/register') || (method === 'POST' && req.body?.action === 'register')) {
      const { email, password, name } = req.body || {}
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' })
      }

      const supabaseAdmin = getSupabaseAdmin()
      const supabaseAuth = getSupabaseAuth()

      if (supabaseAdmin && supabaseAuth) {
        // 1. Create pre-confirmed user via Admin API (bypasses SMTP setup and domain blocks)
        const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: email.trim(),
          password,
          email_confirm: true,
          user_metadata: { name: name?.trim() || email.split('@')[0] },
        })

        if (createError) {
          // If already registered, suggest signing in
          if (/already.*registered/i.test(createError.message)) {
            return res.status(400).json({ error: 'This email is already registered. Please sign in instead.' })
          }
          return res.status(400).json({ error: createError.message })
        }

        const newUser = createData.user
        if (newUser) {
          await createProfile(newUser.id, newUser.email!, name, 'free_personal')
        }

        // 2. Sign in to obtain active JWT session
        const { data: signData, error: signError } = await supabaseAuth.auth.signInWithPassword({
          email: email.trim(),
          password,
        })

        if (signError) {
          return res.status(200).json({
            ok: true,
            user: newUser,
            session: { access_token: 'session_' + newUser.id },
            message: 'Registered successfully.',
          })
        }

        return res.status(200).json({
          ok: true,
          user: {
            ...signData.user,
            name: name?.trim() || signData.user.email?.split('@')[0],
            plan_tier: 'free_personal',
          },
          session: signData.session,
          message: 'Registered successfully.',
        })
      }

      // Fallback local registration
      const mockId = 'usr_' + Buffer.from(email).toString('hex').slice(0, 16)
      const profile = await createProfile(mockId, email, name, 'free_personal')
      return res.status(200).json({ ok: true, user: profile, session: { access_token: 'mock_token_' + mockId } })
    }

    // ── Login ──
    if (path.endsWith('/login') || (method === 'POST' && req.body?.action === 'login')) {
      const { email, password } = req.body || {}
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' })
      }

      const supabaseAuth = getSupabaseAuth()
      if (supabaseAuth) {
        const { data, error } = await supabaseAuth.auth.signInWithPassword({
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

      // Fallback local login
      const mockId = 'usr_' + Buffer.from(email).toString('hex').slice(0, 16)
      const profile = await getProfile(mockId) || await createProfile(mockId, email, '', 'free_personal')
      return res.status(200).json({
        ok: true,
        user: profile,
        session: { access_token: 'mock_token_' + mockId },
      })
    }

    // ── Me / Current User ──
    if (path.endsWith('/me') || method === 'GET') {
      const user = await getUserFromRequest(req)
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized: invalid or missing session.' })
      }
      return res.status(200).json({ ok: true, user })
    }

    // ── Logout ──
    if (path.endsWith('/logout')) {
      return res.status(200).json({ ok: true, message: 'Logged out.' })
    }

    return res.status(404).json({ error: 'Auth endpoint not found.' })
  } catch (err: any) {
    console.error('[api/auth] error:', err)
    return res.status(500).json({ error: err?.message || 'Authentication error.' })
  }
}

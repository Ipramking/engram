import { getSupabaseAuth, getSupabaseAdmin, authApi } from './_lib/supabase.js'
import { createProfile, getProfile } from './_lib/db.js'
import { getUserFromRequest, isMachineToken } from './_lib/auth.js'
import { signSession } from './_lib/token.js'
import { allowShared, clientIp, tooMany } from './_lib/ratelimit.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

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
      // ?deep=1 touches the database: used by the uptime check, and keeps the free Supabase project awake.
      if (req.query?.deep || new URLSearchParams(rawUrl.split('?')[1] || '').get('deep')) {
        const admin = getSupabaseAdmin()
        const { error } = admin ? await admin.from('profiles').select('id', { head: true, count: 'exact' }).limit(1) : { error: { message: 'not configured' } }
        return res.status(error ? 503 : 200).json({ mock, llm: Boolean(env.GROQ_API_KEY), db: error ? 'error' : 'ok' })
      }
      return res.status(200).json({ mock, llm: Boolean(env.GROQ_API_KEY) })
    }

    // ── Register ──
    if (path.endsWith('/register') || action === 'register') {
      const { email, password, name } = req.body || {}
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' })
      }
      if (typeof email !== 'string' || !EMAIL_RE.test(email.trim()) || email.length > 254) {
        return res.status(400).json({ error: 'Enter a valid email address.' })
      }
      if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
        return res.status(400).json({ error: 'Use a password of at least 8 characters.' })
      }
      if (!(await allowShared(`register:${clientIp(req)}`, 10, 60 * 60 * 1000))) {
        return res.status(429).json({ error: 'Too many sign-ups from this network. Try again in an hour.' })
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
      // Slow down password guessing: per IP and per account.
      const ip = clientIp(req)
      if (
        !(await allowShared(`login:${ip}`, 30, 15 * 60 * 1000)) ||
        !(await allowShared(`login:${String(email).toLowerCase()}`, 10, 15 * 60 * 1000))
      ) {
        return res.status(429).json({ error: 'Too many sign-in attempts. Wait 15 minutes and try again.' })
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

    // ── Delete account (signed-in session + typed confirmation) ──
    if (path.endsWith('/delete-account') && method === 'POST') {
      if (isMachineToken(req)) return res.status(403).json({ error: 'Sign in to the dashboard to delete your account.' })
      const user = await getUserFromRequest(req)
      if (!user) return res.status(401).json({ error: 'Sign in to delete your account.' })
      if (req.body?.confirm !== 'DELETE') return res.status(400).json({ error: 'Type DELETE to confirm.' })
      const admin = getSupabaseAdmin()
      if (!admin) return res.status(503).json({ error: 'Account deletion is unavailable right now.' })
      // Usage counters aren't linked by foreign key; everything else cascades from the auth user.
      await admin.from('usage_daily').delete().eq('entity_type', 'user').eq('entity_id', user.id)
      const { error } = await authApi(admin).admin.deleteUser(user.id)
      if (error) {
        console.error('[api/auth] delete-account failed:', error.message)
        return res.status(500).json({ error: 'Could not delete the account. Try again or contact us.' })
      }
      return res.status(200).json({ ok: true })
    }

    // ── Change password (signed-in session; the current password must be entered again) ──
    if (path.endsWith('/change-password') && method === 'POST') {
      if (isMachineToken(req)) return res.status(403).json({ error: 'Sign in to the dashboard to change your password.' })
      const user = await getUserFromRequest(req)
      if (!user) return res.status(401).json({ error: 'Your session has ended. Sign in again.' })

      const { currentPassword, newPassword } = req.body || {}
      if (typeof currentPassword !== 'string' || !currentPassword || typeof newPassword !== 'string') {
        return res.status(400).json({ error: 'Enter your current password and a new one.' })
      }
      if (newPassword.length < 8 || newPassword.length > 128) {
        return res.status(400).json({ error: 'Use a new password of 8 to 128 characters.' })
      }
      if (newPassword === currentPassword) {
        return res.status(400).json({ error: 'The new password must be different from the current one.' })
      }
      // This endpoint checks a password, so guessing is limited per account and per network.
      if (
        !(await allowShared(`password:${user.id}`, 5, 15 * 60 * 1000)) ||
        !(await allowShared(`password-ip:${clientIp(req)}`, 20, 15 * 60 * 1000))
      ) {
        return tooMany(res, 'Too many attempts. Wait 15 minutes and try again.', 900)
      }

      const admin = getSupabaseAdmin()
      const anon = getSupabaseAuth()
      if (!admin || !anon || !user.email) {
        return res.status(503).json({ error: 'Password changes are unavailable right now. Try again later.' })
      }
      const { error: verifyError } = await authApi(anon).signInWithPassword({ email: user.email, password: currentPassword })
      if (verifyError) {
        // Rejected credentials mean a wrong password; anything else (network, server) is not the user's fault.
        if ([400, 401, 403, 422].includes(Number(verifyError.status))) {
          return res.status(400).json({ error: 'That is not your current password.', code: 'WRONG_PASSWORD' })
        }
        console.error('[api/auth] password check failed:', verifyError.message)
        return res.status(502).json({ error: 'Could not check your password. Try again in a moment.' })
      }
      const { error: updateError } = await authApi(admin).admin.updateUserById(user.id, { password: newPassword })
      if (updateError) {
        console.error('[api/auth] change-password failed:', updateError.message)
        return res.status(500).json({ error: 'Could not change the password. Try again.' })
      }
      return res.status(200).json({ ok: true })
    }

    // ── Update display name (signed-in session) ──
    if (path.endsWith('/profile') && method === 'POST') {
      if (isMachineToken(req)) return res.status(403).json({ error: 'Sign in to the dashboard to edit your profile.' })
      const user = await getUserFromRequest(req)
      if (!user) return res.status(401).json({ error: 'Your session has ended. Sign in again.' })

      const name = typeof req.body?.name === 'string' ? req.body.name.replace(/\s+/g, ' ').trim() : ''
      if (!name || name.length > 60 || /[\u0000-\u001f\u007f]/.test(name)) {
        return res.status(400).json({ error: 'Use a name of 1 to 60 characters.' })
      }
      const admin = getSupabaseAdmin()
      if (!admin) return res.status(503).json({ error: 'Profile changes are unavailable right now. Try again later.' })
      const { data: updated, error } = await admin.from('profiles').update({ name }).eq('id', user.id).select('id').maybeSingle()
      if (error) {
        console.error('[api/auth] profile update failed:', error.message)
        return res.status(500).json({ error: 'Could not save your name. Try again.' })
      }
      if (!updated) await createProfile(user.id, user.email, name, 'free_personal')
      return res.status(200).json({ ok: true, name })
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

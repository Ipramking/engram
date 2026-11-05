import { createClient, SupabaseClient } from '@supabase/supabase-js'

const env = ((globalThis as any).process?.env ?? {}) as Record<string, string | undefined>

const SUPABASE_URL = env.SUPABASE_URL || 'https://lqscyshajhvzkusougpy.supabase.co'
const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY || ''
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || ''

export const isSupabaseConfigured = Boolean(SUPABASE_URL && (SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY))

// Admin client (bypasses RLS for system operations: quota tracking, key validation, team management)
let adminClient: SupabaseClient | null = null
export function getSupabaseAdmin(): SupabaseClient | null {
  if (!isSupabaseConfigured || !SUPABASE_SERVICE_ROLE_KEY) return null
  if (!adminClient) {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }
  return adminClient
}

/**
 * The Supabase auth methods Engram calls. Vercel's per-function type check can't always resolve
 * @supabase/auth-js through supabase-js, which made these methods look missing in build logs.
 */
export interface AuthApi {
  admin: {
    createUser(attrs: Record<string, unknown>): Promise<{ data: any; error: any }>
    deleteUser(id: string): Promise<{ data: any; error: any }>
  }
  signInWithPassword(creds: { email: string; password: string }): Promise<{ data: any; error: any }>
  getUser(jwt?: string): Promise<{ data: any; error: any }>
}
export const authApi = (client: SupabaseClient) => client.auth as unknown as AuthApi

// Client for user-facing auth (sign in, sign up, token validation)
let authClient: SupabaseClient | null = null
export function getSupabaseAuth(): SupabaseClient | null {
  if (!isSupabaseConfigured || !SUPABASE_ANON_KEY) return null
  if (!authClient) {
    authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
      },
    })
  }
  return authClient
}

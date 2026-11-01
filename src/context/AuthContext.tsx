import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { safeJson } from '../lib/api'

export interface User {
  id: string
  email: string
  name?: string
  plan_tier?: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  loading: boolean
  error: string | null
  login: (email: string, pass: string) => Promise<{ ok: boolean; error?: string }>
  register: (email: string, pass: string, name?: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_KEY = 'engram.auth_token'
const USER_KEY = 'engram.auth_user'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem(USER_KEY)
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const saveSession = (newToken: string | null, newUser: User | null) => {
    setToken(newToken)
    setUser(newUser)
    try {
      if (newToken) {
        localStorage.setItem(TOKEN_KEY, newToken)
      } else {
        localStorage.removeItem(TOKEN_KEY)
      }
      if (newUser) {
        localStorage.setItem(USER_KEY, JSON.stringify(newUser))
      } else {
        localStorage.removeItem(USER_KEY)
      }
    } catch {}
  }

  const refreshUser = async () => {
    if (!token) {
      setLoading(false)
      return
    }
    try {
      const res = await fetch('/api/auth?action=me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const data = await safeJson(res)
      if (res.ok && data?.user) {
        setUser(data.user)
        try {
          localStorage.setItem(USER_KEY, JSON.stringify(data.user))
        } catch {}
      } else {
        // Token expired or invalid
        saveSession(null, null)
      }
    } catch (err: any) {
      console.warn('Failed to refresh user:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshUser()
  }, [])

  const login = async (email: string, pass: string) => {
    setError(null)
    try {
      const res = await fetch('/api/auth?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email, password: pass }),
      })
      const data = await safeJson(res)
      if (!res.ok) {
        const msg = data?.error || 'Failed to sign in'
        setError(msg)
        return { ok: false, error: msg }
      }

      const sessionToken = data?.session?.access_token || 'session_' + data?.user?.id
      saveSession(sessionToken, data?.user)
      return { ok: true }
    } catch (err: any) {
      const msg = err?.message || 'Network error during login'
      setError(msg)
      return { ok: false, error: msg }
    }
  }

  const register = async (email: string, pass: string, name?: string) => {
    setError(null)
    try {
      const res = await fetch('/api/auth?action=register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', email, password: pass, name }),
      })
      const data = await safeJson(res)
      if (!res.ok) {
        const msg = data?.error || 'Failed to create account'
        setError(msg)
        return { ok: false, error: msg }
      }

      if (data?.session?.access_token) {
        saveSession(data.session.access_token, data.user)
      } else if (data?.user) {
        saveSession('session_' + data.user.id, data.user)
      }
      return { ok: true }
    } catch (err: any) {
      const msg = err?.message || 'Network error during registration'
      setError(msg)
      return { ok: false, error: msg }
    }
  }

  const logout = async () => {
    try {
      await fetch('/api/auth?action=logout', { method: 'POST' })
    } catch {}
    saveSession(null, null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        error,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { login as apiLogin } from '../api/auth'
import type { UserOut } from '../api/auth'
import { setToken, getToken } from '../api/client'

interface AuthCtx {
  token: string | null
  user: UserOut | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthCtx | null>(null)

function decodeUserFromToken(tok: string | null, fallbackUsername = 'admin'): UserOut | null {
  if (!tok) return null
  try {
    const parts = tok.split('.')
    if (parts.length < 2) return null
    const payload = JSON.parse(atob(parts[1]))
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      setToken(null)
      return null
    }
    return {
      user_id: payload.sub || '',
      username: payload.uname ?? fallbackUsername,
      email: payload.uname ?? fallbackUsername,
      roles: payload.roles ?? ['ADMIN'],
      is_active: true,
    }
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => {
    const stored = getToken()
    const u = decodeUserFromToken(stored)
    return u ? stored : null
  })

  const [user, setUser] = useState<UserOut | null>(() => {
    const stored = getToken()
    return decodeUserFromToken(stored)
  })

  const login = useCallback(async (username: string, password: string) => {
    const resp = await apiLogin(username, password)
    setToken(resp.access_token)
    setTokenState(resp.access_token)
    const decoded = decodeUserFromToken(resp.access_token, username)
    setUser(decoded ?? { user_id: '', username, email: username, roles: ['ADMIN'], is_active: true })
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setTokenState(null)
    setUser(null)
  }, [])

  // Listen for unauthorized 401 events dispatched by Axios interceptor
  useEffect(() => {
    const handleUnauthorized = () => {
      setToken(null)
      setTokenState(null)
      setUser(null)
    }
    window.addEventListener('vajrax_auth_unauthorized', handleUnauthorized)
    return () => window.removeEventListener('vajrax_auth_unauthorized', handleUnauthorized)
  }, [])

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

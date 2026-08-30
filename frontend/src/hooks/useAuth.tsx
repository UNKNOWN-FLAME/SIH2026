import React, { createContext, useContext, useState, useCallback } from 'react'
import { login as apiLogin } from '../api/auth'
import type { UserOut } from '../api/auth'
import { setToken } from '../api/client'

interface AuthCtx {
  token: string | null
  user: UserOut | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null)
  const [user, setUser] = useState<UserOut | null>(null)

  const login = useCallback(async (username: string, password: string) => {
    const resp = await apiLogin(username, password)
    setToken(resp.access_token)
    setTokenState(resp.access_token)
    // Decode basic user info from JWT payload (base64)
    try {
      const payload = JSON.parse(atob(resp.access_token.split('.')[1]))
      setUser({
        user_id: payload.sub,
        username: payload.uname ?? username,
        email: payload.uname ?? username,
        roles: payload.roles ?? [],
        is_active: true,
      })
    } catch {
      setUser({ user_id: '', username, email: username, roles: [], is_active: true })
    }
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setTokenState(null)
    setUser(null)
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

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import type { User, Profile, RoleName } from "../types"
import * as authService from "../services/authService"

const SESSION_KEY = "eventflow_session"

interface AuthState {
  user: User | null
  profile: Profile | null
  role: RoleName | null
  isAuthenticated: boolean
  isLoading: boolean
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<void>
  logout: () => void
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    role: null,
    isAuthenticated: false,
    isLoading: true,
  })

  useEffect(() => {
    const email = localStorage.getItem(SESSION_KEY)
    if (email) {
      authService
        .getProfileByEmail(email)
        .then((result) => {
          setState({
            user: result.user,
            profile: result.profile,
            role: result.role,
            isAuthenticated: true,
            isLoading: false,
          })
        })
        .catch(() => {
          localStorage.removeItem(SESSION_KEY)
          setState((s) => ({ ...s, isLoading: false }))
        })
    } else {
      setState((s) => ({ ...s, isLoading: false }))
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setState((s) => ({ ...s, isLoading: true }))
    try {
      const result = await authService.login(email, password)
      localStorage.setItem(SESSION_KEY, email)
      setState({
        user: result.user,
        profile: result.profile,
        role: result.role,
        isAuthenticated: true,
        isLoading: false,
      })
    } catch {
      setState((s) => ({ ...s, isLoading: false }))
      throw new Error("Invalid email or password")
    }
  }, [])

  const register = useCallback(async (email: string, password: string, firstName: string, lastName: string) => {
    setState((s) => ({ ...s, isLoading: true }))
    try {
      const result = await authService.register(email, password, firstName, lastName)
      localStorage.setItem(SESSION_KEY, email)
      setState({
        user: result.user,
        profile: result.profile,
        role: result.role,
        isAuthenticated: true,
        isLoading: false,
      })
    } catch {
      setState((s) => ({ ...s, isLoading: false }))
      throw new Error("Registration failed")
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY)
    setState({ user: null, profile: null, role: null, isAuthenticated: false, isLoading: false })
  }, [])

  const refreshProfile = useCallback(async () => {
    const email = state.user?.email
    if (!email) return
    const result = await authService.getProfileByEmail(email)
    setState((s) => ({ ...s, user: result.user, profile: result.profile, role: result.role }))
  }, [state.user?.email])

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}

/**
 * In-memory holder for the access token issued by the database
 * (see supabase/migrations/2026-11-15_rls_step1_identity.sql).
 *
 * The token is never written to localStorage: the existing device-session
 * token in localStorage is still what keeps the user signed in, and a fresh
 * JWT is minted on every restore. A page reload simply asks for a new one.
 */

type Listener = (token: string | null) => void

let accessToken: string | null = null
const listeners = new Set<Listener>()

export function getAccessToken(): string | null {
  return accessToken
}

export function setAccessToken(token: string | null): void {
  if (token === accessToken) return
  accessToken = token
  listeners.forEach((listener) => {
    try {
      listener(token)
    } catch {
      // a broken listener must never break authentication
    }
  })
}

export function onAccessTokenChange(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

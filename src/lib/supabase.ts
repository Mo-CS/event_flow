import { createClient } from "@supabase/supabase-js"
import { getAccessToken, onAccessTokenChange } from "./authToken"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://vcmsdtighsmmwssyuese.supabase.co"
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjbXNkdGlnaHNtbXdzc3l1ZXNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MTE5MTksImV4cCI6MjA5OTE4NzkxOX0.Y4kFTQYcyodvwWlBB2QOL-V9ShCs7EZ3Iryfap-Tgcg"

/**
 * Attach the database-issued access token (when there is one) to every request.
 * supabase-js would otherwise send the anon key, which carries no identity and
 * therefore cannot satisfy the row level security policies.
 */
const authFetch: typeof fetch = (input, init) => {
  const token = getAccessToken()
  if (!token) return fetch(input, init)

  const headers = new Headers(init?.headers)
  headers.set("Authorization", `Bearer ${token}`)
  return fetch(input, { ...init, headers })
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: authFetch },
})

// Realtime (event chat, in-meeting chat) authenticates over its own websocket,
// so it needs the token separately.
onAccessTokenChange((token) => {
  if (!token) return
  const realtime = supabase.realtime as unknown as { setAuth?: (value?: string) => void }
  if (typeof realtime.setAuth === "function") realtime.setAuth(token)
})

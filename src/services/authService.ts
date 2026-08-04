import { supabase } from "../lib/supabase"
import type { User, Profile, RoleName } from "../types"
import { sha256 } from "js-sha256"

interface AuthResult {
  user: User
  profile: Profile
  role: RoleName
}

async function hashPassword(password: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoder = new TextEncoder()
    const data = encoder.encode(password)
    const hashBuffer = await crypto.subtle.digest("SHA-256", data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
  }
  // Fallback for non-secure contexts (phone via HTTP, etc.)
  return sha256(password)
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const { data: user, error } = await supabase
    .from("users")
    .select("*, profile:profiles!inner(*, role:roles!inner(*))")
    .eq("email", email)
    .single()

  if (error || !user) throw new Error("Invalid email or password")
  if (user.suspended) throw new Error("Account is suspended")

  const passwordHash = await hashPassword(password)
  if (user.password_hash !== passwordHash) throw new Error("Invalid email or password")

  const profile = user.profile
  if (!profile) throw new Error("Profile not found")

  return {
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      suspended: user.suspended,
    },
    profile: {
      id: profile.id,
      userId: profile.user_id,
      firstName: profile.first_name,
      lastName: profile.last_name,
      phoneNumber: profile.phone_number,
      avatarUrl: profile.avatar_url,
      roleId: profile.role_id,
    },
    role: profile.role.name as RoleName,
  }
}

export async function getProfileByEmail(email: string): Promise<AuthResult> {
  const { data: user, error } = await supabase
    .from("users")
    .select("*, profile:profiles!inner(*, role:roles!inner(*))")
    .eq("email", email)
    .single()
  if (error || !user) throw new Error("User not found")
  if (user.suspended) throw new Error("Account is suspended")

  const profile = user.profile
  if (!profile) throw new Error("Profile not found")

  return {
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      suspended: user.suspended,
    },
    profile: {
      id: profile.id,
      userId: profile.user_id,
      firstName: profile.first_name,
      lastName: profile.last_name,
      phoneNumber: profile.phone_number,
      avatarUrl: profile.avatar_url,
      roleId: profile.role_id,
    },
    role: profile.role.name as RoleName,
  }
}

export async function register(email: string, password: string, firstName: string, lastName: string): Promise<AuthResult> {
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle()
  if (existing) throw new Error("Email already in use")

  const passwordHash = await hashPassword(password)

  const { data: attendeeRole } = await supabase
    .from("roles")
    .select("id")
    .eq("name", "attendee")
    .single()
  if (!attendeeRole) throw new Error("Role not found")

  const { data: user, error: userError } = await supabase
    .from("users")
    .insert({ email, password_hash: passwordHash })
    .select()
    .single()
  if (userError) throw userError

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .insert({
      user_id: user.id,
      first_name: firstName,
      last_name: lastName,
      phone_number: "",
      avatar_url: "",
      role_id: attendeeRole.id,
    })
    .select()
    .single()
  if (profileError) throw profileError

  return {
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    },
    profile: {
      id: profile.id,
      userId: profile.user_id,
      firstName: profile.first_name,
      lastName: profile.last_name,
      phoneNumber: profile.phone_number,
      avatarUrl: profile.avatar_url,
      roleId: profile.role_id,
    },
    role: "attendee",
  }
}

import { supabase } from "../lib/supabase"
import type { InvitationLink } from "../types"

function mapLink(l: Record<string, any>): InvitationLink {
  return {
    id: l.id,
    eventId: l.event_id,
    email: l.email,
    code: l.code,
    used: l.used,
    usedAt: l.used_at ?? null,
    createdAt: l.created_at,
  }
}

export async function getLinksByEvent(eventId: string): Promise<InvitationLink[]> {
  const { data, error } = await supabase
    .from("invitation_links")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at")
  if (error) throw error
  return (data ?? []).map(mapLink)
}

export async function createLink(eventId: string, email: string): Promise<InvitationLink> {
  const code = crypto.randomUUID().replace(/-/g, "").slice(0, 12)
  const { data, error } = await supabase
    .from("invitation_links")
    .insert({ event_id: eventId, email, code })
    .select()
    .single()
  if (error) throw error
  return mapLink(data)
}

export async function deleteLink(id: string): Promise<boolean> {
  const { error } = await supabase.from("invitation_links").delete().eq("id", id)
  if (error) throw error
  return true
}

export async function getLinkByCode(code: string): Promise<InvitationLink | undefined> {
  const { data, error } = await supabase
    .from("invitation_links")
    .select("*")
    .eq("code", code)
    .maybeSingle()
  if (error) throw error
  return data ? mapLink(data) : undefined
}

export async function markLinkAsUsed(id: string): Promise<void> {
  const { error } = await supabase
    .from("invitation_links")
    .update({ used: true, used_at: new Date().toISOString() })
    .eq("id", id)
  if (error) throw error
}

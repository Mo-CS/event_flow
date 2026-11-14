import { formatDateTime } from "../i18n/format"
import { t } from "../i18n"
import { supabase } from "../lib/supabase"
import { isMissingRelation } from "../lib/supabaseErrors"
import { sendNotification } from "./notificationService"
import { getAdminUserIds } from "./userService"
import type { BanRevokeRequest, BanScope, BanStatus, RoleName, UserBan } from "../types"

function mapBan(row: Record<string, any>): UserBan {
  return {
    id: row.id,
    userId: row.user_id,
    scope: row.scope,
    eventId: row.event_id ?? undefined,
    categoryId: row.category_id ?? undefined,
    reason: row.reason ?? "",
    isPermanent: row.is_permanent ?? true,
    expiresAt: row.expires_at ?? undefined,
    notifyUser: row.notify_user ?? true,
    status: row.status,
    requestedBy: row.requested_by ?? undefined,
    approvedBy: row.approved_by ?? undefined,
    approvedAt: row.approved_at ?? undefined,
    revokedBy: row.revoked_by ?? undefined,
    revokedAt: row.revoked_at ?? undefined,
    revokeReason: row.revoke_reason ?? undefined,
    createdAt: row.created_at,
  }
}

function mapRevokeRequest(row: Record<string, any>): BanRevokeRequest {
  return {
    id: row.id,
    banId: row.ban_id,
    requestedBy: row.requested_by ?? undefined,
    reason: row.reason ?? "",
    status: row.status,
    handledBy: row.handled_by ?? undefined,
    handledAt: row.handled_at ?? undefined,
    createdAt: row.created_at,
  }
}

export interface BanInput {
  userId: string
  scope: BanScope
  eventId?: string
  categoryId?: string
  reason: string
  isPermanent?: boolean
  expiresAt?: string
  notifyUser?: boolean
}

export interface BanWithNames extends UserBan {
  userName?: string
  userEmail?: string
  eventTitle?: string
  categoryName?: string
}

export async function getBans(filter?: { status?: BanStatus; userId?: string; scope?: BanScope }): Promise<BanWithNames[]> {
  let query = supabase.from("user_bans").select("*").order("created_at", { ascending: false })
  if (filter?.status) query = query.eq("status", filter.status)
  if (filter?.userId) query = query.eq("user_id", filter.userId)
  if (filter?.scope) query = query.eq("scope", filter.scope)
  const { data, error } = await query
  if (error && isMissingRelation(error)) return []
  if (error) throw error
  return attachBanNames((data ?? []).map(mapBan))
}

async function attachBanNames(bans: BanWithNames[]): Promise<BanWithNames[]> {
  if (bans.length === 0) return bans
  const userIds = [...new Set(bans.map((b) => b.userId))]
  const eventIds = [...new Set(bans.map((b) => b.eventId).filter(Boolean) as string[])]
  const categoryIds = [...new Set(bans.map((b) => b.categoryId).filter(Boolean) as string[])]

  const [users, events, categories] = await Promise.all([
    supabase.from("users").select("id, email, profile:profiles(first_name, last_name)").in("id", userIds),
    eventIds.length ? supabase.from("events").select("id, title").in("id", eventIds) : Promise.resolve({ data: [] as any[] }),
    categoryIds.length ? supabase.from("categories").select("id, name").in("id", categoryIds) : Promise.resolve({ data: [] as any[] }),
  ])

  const userMap = new Map<string, { name: string; email: string }>()
  for (const row of users.data ?? []) {
    const p: any = Array.isArray((row as any).profile) ? (row as any).profile[0] : (row as any).profile
    const name = `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim() || row.email
    userMap.set(row.id, { name, email: row.email })
  }
  const eventMap = new Map((events.data ?? []).map((e: any) => [e.id, e.title]))
  const categoryMap = new Map((categories.data ?? []).map((c: any) => [c.id, c.name]))

  return bans.map((b) => ({
    ...b,
    userName: userMap.get(b.userId)?.name,
    userEmail: userMap.get(b.userId)?.email,
    eventTitle: b.eventId ? eventMap.get(b.eventId) : undefined,
    categoryName: b.categoryId ? categoryMap.get(b.categoryId) : undefined,
  }))
}

export async function getBanById(id: string): Promise<UserBan | undefined> {
  const { data, error } = await supabase.from("user_bans").select("*").eq("id", id).maybeSingle()
  if (error && isMissingRelation(error)) return undefined
  if (error) throw error
  return data ? mapBan(data) : undefined
}

export async function getBansForUser(userId: string): Promise<UserBan[]> {
  const { data, error } = await supabase
    .from("user_bans")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
  if (error && isMissingRelation(error)) return []
  if (error) throw error
  return (data ?? []).map(mapBan)
}

/** Only active, non-expired bans block a new registration. */
export async function checkBanForRegistration(
  userId: string,
  eventId: string,
  categoryId?: string,
): Promise<UserBan | null> {
  const { data, error } = await supabase
    .from("user_bans")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
  if (error && isMissingRelation(error)) return null
  if (error) throw error
  const now = Date.now()
  const active = (data ?? [])
    .map(mapBan)
    .filter((ban) => ban.isPermanent || !ban.expiresAt || new Date(ban.expiresAt).getTime() > now)

  return (
    active.find((ban) => ban.scope === "global") ??
    active.find((ban) => ban.scope === "event" && ban.eventId === eventId) ??
    active.find((ban) => ban.scope === "category" && !!categoryId && ban.categoryId === categoryId) ??
    null
  )
}

export function describeBan(ban: UserBan): string {
  if (ban.scope === "global") return t("a global ban")
  if (ban.scope === "event") return t("a ban for this event")
  return t("a ban in this event category")
}

function banNotice(ban: UserBan): string {
  const expiry = ban.isPermanent
    ? t("This ban is permanent.")
    : ban.expiresAt
      ? t("It ends on {date}.", { date: formatDateTime(new Date(ban.expiresAt)) })
      : ""
  return t(
    "You have been restricted by {ban}. {reason}{expiry} You can still use your account but cannot register for new events covered by this ban.",
    {
      ban: describeBan(ban),
      reason: ban.reason ? t("Reason: {reason}. ", { reason: ban.reason }) : "",
      expiry,
    },
  )
}

async function notifyAdmins(message: string, link: string): Promise<void> {
  try {
    const admins = await getAdminUserIds()
    await Promise.all(
      admins.map((admin) =>
        sendNotification(admin.userId, "ban_request", message, link).catch(() => undefined),
      ),
    )
  } catch {
    // best-effort
  }
}

/**
 * Creates a ban. Administrators create active bans immediately; organizer
 * requests are stored as pending until an administrator approves them.
 */
export async function createBan(input: BanInput, actorUserId: string, actorRole: RoleName): Promise<UserBan> {
  if (input.scope !== "global" && input.scope !== "event" && input.scope !== "category") {
    throw new Error(t("Invalid ban scope"))
  }
  if (input.scope === "event" && !input.eventId) throw new Error(t("Choose the event for this ban"))
  if (input.scope === "category" && !input.categoryId) throw new Error(t("Choose the category for this ban"))
  if (!input.reason.trim()) throw new Error(t("A reason is required"))

  const isAdmin = actorRole === "admin"
  const { data, error } = await supabase
    .from("user_bans")
    .insert({
      user_id: input.userId,
      scope: input.scope,
      event_id: input.scope === "event" ? input.eventId : null,
      category_id: input.scope === "category" ? input.categoryId : null,
      reason: input.reason.trim(),
      is_permanent: input.isPermanent ?? true,
      expires_at: input.isPermanent === false ? input.expiresAt || null : null,
      notify_user: input.notifyUser ?? true,
      status: isAdmin ? "active" : "pending",
      requested_by: actorUserId,
      approved_by: isAdmin ? actorUserId : null,
      approved_at: isAdmin ? new Date().toISOString() : null,
    })
    .select()
    .single()
  if (error) throw error
  const ban = mapBan(data)

  if (isAdmin) {
    if (ban.notifyUser) {
      await sendNotification(ban.userId, "ban_notice", banNotice(ban), "/dashboard/notifications").catch(() => undefined)
    }
  } else {
    const existingCount = await getUserRegistrationSummary(input.userId)
      .then((rows) => rows.length)
      .catch(() => 0)
    const existingNote = existingCount > 0
      ? ` ${t("The user currently has {count} existing registration(s) that will not be cancelled.", { count: existingCount })}`
      : ` ${t("The user has no existing registrations.")}`
    await notifyAdmins(
      t("An organizer requested {ban} for a user. Approval is required before it takes effect.{note}", {
        ban: describeBan(ban),
        note: existingNote,
      }),
      "/dashboard/bans",
    )
  }

  return ban
}

export async function approveBan(id: string, adminId: string): Promise<UserBan> {
  const { data, error } = await supabase
    .from("user_bans")
    .update({ status: "active", approved_by: adminId, approved_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  const ban = mapBan(data)
  if (ban.notifyUser) {
    await sendNotification(ban.userId, "ban_notice", banNotice(ban), "/dashboard/notifications").catch(() => undefined)
  }
  return ban
}

export async function rejectBan(id: string, adminId: string): Promise<UserBan> {
  const { data, error } = await supabase
    .from("user_bans")
    .update({ status: "rejected", approved_by: adminId, approved_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  return mapBan(data)
}

export async function revokeBan(id: string, adminId: string, reason: string): Promise<UserBan> {
  const { data, error } = await supabase
    .from("user_bans")
    .update({
      status: "revoked",
      revoked_by: adminId,
      revoked_at: new Date().toISOString(),
      revoke_reason: reason,
    })
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  const ban = mapBan(data)

  await sendNotification(
    ban.userId,
    "ban_approved",
    t("The restriction on your account has been lifted.{note}", {
      note: reason ? ` ${t("Note: {reason}", { reason })}` : "",
    }),
    "/dashboard/notifications",
  ).catch(() => undefined)

  return ban
}

export async function requestBanRevoke(banId: string, requestedBy: string, reason: string): Promise<BanRevokeRequest> {
  if (!reason.trim()) throw new Error(t("Please explain why the ban should be lifted"))
  const { data, error } = await supabase
    .from("ban_revoke_requests")
    .insert({ ban_id: banId, requested_by: requestedBy, reason: reason.trim() })
    .select()
    .single()
  if (error) throw error
  await notifyAdmins(t("An organizer requested to lift a user ban. Review it on the Bans page."), "/dashboard/bans")
  return mapRevokeRequest(data)
}

export async function getBanRevokeRequests(status?: "pending" | "approved" | "rejected"): Promise<BanRevokeRequest[]> {
  let query = supabase.from("ban_revoke_requests").select("*").order("created_at", { ascending: false })
  if (status) query = query.eq("status", status)
  const { data, error } = await query
  if (error && isMissingRelation(error)) return []
  if (error) throw error
  return (data ?? []).map(mapRevokeRequest)
}

export async function approveBanRevoke(requestId: string, adminId: string): Promise<void> {
  const { data: request, error } = await supabase
    .from("ban_revoke_requests")
    .select("*, ban:user_bans(*)")
    .eq("id", requestId)
    .maybeSingle()
  if (error) throw error
  if (!request) throw new Error(t("Request not found"))
  const banRow: any = Array.isArray((request as any).ban) ? (request as any).ban[0] : (request as any).ban
  if (!banRow) throw new Error(t("Ban not found"))

  await revokeBan(banRow.id, adminId, request.reason ?? t("Approved revocation request"))
  await supabase
    .from("ban_revoke_requests")
    .update({ status: "approved", handled_by: adminId, handled_at: new Date().toISOString() })
    .eq("id", requestId)
}

export async function rejectBanRevoke(requestId: string, adminId: string): Promise<void> {
  const { error } = await supabase
    .from("ban_revoke_requests")
    .update({ status: "rejected", handled_by: adminId, handled_at: new Date().toISOString() })
    .eq("id", requestId)
  if (error) throw error
}

export interface UserRegistrationSummary {
  id: string
  eventId: string
  eventTitle: string
  status: string
  registeredAt: string
}

/** Used by administrators before confirming a ban: shows the user's existing registrations. */
export async function getUserRegistrationSummary(userId: string): Promise<UserRegistrationSummary[]> {
  const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", userId).maybeSingle()
  if (!profile) return []
  const { data, error } = await supabase
    .from("registrations")
    .select("id, event_id, status, registered_at, event:events(title)")
    .eq("attendee_id", profile.id)
    .order("registered_at", { ascending: false })
  if (error) throw error
  return (data ?? []).map((row: any) => {
    const event = Array.isArray(row.event) ? row.event[0] : row.event
    return {
      id: row.id,
      eventId: row.event_id,
      eventTitle: event?.title ?? t("Unknown event"),
      status: row.status,
      registeredAt: row.registered_at,
    }
  })
}

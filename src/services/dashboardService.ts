import { supabase } from "../lib/supabase"
import type { Event } from "../types"

export async function getAdminStats() {
  const [
    { count: totalUsers },
    { count: totalEvents },
    { count: publishedEvents },
    { count: totalRegistrations },
    { count: confirmedRegistrations },
    { count: totalVenues },
    { count: totalCategories },
    { count: totalFeedback },
  ] = await Promise.all([
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase.from("events").select("*", { count: "exact", head: true }),
    supabase.from("events").select("*", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("registrations").select("*", { count: "exact", head: true }),
    supabase.from("registrations").select("*", { count: "exact", head: true }).eq("status", "confirmed"),
    supabase.from("venues").select("*", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("categories").select("*", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("feedback").select("*", { count: "exact", head: true }),
  ])

  return {
    totalUsers: totalUsers ?? 0,
    totalEvents: totalEvents ?? 0,
    publishedEvents: publishedEvents ?? 0,
    totalRegistrations: totalRegistrations ?? 0,
    confirmedRegistrations: confirmedRegistrations ?? 0,
    totalVenues: totalVenues ?? 0,
    totalCategories: totalCategories ?? 0,
    totalFeedback: totalFeedback ?? 0,
  }
}

export async function getRecentActivity() {
  const { data } = await supabase
    .from("audit_logs")
    .select("action, details, created_at")
    .order("created_at", { ascending: false })
    .limit(5)

  if (!data) return []

  return data.map((log) => ({
    action: log.action,
    detail: log.details,
    time: formatRelativeTime(log.created_at),
  }))
}

export async function getUpcomingEvents(limit = 5) {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("status", "published")
    .gte("start_date", new Date().toISOString())
    .order("start_date")
    .limit(limit)
  if (error) throw error
  return (data ?? []).map(mapEvent)
}

export async function getOrganizerStats(organizerId: string) {
  const { data: myEvents } = await supabase
    .from("events")
    .select("*")
    .eq("organizer_id", organizerId)

  const events = myEvents ?? []
  const myEventIds = events.map((e) => e.id)

  const { count: totalRegs } = await supabase
    .from("registrations")
    .select("*", { count: "exact", head: true })
    .in("event_id", myEventIds)

  const { count: confirmedRegs } = await supabase
    .from("registrations")
    .select("*", { count: "exact", head: true })
    .in("event_id", myEventIds)
    .eq("status", "confirmed")

  return {
    totalEvents: events.length,
    publishedEvents: events.filter((e) => e.status === "published").length,
    draftEvents: events.filter((e) => e.status === "draft").length,
    totalRegistrations: totalRegs ?? 0,
    confirmedRegistrations: confirmedRegs ?? 0,
    events: events.map(mapEvent),
  }
}

export async function getAttendeeStats(attendeeId: string) {
  const { data: myRegs } = await supabase
    .from("registrations")
    .select("*")
    .eq("attendee_id", attendeeId)

  const regs = myRegs ?? []
  const myEventIds = regs.map((r) => r.event_id)

  const { data: myEvents } = myEventIds.length > 0
    ? await supabase.from("events").select("*").in("id", myEventIds)
    : { data: [] }

  const events = (myEvents ?? []).map(mapEvent)
  const now = new Date()

  return {
    totalRegistered: regs.length,
    confirmedRegistrations: regs.filter((r) => r.status === "confirmed").length,
    upcomingEvents: events.filter((e) => new Date(e.startDate) > now),
    pastEvents: events.filter((e) => new Date(e.endDate) < now),
    tickets: regs.map((r) => ({
      event: events.find((e) => e.id === r.event_id),
      status: r.status,
      registeredAt: r.registered_at,
    })),
  }
}

export async function getNotifications(userId: string) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
  if (error) throw error
  return (data ?? []).map((n: Record<string, any>) => ({
    id: n.id,
    userId: n.user_id,
    type: n.type,
    message: n.message,
    readAt: n.read_at ?? null,
    createdAt: n.created_at,
  }))
}

export async function getRegistrationTrends() {
  const { data } = await supabase
    .from("registrations")
    .select("registered_at")

  if (!data || data.length === 0) {
    return [
      { month: "Jan", count: 0 },
      { month: "Feb", count: 0 },
      { month: "Mar", count: 0 },
      { month: "Apr", count: 0 },
      { month: "May", count: 0 },
      { month: "Jun", count: 0 },
    ]
  }

  const byMonth: Record<string, number> = {}
  for (const r of data) {
    const m = new Date(r.registered_at).toLocaleString("en-US", { month: "short" })
    byMonth[m] = (byMonth[m] || 0) + 1
  }

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
  return months.map((month) => ({ month, count: byMonth[month] ?? 0 }))
}

function mapEvent(e: Record<string, any>): Event {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    coverImageUrl: e.cover_image_url,
    organizerId: e.organizer_id,
    venueId: e.venue_id,
    capacity: e.capacity,
    registrationDeadline: e.registration_deadline,
    startDate: e.start_date,
    endDate: e.end_date,
    status: e.status,
    visibility: e.visibility,
    contactEmail: e.contact_email,
    categoryId: e.category_id,
    deletedAt: e.deleted_at ?? undefined,
  }
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins} minute${mins > 1 ? "s" : ""} ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days > 1 ? "s" : ""} ago`
}

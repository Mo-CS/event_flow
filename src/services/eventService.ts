import { supabase } from "../lib/supabase"
import type { Event, Session, Speaker, Registration, Feedback, Ticket } from "../types"
import QRCode from "qrcode"

export async function getEvents(): Promise<Event[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("status", "published")
    .eq("visibility", "public")
    .is("deleted_at", null)
    .order("start_date")
  if (error) throw error
  return data.map(mapEvent)
}

export async function getAllEvents(): Promise<Event[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
  if (error) throw error
  return data.map(mapEvent)
}

export async function getEventById(id: string): Promise<Event | undefined> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single()
  if (error) throw error
  return data ? mapEvent(data) : undefined
}

export async function getEventsByOrganizer(organizerId: string): Promise<Event[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("organizer_id", organizerId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
  if (error) throw error
  return data.map(mapEvent)
}

/**
 * All events a user can manage: their own, events they are assigned to
 * (event_organizers), plus every event when role is admin or managesAllEvents.
 */
export async function getEventsForUser(
  profileId: string,
  userId: string,
  role: string,
  managesAllEvents: boolean,
): Promise<Event[]> {
  if (role === "admin" || managesAllEvents) return getAllEvents()

  const own = await getEventsByOrganizer(profileId)

  const { data: assigned } = await supabase
    .from("event_organizers")
    .select("event_id")
    .eq("user_id", userId)
  const eventIds = (assigned ?? []).map((r: any) => r.event_id)

  let fromAssignments: Event[] = []
  if (eventIds.length > 0) {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .in("id", eventIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
    if (error) throw error
    fromAssignments = data.map(mapEvent)
  }

  const seen = new Set<string>()
  return [...own, ...fromAssignments].filter((e) => {
    if (seen.has(e.id)) return false
    seen.add(e.id)
    return true
  })
}

export async function createEvent(data: Omit<Event, "id">): Promise<Event> {
  const { data: inserted, error } = await supabase
    .from("events")
    .insert(toDbEvent(data))
    .select()
    .single()
  if (error) throw error
  return mapEvent(inserted)
}

export async function updateEvent(id: string, data: Partial<Event>): Promise<Event | undefined> {
  const payload: Record<string, unknown> = {}
  if (data.title !== undefined) payload.title = data.title
  if (data.description !== undefined) payload.description = data.description
  if (data.coverImageUrl !== undefined) payload.cover_image_url = data.coverImageUrl
  if (data.organizerId !== undefined) payload.organizer_id = data.organizerId
  if (data.venueId !== undefined) payload.venue_id = data.venueId || null
  if (data.capacity !== undefined) payload.capacity = data.capacity
  if (data.registrationDeadline !== undefined) payload.registration_deadline = data.registrationDeadline
  if (data.startDate !== undefined) payload.start_date = data.startDate
  if (data.endDate !== undefined) payload.end_date = data.endDate
  if (data.status !== undefined) payload.status = data.status
  if (data.visibility !== undefined) payload.visibility = data.visibility
  if (data.contactEmail !== undefined) payload.contact_email = data.contactEmail
  if (data.categoryId !== undefined) payload.category_id = data.categoryId
  if (data.eventType !== undefined) payload.event_type = data.eventType
  if (data.meetingLink !== undefined) payload.meeting_link = data.meetingLink
  const { data: updated, error } = await supabase
    .from("events")
    .update(payload)
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  return updated ? mapEvent(updated) : undefined
}

export async function setMeetingLink(
  id: string,
  link: string,
  generatedBy: string,
): Promise<Event | undefined> {
  const { data: updated, error } = await supabase
    .from("events")
    .update({
      meeting_link: link,
      meeting_link_generated_by: generatedBy,
      meeting_link_created_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  return updated ? mapEvent(updated) : undefined
}

export function isMeetingLinkVisible(event: Pick<Event, "eventType" | "meetingLink" | "startDate" | "meetingLinkCreatedAt">): boolean {
  if (event.eventType !== "online" || !event.meetingLink) return false
  const oneHourBefore = new Date(event.startDate).getTime() - 60 * 60 * 1000
  return Date.now() >= oneHourBefore
}

export async function deleteEvent(id: string): Promise<boolean> {
  const { error } = await supabase
    .from("events")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
  if (error) throw error
  return true
}

export async function restoreEvent(id: string): Promise<Event | undefined> {
  const { data, error } = await supabase
    .from("events")
    .update({ deleted_at: null })
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  return data ? mapEvent(data) : undefined
}

export async function duplicateEvent(id: string): Promise<Event | undefined> {
  const original = await getEventById(id)
  if (!original) return undefined
  return createEvent({
    ...original,
    title: `${original.title} (Copy)`,
    status: "draft",
    visibility: "private",
    meetingLink: undefined,
    meetingLinkGeneratedBy: undefined,
    meetingLinkCreatedAt: undefined,
  })
}

export async function publishEvent(id: string): Promise<Event | undefined> {
  return updateEvent(id, { status: "published" })
}

export async function archiveEvent(id: string): Promise<Event | undefined> {
  return updateEvent(id, { status: "archived" })
}

export async function setDraft(id: string): Promise<Event | undefined> {
  return updateEvent(id, { status: "draft" })
}

export async function getSessions(eventId: string): Promise<Session[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("event_id", eventId)
    .order("start_time")
  if (error) throw error
  return data.map(mapSession)
}

export async function getSpeakers(sessionId: string): Promise<Speaker[]> {
  const { data, error } = await supabase
    .from("speakers")
    .select("*")
    .eq("session_id", sessionId)
  if (error) throw error
  return data.map(mapSpeaker)
}

export async function getRegistrations(eventId: string): Promise<Registration[]> {
  const { data, error } = await supabase
    .from("registrations")
    .select("*")
    .eq("event_id", eventId)
  if (error) throw error
  return data.map(mapRegistration)
}

export async function getRegistrationForAttendee(eventId: string, attendeeId: string): Promise<Registration | undefined> {
  const { data, error } = await supabase
    .from("registrations")
    .select("*")
    .eq("event_id", eventId)
    .eq("attendee_id", attendeeId)
    .neq("status", "cancelled")
    .maybeSingle()
  if (error) throw error
  return data ? mapRegistration(data) : undefined
}

export async function registerForEvent(eventId: string, attendeeId: string, code?: string): Promise<{ registration: Registration; waitlisted: boolean }> {
  const { data: event } = await supabase
    .from("events")
    .select("title, capacity, visibility, status, start_date, end_date, registration_deadline")
    .eq("id", eventId)
    .single()
  if (!event) throw new Error("Event not found")

  if (event.status !== "published") {
    throw new Error("This event is not open for registration")
  }
  if (event.registration_deadline && new Date(event.registration_deadline).getTime() < Date.now()) {
    throw new Error("The registration deadline has passed")
  }
  if (new Date(event.end_date).getTime() < Date.now()) {
    throw new Error("This event has already ended")
  }

  if (event.visibility === "private") {
    if (!code) throw new Error("An invitation code is required for this private event")
    const { getLinkByCode } = await import("./invitationService")
    const link = await getLinkByCode(code)
    if (!link) throw new Error("Invalid invitation link")
    if (link.used) throw new Error("This invitation link has already been used")
    if (link.eventId !== eventId) throw new Error("This invitation link does not belong to this event")

    const { data: profile } = await supabase
      .from("profiles")
      .select("user:users(email)")
      .eq("id", attendeeId)
      .single()
    const attendeeEmail = (profile as any)?.user?.email
    if (!attendeeEmail || attendeeEmail !== link.email) {
      throw new Error("This invitation was sent to a different email address")
    }
  }

  const existing = await getRegistrationForAttendee(eventId, attendeeId)
  if (existing) throw new Error("Already registered for this event")

  const { count } = await supabase
    .from("registrations")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("status", "confirmed")

  const isFull = (count ?? 0) >= event.capacity

  const status = isFull ? "waitlisted" : "confirmed"

  const { data: registration, error } = await supabase
    .from("registrations")
    .insert({ event_id: eventId, attendee_id: attendeeId, status })
    .select()
    .single()
  if (error) throw error

  if (!isFull) {
    await generateTicketForRegistration(mapRegistration(registration), event.title)
  }

  const reg = mapRegistration(registration)

  // Send confirmation / waitlist notification
  const { sendNotification } = await import("./notificationService")
  const { data: prof } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("id", attendeeId)
    .single()
  if (prof) {
    if (!isFull) {
      await sendNotification(
        prof.user_id,
        "registration_confirmation",
        `Your registration for "${event.title}" has been confirmed. Your ticket is ready in your dashboard.`,
        `/events/${eventId}`,
      )
    } else {
      await sendNotification(
        prof.user_id,
        "waitlist",
        `All seats for "${event.title}" are currently taken. You've been added to the waiting list and will be notified if a spot opens up.`,
        `/events/${eventId}`,
      )
    }
  }

  if (event.visibility === "private" && code) {
    const { markLinkAsUsed } = await import("./invitationService")
    const { data: link } = await supabase
      .from("invitation_links")
      .select("id")
      .eq("code", code)
      .single()
    if (link) await markLinkAsUsed(link.id)

    // Notify the organizer(s) that the invited user has joined
    const { data: ev } = await supabase
      .from("events")
      .select("organizer_id, title")
      .eq("id", eventId)
      .single()
    const { data: orgProf } = ev
      ? await supabase.from("profiles").select("user_id").eq("id", ev.organizer_id).single()
      : { data: null }
    if (orgProf && ev) {
      await sendNotification(
        orgProf.user_id,
        "invitation_used",
        `An invited guest just registered for "${ev.title}" using their invitation link.`,
        `/events/${eventId}`,
      )
    }
  }

  return { registration: reg, waitlisted: isFull }
}

async function generateTicketForRegistration(registration: Registration, eventTitle: string): Promise<Ticket> {
  const { data: event } = await supabase
    .from("events")
    .select("title")
    .eq("id", registration.eventId)
    .single()

  const title = event?.title ?? eventTitle
  const uniqueCode = `${title.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6)}-${Date.now().toString(36).toUpperCase()}`
  const qrDataUrl = await QRCode.toDataURL(uniqueCode, { width: 300, margin: 2 })

  const { data: ticket, error } = await supabase
    .from("tickets")
    .insert({
      registration_id: registration.id,
      unique_code: uniqueCode,
      qr_code_url: qrDataUrl,
    })
    .select()
    .single()
  if (error) throw error
  return mapTicket(ticket)
}

export async function cancelRegistration(id: string): Promise<boolean> {
  const { data: reg } = await supabase
    .from("registrations")
    .select("event_id, status")
    .eq("id", id)
    .single()
  if (!reg) return false

  await supabase
    .from("registrations")
    .update({ status: "cancelled" })
    .eq("id", id)

  // Only promote a waitlisted attendee when a *confirmed* spot was freed.
  if (reg.status !== "confirmed") return true

  const { data: waitlisted } = await supabase
    .from("registrations")
    .select("*")
    .eq("event_id", reg.event_id)
    .eq("status", "waitlisted")
    .order("registered_at")
    .limit(1)

  if (waitlisted && waitlisted.length > 0) {
    await supabase
      .from("registrations")
      .update({ status: "confirmed" })
      .eq("id", waitlisted[0].id)

    const { data: ev } = await supabase
      .from("events")
      .select("title")
      .eq("id", reg.event_id)
      .single()

    if (ev) {
      await generateTicketForRegistration(mapRegistration(waitlisted[0]), ev.title)
    }
  }

  return true
}

export async function getAllRegistrations(): Promise<Registration[]> {
  const { data, error } = await supabase
    .from("registrations")
    .select("*")
  if (error) throw error
  return data.map(mapRegistration)
}

export async function getRegistrationsByAttendee(attendeeId: string): Promise<Registration[]> {
  const { data, error } = await supabase
    .from("registrations")
    .select("*")
    .eq("attendee_id", attendeeId)
    .order("registered_at", { ascending: false })
  if (error) throw error
  return data.map(mapRegistration)
}

export async function getFeedback(eventId: string): Promise<Feedback[]> {
  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .eq("event_id", eventId)
    .order("submitted_at", { ascending: false })
  if (error) throw error
  return data.map(mapFeedback)
}

export async function submitFeedback(data: Omit<Feedback, "id">): Promise<Feedback> {
  const { data: inserted, error } = await supabase
    .from("feedback")
    .insert({
      event_id: data.eventId,
      attendee_id: data.attendeeId,
      rating: data.rating,
      comment: data.comment,
    })
    .select()
    .single()
  if (error) throw error
  return mapFeedback(inserted)
}

// --- Mappers ---

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
    eventType: e.event_type === "online" ? "online" : "in_person",
    meetingLink: e.meeting_link ?? undefined,
    meetingLinkGeneratedBy: e.meeting_link_generated_by ?? undefined,
    meetingLinkCreatedAt: e.meeting_link_created_at ?? undefined,
    deletedAt: e.deleted_at ?? undefined,
  }
}

function toDbEvent(e: Omit<Event, "id">): Record<string, unknown> {
  return {
    title: e.title,
    description: e.description,
    cover_image_url: e.coverImageUrl,
    organizer_id: e.organizerId,
    venue_id: e.venueId || null,
    capacity: e.capacity,
    registration_deadline: e.registrationDeadline,
    start_date: e.startDate,
    end_date: e.endDate,
    status: e.status,
    visibility: e.visibility,
    contact_email: e.contactEmail,
    category_id: e.categoryId,
    event_type: e.eventType,
    meeting_link: e.meetingLink ?? null,
  }
}

function mapSession(s: Record<string, any>): Session {
  return {
    id: s.id,
    eventId: s.event_id,
    title: s.title,
    description: s.description,
    startTime: s.start_time,
    endTime: s.end_time,
    roomName: s.room_name,
  }
}

function mapSpeaker(s: Record<string, any>): Speaker {
  return {
    id: s.id,
    sessionId: s.session_id,
    name: s.name,
    bio: s.bio,
    imageUrl: s.image_url,
  }
}

function mapRegistration(r: Record<string, any>): Registration {
  return {
    id: r.id,
    eventId: r.event_id,
    attendeeId: r.attendee_id,
    registeredAt: r.registered_at,
    status: r.status,
  }
}

function mapTicket(t: Record<string, any>): Ticket {
  return {
    id: t.id,
    registrationId: t.registration_id,
    uniqueCode: t.unique_code,
    qrCodeUrl: t.qr_code_url,
    issuedAt: t.issued_at,
    status: t.status,
  }
}

function mapFeedback(f: Record<string, any>): Feedback {
  return {
    id: f.id,
    eventId: f.event_id,
    attendeeId: f.attendee_id,
    rating: f.rating,
    comment: f.comment,
    submittedAt: f.submitted_at,
    response: f.response ?? undefined,
    respondedAt: f.responded_at ?? undefined,
  }
}

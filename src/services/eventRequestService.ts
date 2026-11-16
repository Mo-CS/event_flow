import { supabase } from "../lib/supabase"
import { isMissingRelation } from "../lib/supabaseErrors"
import { createEvent } from "./eventService"
import { sendNotification } from "./notificationService"
import { getAdminUserIds } from "./userService"
import type { Attachment, EventRequest, EventRequestStatus, EventType } from "../types"

function mapRequest(row: Record<string, any>): EventRequest {
  return {
    id: row.id,
    requesterId: row.requester_id,
    title: row.title,
    description: row.description ?? "",
    categoryId: row.category_id ?? undefined,
    eventType: row.event_type ?? "in_person",
    method: row.method ?? "",
    targetAudience: row.target_audience ?? "",
    expectedAttendees: row.expected_attendees ?? undefined,
    trainerName: row.trainer_name ?? "",
    trainerBio: row.trainer_bio ?? "",
    trainerContact: row.trainer_contact ?? "",
    preferredStart: row.preferred_start ?? undefined,
    preferredEnd: row.preferred_end ?? undefined,
    venueId: row.venue_id ?? undefined,
    estimatedBudget: row.estimated_budget != null ? Number(row.estimated_budget) : undefined,
    currencyCode: row.currency_code ?? "USD",
    attachments: Array.isArray(row.attachments) ? (row.attachments as Attachment[]) : [],
    status: row.status,
    adminNotes: row.admin_notes ?? "",
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    createdEventId: row.created_event_id ?? undefined,
    createdAt: row.created_at,
  }
}

export interface EventRequestInput {
  title: string
  description: string
  categoryId?: string
  eventType: EventType
  method?: string
  targetAudience?: string
  expectedAttendees?: number
  trainerName?: string
  trainerBio?: string
  trainerContact?: string
  preferredStart?: string
  preferredEnd?: string
  venueId?: string
  estimatedBudget?: number
  currencyCode?: string
  attachments?: Attachment[]
}

export interface EventRequestWithRequester extends EventRequest {
  requesterName?: string
  requesterEmail?: string
}

async function attachRequesterNames(requests: EventRequestWithRequester[]): Promise<EventRequestWithRequester[]> {
  if (requests.length === 0) return requests
  const ids = [...new Set(requests.map((r) => r.requesterId))]
  const { data } = await supabase
    .from("users")
    .select("id, email, profile:profiles(first_name, last_name)")
    .in("id", ids)
  const map = new Map<string, { name: string; email: string }>()
  for (const row of data ?? []) {
    const p: any = Array.isArray((row as any).profile) ? (row as any).profile[0] : (row as any).profile
    map.set(row.id, {
      name: `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim() || row.email,
      email: row.email,
    })
  }
  return requests.map((r) => ({
    ...r,
    requesterName: map.get(r.requesterId)?.name,
    requesterEmail: map.get(r.requesterId)?.email,
  }))
}

export async function getEventRequests(filter?: { status?: EventRequestStatus; requesterId?: string }): Promise<EventRequestWithRequester[]> {
  let query = supabase.from("event_requests").select("*").order("created_at", { ascending: false })
  if (filter?.status) query = query.eq("status", filter.status)
  if (filter?.requesterId) query = query.eq("requester_id", filter.requesterId)
  const { data, error } = await query
  if (error && isMissingRelation(error)) return []
  if (error) throw error
  return attachRequesterNames((data ?? []).map(mapRequest))
}

export async function getEventRequestById(id: string): Promise<EventRequestWithRequester | undefined> {
  const { data, error } = await supabase.from("event_requests").select("*").eq("id", id).maybeSingle()
  if (error && isMissingRelation(error)) return undefined
  if (error) throw error
  if (!data) return undefined
  const [request] = await attachRequesterNames([mapRequest(data)])
  return request
}

export async function createEventRequest(input: EventRequestInput, requesterId: string): Promise<EventRequest> {
  if (!input.title.trim()) throw new Error("Event title is required")
  if (!input.description.trim()) throw new Error("Please describe the event")
  if (input.preferredStart && input.preferredEnd && new Date(input.preferredEnd) < new Date(input.preferredStart)) {
    throw new Error("The preferred end date must be after the start date")
  }

  const { data, error } = await supabase
    .from("event_requests")
    .insert({
      requester_id: requesterId,
      title: input.title.trim(),
      description: input.description.trim(),
      category_id: input.categoryId || null,
      event_type: input.eventType,
      method: input.method ?? "",
      target_audience: input.targetAudience ?? "",
      expected_attendees: input.expectedAttendees ?? null,
      trainer_name: input.trainerName ?? "",
      trainer_bio: input.trainerBio ?? "",
      trainer_contact: input.trainerContact ?? "",
      preferred_start: input.preferredStart || null,
      preferred_end: input.preferredEnd || null,
      venue_id: input.venueId || null,
      estimated_budget: input.estimatedBudget ?? null,
      currency_code: input.currencyCode || "USD",
      attachments: input.attachments ?? [],
    })
    .select()
    .single()
  if (error) throw error

  try {
    const admins = await getAdminUserIds()
    await Promise.all(
      admins.map((admin) =>
        sendNotification(
          admin.userId,
          "event_request",
          `New event request "${input.title}" from a registered user is waiting for review.`,
          "/dashboard/event-requests",
        ).catch(() => undefined),
      ),
    )
  } catch {
    // notifications are best-effort
  }

  return mapRequest(data)
}

/** The requester may refine budget and attachments while the request is open. */
export async function updateEventRequest(
  id: string,
  patch: Partial<Pick<EventRequestInput, "estimatedBudget" | "currencyCode" | "attachments" | "preferredStart" | "preferredEnd" | "description">>,
): Promise<EventRequest> {
  const payload: Record<string, unknown> = {}
  if (patch.estimatedBudget !== undefined) payload.estimated_budget = patch.estimatedBudget
  if (patch.currencyCode !== undefined) payload.currency_code = patch.currencyCode
  if (patch.attachments !== undefined) payload.attachments = patch.attachments
  if (patch.preferredStart !== undefined) payload.preferred_start = patch.preferredStart || null
  if (patch.preferredEnd !== undefined) payload.preferred_end = patch.preferredEnd || null
  if (patch.description !== undefined) payload.description = patch.description
  if (Object.keys(payload).length === 0) throw new Error("Nothing to update")
  const { data, error } = await supabase.from("event_requests").update(payload).eq("id", id).select().single()
  if (error) throw error
  return mapRequest(data)
}

export async function setEventRequestStatus(
  id: string,
  status: EventRequestStatus,
  adminId: string,
  adminNotes?: string,
): Promise<EventRequest> {
  const payload: Record<string, unknown> = {
    status,
    reviewed_by: adminId,
    reviewed_at: new Date().toISOString(),
  }
  if (adminNotes !== undefined) payload.admin_notes = adminNotes
  const { data, error } = await supabase.from("event_requests").update(payload).eq("id", id).select().single()
  if (error) throw error
  const request = mapRequest(data)
  await notifyRequester(request, status)
  return request
}

async function notifyRequester(request: EventRequest, status: EventRequestStatus): Promise<void> {
  const messages: Record<EventRequestStatus, string> = {
    pending: `Your event request "${request.title}" is pending review.`,
    reviewing: `An administrator is reviewing your event request "${request.title}".`,
    approved: `Your event request "${request.title}" was approved and a draft event was created.`,
    rejected: `Your event request "${request.title}" was not approved.${request.adminNotes ? ` Note: ${request.adminNotes}` : ""}`,
    needs_info: `More information is needed for your event request "${request.title}".${request.adminNotes ? ` Note: ${request.adminNotes}` : ""}`,
  }
  await sendNotification(
    request.requesterId,
    "event_request_update",
    messages[status],
    request.createdEventId ? `/events/${request.createdEventId}` : "/dashboard/event-requests",
  ).catch(() => undefined)
}

export interface ApprovalEventData {
  organizerId: string
  categoryId: string
  venueId?: string
  eventType: EventType
  capacity: number
  onlineCapacity?: number
  inPersonCapacity?: number
  startDate: string
  endDate: string
  registrationDeadline: string
  contactEmail: string
  description?: string
  /** The administrator may confirm or adjust the budget while approving. */
  estimatedBudget?: number
  currencyCode?: string
}

/**
 * Approves a request and creates the required draft event. The approver is
 * responsible for the core event data (title, dates, capacity, venue...).
 */
export async function approveEventRequest(
  requestId: string,
  adminId: string,
  eventData: ApprovalEventData,
  adminNotes?: string,
): Promise<{ request: EventRequest; eventId: string }> {
  const request = await getEventRequestById(requestId)
  if (!request) throw new Error("Event request not found")
  if (request.status === "approved") throw new Error("This request has already been approved")

  const created = await createEvent({
    title: request.title,
    description: eventData.description?.trim() || request.description,
    coverImageUrl: "",
    organizerId: eventData.organizerId,
    venueId: eventData.venueId ?? request.venueId ?? "",
    capacity: eventData.capacity,
    registrationDeadline: eventData.registrationDeadline,
    startDate: eventData.startDate,
    endDate: eventData.endDate,
    status: "draft",
    visibility: "private",
    contactEmail: eventData.contactEmail,
    categoryId: eventData.categoryId || request.categoryId || "",
    eventType: eventData.eventType,
    onlineCapacity: eventData.onlineCapacity,
    inPersonCapacity: eventData.inPersonCapacity,
  })

  const requestPatch: Record<string, unknown> = {
    status: "approved",
    reviewed_by: adminId,
    reviewed_at: new Date().toISOString(),
    admin_notes: adminNotes ?? request.adminNotes,
    created_event_id: created.id,
  }
  if (eventData.estimatedBudget !== undefined) requestPatch.estimated_budget = eventData.estimatedBudget
  if (eventData.currencyCode !== undefined) requestPatch.currency_code = eventData.currencyCode

  const { data, error } = await supabase
    .from("event_requests")
    .update(requestPatch)
    .eq("id", requestId)
    .select()
    .single()
  if (error) throw error

  const updated = mapRequest(data)
  await notifyRequester(updated, "approved")
  return { request: updated, eventId: created.id }
}

export async function deleteEventRequest(id: string): Promise<void> {
  const { error } = await supabase.from("event_requests").delete().eq("id", id)
  if (error) throw error
}

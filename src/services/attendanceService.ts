import { supabase } from "../lib/supabase"
import { decodeTicketCode } from "./ticketService"
import type { Attendance, AttendanceMode, AttendanceSource, Ticket } from "../types"

function mapAttendance(a: Record<string, any>): Attendance {
  return {
    id: a.id,
    ticketId: a.ticket_id,
    checkInTime: a.check_in_time,
    checkOutTime: a.check_out_time ?? undefined,
    mode: a.mode ?? undefined,
    source: a.source ?? "manual",
    verifiedBy: a.verified_by ?? undefined,
    presenceSeconds: a.presence_seconds ?? undefined,
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
    qrPayload: t.qr_payload ?? undefined,
    attendanceMode: t.attendance_mode ?? undefined,
    verifiedBy: t.verified_by ?? undefined,
    verifiedAt: t.verified_at ?? undefined,
  }
}

export interface CheckInOptions {
  mode?: AttendanceMode
  source?: AttendanceSource
  verifiedBy?: string
}

export async function checkIn(ticketId: string, options: CheckInOptions = {}): Promise<Attendance> {
  const { data: ticket } = await supabase
    .from("tickets")
    .select("status, attendance_mode, registration:registrations(status, attendance_mode, event:events(event_type))")
    .eq("id", ticketId)
    .single()
  if (!ticket) throw new Error("Ticket not found")
  if (ticket.status === "used") throw new Error("Ticket already checked in")

  const reg: any = (ticket as any).registration
  if (reg?.status !== "confirmed") {
    throw new Error("Registration is not confirmed — cannot check in")
  }

  const mode: AttendanceMode =
    options.mode ??
    ((ticket as any).attendance_mode || reg?.attendance_mode || (reg?.event?.event_type === "online" ? "online" : "in_person"))
  const source: AttendanceSource = options.source ?? "manual"

  const verifiedPatch = options.verifiedBy
    ? { verified_by: options.verifiedBy, verified_at: new Date().toISOString() }
    : {}
  await supabase.from("tickets").update({ status: "used", ...verifiedPatch }).eq("id", ticketId)

  const row = {
    ticket_id: ticketId,
    mode,
    source,
    verified_by: options.verifiedBy ?? null,
  }
  let { data, error } = await supabase.from("attendance").insert(row).select().single()
  if (error && /mode|source|verified_by|presence_seconds/i.test(error.message ?? "")) {
    const fallback = await supabase.from("attendance").insert({ ticket_id: ticketId }).select().single()
    data = fallback.data
    error = fallback.error
  }
  if (error) throw error
  return mapAttendance(data)
}

export async function checkOut(attendanceId: string): Promise<Attendance | undefined> {
  const { data, error } = await supabase
    .from("attendance")
    .update({ check_out_time: new Date().toISOString() })
    .eq("id", attendanceId)
    .select()
    .single()
  if (error) throw error
  return data ? mapAttendance(data) : undefined
}

export async function getAttendanceByEvent(eventId: string): Promise<(Attendance & { ticket: Ticket | undefined })[]> {
  const { data: regs } = await supabase
    .from("registrations")
    .select("id")
    .eq("event_id", eventId)

  if (!regs || regs.length === 0) return []

  const regIds = regs.map((r) => r.id)

  const { data: eventTickets } = await supabase
    .from("tickets")
    .select("*")
    .in("registration_id", regIds)

  if (!eventTickets || eventTickets.length === 0) return []

  const ticketIds = eventTickets.map((t) => t.id)

  const { data: attendanceRecords } = await supabase
    .from("attendance")
    .select("*")
    .in("ticket_id", ticketIds)

  if (!attendanceRecords) return []

  const ticketMap = Object.fromEntries(eventTickets.map((t) => [t.id, mapTicket(t)]))
  return attendanceRecords.map((a) => ({ ...mapAttendance(a), ticket: ticketMap[a.ticket_id] }))
}

export async function getAttendanceByTicket(ticketId: string): Promise<Attendance | undefined> {
  const { data, error } = await supabase
    .from("attendance")
    .select("*")
    .eq("ticket_id", ticketId)
    .maybeSingle()
  if (error) throw error
  return data ? mapAttendance(data) : undefined
}

/** Accepts an encoded QR payload or a manually typed unique code. */
export async function findTicketByCode(code: string): Promise<Ticket | undefined> {
  const decoded = decodeTicketCode(code)
  if (!decoded.code) return undefined
  const { data, error } = await supabase
    .from("tickets")
    .select("*, registration:registrations(status, attendance_mode)")
    .ilike("unique_code", decoded.code)
    .maybeSingle()
  if (error) throw error
  if (!data) return undefined
  const regStatus = (data as any).registration?.status
  if (regStatus !== "confirmed") return undefined
  return mapTicket(data)
}

export async function findTicketByAttendee(eventId: string, attendeeId: string): Promise<Ticket | undefined> {
  const { data: reg } = await supabase
    .from("registrations")
    .select("id")
    .eq("event_id", eventId)
    .eq("attendee_id", attendeeId)
    .eq("status", "confirmed")
    .maybeSingle()

  if (!reg) return undefined

  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("registration_id", reg.id)
    .maybeSingle()
  if (error) throw error
  return data ? mapTicket(data) : undefined
}

/**
 * Marks auto-attendance when the attendee opens the meeting link. Online/hybrid
 * attendees are recorded with the correct mode and source. Idempotent.
 */
export async function markAutoAttendance(
  eventId: string,
  attendeeId: string,
  source: AttendanceSource = "auto_join",
): Promise<void> {
  const { data: reg } = await supabase
    .from("registrations")
    .select("id, attendance_mode, event:events(event_type)")
    .eq("event_id", eventId)
    .eq("attendee_id", attendeeId)
    .eq("status", "confirmed")
    .maybeSingle()
  if (!reg) return

  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, attendance_mode")
    .eq("registration_id", reg.id)
    .maybeSingle()
  if (!ticket) return

  const { data: existing } = await supabase
    .from("attendance")
    .select("id")
    .eq("ticket_id", ticket.id)
    .maybeSingle()
  if (existing) return

  const event: any = (reg as any).event
  const mode: AttendanceMode =
    (ticket as any).attendance_mode ||
    (reg as any).attendance_mode ||
    (event?.event_type === "online" ? "online" : "online")

  await supabase.from("tickets").update({ status: "used" }).eq("id", ticket.id)
  const row = { ticket_id: ticket.id, mode, source }
  const { error } = await supabase.from("attendance").insert(row)
  if (error && /mode|source|presence_seconds/i.test(error.message ?? "")) {
    await supabase.from("attendance").insert({ ticket_id: ticket.id })
  }
}

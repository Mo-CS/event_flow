import { supabase } from "../lib/supabase"
import type { Attendance, Ticket } from "../types"

function mapAttendance(a: Record<string, any>): Attendance {
  return {
    id: a.id,
    ticketId: a.ticket_id,
    checkInTime: a.check_in_time,
    checkOutTime: a.check_out_time ?? undefined,
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

export async function checkIn(ticketId: string): Promise<Attendance> {
  const { data: ticket } = await supabase
    .from("tickets")
    .select("status, registration:registrations(status)")
    .eq("id", ticketId)
    .single()
  if (!ticket) throw new Error("Ticket not found")
  if (ticket.status === "used") throw new Error("Ticket already checked in")

  const regStatus = (ticket as any).registration?.status
  if (regStatus !== "confirmed") {
    throw new Error("Registration is not confirmed — cannot check in")
  }

  await supabase
    .from("tickets")
    .update({ status: "used" })
    .eq("id", ticketId)

  const { data, error } = await supabase
    .from("attendance")
    .insert({ ticket_id: ticketId })
    .select()
    .single()
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

export async function findTicketByCode(code: string): Promise<Ticket | undefined> {
  const { data, error } = await supabase
    .from("tickets")
    .select("*, registration:registrations(status)")
    .ilike("unique_code", code)
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
 * Marks auto-attendance for online events when the attendee opens the meeting link.
 * Records attendance if not already recorded. Idempotent.
 */
export async function markAutoAttendance(eventId: string, attendeeId: string): Promise<void> {
  const ticket = await findTicketByAttendee(eventId, attendeeId)
  if (!ticket) return

  const { data: existing } = await supabase
    .from("attendance")
    .select("id")
    .eq("ticket_id", ticket.id)
    .maybeSingle()
  if (existing) return

  await supabase
    .from("tickets")
    .update({ status: "used" })
    .eq("id", ticket.id)

  await supabase.from("attendance").insert({ ticket_id: ticket.id })
}

import { supabase } from "../lib/supabase"
import type { AttendanceMode, Ticket } from "../types"
import QRCode from "qrcode"

const PAYLOAD_PREFIX = "EF1:"

export interface TicketPayload {
  v: 1
  code: string
  eventId?: string
  registrationId?: string
  mode?: AttendanceMode
}

function toBase64Url(text: string): string {
  const base64 = btoa(unescape(encodeURIComponent(text)))
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function fromBase64Url(text: string): string {
  const normalized = text.replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4)
  return decodeURIComponent(escape(atob(padded)))
}

/** Encodes the ticket into one scannable/typeable string. */
export function encodeTicketCode(payload: TicketPayload): string {
  return `${PAYLOAD_PREFIX}${toBase64Url(JSON.stringify(payload))}`
}

/**
 * Accepts either the encoded payload (QR scan) or the plain unique code
 * (manual entry) and always returns a usable ticket code.
 */
export function decodeTicketCode(value: string): { code: string; payload?: TicketPayload } {
  const trimmed = value.trim()
  if (!trimmed) return { code: "" }
  if (!trimmed.startsWith(PAYLOAD_PREFIX)) return { code: trimmed }
  try {
    const parsed = JSON.parse(fromBase64Url(trimmed.slice(PAYLOAD_PREFIX.length))) as TicketPayload
    if (!parsed.code) return { code: trimmed }
    return { code: parsed.code, payload: parsed }
  } catch {
    return { code: trimmed }
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

export async function generateTicket(
  registrationId: string,
  eventTitle: string,
  attendanceMode?: AttendanceMode,
  eventId?: string,
): Promise<Ticket> {
  let resolvedEventId = eventId
  if (!resolvedEventId || !attendanceMode) {
    const { data: reg } = await supabase
      .from("registrations")
      .select("event_id, attendance_mode")
      .eq("id", registrationId)
      .maybeSingle()
    resolvedEventId = resolvedEventId ?? (reg as any)?.event_id
    attendanceMode = attendanceMode ?? ((reg as any)?.attendance_mode ?? undefined)
  }

  const uniqueCode = `${eventTitle.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6)}-${Date.now().toString(36).toUpperCase()}`
  const payload = encodeTicketCode({
    v: 1,
    code: uniqueCode,
    eventId: resolvedEventId,
    registrationId,
    mode: attendanceMode,
  })
  const qrDataUrl = await QRCode.toDataURL(payload, { width: 300, margin: 2 })

  const baseRow = {
    registration_id: registrationId,
    unique_code: uniqueCode,
    qr_code_url: qrDataUrl,
  }

  let { data, error } = await supabase
    .from("tickets")
    .insert({
      ...baseRow,
      qr_payload: payload,
      attendance_mode: attendanceMode ?? null,
    })
    .select()
    .single()

  // Older databases may not have the new columns yet: keep the ticket usable.
  if (error && /qr_payload|attendance_mode|verified_/i.test(error.message ?? "")) {
    const fallback = await supabase.from("tickets").insert(baseRow).select().single()
    data = fallback.data
    error = fallback.error
  }
  if (error) throw error
  return mapTicket(data)
}

export async function getTicketByRegistration(registrationId: string): Promise<Ticket | undefined> {
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("registration_id", registrationId)
    .maybeSingle()
  if (error) throw error
  return data ? mapTicket(data) : undefined
}

export async function getTicketById(id: string): Promise<Ticket | undefined> {
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("id", id)
    .single()
  if (error) throw error
  return data ? mapTicket(data) : undefined
}

/**
 * Loads a ticket only when it belongs to the given attendee profile (confirmed registration),
 * otherwise returns undefined. Used to keep the ticket page from leaking others' tickets.
 */
export async function getTicketForOwner(id: string, attendeeProfileId: string): Promise<Ticket | undefined> {
  const { data: ticket, error } = await supabase
    .from("tickets")
    .select("*, registration:registrations(attendee_id, status, attendance_mode)")
    .eq("id", id)
    .single()
  if (error) throw error
  if (!ticket) return undefined
  const reg = (ticket as any).registration
  if (!reg || reg.attendee_id !== attendeeProfileId || reg.status !== "confirmed") return undefined
  return mapTicket(ticket)
}

export async function getTicketsByIds(ids: string[]): Promise<Ticket[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .in("id", ids)
  if (error) throw error
  return (data ?? []).map(mapTicket)
}

export async function markTicketVerified(ticketId: string, userId: string): Promise<void> {
  await supabase
    .from("tickets")
    .update({ verified_by: userId, verified_at: new Date().toISOString() })
    .eq("id", ticketId)
    .then(() => undefined, () => undefined)
}

export async function downloadTicket(id: string): Promise<void> {
  const { data: ticket } = await supabase
    .from("tickets")
    .select("*")
    .eq("id", id)
    .single()
  if (!ticket) throw new Error("Ticket not found")

  const code = ticket.qr_payload || ticket.unique_code
  const qrUrl = ticket.qr_code_url || (await QRCode.toDataURL(code, { width: 300, margin: 2 }))
  const mode = ticket.attendance_mode === "online" ? "Online" : ticket.attendance_mode === "in_person" ? "In person" : ""

  const canvas = document.createElement("canvas")
  canvas.width = 600
  canvas.height = 430
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, 600, 430)
  ctx.strokeStyle = "#000000"
  ctx.lineWidth = 2
  ctx.strokeRect(10, 10, 580, 410)
  ctx.fillStyle = "#000000"
  ctx.font = "bold 24px sans-serif"
  ctx.textAlign = "center"
  ctx.fillText("EVENT TICKET", 300, 60)
  ctx.font = "16px sans-serif"
  ctx.fillText(`Code: ${ticket.unique_code}`, 300, 110)
  if (mode) ctx.fillText(`Attendance: ${mode}`, 300, 135)
  ctx.font = "14px sans-serif"
  ctx.fillText(`Issued: ${new Date(ticket.issued_at).toLocaleDateString()}`, 300, 160)
  ctx.fillText(`Status: ${ticket.status}`, 300, 185)

  return new Promise<void>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 200, 205, 200, 200)
      const link = document.createElement("a")
      link.download = `ticket-${ticket.unique_code}.png`
      link.href = canvas.toDataURL()
      link.click()
      resolve()
    }
    img.onerror = () => reject(new Error("Failed to load QR image"))
    img.src = qrUrl
  })
}

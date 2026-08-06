import { supabase } from "../lib/supabase"
import type { Ticket } from "../types"
import QRCode from "qrcode"

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

export async function generateTicket(registrationId: string, eventTitle: string): Promise<Ticket> {
  const uniqueCode = `${eventTitle.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6)}-${Date.now().toString(36).toUpperCase()}`
  const qrDataUrl = await QRCode.toDataURL(uniqueCode, { width: 300, margin: 2 })

  const { data, error } = await supabase
    .from("tickets")
    .insert({
      registration_id: registrationId,
      unique_code: uniqueCode,
      qr_code_url: qrDataUrl,
    })
    .select()
    .single()
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
    .select("*, registration:registrations(attendee_id, status)")
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

export async function downloadTicket(id: string): Promise<void> {
  const { data: ticket } = await supabase
    .from("tickets")
    .select("*")
    .eq("id", id)
    .single()
  if (!ticket) throw new Error("Ticket not found")

  let qrUrl = ticket.qr_code_url
  if (!qrUrl) {
    qrUrl = await QRCode.toDataURL(ticket.unique_code, { width: 300, margin: 2 })
  }

  const canvas = document.createElement("canvas")
  canvas.width = 600
  canvas.height = 400
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, 600, 400)
  ctx.strokeStyle = "#000000"
  ctx.lineWidth = 2
  ctx.strokeRect(10, 10, 580, 380)
  ctx.fillStyle = "#000000"
  ctx.font = "bold 24px sans-serif"
  ctx.textAlign = "center"
  ctx.fillText("EVENT TICKET", 300, 60)
  ctx.font = "16px sans-serif"
  ctx.fillText(`Code: ${ticket.unique_code}`, 300, 110)
  ctx.font = "14px sans-serif"
  ctx.fillText(`Issued: ${new Date(ticket.issued_at).toLocaleDateString()}`, 300, 140)
  ctx.fillText(`Status: ${ticket.status}`, 300, 170)

  return new Promise<void>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 200, 190, 200, 200)
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

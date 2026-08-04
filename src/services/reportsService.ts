import { supabase } from "../lib/supabase"

export async function getReportData() {
  const { data: events } = await supabase.from("events").select("id, title, category_id")
  const { data: registrations } = await supabase.from("registrations").select("event_id, status, registered_at")
  const { data: categories } = await supabase.from("categories").select("id, name")
  const { data: feedbacks } = await supabase.from("feedback").select("rating")

  const totalEvents = events?.length ?? 0
  const totalRegs = registrations?.length ?? 0
  const confirmedRegs = registrations?.filter((r) => r.status === "confirmed").length ?? 0
  const cancelledRegs = registrations?.filter((r) => r.status === "cancelled").length ?? 0
  const waitlistedRegs = registrations?.filter((r) => r.status === "waitlisted").length ?? 0

  const regByMonth: Record<string, number> = {}
  for (const r of registrations ?? []) {
    const m = new Date(r.registered_at).toLocaleString("en-US", { month: "short" })
    regByMonth[m] = (regByMonth[m] || 0) + 1
  }
  const registrationTrend = Object.entries(regByMonth).map(([month, count]) => ({ month, count }))

  const catMap = Object.fromEntries((categories ?? []).map((c) => [c.id, c.name]))
  const regByCategory: Record<string, number> = {}
  for (const reg of registrations ?? []) {
    const ev = events?.find((e) => e.id === reg.event_id)
    const name = ev ? (catMap[ev.category_id] ?? "Unknown") : "Unknown"
    regByCategory[name] = (regByCategory[name] || 0) + 1
  }
  const categoryBreakdown = Object.entries(regByCategory).map(([name, count]) => ({ name, count }))

  const eventPopularity = (events ?? [])
    .map((e) => ({
      name: e.title,
      registrations: registrations?.filter((r) => r.event_id === e.id && r.status !== "cancelled").length ?? 0,
    }))
    .sort((a, b) => b.registrations - a.registrations)

  const averageRating =
    feedbacks && feedbacks.length > 0
      ? feedbacks.reduce((s, f) => s + f.rating, 0) / feedbacks.length
      : 0

  return {
    summary: { totalEvents, totalRegs, confirmedRegs, cancelledRegs, waitlistedRegs, averageRating: +averageRating.toFixed(1) },
    registrationTrend,
    categoryBreakdown,
    eventPopularity,
  }
}

export function exportToCsv(data: Record<string, any>[], filename: string) {
  if (data.length === 0) return
  const headers = Object.keys(data[0])
  const rows = data.map((row) => headers.map((h) => `"${String(row[h] ?? "").replace(/"/g, '""')}"`).join(","))
  const csv = [headers.join(","), ...rows].join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

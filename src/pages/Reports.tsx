import { useState, useEffect } from "react"
import { Download, BarChart3, PieChart, TrendingUp, Star } from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Loading } from "../components/ui/Loading"
import { getReportData, exportToCsv } from "../services/reportsService"
import { supabase } from "../lib/supabase"

const COLORS = ["#007bff", "#28a745", "#6f42c1", "#fd7e14", "#e83e8c", "#20c997", "#ffc107", "#dc3545"]

export function Reports() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getReportData().then((d) => { setData(d); setLoading(false) })
  }, [])

  if (loading) return <Loading text="Loading reports..." />
  if (!data) return null

  const statusPie = [
    { name: "Confirmed", value: data.summary.confirmedRegs },
    { name: "Cancelled", value: data.summary.cancelledRegs },
    { name: "Waitlisted", value: data.summary.waitlistedRegs },
  ].filter((d) => d.value > 0)

  const handleExportRegistrations = async () => {
    const { data: regs } = await supabase.from("registrations").select("event_id, status, registered_at")
    const { data: evs } = await supabase.from("events").select("id, title")
    const evMap = Object.fromEntries((evs ?? []).map((e: any) => [e.id, e.title]))
    const rows = (regs ?? []).map((r: any) => ({
      "Event": evMap[r.event_id] ?? "Unknown",
      "Status": r.status,
      "Registered": new Date(r.registered_at).toLocaleDateString(),
    }))
    exportToCsv(rows, "registrations.csv")
  }

  const handleExportEvents = async () => {
    const { data: evs } = await supabase.from("events").select("id, title, status, capacity, start_date")
    const { data: regs } = await supabase.from("registrations").select("event_id, status")
    const regCounts: Record<string, number> = {}
    for (const r of regs ?? []) {
      if (r.status !== "cancelled") regCounts[r.event_id] = (regCounts[r.event_id] || 0) + 1
    }
    const rows = (evs ?? []).map((e: any) => ({
      Title: e.title, Status: e.status, Capacity: e.capacity,
      "Start Date": new Date(e.start_date).toLocaleDateString(),
      Registrations: regCounts[e.id] ?? 0,
    }))
    exportToCsv(rows, "events.csv")
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports & Analytics</h1>

      <div className="grid sm:grid-cols-5 gap-4">
        <StatCard label="Total Events" value={data.summary.totalEvents} icon={BarChart3} />
        <StatCard label="Total Regs" value={data.summary.totalRegs} icon={TrendingUp} />
        <StatCard label="Confirmed" value={data.summary.confirmedRegs} color="bg-green-500/10" />
        <StatCard label="Cancelled" value={data.summary.cancelledRegs} color="bg-red-500/10" />
        <StatCard label="Avg Rating" value={data.summary.averageRating} icon={Star} color="bg-yellow-500/10" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><TrendingUp size={16} /> Registration Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={data.registrationTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#007bff" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><PieChart size={16} /> Registration Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <RePieChart>
                <Pie data={statusPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {statusPie.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </RePieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><BarChart3 size={16} /> Registrations by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.categoryBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#28a745" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><BarChart3 size={16} /> Event Popularity</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.eventPopularity} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="registrations" fill="#6f42c1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Export Data</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" className="gap-2" onClick={handleExportRegistrations}>
            <Download size={14} /> Export Registrations (CSV)
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleExportEvents}>
            <Download size={14} /> Export Events (CSV)
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }: { icon?: any; label: string; value: number | string; color?: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        {Icon && <div className={`p-2 rounded-lg ${color ?? "bg-primary/10"}`}><Icon size={20} className={color ? "" : "text-primary"} /></div>}
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

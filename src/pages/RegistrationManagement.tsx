import { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { Loading } from "../components/ui/Loading"
import { EmptyState } from "../components/ui/EmptyState"
import { useAuth } from "../contexts/AuthContext"
import { getEventById, getRegistrations, cancelRegistration } from "../services/eventService"
import { getProfilesByIds } from "../services/userService"
import type { Registration } from "../types"

const statusColors: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  confirmed: "default",
  pending: "secondary",
  cancelled: "destructive",
  waitlisted: "outline",
}

export function RegistrationManagement() {
  const { eventId } = useParams<{ eventId: string }>()
  const { profile, role } = useAuth()
  const navigate = useNavigate()
  const [eventTitle, setEventTitle] = useState("")
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [profileMap, setProfileMap] = useState<Map<string, any>>(new Map())
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!eventId) return
    setLoading(true)
    const event = await getEventById(eventId)
    if (!event) { navigate("/dashboard/events"); return }
    if (event.organizerId !== profile?.id && role !== "admin") { navigate("/dashboard/events"); return }
    setEventTitle(event.title)
    const regs = await getRegistrations(eventId)
    const sorted = regs.sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime())
    setRegistrations(sorted)
    const attendeeIds = [...new Set(sorted.map((r) => r.attendeeId))]
    if (attendeeIds.length > 0) {
      const profs = await getProfilesByIds(attendeeIds)
      setProfileMap(new Map(profs.map((p: any) => [p.id, p])))
    }
    setLoading(false)
  }, [eventId, navigate])

  useEffect(() => { fetch() }, [fetch])

  const handleCancel = async (reg: Registration) => {
    await cancelRegistration(reg.id)
    toast.success("Registration cancelled")
    fetch()
  }

  if (loading) return <Loading text="Loading registrations..." />

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/events")} className="gap-2">
        <ArrowLeft size={16} /> Back to Events
      </Button>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Registrations: {eventTitle}</h1>
        <Badge variant="secondary">{registrations.length} total</Badge>
      </div>

      {registrations.length === 0 ? (
        <EmptyState title="No registrations yet" description="Attendees will appear here once they register." />
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Attendee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Registered</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registrations.map((reg) => {
                const attendee = profileMap.get(reg.attendeeId)
                return (
                  <TableRow key={reg.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{attendee?.firstName} {attendee?.lastName}</p>
                        <p className="text-xs text-muted-foreground">ID: {reg.attendeeId}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColors[reg.status] ?? "outline"}>{reg.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(reg.registeredAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {reg.status !== "cancelled" && (
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleCancel(reg)}>
                          Cancel
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

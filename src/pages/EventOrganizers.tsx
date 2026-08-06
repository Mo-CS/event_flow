import { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Plus, Trash2, ShieldCheck, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { Loading } from "../components/ui/Loading"
import { EmptyState } from "../components/ui/EmptyState"
import { useAuth } from "../contexts/AuthContext"
import { getEventById } from "../services/eventService"
import {
  getEventOrganizers, getAllOrganizers, assignOrganizer, removeOrganizer,
  type OrganizerInfo,
} from "../services/organizerService"

export function EventOrganizers() {
  const { eventId } = useParams<{ eventId: string }>()
  const { profile, role } = useAuth()
  const navigate = useNavigate()

  const [eventTitle, setEventTitle] = useState("")
  const [assigned, setAssigned] = useState<OrganizerInfo[]>([])
  const [allOrganizers, setAllOrganizers] = useState<OrganizerInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const fetch = useCallback(async () => {
    if (!eventId) return
    setLoading(true)
    try {
      const event = await getEventById(eventId)
      if (!event) { navigate("/dashboard/events"); return }
      if (role !== "admin") { navigate("/dashboard/events"); return }
      setEventTitle(event.title)
      const [a, all] = await Promise.all([getEventOrganizers(eventId), getAllOrganizers()])
      setAssigned(a)
      setAllOrganizers(all)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [eventId, navigate, role])

  useEffect(() => { fetch() }, [fetch])

  const assigneeIds = new Set(assigned.map((o) => o.userId))

  const handleAssign = async (userId: string) => {
    if (!eventId || !profile) return
    setBusy(true)
    try {
      await assignOrganizer(eventId, userId, profile.userId)
      toast.success("Organizer added")
      fetch()
    } catch {
      toast.error("Failed to add organizer")
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async (userId: string) => {
    if (!eventId) return
    setBusy(true)
    try {
      await removeOrganizer(eventId, userId)
      toast.success("Organizer removed — chats stay archived")
      fetch()
    } catch {
      toast.error("Failed to remove organizer")
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Loading text="Loading organizers..." />

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/events")} className="gap-2">
        <ArrowLeft size={16} /> Back to Events
      </Button>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck size={22} className="text-primary" /> Organizers: {eventTitle}
        </h1>
        <Badge variant="secondary">{assigned.length} assigned</Badge>
      </div>

      <p className="text-sm text-muted-foreground">
        Assign organizer accounts to help manage this event. Only admins can change organizer assignments. Removed organizers keep access to archived conversations.
      </p>

      <div className="rounded-lg border border-border">
        <div className="px-4 py-3 border-b border-border bg-muted/20 font-semibold">Assigned Organizers</div>
        {assigned.length === 0 ? (
          <EmptyState title="No organizers assigned" description="Add organizers below." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assigned.map((o) => (
                <TableRow key={o.userId}>
                  <TableCell className="font-medium">
                    {o.firstName} {o.lastName}
                    {o.isPrimary && <Badge variant="secondary" className="ml-2">Primary</Badge>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{o.email}</TableCell>
                  <TableCell>
                    {o.managesAllEvents
                      ? <Badge variant="outline" className="text-teal-600">All events</Badge>
                      : <Badge variant="secondary">Event only</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    {!o.isPrimary && (
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleRemove(o.userId)} disabled={busy}>
                        <Trash2 size={14} /> Remove
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="rounded-lg border border-border">
        <div className="px-4 py-3 border-b border-border bg-muted/20 font-semibold">Available Organizers</div>
        {allOrganizers.filter((o) => !assigneeIds.has(o.userId)).length === 0 ? (
          <EmptyState title="No more organizers available" description="Create more organizer accounts or adjust assignments." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allOrganizers.filter((o) => !assigneeIds.has(o.userId)).map((o) => (
                <TableRow key={o.userId}>
                  <TableCell className="font-medium">{o.firstName} {o.lastName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{o.email}</TableCell>
                  <TableCell>
                    {o.managesAllEvents
                      ? <Badge variant="outline" className="text-teal-600">All events</Badge>
                      : <Badge variant="secondary">Event only</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleAssign(o.userId)} disabled={busy}>
                      {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Assign
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}

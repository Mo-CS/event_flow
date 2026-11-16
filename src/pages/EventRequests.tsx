import { useState, useEffect, useCallback } from "react"
import { Link } from "react-router-dom"
import { Plus, ClipboardList, CheckCircle2, XCircle, HelpCircle, Eye } from "lucide-react"
import { toast } from "sonner"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Badge } from "../components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog"
import { Loading } from "../components/ui/Loading"
import { EmptyState } from "../components/ui/EmptyState"
import { useAuth } from "../contexts/AuthContext"
import {
  getEventRequests,
  setEventRequestStatus,
  approveEventRequest,
  type EventRequestWithRequester,
} from "../services/eventRequestService"
import { getUsers } from "../services/userService"
import { getCategories } from "../services/categoryService"
import { getVenues } from "../services/venueService"
import type { Category, EventRequestStatus, EventType, Venue } from "../types"

const statusVariant: Record<EventRequestStatus, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary",
  reviewing: "default",
  approved: "default",
  rejected: "destructive",
  needs_info: "outline",
}

export function EventRequests() {
  const { user, role } = useAuth()
  const isAdmin = role === "admin"
  const [requests, setRequests] = useState<EventRequestWithRequester[]>([])
  const [loading, setLoading] = useState(true)
  const [organizers, setOrganizers] = useState<any[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [venues, setVenues] = useState<Venue[]>([])
  const [approving, setApproving] = useState<EventRequestWithRequester | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const rows = await getEventRequests(isAdmin ? undefined : { requesterId: user.id })
      setRequests(rows)
      if (isAdmin) {
        const [userRows, categoryRows, venueRows] = await Promise.all([
          getUsers({ role: "organizer", pageSize: 200 }),
          getCategories(),
          getVenues(),
        ])
        setOrganizers(userRows.items)
        setCategories(categoryRows)
        setVenues(venueRows)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load event requests")
    } finally {
      setLoading(false)
    }
  }, [isAdmin, user])

  useEffect(() => { load() }, [load])

  const changeStatus = async (request: EventRequestWithRequester, status: EventRequestStatus) => {
    if (!user) return
    const note = status === "needs_info" || status === "rejected"
      ? window.prompt("Optional note for the requester:") ?? ""
      : undefined
    try {
      await setEventRequestStatus(request.id, status, user.id, note)
      toast.success(`Request marked as ${status.replace("_", " ")}`)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update the request")
    }
  }

  if (loading) return <Loading text="Loading event requests..." />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ClipboardList size={24} /> Event requests</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "Review requests from registered users. Approving a request creates a draft event that you configure."
              : "Track the requests you submitted. An administrator reviews each one."}
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link to="/dashboard/event-requests/new"><Plus size={16} /> New request</Link>
        </Button>
      </div>

      {requests.length === 0 ? (
        <EmptyState title="No event requests" description={isAdmin ? "Requests submitted by users will appear here." : "Submit your first event idea."} />
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">{isAdmin ? "All requests" : "My requests"} ({requests.length})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  {isAdmin && <TableHead>Requester</TableHead>}
                  <TableHead>Type</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{request.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1 max-w-xs">{request.description}</p>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-sm">
                        <p>{request.requesterName ?? "User"}</p>
                        <p className="text-xs text-muted-foreground">{request.requesterEmail}</p>
                      </TableCell>
                    )}
                    <TableCell className="text-sm capitalize">{request.eventType.replace("_", " ")}</TableCell>
                    <TableCell className="text-sm">
                      {request.estimatedBudget != null ? `${request.estimatedBudget.toLocaleString()} ${request.currencyCode}` : "—"}
                    </TableCell>
                    <TableCell><Badge variant={statusVariant[request.status]}>{request.status.replace("_", " ")}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(request.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 flex-wrap">
                        {isAdmin && request.status !== "approved" && (
                          <>
                            <Button size="sm" variant="ghost" className="gap-1" onClick={() => changeStatus(request, "reviewing")}>
                              <Eye size={14} /> Review
                            </Button>
                            <Button size="sm" variant="ghost" className="gap-1 text-green-600" onClick={() => setApproving(request)}>
                              <CheckCircle2 size={14} /> Approve
                            </Button>
                            <Button size="sm" variant="ghost" className="gap-1" onClick={() => changeStatus(request, "needs_info")}>
                              <HelpCircle size={14} /> Info
                            </Button>
                            <Button size="sm" variant="ghost" className="gap-1 text-destructive" onClick={() => changeStatus(request, "rejected")}>
                              <XCircle size={14} /> Reject
                            </Button>
                          </>
                        )}
                        {request.createdEventId && (
                          <Button size="sm" variant="outline" asChild>
                            <Link to={`/dashboard/events/${request.createdEventId}/edit`}>Open draft</Link>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {approving && user && (
        <ApprovalDialog
          request={approving}
          adminId={user.id}
          organizers={organizers}
          categories={categories}
          venues={venues}
          onClose={() => setApproving(null)}
          onDone={() => { setApproving(null); load() }}
        />
      )}
    </div>
  )
}

function ApprovalDialog({
  request,
  adminId,
  organizers,
  categories,
  venues,
  onClose,
  onDone,
}: {
  request: EventRequestWithRequester
  adminId: string
  organizers: any[]
  categories: Category[]
  venues: Venue[]
  onClose: () => void
  onDone: () => void
}) {
  const [organizerId, setOrganizerId] = useState(organizers[0]?.id ?? "")
  const [categoryId, setCategoryId] = useState(request.categoryId ?? categories[0]?.id ?? "")
  const [venueId, setVenueId] = useState(request.venueId ?? "")
  const [eventType, setEventType] = useState<EventType>(request.eventType)
  const [capacity, setCapacity] = useState(request.expectedAttendees ?? 50)
  const [onlineCapacity, setOnlineCapacity] = useState(request.expectedAttendees ?? 50)
  const [inPersonCapacity, setInPersonCapacity] = useState(request.expectedAttendees ?? 50)
  const [startDate, setStartDate] = useState(request.preferredStart?.slice(0, 16) ?? "")
  const [endDate, setEndDate] = useState(request.preferredEnd?.slice(0, 16) ?? "")
  const [deadline, setDeadline] = useState(request.preferredStart?.slice(0, 16) ?? "")
  const [contactEmail, setContactEmail] = useState(request.requesterEmail ?? "")
  const [estimatedBudget, setEstimatedBudget] = useState(
    request.estimatedBudget != null ? String(request.estimatedBudget) : "",
  )
  const [currencyCode, setCurrencyCode] = useState(request.currencyCode || "USD")
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await approveEventRequest(request.id, adminId, {
        organizerId,
        categoryId,
        venueId: venueId || undefined,
        eventType,
        capacity: eventType === "hybrid" ? onlineCapacity : capacity,
        onlineCapacity: eventType === "hybrid" ? onlineCapacity : undefined,
        inPersonCapacity: eventType === "hybrid" ? inPersonCapacity : undefined,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        registrationDeadline: new Date(deadline).toISOString(),
        contactEmail,
        estimatedBudget: estimatedBudget.trim() ? Number(estimatedBudget) : undefined,
        currencyCode,
      })
      toast.success("Request approved and draft event created")
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve the request")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Approve “{request.title}”</DialogTitle>
          <DialogDescription>
            Enter the core event data. A draft event is created and the requester is notified.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Organizer</label>
            <select value={organizerId} onChange={(e) => setOrganizerId(e.target.value)} required
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
              <option value="">Select an organizer</option>
              {organizers.map((o) => (
                <option key={o.id} value={o.profile?.id ?? o.id}>
                  {o.profile ? `${o.profile.firstName} ${o.profile.lastName}` : o.email}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                <option value="">Select category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Event type</label>
              <select value={eventType} onChange={(e) => setEventType(e.target.value as EventType)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                <option value="in_person">In person</option>
                <option value="online">Online</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Venue</label>
            <select value={venueId} onChange={(e) => setVenueId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
              <option value="">Not decided</option>
              {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          {eventType === "hybrid" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Online capacity</label>
                <Input type="number" min={1} value={onlineCapacity} onChange={(e) => setOnlineCapacity(Number(e.target.value))} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">In-person capacity</label>
                <Input type="number" min={1} value={inPersonCapacity} onChange={(e) => setInPersonCapacity(Number(e.target.value))} required />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1">Capacity</label>
              <Input type="number" min={1} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} required />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Start</label>
              <Input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End</label>
              <Input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Registration deadline</label>
              <Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Contact email</label>
              <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Estimated budget</label>
              <Input type="number" min={0} step="0.01" value={estimatedBudget}
                onChange={(e) => setEstimatedBudget(e.target.value)} placeholder="Optional — confirm or adjust" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Currency</label>
              <select value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                {[...new Set(["USD", "YER", "SAR", "EUR", "AED", request.currencyCode || "USD"])].map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Creating..." : "Approve & create draft"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

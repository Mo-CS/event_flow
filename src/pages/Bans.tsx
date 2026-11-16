import { useState, useEffect, useCallback } from "react"
import { ShieldOff, Plus, Check, X, RotateCcw, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Badge } from "../components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Loading } from "../components/ui/Loading"
import { EmptyState } from "../components/ui/EmptyState"
import { useAuth } from "../contexts/AuthContext"
import {
  getBans,
  createBan,
  approveBan,
  rejectBan,
  revokeBan,
  getBanRevokeRequests,
  approveBanRevoke,
  rejectBanRevoke,
  requestBanRevoke,
  getUserRegistrationSummary,
  type BanWithNames,
  type UserRegistrationSummary,
} from "../services/banService"
import { getUsers } from "../services/userService"
import { getAllEvents } from "../services/eventService"
import { getCategories } from "../services/categoryService"
import type { BanScope, Category, Event, UserBan } from "../types"

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  active: "destructive",
  pending: "secondary",
  rejected: "outline",
  revoked: "outline",
  expired: "outline",
}

export function Bans() {
  const { user, role } = useAuth()
  const isAdmin = role === "admin"

  const [bans, setBans] = useState<BanWithNames[]>([])
  const [revokeRequests, setRevokeRequests] = useState<Awaited<ReturnType<typeof getBanRevokeRequests>>>([])
  const [users, setUsers] = useState<any[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const [userId, setUserId] = useState("")
  const [scope, setScope] = useState<BanScope>("global")
  const [eventId, setEventId] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [reason, setReason] = useState("")
  const [isPermanent, setIsPermanent] = useState(true)
  const [expiresAt, setExpiresAt] = useState("")
  const [notifyUser, setNotifyUser] = useState(true)
  const [saving, setSaving] = useState(false)
  const [summary, setSummary] = useState<UserRegistrationSummary[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [banRows, requests, userRows, eventRows, categoryRows] = await Promise.all([
        getBans(),
        isAdmin ? getBanRevokeRequests() : Promise.resolve([]),
        getUsers({ pageSize: 300 }),
        getAllEvents(),
        getCategories(),
      ])
      setBans(banRows)
      setRevokeRequests(requests)
      setUsers(userRows.items)
      setEvents(eventRows)
      setCategories(categoryRows)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load bans")
    } finally {
      setLoading(false)
    }
  }, [isAdmin])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!userId) {
      setSummary([])
      return
    }
    getUserRegistrationSummary(userId).then(setSummary).catch(() => setSummary([]))
  }, [userId])

  const resetForm = () => {
    setUserId("")
    setScope("global")
    setEventId("")
    setCategoryId("")
    setReason("")
    setIsPermanent(true)
    setExpiresAt("")
    setNotifyUser(true)
    setSummary([])
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    try {
      await createBan(
        {
          userId,
          scope,
          eventId: scope === "event" ? eventId : undefined,
          categoryId: scope === "category" ? categoryId : undefined,
          reason,
          isPermanent,
          expiresAt: isPermanent ? undefined : new Date(expiresAt).toISOString(),
          notifyUser,
        },
        user.id,
        role ?? "attendee",
      )
      toast.success(isAdmin ? "Ban applied immediately" : "Ban request sent to administrators")
      resetForm()
      setShowForm(false)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save the ban")
    } finally {
      setSaving(false)
    }
  }

  const handleApprove = async (ban: UserBan) => {
    if (!user) return
    try {
      await approveBan(ban.id, user.id)
      toast.success("Ban approved and activated")
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve")
    }
  }

  const handleReject = async (ban: UserBan) => {
    if (!user) return
    try {
      await rejectBan(ban.id, user.id)
      toast.success("Ban request rejected")
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject")
    }
  }

  const handleRevoke = async (ban: UserBan) => {
    if (!user) return
    const reasonText = window.prompt("Why is this ban being lifted?") ?? ""
    try {
      await revokeBan(ban.id, user.id, reasonText)
      toast.success("Ban lifted")
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to lift the ban")
    }
  }

  const handleRequestRevoke = async (ban: UserBan) => {
    if (!user) return
    const reasonText = window.prompt("Why should this ban be lifted? Administrators will review it.") ?? ""
    if (!reasonText.trim()) return
    try {
      await requestBanRevoke(ban.id, user.id, reasonText)
      toast.success("Lift request sent to administrators")
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send the request")
    }
  }

  const handleRevokeRequest = async (id: string, approve: boolean) => {
    if (!user) return
    try {
      if (approve) await approveBanRevoke(id, user.id)
      else await rejectBanRevoke(id, user.id)
      toast.success(approve ? "Lift request approved" : "Lift request rejected")
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to handle the request")
    }
  }

  if (loading) return <Loading text="Loading bans..." />

  const visibleBans = isAdmin ? bans : bans.filter((b) => b.requestedBy === user?.id)
  const pendingBans = visibleBans.filter((b) => b.status === "pending")
  const activeBans = visibleBans.filter((b) => b.status === "active")

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldOff size={24} /> User bans</h1>
          <p className="text-sm text-muted-foreground">
            Bans block new registrations only. Existing registrations are never removed automatically.
            {!isAdmin && " Organizer requests need administrator approval."}
          </p>
        </div>
        <Button className="gap-2" onClick={() => setShowForm((v) => !v)}>
          <Plus size={16} /> {showForm ? "Close form" : isAdmin ? "Ban a user" : "Request a ban"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">New {isAdmin ? "ban" : "ban request"}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">User</label>
                  <select value={userId} onChange={(e) => setUserId(e.target.value)} required
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                    <option value="">Select a user</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.profile ? `${u.profile.firstName} ${u.profile.lastName}` : u.email} — {u.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Scope</label>
                  <select value={scope} onChange={(e) => setScope(e.target.value as BanScope)}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                    <option value="global">Global (all events)</option>
                    <option value="event">One event</option>
                    <option value="category">One category</option>
                  </select>
                </div>
              </div>

              {scope === "event" && (
                <div>
                  <label className="block text-sm font-medium mb-1">Event</label>
                  <select value={eventId} onChange={(e) => setEventId(e.target.value)} required
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                    <option value="">Select an event</option>
                    {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                  </select>
                </div>
              )}

              {scope === "category" && (
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                    <option value="">Select a category</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">Reason</label>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} required rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
                  placeholder="Explain the reason for this ban" />
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={isPermanent} onChange={(e) => setIsPermanent(e.target.checked)} />
                  Permanent
                </label>
                {!isPermanent && (
                  <div className="flex items-center gap-2 text-sm">
                    <span>Ends on</span>
                    <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} required className="w-auto" />
                  </div>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={notifyUser} onChange={(e) => setNotifyUser(e.target.checked)} />
                  Notify the user with the reason
                </label>
              </div>

              {summary.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                  <p className="text-sm font-medium flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <AlertTriangle size={15} /> This user has {summary.length} existing registration{summary.length === 1 ? "" : "s"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Existing registrations stay valid; only new registrations will be blocked.
                  </p>
                  <ul className="mt-2 text-xs text-muted-foreground space-y-0.5 max-h-28 overflow-y-auto">
                    {summary.map((s) => (
                      <li key={s.id}>{s.eventTitle} — {s.status} ({new Date(s.registeredAt).toLocaleDateString()})</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => { resetForm(); setShowForm(false) }}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? "Saving..." : isAdmin ? "Apply ban" : "Send request"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isAdmin && pendingBans.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Pending organizer requests ({pendingBans.length})</CardTitle></CardHeader>
          <CardContent>
            <BanTable bans={pendingBans} isAdmin onApprove={handleApprove} onReject={handleReject} onRevoke={handleRevoke} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Active bans ({activeBans.length})</CardTitle></CardHeader>
        <CardContent>
          {activeBans.length === 0 ? (
            <EmptyState title="No active bans" description="Users who are blocked from new registrations appear here." />
          ) : (
            <BanTable bans={activeBans} isAdmin onApprove={handleApprove} onReject={handleReject} onRevoke={handleRevoke} onRequestRevoke={handleRequestRevoke} />
          )}
        </CardContent>
      </Card>

      {isAdmin && revokeRequests.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Lift requests</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revokeRequests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="max-w-md text-sm">{req.reason}</TableCell>
                    <TableCell><Badge variant={req.status === "pending" ? "secondary" : "outline"}>{req.status}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(req.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      {req.status === "pending" && (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" className="text-green-600 gap-1" onClick={() => handleRevokeRequest(req.id, true)}>
                            <Check size={14} /> Approve
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive gap-1" onClick={() => handleRevokeRequest(req.id, false)}>
                            <X size={14} /> Reject
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Ban history</CardTitle></CardHeader>
        <CardContent>
          {visibleBans.length === 0 ? (
            <EmptyState title="No bans yet" description="Ban records will appear here." />
          ) : (
            <BanTable bans={visibleBans} isAdmin readOnly onApprove={handleApprove} onReject={handleReject} onRevoke={handleRevoke} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function BanTable({
  bans,
  isAdmin,
  readOnly,
  onApprove,
  onReject,
  onRevoke,
  onRequestRevoke,
}: {
  bans: BanWithNames[]
  isAdmin: boolean
  readOnly?: boolean
  onApprove: (ban: UserBan) => void
  onReject: (ban: UserBan) => void
  onRevoke: (ban: UserBan) => void
  onRequestRevoke?: (ban: UserBan) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>User</TableHead>
          <TableHead>Scope</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead>Expires</TableHead>
          <TableHead>Status</TableHead>
          {!readOnly && <TableHead className="text-right">Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {bans.map((ban) => (
          <TableRow key={ban.id}>
            <TableCell>
              <p className="font-medium text-sm">{ban.userName ?? "Unknown"}</p>
              <p className="text-xs text-muted-foreground">{ban.userEmail}</p>
            </TableCell>
            <TableCell className="text-sm">
              {ban.scope === "global" ? "Global" : ban.scope === "event" ? `Event: ${ban.eventTitle ?? "—"}` : `Category: ${ban.categoryName ?? "—"}`}
            </TableCell>
            <TableCell className="text-sm max-w-xs truncate" title={ban.reason}>{ban.reason}</TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {ban.isPermanent ? "Permanent" : ban.expiresAt ? new Date(ban.expiresAt).toLocaleDateString() : "—"}
            </TableCell>
            <TableCell><Badge variant={statusVariant[ban.status] ?? "outline"}>{ban.status}</Badge></TableCell>
            {!readOnly && (
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  {isAdmin && ban.status === "pending" && (
                    <>
                      <Button size="sm" variant="ghost" className="text-green-600 gap-1" onClick={() => onApprove(ban)}><Check size={14} /> Approve</Button>
                      <Button size="sm" variant="ghost" className="text-destructive gap-1" onClick={() => onReject(ban)}><X size={14} /> Reject</Button>
                    </>
                  )}
                  {isAdmin && ban.status === "active" && (
                    <Button size="sm" variant="ghost" className="gap-1" onClick={() => onRevoke(ban)}><RotateCcw size={14} /> Lift</Button>
                  )}
                  {!isAdmin && ban.status === "active" && onRequestRevoke && (
                    <Button size="sm" variant="ghost" className="gap-1" onClick={() => onRequestRevoke(ban)}><RotateCcw size={14} /> Request lift</Button>
                  )}
                </div>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

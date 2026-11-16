import { useState, useEffect, useCallback } from "react"
import { KeyRound, RefreshCw, Copy, Check, ShieldCheck, UserCog, XCircle } from "lucide-react"
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
  getPasswordResetRequests,
  resolvePasswordResetRequest,
  rejectPasswordResetRequest,
  generateStrongPassword,
  adminSetPassword,
} from "../services/passwordResetService"
import { getUsers } from "../services/userService"
import type { PasswordResetRequestItem } from "../types"

export function PasswordResets() {
  const { user } = useAuth()
  const [requests, setRequests] = useState<PasswordResetRequestItem[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [resolving, setResolving] = useState<PasswordResetRequestItem | null>(null)
  const [filter, setFilter] = useState<"pending" | "all">("pending")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rows, userRows] = await Promise.all([
        getPasswordResetRequests(),
        getUsers({ pageSize: 500 }),
      ])
      setRequests(rows)
      setUsers(userRows.items.filter((u) => !u.deletedAt))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load password reset requests")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleReject = async (request: PasswordResetRequestItem) => {
    if (!user) return
    const note = window.prompt("Optional note for the requester:") ?? ""
    try {
      await rejectPasswordResetRequest(request.id, user.id, note)
      toast.success("Request rejected")
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject the request")
    }
  }

  if (loading) return <Loading text="Loading password reset requests..." />

  const visible = filter === "pending" ? requests.filter((r) => r.status === "pending") : requests
  const pendingCount = requests.filter((r) => r.status === "pending").length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><KeyRound size={24} /> Password resets</h1>
          <p className="text-sm text-muted-foreground">
            Resolve manual reset requests with a strong temporary password. The password is sent through the user's in-app inbox
            and the user must change it on first login.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={filter} onChange={(e) => setFilter(e.target.value as "pending" | "all")}
            className="px-3 py-2 rounded-lg border border-input bg-background text-sm">
            <option value="pending">Pending ({pendingCount})</option>
            <option value="all">All requests</option>
          </select>
          <Button variant="outline" className="gap-2" onClick={load}><RefreshCw size={15} /> Refresh</Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Manual reset requests</CardTitle></CardHeader>
        <CardContent>
          {visible.length === 0 ? (
            <EmptyState
              title={filter === "pending" ? "No pending requests" : "No requests yet"}
              description="Users can request an administrator-assisted reset from the forgot-password page."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="text-sm font-medium">{request.email}</TableCell>
                    <TableCell className="text-sm max-w-sm">
                      <p className="line-clamp-2">{request.message || "—"}</p>
                      {request.adminNote && <p className="text-xs text-muted-foreground mt-1">Admin note: {request.adminNote}</p>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={request.status === "pending" ? "secondary" : request.status === "resolved" ? "default" : "outline"}>
                        {request.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(request.createdAt).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      {request.status === "pending" ? (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" className="gap-1 text-primary" onClick={() => setResolving(request)}>
                            <ShieldCheck size={14} /> Reset password
                          </Button>
                          <Button size="sm" variant="ghost" className="gap-1 text-destructive" onClick={() => handleReject(request)}>
                            <XCircle size={14} /> Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {request.handledAt ? new Date(request.handledAt).toLocaleDateString() : "—"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {user && <DirectResetPanel users={users} adminId={user.id} onDone={load} />}

      {resolving && user && (
        <ResolveDialog
          request={resolving}
          adminId={user.id}
          onClose={() => setResolving(null)}
          onDone={() => { setResolving(null); load() }}
        />
      )}
    </div>
  )
}

function ResolveDialog({
  request, adminId, onClose, onDone,
}: {
  request: PasswordResetRequestItem
  adminId: string
  onClose: () => void
  onDone: () => void
}) {
  const [password, setPassword] = useState(() => generateStrongPassword())
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Could not copy the password")
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await resolvePasswordResetRequest(request.id, adminId, password, note || undefined)
      toast.success("Temporary password sent through the user's inbox")
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset the password")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password for {request.email}</DialogTitle>
          <DialogDescription>
            Generate a new strong password or edit it. It is sent in an in-app message and the user must change it after signing in.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Temporary password</label>
            <div className="flex gap-2">
              <Input value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
              <Button type="button" variant="outline" onClick={() => setPassword(generateStrongPassword())} title="Generate a new password">
                <RefreshCw size={15} />
              </Button>
              <Button type="button" variant="outline" onClick={copy} title="Copy password">
                {copied ? <Check size={15} /> : <Copy size={15} />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">At least 8 characters. Mix upper/lower case, digits and symbols.</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Note (optional)</label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Internal note" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Resetting..." : "Reset & send password"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DirectResetPanel({ users, adminId, onDone }: { users: any[]; adminId: string; onDone: () => void }) {
  const [userId, setUserId] = useState("")
  const [password, setPassword] = useState("")
  const [saving, setSaving] = useState(false)

  const generate = () => setPassword(generateStrongPassword())

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return
    setSaving(true)
    try {
      await adminSetPassword(userId, password, adminId)
      toast.success("Temporary password set and sent to the user's inbox")
      setUserId("")
      setPassword("")
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to set the password")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><UserCog size={16} /> Set a password directly</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid lg:grid-cols-4 gap-3 items-end">
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium mb-1">User</label>
            <select value={userId} onChange={(e) => setUserId(e.target.value)} required
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
              <option value="">Select a user</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.profile ? `${u.profile.firstName} ${u.profile.lastName}` : u.email} — {u.email}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Temporary password</label>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required placeholder="Generate or type" />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={generate} title="Generate a strong password"><RefreshCw size={15} /></Button>
            <Button type="submit" disabled={saving || !password}>{saving ? "Saving..." : "Set password"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

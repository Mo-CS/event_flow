import { useState, useEffect, useCallback } from "react"
import { useAuth } from "../contexts/AuthContext"
import { toast } from "sonner"
import { Monitor, Smartphone, Laptop, Globe, Trash2, LogOut } from "lucide-react"
import { Avatar, AvatarFallback } from "../components/ui/avatar"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { updateUser } from "../services/userService"
import { setOrganizerAllEvents } from "../services/organizerService"
import { getDeviceSessions, deleteDeviceSession, deleteAllDeviceSessions, type SessionListItem } from "../services/deviceSessionService"

const SESSION_KEY = "eventflow_session"

function deviceIcon(name: string) {
  const n = name.toLowerCase()
  if (n.includes("android") || n.includes("iphone") || n.includes("ipad") || n.includes("ios")) return <Smartphone size={16} />
  if (n.includes("windows")) return <Monitor size={16} />
  if (n.includes("mac")) return <Laptop size={16} />
  return <Globe size={16} />
}

export function Profile() {
  const { user, profile, role, refreshProfile } = useAuth()
  const [firstName, setFirstName] = useState(profile?.firstName ?? "")
  const [lastName, setLastName] = useState(profile?.lastName ?? "")
  const [phone, setPhone] = useState(profile?.phoneNumber ?? "")
  const [managesAll, setManagesAll] = useState(profile?.managesAllEvents ?? false)
  const [saving, setSaving] = useState(false)
  const [sessions, setSessions] = useState<SessionListItem[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [revokingAll, setRevokingAll] = useState(false)

  const initials = `${profile?.firstName?.[0] ?? ""}${profile?.lastName?.[0] ?? ""}`

  const loadSessions = useCallback(async () => {
    if (!user) return
    try {
      const token = localStorage.getItem(SESSION_KEY) ?? ""
      const list = await getDeviceSessions(user.id, token)
      setSessions(list)
    } catch {
      toast.error("Could not load active sessions")
    } finally {
      setSessionsLoading(false)
    }
  }, [user])

  useEffect(() => { loadSessions() }, [loadSessions])

  const handleRevoke = async (id: string) => {
    if (!user) return
    setRevokingId(id)
    try {
      await deleteDeviceSession(user.id, id)
      setSessions((prev) => prev.filter((s) => s.id !== id))
      toast.success("Session signed out")
    } catch {
      toast.error("Failed to sign out that session")
    } finally {
      setRevokingId(null)
    }
  }

  const handleRevokeAll = async () => {
    if (!user) return
    setRevokingAll(true)
    try {
      const token = localStorage.getItem(SESSION_KEY) ?? ""
      const count = await deleteAllDeviceSessions(user.id, token)
      setSessions((prev) => prev.filter((s) => s.isCurrent))
      toast.success(count > 0 ? `Signed out ${count} other session${count === 1 ? "" : "s"}` : "No other sessions to sign out")
    } catch {
      toast.error("Failed to sign out other sessions")
    } finally {
      setRevokingAll(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    try {
      await updateUser(user.id, { firstName, lastName, phoneNumber: phone })
      await refreshProfile()
      toast.success("Profile updated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  const handleToggleAllEvents = async (checked: boolean) => {
    if (!user || role !== "admin") return
    setManagesAll(checked)
    try {
      await setOrganizerAllEvents(user.id, checked)
      await refreshProfile()
      toast.success(checked ? "You now manage all events" : "All-events management disabled")
    } catch {
      setManagesAll(!checked)
      toast.error("Failed to update setting")
    }
  }

  return (
    <div className="relative max-w-2xl mx-auto space-y-6 animate-fade-in-up">
      <div className="absolute -top-10 -right-10 w-64 h-64 bg-teal-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-56 h-56 bg-amber-500/6 rounded-full blur-3xl pointer-events-none" />
      <h1 className="text-2xl font-bold">My Profile</h1>

      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
              <AvatarFallback className="text-lg bg-gradient-to-br from-primary/20 to-accent/20">{initials || "?"}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{profile?.firstName} {profile?.lastName}</p>
              <p className="text-sm text-muted-foreground capitalize">{role}</p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user?.email ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <Button type="submit" className="bg-gradient-to-r from-primary to-[hsl(185,75%,42%)]" disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button>
          </form>
        </CardContent>
      </Card>

      {(role === "admin" || role === "organizer") && (
        <Card>
          <CardHeader>
            <CardTitle>Event Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Manage all events</p>
                <p className="text-sm text-muted-foreground">
                  When enabled, you'll be added as a co-organizer (with chat access) to every event automatically.
                  {role !== "admin" && " Only admins can change this setting."}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={managesAll}
                disabled={role !== "admin"}
                onClick={() => handleToggleAllEvents(!managesAll)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${managesAll ? "bg-primary" : "bg-input"} ${role !== "admin" ? "cursor-not-allowed opacity-60" : ""}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${managesAll ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Active Sessions
            {sessions.filter((s) => !s.isCurrent).length > 0 && (
              <Button size="sm" variant="outline" className="gap-2" onClick={handleRevokeAll} disabled={revokingAll}>
                <LogOut size={14} /> {revokingAll ? "Signing out..." : "Sign out other devices"}
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <p className="text-sm text-muted-foreground">Loading sessions...</p>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active sessions.</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">{deviceIcon(s.deviceName)}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {s.deviceName}
                        {s.isCurrent && <Badge variant="outline" className="ml-2 text-[10px]">This device</Badge>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Last active {new Date(s.lastActiveAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {!s.isCurrent && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-destructive"
                      disabled={revokingId === s.id}
                      onClick={() => handleRevoke(s.id)}
                    >
                      <Trash2 size={14} /> {revokingId === s.id ? "..." : "Sign out"}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

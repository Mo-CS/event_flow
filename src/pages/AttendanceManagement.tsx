import { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Search, Scan, Camera, CheckCircle, LogOut, User } from "lucide-react"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Loading } from "../components/ui/Loading"
import { EmptyState } from "../components/ui/EmptyState"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog"
import { QrScanner } from "../components/QrScanner"
import { useAuth } from "../contexts/AuthContext"
import { getEventById, getRegistrations } from "../services/eventService"
import { checkIn, checkOut, getAttendanceByEvent, findTicketByCode, getAttendanceByTicket } from "../services/attendanceService"
import { getTicketsByIds, getTicketByRegistration } from "../services/ticketService"
import { getProfilesByIds } from "../services/userService"
import type { Registration, Ticket, Attendance } from "../types"

export function AttendanceManagement() {
  const { eventId } = useParams<{ eventId: string }>()
  const { profile, role } = useAuth()
  const navigate = useNavigate()
  const [eventTitle, setEventTitle] = useState("")
  const [isHybrid, setIsHybrid] = useState(false)
  const [modeFilter, setModeFilter] = useState<"all" | "online" | "in_person">("all")
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<Map<string, Attendance>>(new Map())
  const [ticketMap, setTicketMap] = useState<Map<string, Ticket>>(new Map())
  const [loading, setLoading] = useState(true)
  const [scanCode, setScanCode] = useState("")
  const [scanning, setScanning] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [profileMap, setProfileMap] = useState<Map<string, any>>(new Map())

  const [pendingConfirm, setPendingConfirm] = useState<{
    ticket: Ticket
    registration: Registration
    profile: any
    existingAtt: Attendance | null
  } | null>(null)

  const fetch = useCallback(async () => {
    if (!eventId) return
    setLoading(true)
    try {
      const event = await getEventById(eventId)
      if (!event) { navigate("/dashboard/events"); return }
      if (event.organizerId !== profile?.id && role !== "admin") { navigate("/dashboard/events"); return }
      setEventTitle(event.title)
      setIsHybrid(event.eventType === "hybrid")
      const regs = await getRegistrations(eventId)
      const confirmed = regs.filter((r) => r.status === "confirmed").sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime())
      setRegistrations(confirmed)
      const att = await getAttendanceByEvent(eventId)
      const amap = new Map<string, Attendance>()
      const tmap = new Map<string, Ticket>()
      const regIds = confirmed.map((r) => r.id)
      if (regIds.length > 0) {
        const tkts = await getTicketsByIds((await Promise.all(regIds.map((id) => getTicketByRegistration(id)))).filter(Boolean).map((t) => t!.id))
        const byReg = new Map<string, Ticket>()
        for (const t of tkts) {
          byReg.set(t.registrationId, t)
          tmap.set(t.registrationId, t)
        }
        const attendeeIds = [...new Set(confirmed.map((r) => r.attendeeId))]
        const profs = await getProfilesByIds(attendeeIds)
        setProfileMap(new Map(profs.map((p: any) => [p.id, p])))
      }
      for (const a of att) {
        amap.set(a.ticketId, a)
      }
      setAttendanceRecords(amap)
      setTicketMap(tmap)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [eventId, navigate, profile?.id, role])

  useEffect(() => { fetch() }, [fetch])

  const handleCheckIn = async (reg: Registration) => {
    const ticket = ticketMap.get(reg.id)
    if (!ticket) { toast.error("No ticket found for this registration"); return }
    try {
      await checkIn(ticket.id, { mode: reg.attendanceMode, verifiedBy: profile?.userId })
      toast.success(`${profileMap.get(reg.attendeeId)?.firstName ?? "Attendee"} checked in`)
      fetch()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const handleCheckOut = async (reg: Registration) => {
    const ticket = ticketMap.get(reg.id)
    if (!ticket) return
    const att = attendanceRecords.get(ticket.id)
    if (!att) { toast.error("No check-in record found"); return }
    try {
      await checkOut(att.id)
      toast.success("Checked out")
      fetch()
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to check out")
    }
  }

  const lookupTicket = async (code: string) => {
    if (!code.trim()) return
    setScanning(true)
    try {
      const ticket = await findTicketByCode(code.trim())
      if (!ticket) {
        toast.error("No ticket found with that code")
        return
      }
      const reg = registrations.find((r) => r.id === ticket.registrationId)
      if (!reg) {
        toast.error("Registration not found for this ticket")
        return
      }
      const attendee = profileMap.get(reg.attendeeId)
      const existingAtt = await getAttendanceByTicket(ticket.id)
      setPendingConfirm({ ticket, registration: reg, profile: attendee, existingAtt: existingAtt ?? null })
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to look up ticket")
    } finally {
      setScanning(false)
    }
  }

  const handleConfirmCheckIn = async () => {
    if (!pendingConfirm) return
    const { ticket, existingAtt } = pendingConfirm
    try {
      if (existingAtt && existingAtt.checkOutTime) {
        toast.success("Ticket already checked in and out")
      } else if (existingAtt) {
        await checkOut(existingAtt.id)
        toast.success(`${pendingConfirm.profile?.firstName ?? "Attendee"} checked out`)
      } else {
        await checkIn(ticket.id, { mode: pendingConfirm.registration.attendanceMode, source: "qr_scan", verifiedBy: profile?.userId })
        toast.success(`${pendingConfirm.profile?.firstName ?? "Attendee"} checked in`)
      }
      setScanCode("")
      fetch()
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to process check-in")
    } finally {
      setPendingConfirm(null)
      setScanning(false)
    }
  }

  const handleScan = () => {
    lookupTicket(scanCode)
  }

  const handleQrScan = (code: string) => {
    setShowScanner(false)
    lookupTicket(code)
  }

  if (loading) return <Loading text="Loading attendance..." />

  const visibleRegistrations = modeFilter === "all"
    ? registrations
    : registrations.filter((r) => (r.attendanceMode ?? "in_person") === modeFilter)

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/events")} className="gap-2">
        <ArrowLeft size={16} /> Back to Events
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Attendance: {eventTitle}</h1>
        <div className="flex items-center gap-2">
          {isHybrid && (
            <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value as "all" | "online" | "in_person")}
              className="px-3 py-2 rounded-lg border border-input bg-background text-sm">
              <option value="all">All modes</option>
              <option value="in_person">In person</option>
              <option value="online">Online</option>
            </select>
          )}
          <Badge variant="secondary">{visibleRegistrations.length} attendees</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Scan size={16} /> Scan Ticket</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter ticket code (e.g. TECH-2026-001)"
              value={scanCode}
              onChange={(e) => setScanCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleScan() }}
            />
            <Button onClick={handleScan} disabled={scanning || !scanCode.trim()} className="gap-2">
              <Search size={14} /> {scanning ? "Looking up..." : "Find"}
            </Button>
            <Button onClick={() => setShowScanner(true)} variant="outline" className="gap-2">
              <Camera size={14} /> Scan QR
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Type a ticket code or scan the attendee's QR code</p>
          {showScanner && <QrScanner onScan={handleQrScan} onClose={() => setShowScanner(false)} />}
        </CardContent>
      </Card>

      <Dialog open={!!pendingConfirm} onOpenChange={(open) => { if (!open) setPendingConfirm(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {pendingConfirm?.existingAtt && !pendingConfirm.existingAtt.checkOutTime
                ? "Check Out Attendee?"
                : pendingConfirm?.existingAtt?.checkOutTime
                  ? "Already Processed"
                  : "Check In Attendee?"}
            </DialogTitle>
            <DialogDescription>
              Verify the attendee details before confirming.
            </DialogDescription>
          </DialogHeader>
          {pendingConfirm && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/50">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500/30 to-amber-500/30 flex items-center justify-center">
                  <User size={18} className="text-primary" />
                </div>
                <div>
                  <p className="font-medium">{pendingConfirm.profile?.firstName} {pendingConfirm.profile?.lastName}</p>
                  <p className="text-xs text-muted-foreground">{pendingConfirm.ticket.uniqueCode}</p>
                </div>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Event: {eventTitle}</p>
                <p>Status: {
                  pendingConfirm.existingAtt && !pendingConfirm.existingAtt.checkOutTime
                    ? "Checked in"
                    : pendingConfirm.existingAtt?.checkOutTime
                      ? "Checked in & out"
                      : "Not checked in"
                }</p>
                {pendingConfirm.existingAtt && (
                  <p>Checked in at: {new Date(pendingConfirm.existingAtt.checkInTime).toLocaleTimeString()}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setPendingConfirm(null)}>
                  Cancel
                </Button>
                {(!pendingConfirm.existingAtt || !pendingConfirm.existingAtt.checkOutTime) && (
                  <Button
                    className="flex-1"
                    variant={pendingConfirm.existingAtt ? "secondary" : "default"}
                    onClick={handleConfirmCheckIn}
                  >
                    {pendingConfirm.existingAtt ? "Check Out" : "Check In"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {visibleRegistrations.length === 0 ? (
        <EmptyState title="No confirmed registrations" description="Only confirmed registrations can check in." />
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Attendee</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Ticket Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Check-out</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRegistrations.map((reg) => {
                const attendee = profileMap.get(reg.attendeeId)
                const ticket = ticketMap.get(reg.id)
                const att = ticket ? attendanceRecords.get(ticket.id) : undefined
                return (
                  <TableRow key={reg.id}>
                    <TableCell>
                      <p className="font-medium">{attendee?.firstName} {attendee?.lastName}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={(att?.mode ?? reg.attendanceMode) === "online" ? "secondary" : "outline"}>
                        {(att?.mode ?? reg.attendanceMode) === "online" ? "Online" : "In person"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-0.5 rounded">{ticket?.uniqueCode ?? "—"}</code>
                    </TableCell>
                    <TableCell>
                      {att ? (
                        <Badge variant="default" className="bg-green-600">Checked In</Badge>
                      ) : (
                        <Badge variant="outline">Not Checked In</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {att ? new Date(att.checkInTime).toLocaleTimeString() : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {att?.checkOutTime ? new Date(att.checkOutTime).toLocaleTimeString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {!att && (
                        <Button size="sm" variant="ghost" className="text-green-600" onClick={() => handleCheckIn(reg)}>
                          <CheckCircle size={14} /> Check In
                        </Button>
                      )}
                      {att && !att.checkOutTime && (
                        <Button size="sm" variant="ghost" onClick={() => handleCheckOut(reg)}>
                          <LogOut size={14} /> Check Out
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

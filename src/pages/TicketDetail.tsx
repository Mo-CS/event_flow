import { formatDate } from "../i18n/format"
import { statusLabel, t } from "../i18n"
import { useState, useEffect } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { ArrowLeft, Download, CheckCircle, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { getTicketForOwner, downloadTicket } from "../services/ticketService"
import { getEventById, getAllRegistrations } from "../services/eventService"
import { useAuth } from "../contexts/AuthContext"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Loading } from "../components/ui/Loading"
import type { Ticket, Event } from "../types"
import QRCode from "qrcode"

export function TicketDetail() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [event, setEvent] = useState<Event | null>(null)
  const [qrCodeUrl, setQrCodeUrl] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    ;(async () => {
      if (!profile) {
        navigate("/login")
        return
      }
      let loaded: Ticket | null = null
      try {
        loaded = (await getTicketForOwner(id, profile.id)) ?? null
      } catch {
        loaded = null
      }
      if (!loaded) { setLoading(false); return }
      setTicket(loaded)
      if (loaded.qrCodeUrl) {
        setQrCodeUrl(loaded.qrCodeUrl)
      } else {
        QRCode.toDataURL(loaded.uniqueCode, { width: 300, margin: 2 }).then(setQrCodeUrl).catch(() => {})
      }
      const allRegs = await getAllRegistrations()
      const reg = allRegs.find((r) => r.id === loaded.registrationId)
      if (reg) {
        const ev = await getEventById(reg.eventId)
        setEvent(ev ?? null)
      }
      setLoading(false)
    })()
  }, [id, profile, navigate])

  const handleDownload = async () => {
    if (!ticket) return
    try {
      await downloadTicket(ticket.id)
      toast.success(t("Ticket downloaded"))
    } catch {
      toast.error(t("Failed to download ticket"))
    }
  }

  if (loading) return <Loading text={t("Loading ticket...")} />
  if (!ticket) return <div className="text-center py-12 text-muted-foreground">{t("Ticket not found")}</div>

  return (
    <div className="max-w-lg mx-auto space-y-6 py-8">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft size={16} /> {t("Back to Dashboard")}
      </Link>
      <Card className="border-2 border-primary/20">
        <CardHeader className="text-center border-b border-border pb-6">
          <CardTitle className="text-2xl">{event?.title ?? t("Event Ticket")}</CardTitle>
          <p className="text-sm text-muted-foreground">{event ? formatDate(new Date(event.startDate)) : ""}</p>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {qrCodeUrl && (
            <div className="flex justify-center">
              <img src={qrCodeUrl} alt={t("QR Code")} className="w-48 h-48 border border-border rounded-lg" />
            </div>
          )}

          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("Ticket Code")}</span>
              <span className="font-mono font-medium">{ticket.uniqueCode}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("Issued")}</span>
              <span>{formatDate(new Date(ticket.issuedAt))}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("Status")}</span>
              <Badge variant={ticket.status === "valid" ? "default" : ticket.status === "used" ? "secondary" : "destructive"}>
                {ticket.status === "valid" && <CheckCircle size={12} className="mr-1" />}
                {ticket.status === "invalid" && <AlertCircle size={12} className="mr-1" />}
                {statusLabel(ticket.status)}
              </Badge>
            </div>
          </div>

          <Button className="w-full" onClick={handleDownload}>
            <Download size={16} /> {t("Download Ticket")}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

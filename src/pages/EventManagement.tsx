import { formatDate } from "../i18n/format"
import { statusLabel, t } from "../i18n"
import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Plus, Pencil, Trash2, Copy, Archive, Eye, Calendar, MapPin, Users, Send, RotateCcw, ListOrdered, ClipboardList, ScanLine, UserPlus, Wallet, ClipboardCheck, MessageSquare, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import { Loading } from "../components/ui/Loading"
import { EmptyState } from "../components/ui/EmptyState"
import { useAuth } from "../contexts/AuthContext"
import { getEventsForUser, deleteEvent, duplicateEvent, publishEvent, archiveEvent, setDraft } from "../services/eventService"
import { sendEventReminder } from "../services/notificationService"
import { getVenues } from "../services/venueService"
import type { Event, Venue } from "../types"

const statusColors: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  published: "default",
  draft: "secondary",
  archived: "outline",
}

export function EventManagement() {
  const { profile, user, role } = useAuth()
  const navigate = useNavigate()
  const [events, setEvents] = useState<Event[]>([])
  const [venues, setVenues] = useState<Venue[]>([])
  const [loading, setLoading] = useState(true)
  const [sendingReminder, setSendingReminder] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!profile || !user) return
    setLoading(true)
    const [data, v] = await Promise.all([
      getEventsForUser(profile.id, user.id, role ?? "attendee", profile.managesAllEvents ?? false),
      getVenues(),
    ])
    setEvents(data)
    setVenues(v)
    setLoading(false)
  }, [profile, user, role])

  useEffect(() => { fetch() }, [fetch])

  const handleDelete = async (event: Event) => {
    await deleteEvent(event.id)
    toast.success(t("\"{name}\" deleted", { name: event.title }))
    fetch()
  }

  const handleDuplicate = async (event: Event) => {
    await duplicateEvent(event.id)
    toast.success(t("\"{title}\" duplicated as draft", { title: event.title }))
    fetch()
  }

  const handlePublish = async (event: Event) => {
    await publishEvent(event.id)
    toast.success(t("\"{title}\" published", { title: event.title }))
    fetch()
  }

  const handleArchive = async (event: Event) => {
    await archiveEvent(event.id)
    toast.success(t("\"{title}\" archived", { title: event.title }))
    fetch()
  }

  const handleDraft = async (event: Event) => {
    await setDraft(event.id)
    toast.success(t("\"{title}\" moved to draft", { title: event.title }))
    fetch()
  }

  const handleSendReminder = async (event: Event) => {
    setSendingReminder(event.id)
    try {
      const count = await sendEventReminder(event.id)
      if (count === 0) {
        toast.info(t("No confirmed attendees to remind"))
      } else {
        toast.success(t("Reminder sent to {count} attendees", { count }))
      }
    } catch (e: any) {
      toast.error(e?.message ?? t("Failed to send reminder"))
    } finally {
      setSendingReminder(null)
    }
  }

  if (loading) return <Loading text={t("Loading events...")} />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("My Events")}</h1>
        <Button onClick={() => navigate("/dashboard/events/new")} className="gap-2"><Plus size={16} /> {t("Create Event")}</Button>
      </div>

      {events.length === 0 ? (
        <EmptyState title={t("No events yet")} description={t("Create your first event to get started.")} action={
          <Button onClick={() => navigate("/dashboard/events/new")}><Plus size={16} /> {t("Create Event")}</Button>
        } />
      ) : (
        <div className="grid gap-4">
          {events.map((event) => (
            <div key={event.id} className="rounded-xl border border-border bg-card p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg font-semibold">{event.title}</span>
                    <Badge variant={statusColors[event.status] ?? "outline"}>{statusLabel(event.status)}</Badge>
                    <Badge variant="outline" className="text-xs">{event.visibility === "public" ? t("Public") : t("Private")}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar size={14} /> {formatDate(new Date(event.startDate))}</span>
                    <span className="flex items-center gap-1"><MapPin size={14} /> {venues.find((v) => v.id === event.venueId)?.name ?? t("Unknown venue")}</span>
                    <span className="flex items-center gap-1"><Users size={14} /> {event.capacity} {t("spots")}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
                <Button size="sm" variant="ghost" onClick={() => navigate(`/dashboard/events/${event.id}/registrations`)}><ClipboardList size={14} /> {t("Registrations")}</Button>
                {event.visibility === "private" && (
                  <Button size="sm" variant="ghost" onClick={() => navigate(`/dashboard/events/${event.id}/invitations`)}><UserPlus size={14} /> {t("Invitations")}</Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => navigate(`/dashboard/events/${event.id}/attendance`)}><ScanLine size={14} /> {t("Attendance")}</Button>
                <Button size="sm" variant="ghost" onClick={() => navigate(`/dashboard/events/${event.id}/schedule`)}><ListOrdered size={14} /> {t("Schedule")}</Button>
                <Button size="sm" variant="ghost" onClick={() => navigate(`/dashboard/events/${event.id}/costs`)}><Wallet size={14} /> {t("Costs")}</Button>
                <Button size="sm" variant="ghost" onClick={() => navigate(`/dashboard/events/${event.id}/evaluation`)}><ClipboardCheck size={14} /> {t("Evaluation")}</Button>
                <Button size="sm" variant="ghost" onClick={() => navigate(`/dashboard/events/${event.id}/chat`)}><MessageSquare size={14} /> {t("Chat")}</Button>
                {role === "admin" && (
                  <Button size="sm" variant="ghost" onClick={() => navigate(`/dashboard/events/${event.id}/organizers`)}><ShieldCheck size={14} /> {t("Organizers")}</Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => navigate(`/events/${event.id}`)}><Eye size={14} /> {t("View")}</Button>
                <Button size="sm" variant="ghost" onClick={() => navigate(`/dashboard/events/${event.id}/edit`)}><Pencil size={14} /> {t("Edit")}</Button>
                {event.status === "draft" && (
                  <Button size="sm" variant="ghost" className="text-green-600" onClick={() => handlePublish(event)}><Send size={14} /> {t("Publish")}</Button>
                )}
                {event.status === "published" && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => handleSendReminder(event)} disabled={sendingReminder === event.id}>
                      <Send size={14} /> {sendingReminder === event.id ? t("Sending...") : t("Send Reminder")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleArchive(event)}><Archive size={14} /> {t("Archive")}</Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDraft(event)}><RotateCcw size={14} /> {t("Unpublish")}</Button>
                  </>
                )}
                {event.status === "archived" && (
                  <Button size="sm" variant="ghost" className="text-green-600" onClick={() => handlePublish(event)}><Send size={14} /> {t("Republish")}</Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => handleDuplicate(event)}><Copy size={14} /> {t("Duplicate")}</Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(event)}><Trash2 size={14} /> {t("Delete")}</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import {
  Mail, Plus, Send, Trash2, XCircle, RefreshCw, Users, Eye,
} from "lucide-react"
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
  getCampaigns,
  createCampaign,
  sendCampaign,
  cancelCampaign,
  deleteCampaign,
  processDueCampaigns,
  getCampaignRecipients,
  resolveCampaignRecipients,
} from "../services/campaignService"
import { getContacts, getAudienceAccess, allAudienceTags } from "../services/audienceService"
import { getAllEvents } from "../services/eventService"
import { getEmailProvider } from "../services/emailService"
import type {
  AudienceContact, CampaignStatus, CampaignTargetType, EmailCampaign, EmailCampaignRecipient,
  Event, RecipientStatusFilter,
} from "../types"

const statusVariant: Record<CampaignStatus, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "secondary",
  scheduled: "outline",
  sending: "secondary",
  sent: "default",
  failed: "destructive",
  cancelled: "outline",
}

export function Campaigns() {
  const { user, role } = useAuth()
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([])
  const [contacts, setContacts] = useState<AudienceContact[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [runningDue, setRunningDue] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [details, setDetails] = useState<EmailCampaign | null>(null)
  const autoProcessed = useRef(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const access = await getAudienceAccess(user.id, role)
      const canSend = access.isAdmin || access.canSend
      setAllowed(canSend)
      if (!canSend) return
      const [campaignRows, contactRows, eventRows] = await Promise.all([
        getCampaigns(),
        getContacts(),
        getAllEvents(),
      ])
      setCampaigns(campaignRows)
      setContacts(contactRows)
      setEvents(eventRows)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load campaigns")
    } finally {
      setLoading(false)
    }
  }, [role, user])

  useEffect(() => { load() }, [load])

  // Scheduled campaigns are processed whenever an authorized panel loads. The
  // guard prevents a reload loop when processing updates the campaign list.
  useEffect(() => {
    if (allowed !== true || autoProcessed.current) return
    autoProcessed.current = true
    processDueCampaigns()
      .then((count) => { if (count > 0) load() })
      .catch(() => { /* automatic processing is best-effort */ })
  }, [allowed, load])

  const handleRunDue = async () => {
    setRunningDue(true)
    try {
      const count = await processDueCampaigns()
      toast.success(count > 0 ? `Sent ${count} due campaign${count === 1 ? "" : "s"}` : "No campaigns are due")
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to process due campaigns")
    } finally {
      setRunningDue(false)
    }
  }

  const handleSend = async (campaign: EmailCampaign) => {
    setBusyId(campaign.id)
    try {
      await sendCampaign(campaign.id)
      toast.success("Campaign sent")
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send the campaign")
    } finally {
      setBusyId(null)
    }
  }

  const handleCancel = async (campaign: EmailCampaign) => {
    setBusyId(campaign.id)
    try {
      await cancelCampaign(campaign.id)
      toast.success("Campaign cancelled")
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel the campaign")
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (campaign: EmailCampaign) => {
    if (!window.confirm(`Delete campaign “${campaign.name}”?`)) return
    setBusyId(campaign.id)
    try {
      await deleteCampaign(campaign.id)
      toast.success("Campaign deleted")
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete the campaign")
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <Loading text="Loading campaigns..." />

  if (!allowed) {
    return (
      <div className="max-w-lg mx-auto text-center py-20 space-y-3">
        <Mail size={44} className="mx-auto text-muted-foreground opacity-40" />
        <h1 className="text-xl font-semibold">Campaign access required</h1>
        <p className="text-sm text-muted-foreground">
          An administrator can grant temporary sending access from the audience access panel.
        </p>
      </div>
    )
  }

  const provider = getEmailProvider()
  const tags = allAudienceTags(contacts)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Mail size={24} /> Email campaigns</h1>
          <p className="text-sm text-muted-foreground">
            Send to the audience database. Unsubscribed and deleted accounts are never included.
            Scheduling is stored in the database; due campaigns are sent when an authorized panel loads or when you run them now.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={provider === "mock" ? "outline" : "default"}>
            {provider === "mock" ? "Mock delivery" : `Live: ${provider}`}
          </Badge>
          <Button variant="outline" className="gap-2" onClick={handleRunDue} disabled={runningDue}>
            <RefreshCw size={15} className={runningDue ? "animate-spin" : ""} /> Run due now
          </Button>
          <Button className="gap-2" onClick={() => setShowForm((v) => !v)}>
            <Plus size={16} /> {showForm ? "Close form" : "New campaign"}
          </Button>
        </div>
      </div>

      {provider === "mock" && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          Mock mode is active. Messages are reported as sent but only logged to the console.
          Set <code className="text-xs">VITE_EMAIL_PROVIDER</code>, <code className="text-xs">VITE_EMAIL_API_KEY</code> and{" "}
          <code className="text-xs">VITE_EMAIL_FROM</code> for real delivery.
        </div>
      )}

      {showForm && user && (
        <CampaignForm
          contacts={contacts}
          events={events}
          tags={tags}
          userId={user.id}
          onCancel={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load() }}
        />
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Campaigns ({campaigns.length})</CardTitle></CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <EmptyState title="No campaigns yet" description="Create a campaign to email your audience." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{campaign.name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1 max-w-xs">{campaign.subject}</p>
                    </TableCell>
                    <TableCell className="text-sm capitalize">
                      {campaign.targetType === "all" ? "All audience" : campaign.targetType === "event"
                        ? events.find((e) => e.id === campaign.targetEventId)?.title ?? "Event"
                        : campaign.targetType === "tag" ? `Tags: ${campaign.targetTags.join(", ") || "—"}` : `${campaign.targetContactIds.length} contacts`}
                    </TableCell>
                    <TableCell className="text-sm">
                      {campaign.sentCount}/{campaign.totalRecipients}
                      {campaign.failedCount > 0 && <span className="text-destructive"> · {campaign.failedCount} failed</span>}
                    </TableCell>
                    <TableCell><Badge variant={statusVariant[campaign.status]}>{campaign.status}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {campaign.scheduledAt ? new Date(campaign.scheduledAt).toLocaleString() : campaign.sentAt ? `Sent ${new Date(campaign.sentAt).toLocaleDateString()}` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 flex-wrap">
                        <Button size="sm" variant="ghost" className="gap-1" onClick={() => setDetails(campaign)}>
                          <Eye size={14} /> View
                        </Button>
                        {(campaign.status === "draft" || campaign.status === "scheduled") && (
                          <>
                            <Button size="sm" variant="ghost" className="gap-1 text-primary" disabled={busyId === campaign.id} onClick={() => handleSend(campaign)}>
                              <Send size={14} /> Send now
                            </Button>
                            <Button size="sm" variant="ghost" className="gap-1" disabled={busyId === campaign.id} onClick={() => handleCancel(campaign)}>
                              <XCircle size={14} /> Cancel
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="ghost" className="text-destructive" disabled={busyId === campaign.id} onClick={() => handleDelete(campaign)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {details && <RecipientsDialog campaign={details} onClose={() => setDetails(null)} />}
    </div>
  )
}

function CampaignForm({
  contacts,
  events,
  tags,
  userId,
  onCancel,
  onSaved,
}: {
  contacts: AudienceContact[]
  events: Event[]
  tags: string[]
  userId: string
  onCancel: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState("")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [targetType, setTargetType] = useState<CampaignTargetType>("all")
  const [targetEventId, setTargetEventId] = useState("")
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([])
  const [recipientStatus, setRecipientStatus] = useState<RecipientStatusFilter>("both")
  const [sendMode, setSendMode] = useState<"now" | "schedule" | "draft">("now")
  const [scheduledAt, setScheduledAt] = useState("")
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<number | null>(null)

  const subscribed = useMemo(() => contacts.filter((c) => c.status === "subscribed"), [contacts])

  useEffect(() => {
    let cancelled = false
    resolveCampaignRecipients({
      targetType,
      targetEventId: targetEventId || undefined,
      targetTags: selectedTags,
      targetContactIds: selectedContactIds,
      recipientStatus,
    })
      .then((rows) => { if (!cancelled) setPreview(rows.length) })
      .catch(() => { if (!cancelled) setPreview(null) })
    return () => { cancelled = true }
  }, [recipientStatus, selectedContactIds, selectedTags, targetEventId, targetType])

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag])
  }

  const toggleContact = (id: string) => {
    setSelectedContactIds((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id])
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await createCampaign(
        {
          name,
          subject,
          body,
          targetType,
          targetEventId: targetType === "event" ? targetEventId : undefined,
          targetTags: targetType === "tag" ? selectedTags : [],
          targetContactIds: targetType === "contacts" ? selectedContactIds : [],
          recipientStatus,
          scheduledAt: sendMode === "schedule" ? new Date(scheduledAt).toISOString() : undefined,
          sendNow: sendMode === "now",
        },
        userId,
      )
      toast.success(sendMode === "now" ? "Campaign sent" : sendMode === "schedule" ? "Campaign scheduled" : "Campaign saved as draft")
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save the campaign")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">New campaign</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Internal name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Spring newsletter" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Subject</label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} required placeholder="Email subject" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Body</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} required
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
              placeholder="Write the message. Plain text line breaks are preserved." />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Audience</label>
              <select value={targetType} onChange={(e) => setTargetType(e.target.value as CampaignTargetType)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                <option value="all">All subscribed contacts</option>
                <option value="tag">Contacts with selected tags</option>
                <option value="event">Event attendees</option>
                <option value="contacts">Selected contacts</option>
              </select>
            </div>
            {targetType === "event" && (
              <div>
                <label className="block text-sm font-medium mb-1">Event</label>
                <select value={targetEventId} onChange={(e) => setTargetEventId(e.target.value)} required
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                  <option value="">Select an event</option>
                  {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                </select>
              </div>
            )}
            {targetType === "event" && (
              <div>
                <label className="block text-sm font-medium mb-1">Registration status</label>
                <select value={recipientStatus} onChange={(e) => setRecipientStatus(e.target.value as RecipientStatusFilter)}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                  <option value="both">Confirmed + waitlisted</option>
                  <option value="confirmed">Confirmed only</option>
                  <option value="waitlisted">Waitlisted only</option>
                </select>
              </div>
            )}
          </div>

          {targetType === "tag" && (
            <div>
              <label className="block text-sm font-medium mb-1">Tags</label>
              {tags.length === 0 ? (
                <p className="text-xs text-muted-foreground">No tags exist yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <button key={tag} type="button" onClick={() => toggleTag(tag)}>
                      <Badge variant={selectedTags.includes(tag) ? "default" : "outline"}>{tag}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {targetType === "contacts" && (
            <div>
              <label className="block text-sm font-medium mb-1">Contacts ({selectedContactIds.length} selected)</label>
              <div className="max-h-44 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                {subscribed.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3">No subscribed contacts.</p>
                ) : subscribed.map((contact) => (
                  <label key={contact.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={selectedContactIds.includes(contact.id)} onChange={() => toggleContact(contact.id)} />
                    <span className="flex-1 truncate">{contact.name || contact.email}</span>
                    <span className="text-xs text-muted-foreground truncate">{contact.email}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
            <span className="text-sm flex items-center gap-2"><Users size={15} /> Estimated recipients: <strong>{preview ?? "—"}</strong></span>
            <span className="text-xs text-muted-foreground">Unsubscribed and deleted accounts are excluded automatically.</span>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Delivery</label>
              <select value={sendMode} onChange={(e) => setSendMode(e.target.value as typeof sendMode)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                <option value="now">Send immediately</option>
                <option value="schedule">Schedule</option>
                <option value="draft">Save as draft</option>
              </select>
            </div>
            {sendMode === "schedule" && (
              <div>
                <label className="block text-sm font-medium mb-1">Scheduled time</label>
                <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} required />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit" disabled={saving} className="gap-2">
              <Send size={15} /> {saving ? "Saving..." : sendMode === "now" ? "Create & send" : sendMode === "schedule" ? "Schedule campaign" : "Save draft"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function RecipientsDialog({ campaign, onClose }: { campaign: EmailCampaign; onClose: () => void }) {
  const [rows, setRows] = useState<EmailCampaignRecipient[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCampaignRecipients(campaign.id)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [campaign.id])

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{campaign.name}</DialogTitle>
          <DialogDescription>
            {campaign.subject} · {campaign.sentCount} sent / {campaign.totalRecipients} recipients
            {campaign.failedCount > 0 ? ` · ${campaign.failedCount} failed` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm whitespace-pre-wrap mb-3">{campaign.body}</div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading recipients...</p>
        ) : rows.length === 0 ? (
          <EmptyState title="No recipients" description="This campaign had no eligible recipients." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent at</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-sm">{row.email}</TableCell>
                  <TableCell>
                    <Badge variant={row.status === "sent" ? "default" : row.status === "failed" ? "destructive" : "outline"}>{row.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.sentAt ? new Date(row.sentAt).toLocaleString() : row.error ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  )
}

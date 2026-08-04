import { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Plus, Trash2, Copy, Check, Mail } from "lucide-react"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Loading } from "../components/ui/Loading"
import { EmptyState } from "../components/ui/EmptyState"
import { useAuth } from "../contexts/AuthContext"
import { getEventById } from "../services/eventService"
import { getLinksByEvent, createLink, deleteLink } from "../services/invitationService"
import type { InvitationLink } from "../types"

export function InvitationManagement() {
  const { eventId } = useParams<{ eventId: string }>()
  const { profile, role } = useAuth()
  const navigate = useNavigate()
  const [eventTitle, setEventTitle] = useState("")
  const [links, setLinks] = useState<InvitationLink[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState("")
  const [adding, setAdding] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!eventId) return
    setLoading(true)
    const event = await getEventById(eventId)
    if (!event) { navigate("/dashboard/events"); return }
    if (event.organizerId !== profile?.id && role !== "admin") { navigate("/dashboard/events"); return }
    setEventTitle(event.title)
    const l = await getLinksByEvent(eventId)
    setLinks(l)
    setLoading(false)
  }, [eventId, navigate])

  useEffect(() => { fetch() }, [fetch])

  const handleAdd = async () => {
    if (!eventId || !email.trim()) return
    setAdding(true)
    try {
      const link = await createLink(eventId, email.trim())
      toast.success(`Invitation link created for ${link.email}`)
      setEmail("")
      fetch()
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create invitation")
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteLink(id)
      toast.success("Invitation link removed")
      fetch()
    } catch {
      toast.error("Failed to remove invitation")
    }
  }

  const handleCopy = async (link: InvitationLink) => {
    const url = `${window.location.origin}/events/${eventId}?code=${link.code}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(link.id)
      toast.success("Link copied!")
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error("Failed to copy")
    }
  }

  if (loading) return <Loading text="Loading invitations..." />

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/events")} className="gap-2">
        <ArrowLeft size={16} /> Back to Events
      </Button>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Invitations: {eventTitle}</h1>
        <Badge variant="secondary">{links.length} link{links.length !== 1 ? "s" : ""}</Badge>
      </div>

      <div className="flex gap-2">
        <Input
          type="email"
          placeholder="Enter email address..."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="max-w-sm"
        />
        <Button onClick={handleAdd} disabled={adding || !email.trim()} className="gap-2">
          <Plus size={16} /> {adding ? "Creating..." : "Create Link"}
        </Button>
      </div>

      {links.length === 0 ? (
        <EmptyState title="No invitation links yet" description="Enter an email above to generate a unique one-time invitation link." />
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {links.map((link) => (
                <TableRow key={link.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Mail size={14} className="text-muted-foreground" />
                      <span className="font-medium">{link.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={link.used ? "outline" : "default"}>
                      {link.used ? "Used" : "Active"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(link.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => handleCopy(link)}>
                        {copiedId === link.id ? <Check size={14} /> : <Copy size={14} />}
                        {copiedId === link.id ? "Copied" : "Copy"}
                      </Button>
                      {!link.used && (
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(link.id)}>
                          <Trash2 size={14} /> Remove
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

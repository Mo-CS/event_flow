import { useState, useEffect, useCallback } from "react"
import { Users, UserPlus, Search, Download, MailX, MailCheck, Trash2, ShieldCheck, KeyRound } from "lucide-react"
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
  getAudienceAccess,
  getContacts,
  addContact,
  updateContact,
  unsubscribeContact,
  resubscribeContact,
  deleteContact,
  getAccessGrants,
  grantAudienceAccess,
  revokeAudienceAccess,
  allAudienceTags,
} from "../services/audienceService"
import { exportRows, type ExportFormat } from "../services/exportService"
import { getUsers } from "../services/userService"
import type { AudienceAccess, AudienceAccessGrant, AudienceContact } from "../types"

export function Audience() {
  const { user, role } = useAuth()
  const [access, setAccess] = useState<AudienceAccess | null>(null)
  const [contacts, setContacts] = useState<AudienceContact[]>([])
  const [grants, setGrants] = useState<AudienceAccessGrant[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<AudienceContact | null>(null)
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv")

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const permission = await getAudienceAccess(user.id, role)
      setAccess(permission)
      if (!permission.canView) return
      const rows = await getContacts(search)
      setContacts(rows)
      if (permission.isAdmin) {
        const [grantRows, userRows] = await Promise.all([getAccessGrants(), getUsers({ pageSize: 300 })])
        setGrants(grantRows)
        setUsers(userRows.items)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load the audience")
    } finally {
      setLoading(false)
    }
  }, [role, search, user])

  useEffect(() => { load() }, [load])

  const handleExport = () => {
    exportRows(exportFormat, {
      title: "Audience contacts",
      filename: "eventflow-audience",
      columns: [
        { key: "name", label: "Name" },
        { key: "email", label: "Email" },
        { key: "phone", label: "Phone" },
        { key: "tags", label: "Tags" },
        { key: "source", label: "Source" },
        { key: "status", label: "Status" },
      ],
      rows: contacts.map((c) => ({ ...c, tags: c.tags.join(", ") })),
    })
  }

  if (loading) return <Loading text="Loading audience..." />

  if (!access?.canView) {
    return (
      <div className="max-w-lg mx-auto text-center py-20 space-y-3">
        <KeyRound size={44} className="mx-auto text-muted-foreground opacity-40" />
        <h1 className="text-xl font-semibold">Audience access required</h1>
        <p className="text-sm text-muted-foreground">
          An administrator can grant temporary view, edit or send access from the audience access panel.
        </p>
      </div>
    )
  }

  const tags = allAudienceTags(contacts)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Users size={24} /> Audience</h1>
          <p className="text-sm text-muted-foreground">
            Everyone who registers is added automatically. Unsubscribing stops sending but never deletes the contact.
            {!access.isAdmin && access.grant?.expiresAt && ` Access expires ${new Date(access.grant.expiresAt).toLocaleString()}.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
            className="px-3 py-2 rounded-lg border border-input bg-background text-sm">
            <option value="csv">CSV</option>
            <option value="xlsx">XLSX</option>
            <option value="pdf">PDF</option>
            <option value="json">JSON</option>
            <option value="print">Print</option>
          </select>
          <Button variant="outline" className="gap-2" onClick={handleExport}><Download size={15} /> Export</Button>
          {access.canEdit && (
            <Button className="gap-2" onClick={() => setShowAdd((v) => !v)}><UserPlus size={15} /> Add contact</Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Contacts" value={contacts.length} />
        <StatCard label="Subscribed" value={contacts.filter((c) => c.status === "subscribed").length} />
        <StatCard label="Unsubscribed / deleted" value={contacts.filter((c) => c.status !== "subscribed").length} />
      </div>

      {showAdd && access.canEdit && user && (
        <ContactForm
          onCancel={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load() }}
        />
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">Contacts</CardTitle>
            <div className="relative ml-auto w-full sm:w-72">
              <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email or phone" className="pl-8" />
            </div>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-2">
              {tags.map((tag) => (
                <button key={tag} type="button" onClick={() => setSearch(tag)}>
                  <Badge variant="outline">{tag}</Badge>
                </button>
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <EmptyState title="No contacts found" description="Add a contact manually or wait for the first registration." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="text-sm font-medium">{contact.name || "—"}</TableCell>
                    <TableCell className="text-sm">{contact.email}</TableCell>
                    <TableCell className="text-sm">{contact.phone || "—"}</TableCell>
                    <TableCell className="text-sm">
                      {contact.tags.length === 0 ? "—" : contact.tags.map((t) => <Badge key={t} variant="outline" className="mr-1">{t}</Badge>)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground capitalize">{contact.source}</TableCell>
                    <TableCell>
                      <Badge variant={contact.status === "subscribed" ? "default" : contact.status === "deleted_account" ? "destructive" : "outline"}>
                        {contact.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {access.canEdit && (
                        <div className="flex justify-end gap-1 flex-wrap">
                          <Button size="sm" variant="ghost" onClick={() => setEditing(contact)}>Edit</Button>
                          {contact.status === "subscribed" ? (
                            <Button size="sm" variant="ghost" className="gap-1 text-muted-foreground" onClick={async () => {
                              await unsubscribeContact(contact.id)
                              toast.success("Contact unsubscribed")
                              load()
                            }}>
                              <MailX size={14} /> Unsubscribe
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" className="gap-1" onClick={async () => {
                              await resubscribeContact(contact.id)
                              toast.success("Contact resubscribed")
                              load()
                            }}>
                              <MailCheck size={14} /> Resubscribe
                            </Button>
                          )}
                          {access.isAdmin && (
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => {
                              if (!window.confirm("Delete this contact permanently?")) return
                              await deleteContact(contact.id)
                              toast.success("Contact deleted")
                              load()
                            }}>
                              <Trash2 size={14} />
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {access.isAdmin && (
        <GrantPanel
          grants={grants}
          users={users}
          contacts={contacts}
          adminId={user?.id ?? ""}
          onChanged={load}
        />
      )}

      {editing && (
        <EditContactDialog
          contact={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  )
}

function ContactForm({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [tags, setTags] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await addContact({
        email,
        name,
        phone,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        notes,
        source: "manual",
      })
      toast.success("Contact saved")
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save the contact")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Add contact</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" />
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags, comma separated" />
          </div>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save contact"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function EditContactDialog({ contact, onClose, onSaved }: { contact: AudienceContact; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(contact.name)
  const [phone, setPhone] = useState(contact.phone)
  const [tags, setTags] = useState(contact.tags.join(", "))
  const [notes, setNotes] = useState(contact.notes)
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await updateContact(contact.id, {
        name,
        phone,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        notes,
      })
      toast.success("Contact updated")
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update the contact")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit contact</DialogTitle>
          <DialogDescription>{contact.email}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" />
          <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags, comma separated" />
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function GrantPanel({
  grants,
  users,
  contacts,
  adminId,
  onChanged,
}: {
  grants: AudienceAccessGrant[]
  users: any[]
  contacts: AudienceContact[]
  adminId: string
  onChanged: () => void
}) {
  const [userId, setUserId] = useState("")
  const [canView, setCanView] = useState(true)
  const [canEdit, setCanEdit] = useState(false)
  const [canSend, setCanSend] = useState(false)
  const [expiresAt, setExpiresAt] = useState("")
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await grantAudienceAccess({
        userId,
        canView,
        canEdit,
        canSend,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        grantedBy: adminId,
      })
      toast.success("Audience access granted")
      setUserId(""); setExpiresAt("")
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to grant access")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldCheck size={16} /> Temporary audience access</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={submit} className="grid lg:grid-cols-5 gap-3 items-end">
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
          <div className="flex items-center gap-3 text-sm">
            <label className="flex items-center gap-1"><input type="checkbox" checked={canView} onChange={(e) => setCanView(e.target.checked)} /> View</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={canEdit} onChange={(e) => setCanEdit(e.target.checked)} /> Edit</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={canSend} onChange={(e) => setCanSend(e.target.checked)} /> Send</label>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Expires (optional)</label>
            <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </div>
          <Button type="submit" disabled={saving}>{saving ? "Granting..." : "Grant access"}</Button>
        </form>

        {grants.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grants.map((grant) => {
                const u = users.find((row) => row.id === grant.userId)
                const expired = grant.expiresAt && new Date(grant.expiresAt).getTime() < Date.now()
                return (
                  <TableRow key={grant.id}>
                    <TableCell className="text-sm">{u?.email ?? grant.userId}</TableCell>
                    <TableCell className="text-sm">
                      {[grant.canView && "view", grant.canEdit && "edit", grant.canSend && "send"].filter(Boolean).join(", ")}
                    </TableCell>
                    <TableCell className="text-sm">
                      {grant.expiresAt ? (
                        <Badge variant={expired ? "outline" : "secondary"}>{new Date(grant.expiresAt).toLocaleString()}</Badge>
                      ) : "No expiry"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => {
                        await revokeAudienceAccess(grant.id)
                        toast.success("Access revoked")
                        onChanged()
                      }}>Revoke</Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
        <p className="text-xs text-muted-foreground">{contacts.length} contacts in the shared audience database.</p>
      </CardContent>
    </Card>
  )
}

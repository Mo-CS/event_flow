import { useState, useEffect, useCallback } from "react"
import { Plus, Pencil, Trash2, Search, Wifi, Monitor, Coffee, Car } from "lucide-react"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Badge } from "../components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog"
import { Loading } from "../components/ui/Loading"
import { EmptyState } from "../components/ui/EmptyState"
import { getVenues, createVenue, updateVenue, deleteVenue } from "../services/venueService"
import type { Venue } from "../types"

const FACILITY_OPTIONS = [
  { key: "wifi", label: "WiFi", icon: Wifi },
  { key: "projector", label: "Projector", icon: Monitor },
  { key: "catering", label: "Catering", icon: Coffee },
  { key: "parking", label: "Parking", icon: Car },
]

function VenueForm({ venue, onClose }: { venue?: Venue; onClose: () => void }) {
  const [name, setName] = useState(venue?.name ?? "")
  const [address, setAddress] = useState(venue?.address ?? "")
  const [capacity, setCapacity] = useState(venue?.capacity ?? 100)
  const [facilities, setFacilities] = useState<Record<string, boolean>>(venue?.facilities ?? {})
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const data = { name, address, capacity, facilities, imageUrls: venue?.imageUrls ?? [] }
      if (venue) {
        await updateVenue(venue.id, data)
        toast.success("Venue updated")
      } else {
        await createVenue(data)
        toast.success("Venue created")
      }
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Grand Convention Center" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Address</label>
        <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full address" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Capacity</label>
        <Input type="number" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} min={1} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Facilities</label>
        <div className="flex flex-wrap gap-2">
          {FACILITY_OPTIONS.map((opt) => {
            const Icon = opt.icon
            return (
              <button key={opt.key} type="button" onClick={() => setFacilities((f) => ({ ...f, [opt.key]: !f[opt.key] }))}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                  facilities[opt.key] ? "bg-primary/10 border-primary text-primary" : "border-input text-muted-foreground hover:border-muted-foreground"
                }`}
              >
                <Icon size={14} /> {opt.label}
              </button>
            )
          })}
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? "Saving..." : venue ? "Update" : "Create"}
        </Button>
      </DialogFooter>
    </div>
  )
}

export function VenueManagement() {
  const [items, setItems] = useState<Venue[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Venue | undefined>(undefined)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getVenues()
      setItems(data)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const filtered = items.filter(
    (v) => !search || v.name.toLowerCase().includes(search.toLowerCase()) || v.address.toLowerCase().includes(search.toLowerCase()),
  )

  const handleDelete = async (v: Venue) => {
    try {
      await deleteVenue(v.id)
      toast.success(`"${v.name}" deleted`)
      fetch()
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete venue")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Venues</h1>
        <Button onClick={() => { setEditing(undefined); setDialogOpen(true) }} className="gap-2"><Plus size={16} /> Add Venue</Button>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search venues..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? <Loading /> : filtered.length === 0 ? (
        <EmptyState title={search ? "No matches" : "No venues yet"} description={search ? "Try a different search" : "Add your first venue."} />
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Facilities</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{v.address}</TableCell>
                  <TableCell><Badge variant="secondary">{v.capacity} seats</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {FACILITY_OPTIONS.filter((f) => v.facilities[f.key]).map((f) => (
                        <Badge key={f.key} variant="outline" className="gap-1 text-xs">
                          <f.icon size={10} /> {f.label}
                        </Badge>
                      ))}
                      {Object.values(v.facilities).filter(Boolean).length === 0 && <span className="text-xs text-muted-foreground">None</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(v); setDialogOpen(true) }}><Pencil size={14} /></Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(v)}><Trash2 size={14} /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Venue" : "Create Venue"}</DialogTitle>
          </DialogHeader>
          <VenueForm key={editing?.id ?? "new"} venue={editing} onClose={() => { setDialogOpen(false); fetch() }} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

import { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Plus, Trash2, Pencil, Download, TrendingUp, TrendingDown, Wallet } from "lucide-react"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Loading } from "../components/ui/Loading"
import { EmptyState } from "../components/ui/EmptyState"
import { useAuth } from "../contexts/AuthContext"
import { getEventById } from "../services/eventService"
import { getAllCostsByEvent, createCost, updateCost, deleteCost, sumCosts, costLineTotal } from "../services/costService"
import { getProfilesByUserIds } from "../services/userService"
import { exportToCsv } from "../services/reportsService"
import { COST_NEED_TYPES } from "../constants"
import type { EventCost, CostType } from "../types"

interface CostEditor {
  id?: string
  item: string
  needType: string
  quantity: string
  unitPrice: string
  notes: string
}

const emptyEditor: CostEditor = { item: "", needType: "catering", quantity: "1", unitPrice: "", notes: "" }

export function EventCosts() {
  const { eventId } = useParams<{ eventId: string }>()
  const { user, profile, role } = useAuth()
  const navigate = useNavigate()

  const [eventTitle, setEventTitle] = useState("")
  const [costType, setCostType] = useState<CostType>("planned")
  const [planned, setPlanned] = useState<EventCost[]>([])
  const [actual, setActual] = useState<EventCost[]>([])
  const [nameMap, setNameMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editor, setEditor] = useState<CostEditor | null>(null)

  const fetch = useCallback(async () => {
    if (!eventId) return
    setLoading(true)
    try {
      const event = await getEventById(eventId)
      if (!event) { navigate("/dashboard/events"); return }
      if (event.organizerId !== profile?.id && role !== "admin") { navigate("/dashboard/events"); return }
      setEventTitle(event.title)
      const { planned: p, actual: a } = await getAllCostsByEvent(eventId)
      setPlanned(p)
      setActual(a)
      const ids = new Set<string>()
      for (const c of [...p, ...a]) {
        if (c.createdBy) ids.add(c.createdBy)
        if (c.updatedBy) ids.add(c.updatedBy)
      }
      if (ids.size > 0) {
        const profs = await getProfilesByUserIds([...ids])
        const map: Record<string, string> = {}
        for (const pr of profs) map[pr.userId] = `${pr.firstName} ${pr.lastName}`.trim() || pr.email
        setNameMap(map)
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [eventId, navigate, profile?.id, role])

  useEffect(() => { fetch() }, [fetch])

  const rows = costType === "planned" ? planned : actual
  const total = sumCosts(rows)
  const plannedTotal = sumCosts(planned)
  const actualTotal = sumCosts(actual)
  const difference = plannedTotal - actualTotal

  const handleSave = async () => {
    if (!eventId || !user || !profile || !editor) return
    const qty = Number(editor.quantity)
    const price = Number(editor.unitPrice)
    if (!editor.item.trim() || !(qty > 0) || !(price >= 0)) {
      toast.error("Please fill item, quantity and unit price")
      return
    }
    setSaving(true)
    try {
      if (editor.id) {
        await updateCost(editor.id, {
          item: editor.item.trim(),
          needType: editor.needType,
          quantity: qty,
          unitPrice: price,
          notes: editor.notes.trim(),
        }, user.id)
        toast.success("Cost updated")
      } else {
        await createCost(eventId, costType, {
          item: editor.item.trim(),
          needType: editor.needType,
          quantity: qty,
          unitPrice: price,
          notes: editor.notes.trim(),
        }, user.id)
        toast.success("Cost added")
      }
      setEditor(null)
      fetch()
    } catch {
      toast.error("Failed to save cost")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteCost(id)
      toast.success("Cost removed")
      fetch()
    } catch {
      toast.error("Failed to remove cost")
    }
  }

  const handleExport = () => {
    const data = [...planned, ...actual].map((c) => ({
      Type: c.costType,
      Item: c.item,
      "Need Type": c.needType,
      Quantity: c.quantity,
      "Unit Price": c.unitPrice,
      Cost: costLineTotal(c),
      Notes: c.notes ?? "",
    }))
    exportToCsv(data, `${eventTitle}-costs.csv`)
  }

  if (loading) return <Loading text="Loading costs..." />

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/events")} className="gap-2">
        <ArrowLeft size={16} /> Back to Events
      </Button>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Costs: {eventTitle}</h1>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
          <Download size={15} /> Export CSV
        </Button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <SummaryCard
          icon={Wallet}
          label="Planned Total"
          value={plannedTotal.toLocaleString()}
          color="bg-blue-500/10 text-blue-600 dark:text-blue-400"
        />
        <SummaryCard
          icon={Wallet}
          label="Actual Total"
          value={actualTotal.toLocaleString()}
          color="bg-amber-500/10 text-amber-600 dark:text-amber-400"
        />
        <SummaryCard
          icon={difference >= 0 ? TrendingDown : TrendingUp}
          label="Difference (Planned - Actual)"
          value={`${difference >= 0 ? "+" : ""}${difference.toLocaleString()}`}
          color={difference >= 0 ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-red-500/10 text-red-600 dark:text-red-400"}
        />
      </div>

      <div className="flex gap-2">
        {(["planned", "actual"] as CostType[]).map((t) => (
          <Button
            key={t}
            variant={costType === t ? "default" : "outline"}
            size="sm"
            onClick={() => setCostType(t)}
            className="capitalize"
          >
            {t}
          </Button>
        ))}
      </div>

      <div className="rounded-lg border border-border">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
          <p className="font-semibold capitalize">{costType} costs</p>
          <Button size="sm" className="gap-1.5" onClick={() => setEditor({ ...emptyEditor })}>
            <Plus size={15} /> Add {costType} cost
          </Button>
        </div>

        {rows.length === 0 ? (
          <EmptyState title="No costs yet" description={`Add your ${costType} expenses to track the event budget.`} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Need Type</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Unit Price</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Modified By</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.item}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{c.needType}</Badge></TableCell>
                  <TableCell>{c.quantity}</TableCell>
                  <TableCell>{c.unitPrice}</TableCell>
                  <TableCell className="font-semibold">{costLineTotal(c).toLocaleString()}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {nameMap[c.updatedBy ?? c.createdBy] ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditor({
                        id: c.id,
                        item: c.item,
                        needType: c.needType,
                        quantity: String(c.quantity),
                        unitPrice: String(c.unitPrice),
                        notes: c.notes ?? "",
                      })}>
                        <Pencil size={14} />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(c.id)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/30">
                <TableCell className="font-bold" colSpan={4}>Total</TableCell>
                <TableCell className="font-bold">{total.toLocaleString()}</TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableBody>
          </Table>
        )}
      </div>

      {editor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditor(null)}>
          <div className="w-full max-w-lg rounded-xl bg-card p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">{editor.id ? "Edit cost" : `Add ${costType} cost`}</h2>
            <div>
              <label className="block text-sm font-medium mb-1">Item</label>
              <Input value={editor.item} onChange={(e) => setEditor({ ...editor, item: e.target.value })} placeholder="e.g. Catering service" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Need Type</label>
              <select value={editor.needType} onChange={(e) => setEditor({ ...editor, needType: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                {COST_NEED_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Quantity</label>
                <Input type="number" min={0} value={editor.quantity} onChange={(e) => setEditor({ ...editor, quantity: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Unit Price</label>
                <Input type="number" min={0} value={editor.unitPrice} onChange={(e) => setEditor({ ...editor, unitPrice: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea value={editor.notes} onChange={(e) => setEditor({ ...editor, notes: e.target.value })}
                rows={2} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditor(null)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
      <div className={`p-2.5 rounded-lg ${color}`}><Icon size={20} /></div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  )
}

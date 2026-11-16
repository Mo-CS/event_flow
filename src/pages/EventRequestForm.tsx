import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Send } from "lucide-react"
import { toast } from "sonner"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { useAuth } from "../contexts/AuthContext"
import { createEventRequest } from "../services/eventRequestService"
import { getCategories } from "../services/categoryService"
import { getVenues } from "../services/venueService"
import type { Category, EventType, Venue } from "../types"

export function EventRequestForm() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [venues, setVenues] = useState<Venue[]>([])
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [eventType, setEventType] = useState<EventType>("in_person")
  const [method, setMethod] = useState("")
  const [targetAudience, setTargetAudience] = useState("")
  const [expectedAttendees, setExpectedAttendees] = useState(50)
  const [trainerName, setTrainerName] = useState("")
  const [trainerBio, setTrainerBio] = useState("")
  const [trainerContact, setTrainerContact] = useState("")
  const [preferredStart, setPreferredStart] = useState("")
  const [preferredEnd, setPreferredEnd] = useState("")
  const [venueId, setVenueId] = useState("")
  const [estimatedBudget, setEstimatedBudget] = useState("")
  const [currencyCode, setCurrencyCode] = useState("USD")

  useEffect(() => {
    Promise.all([getCategories(), getVenues()]).then(([c, v]) => {
      setCategories(c)
      setVenues(v)
    }).catch(() => undefined)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    try {
      await createEventRequest(
        {
          title,
          description,
          categoryId: categoryId || undefined,
          eventType,
          method,
          targetAudience,
          expectedAttendees,
          trainerName,
          trainerBio,
          trainerContact,
          preferredStart: preferredStart ? new Date(preferredStart).toISOString() : undefined,
          preferredEnd: preferredEnd ? new Date(preferredEnd).toISOString() : undefined,
          venueId: venueId || undefined,
          estimatedBudget: estimatedBudget ? Number(estimatedBudget) : undefined,
          currencyCode,
        },
        user.id,
      )
      toast.success("Event request submitted — an administrator will review it")
      navigate("/dashboard/event-requests")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit the request")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/event-requests")} className="gap-2">
        <ArrowLeft size={16} /> Back to requests
      </Button>
      <div>
        <h1 className="text-2xl font-bold">Request an event</h1>
        <p className="text-sm text-muted-foreground">
          Any registered user can suggest an event. An administrator reviews the request and creates the draft event with its core data.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold">Event idea</h2>
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Event title" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={4}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
              placeholder="What is the event about?" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                <option value="">Let the administrator choose</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Event type</label>
              <select value={eventType} onChange={(e) => setEventType(e.target.value as EventType)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                <option value="in_person">In person</option>
                <option value="online">Online</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Method / format</label>
              <Input value={method} onChange={(e) => setMethod(e.target.value)} placeholder="Workshop, lecture, training..." />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Target audience</label>
              <Input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} placeholder="Students, staff, public..." />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Expected attendees</label>
              <Input type="number" min={1} value={expectedAttendees} onChange={(e) => setExpectedAttendees(Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Preferred venue</label>
              <select value={venueId} onChange={(e) => setVenueId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                <option value="">Not decided</option>
                {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Preferred start</label>
              <Input type="datetime-local" value={preferredStart} onChange={(e) => setPreferredStart(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Preferred end</label>
              <Input type="datetime-local" value={preferredEnd} onChange={(e) => setPreferredEnd(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold">Trainer / presenter</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <Input value={trainerName} onChange={(e) => setTrainerName(e.target.value)} placeholder="Full name" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Contact</label>
              <Input value={trainerContact} onChange={(e) => setTrainerContact(e.target.value)} placeholder="Email or phone" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Short bio</label>
            <textarea value={trainerBio} onChange={(e) => setTrainerBio(e.target.value)} rows={3}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
              placeholder="Background and experience" />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold">Estimated budget</h2>
          <p className="text-sm text-muted-foreground">You can propose a budget; the administrator can adjust it during review.</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Amount</label>
              <Input type="number" min={0} step="0.01" value={estimatedBudget} onChange={(e) => setEstimatedBudget(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Currency</label>
              <select value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                <option value="USD">USD</option>
                <option value="YER">YER</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate("/dashboard/event-requests")}>Cancel</Button>
          <Button type="submit" disabled={saving} className="gap-2">
            <Send size={16} /> {saving ? "Submitting..." : "Submit request"}
          </Button>
        </div>
      </form>
    </div>
  )
}

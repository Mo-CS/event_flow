import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Wand2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Loading } from "../components/ui/Loading"
import { useAuth } from "../contexts/AuthContext"
import { getEventById, createEvent, updateEvent, setMeetingLink } from "../services/eventService"
import { getVenues } from "../services/venueService"
import { getCategories } from "../services/categoryService"
import type { Venue, Category, EventType, EventStatus } from "../types"

export function EventForm() {
  const { id } = useParams<{ id: string }>()
  const { profile, role } = useAuth()
  const navigate = useNavigate()
  const isEdit = !!id

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [venues, setVenues] = useState<Venue[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [venueId, setVenueId] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [capacity, setCapacity] = useState(100)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [registrationDeadline, setRegistrationDeadline] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [visibility, setVisibility] = useState<"public" | "private">("public")
  const [eventType, setEventType] = useState<EventType>("in_person")
  const [meetingLink, setMeetingLinkState] = useState("")
  const [linkSource, setLinkSource] = useState<"auto" | "manual">("auto")
  const [currentStatus, setCurrentStatus] = useState<EventStatus>("draft")
  const [currentCoverImageUrl, setCurrentCoverImageUrl] = useState("")

  useEffect(() => {
    Promise.all([getVenues(), getCategories()]).then(([v, c]) => {
      setVenues(v)
      setCategories(c)
    })
    if (isEdit && id) {
      getEventById(id).then((event) => {
        if (!event) { navigate("/dashboard/events"); return }
        if (event.organizerId !== profile?.id && role !== "admin") { navigate("/dashboard/events"); return }
        setTitle(event.title)
        setDescription(event.description)
        setVenueId(event.venueId ?? "")
        setCategoryId(event.categoryId)
        setCapacity(event.capacity)
        setStartDate(event.startDate.slice(0, 16))
        setEndDate(event.endDate.slice(0, 16))
        setRegistrationDeadline(event.registrationDeadline.slice(0, 16))
        setContactEmail(event.contactEmail)
        setVisibility(event.visibility)
        setEventType(event.eventType)
        setMeetingLinkState(event.meetingLink ?? "")
        setCurrentStatus(event.status)
        setCurrentCoverImageUrl(event.coverImageUrl ?? "")
        setLoading(false)
      })
    }
  }, [id, isEdit, navigate, profile?.id, role])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    if (eventType === "in_person" && !venueId) {
      toast.error("A venue is required for in-person events")
      return
    }
    if (eventType === "online" && meetingLink.trim() && !meetingLink.trim().startsWith("http")) {
      toast.error("Meeting link must start with http(s)://")
      return
    }
    const startTime = new Date(startDate).getTime()
    const endTime = new Date(endDate).getTime()
    const deadlineTime = new Date(registrationDeadline).getTime()
    if (isNaN(startTime) || isNaN(endTime) || isNaN(deadlineTime)) {
      toast.error("Please fill in all event dates correctly")
      return
    }
    if (endTime <= startTime) {
      toast.error("End date must be after the start date")
      return
    }
    if (deadlineTime > startTime) {
      toast.error("Registration deadline must be before or on the event start date")
      return
    }
    setSaving(true)
    try {
      const data = {
        title,
        description,
        coverImageUrl: currentCoverImageUrl,
        organizerId: profile.id,
        venueId,
        capacity,
        registrationDeadline: new Date(registrationDeadline).toISOString(),
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        status: (isEdit ? currentStatus : "draft") as EventStatus,
        visibility,
        contactEmail,
        categoryId,
        eventType,
      }
      if (isEdit && id) {
        await updateEvent(id, data)
        if (eventType === "online" && meetingLink.trim()) {
          await setMeetingLink(id, meetingLink.trim(), profile.id)
        }
        toast.success("Event updated")
      } else {
        const created = await createEvent(data)
        if (eventType === "online" && meetingLink.trim()) {
          await setMeetingLink(created.id, meetingLink.trim(), profile.id)
        }
        toast.success("Event created as draft")
      }
      navigate("/dashboard/events")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  const generateAutoLink = () => {
    const slug = title.trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "event"
    setMeetingLinkState(`https://meet.jit.si/EventFlow-${slug}-${Date.now().toString(36).slice(-6)}`)
  }

  if (loading) return <Loading text="Loading event..." />

  return (
    <div className="max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/events")} className="gap-2">
        <ArrowLeft size={16} /> Back to Events
      </Button>

      <h1 className="text-2xl font-bold">{isEdit ? "Edit Event" : "Create Event"}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold">Basic Information</h2>
          <div>
            <label className="block text-sm font-medium mb-1">Event Type</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEventType("in_person")}
                className={`flex-1 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${eventType === "in_person" ? "border-primary bg-primary/10 text-primary" : "border-input bg-background text-muted-foreground"}`}>
                In Person
              </button>
              <button type="button" onClick={() => setEventType("online")}
                className={`flex-1 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${eventType === "online" ? "border-primary bg-primary/10 text-primary" : "border-input bg-background text-muted-foreground"}`}>
                Online (Virtual)
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Event title" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} required
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Describe your event..."
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Venue {eventType === "in_person" && <span className="text-destructive">*</span>}</label>
              <select value={venueId} onChange={(e) => setVenueId(e.target.value)} required={eventType === "in_person"}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                <option value="">{eventType === "online" ? "Not required" : "Select a venue"}</option>
                {venues.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.capacity} seats)</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                <option value="">Select a category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {eventType === "online" && (
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h2 className="font-semibold">Meeting Link</h2>
            <p className="text-sm text-muted-foreground">
              The link becomes visible to registered attendees one hour before the event starts (or immediately after generation).
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setLinkSource("auto")}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${linkSource === "auto" ? "border-primary bg-primary/10 text-primary" : "border-input bg-background text-muted-foreground"}`}>
                Auto-generate
              </button>
              <button type="button" onClick={() => setLinkSource("manual")}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${linkSource === "manual" ? "border-primary bg-primary/10 text-primary" : "border-input bg-background text-muted-foreground"}`}>
                Enter manually
              </button>
            </div>
            <div className="flex gap-2">
              <Input value={meetingLink} onChange={(e) => setMeetingLinkState(e.target.value)}
                placeholder={linkSource === "auto" ? "Click generate to create a room link" : "https://meet.example.com/room"}
                readOnly={linkSource === "auto" && !meetingLink} />
              {linkSource === "auto" && (
                <Button type="button" variant="outline" className="gap-2" onClick={generateAutoLink}>
                  <Wand2 size={15} /> Generate
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold">Date & Capacity</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Start date & time</label>
              <Input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End date & time</label>
              <Input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Registration deadline</label>
              <Input type="datetime-local" value={registrationDeadline} onChange={(e) => setRegistrationDeadline(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Capacity</label>
              <Input type="number" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} min={1} required />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold">Settings</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Contact email</label>
              <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} required placeholder="contact@example.com" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Visibility</label>
              <select value={visibility} onChange={(e) => setVisibility(e.target.value as "public" | "private")}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => navigate("/dashboard/events")}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : isEdit ? "Update Event" : "Create Event (Draft)"}</Button>
        </div>
      </form>
    </div>
  )
}

import { useState, useEffect, useCallback } from "react"
import { Star, MessageSquare, CheckCheck } from "lucide-react"
import { toast } from "sonner"
import { Button } from "../components/ui/button"
import { Textarea } from "../components/ui/textarea"
import { Card, CardContent, CardHeader } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Loading } from "../components/ui/Loading"
import { EmptyState } from "../components/ui/EmptyState"
import { useAuth } from "../contexts/AuthContext"
import { getFeedbackForOrganizer, respondToFeedback } from "../services/feedbackService"
import { getProfilesByIds } from "../services/userService"
import type { Feedback } from "../types"

export function FeedbackManagement() {
  const { profile } = useAuth()
  const [feedbackList, setFeedbackList] = useState<(Feedback & { eventTitle: string })[]>([])
  const [profileMap, setProfileMap] = useState<Map<string, any>>(new Map())
  const [loading, setLoading] = useState(true)
  const [responding, setResponding] = useState<string | null>(null)
  const [responseText, setResponseText] = useState("")

  const fetch = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    const data = await getFeedbackForOrganizer(profile.id)
    setFeedbackList(data)
    const attendeeIds = [...new Set(data.map((f) => f.attendeeId))]
    if (attendeeIds.length > 0) {
      const profs = await getProfilesByIds(attendeeIds)
      setProfileMap(new Map(profs.map((p: any) => [p.id, p])))
    }
    setLoading(false)
  }, [profile])

  useEffect(() => { fetch() }, [fetch])

  const handleRespond = async (fbId: string) => {
    if (!responseText.trim()) return
    await respondToFeedback(fbId, responseText.trim())
    toast.success("Response posted")
    setResponding(null)
    setResponseText("")
    fetch()
  }

  if (loading) return <Loading text="Loading feedback..." />

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Event Feedback</h1>

      {feedbackList.length === 0 ? (
        <EmptyState title="No feedback yet" description="Reviews from attendees will appear here." />
      ) : (
        <div className="space-y-4">
          {feedbackList.map((fb) => {
            const attendee = profileMap.get(fb.attendeeId)
            return (
              <Card key={fb.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{fb.eventTitle}</Badge>
                      <span className="text-sm font-medium">{attendee?.firstName} {attendee?.lastName}</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={14} className={i < fb.rating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"} />
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm">{fb.comment}</p>
                  <p className="text-xs text-muted-foreground">{new Date(fb.submittedAt).toLocaleDateString()}</p>

                  {fb.response ? (
                    <div className="pl-4 border-l-2 border-primary/30">
                      <p className="text-xs font-medium text-primary flex items-center gap-1"><CheckCheck size={12} /> Your response</p>
                      <p className="text-sm text-muted-foreground mt-1">{fb.response}</p>
                      <p className="text-xs text-muted-foreground mt-1">{fb.respondedAt ? new Date(fb.respondedAt).toLocaleDateString() : ""}</p>
                    </div>
                  ) : (
                    <div>
                      {responding === fb.id ? (
                        <div className="space-y-2">
                          <Textarea placeholder="Write your response..." value={responseText} onChange={(e) => setResponseText(e.target.value)} rows={2} />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleRespond(fb.id)} disabled={!responseText.trim()}>Post Response</Button>
                            <Button size="sm" variant="ghost" onClick={() => { setResponding(null); setResponseText("") }}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" className="gap-1" onClick={() => setResponding(fb.id)}>
                          <MessageSquare size={14} /> Respond
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

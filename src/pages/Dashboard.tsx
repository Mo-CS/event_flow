import { formatDate } from "../i18n/format"
import { statusLabel, t } from "../i18n"
import { useState, useEffect, useCallback } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Calendar, Ticket as TicketIcon, Bell, Clock, ExternalLink, Plus, XCircle, TrendingUp, Users, Building2, Layers, FileUp, BarChart3, Settings, Shield, Activity, MessageSquare, Star } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { Loading } from "../components/ui/Loading"
import { EmptyState } from "../components/ui/EmptyState"
import { useAuth } from "../contexts/AuthContext"
import { getOrganizerStats, getAttendeeStats, getNotifications, getAdminStats, getRecentActivity, getRegistrationTrends } from "../services/dashboardService"
import { getEventsByOrganizer, getRegistrationsByAttendee, cancelRegistration } from "../services/eventService"
import { getTicketByRegistration } from "../services/ticketService"
import type { Event, Registration, Ticket } from "../types"

const statGradients = [
  { bg: "from-teal-500/15 to-amber-500/10", icon: "from-teal-500 to-amber-500" },
  { bg: "from-amber-500/15 to-orange-500/10", icon: "from-amber-500 to-orange-500" },
  { bg: "from-yellow-500/15 to-amber-500/10", icon: "from-yellow-500 to-amber-500" },
  { bg: "from-emerald-500/15 to-teal-500/10", icon: "from-emerald-500 to-teal-500" },
  { bg: "from-red-500/15 to-amber-500/10", icon: "from-red-500 to-amber-500" },
  { bg: "from-emerald-500/15 to-teal-500/10", icon: "from-emerald-500 to-teal-500" },
]

function StatCard({ icon: Icon, label, value, idx = 0, to }: { icon: any; label: string; value: number | string; idx?: number; to?: string }) {
  const g = statGradients[idx % statGradients.length]
  const content = (
    <Card className={`overflow-hidden transition-all ${to ? "hover:shadow-xl hover:-translate-y-0.5 cursor-pointer" : "hover:shadow-lg"}`}>
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className={`p-2.5 rounded-xl bg-gradient-to-br ${g.bg}`}>
            <Icon size={22} className="text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
  return to ? <Link to={to} className="block">{content}</Link> : content
}

function OrganizerDashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<any>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    Promise.all([
      getOrganizerStats(profile.id),
      getEventsByOrganizer(profile.id),
    ]).then(([s, e]) => {
      setStats(s)
      setEvents(e)
      setLoading(false)
    })
  }, [profile])

  if (loading) return <Loading text={t("Loading dashboard...")} />
  if (!stats) return null

  return (
    <div className="relative space-y-6 animate-fade-in-up">
      <div className="absolute -top-10 -right-10 w-72 h-72 bg-teal-500/12 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/3 w-56 h-56 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <h1 className="text-2xl font-bold">{t("Organizer Dashboard")}</h1>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Calendar} label={t("Total Events")} value={stats.totalEvents} idx={0} />
        <StatCard icon={TrendingUp} label={t("Published")} value={stats.publishedEvents} idx={1} />
        <StatCard icon={Clock} label={t("Drafts")} value={stats.draftEvents} idx={2} />
        <StatCard icon={Users} label={t("Registrations")} value={stats.confirmedRegistrations} idx={3} />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{t("Your Events")}</CardTitle>
          <Button size="sm" onClick={() => navigate("/dashboard/events/new")}><Plus size={14} /> {t("New Event")}</Button>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <EmptyState title={t("No events yet")} description={t("Create your first event to get started.")} />
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div key={event.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors group">
                  <Link to={`/events/${event.id}`} className="flex-1 min-w-0">
                    <p className="font-medium group-hover:text-primary transition-colors">{event.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{formatDate(new Date(event.startDate))}</span>
                      <span>{event.capacity} {t("spots")}</span>
                    </div>
                  </Link>
                  <div className="flex items-center gap-2">
                    <Link to={`/dashboard/events/${event.id}/chat`}>
                      <Button size="sm" variant="ghost" className="gap-1.5"><MessageSquare size={14} /> {t("Chat")}</Button>
                    </Link>
                    <Badge variant={event.status === "published" ? "default" : event.status === "draft" ? "secondary" : "outline"}>
                      {statusLabel(event.status)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function AttendeeDashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState<any>(null)
  const [myRegs, setMyRegs] = useState<Registration[]>([])
  const [myTickets, setMyTickets] = useState<Ticket[]>([])
  const [notifs, setNotifs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!profile) return
    const [s, n, r] = await Promise.all([
      getAttendeeStats(profile.id),
      getNotifications(profile.userId),
      getRegistrationsByAttendee(profile.id),
    ])
    setStats(s)
    setNotifs(n)
    setMyRegs(r)
    const allTickets = await Promise.all(r.map((reg) => getTicketByRegistration(reg.id)))
    setMyTickets(allTickets.filter((t): t is Ticket => t !== undefined))
    setLoading(false)
  }, [profile])

  useEffect(() => { fetchData() }, [fetchData])

  const handleCancel = async (reg: Registration) => {
    await cancelRegistration(reg.id)
    toast.success(t("Registration cancelled"))
    fetchData()
  }

  if (loading) return <Loading text={t("Loading dashboard...")} />
  if (!stats) return null

  return (
    <div className="relative space-y-6 animate-fade-in-up">
      <div className="absolute -top-10 -right-10 w-72 h-72 bg-teal-500/12 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 right-1/3 w-56 h-56 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <h1 className="text-2xl font-bold">{t("My Dashboard")}</h1>

      <div className="grid sm:grid-cols-3 gap-4">
        <StatCard icon={Calendar} label={t("Registered Events")} value={stats.totalRegistered} idx={0} />
        <StatCard icon={TicketIcon} label={t("Total Tickets")} value={myTickets.length} idx={1} />
        <StatCard icon={Bell} label={t("Notifications")} value={notifs.length} idx={2} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("My Registrations")}</CardTitle>
        </CardHeader>
        <CardContent>
          {myRegs.length === 0 ? (
            <EmptyState title={t("No registrations yet")} description={t("Browse events and register for one!")} action={
              <Link to="/events"><Button size="sm">{t("Browse Events")}</Button></Link>
            } />
          ) : (
            <div className="space-y-3">
              {myRegs.map((reg) => {
                const event = stats.tickets?.find((t: any) => t.event?.id === reg.eventId)?.event
                return (
                  <div key={reg.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div>
                      <Link to={`/events/${reg.eventId}`} className="font-medium hover:text-primary transition-colors">
                        {event?.title ?? `Event #${reg.eventId}`}
                      </Link>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={reg.status === "confirmed" ? "default" : reg.status === "waitlisted" ? "outline" : "secondary"}>
                          {statusLabel(reg.status)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{event?.startDate ? `${formatDate(new Date(event.startDate))} - ${formatDate(new Date(event.endDate!))}` : formatDate(new Date(reg.registeredAt))}</span>
                      </div>
                    </div>
                    {reg.status !== "cancelled" && (
                      <div className="flex items-center gap-2">
                        <Link to={`/dashboard/events/${reg.eventId}/chat`}>
                          <Button size="sm" variant="outline" className="gap-1.5">
                            <MessageSquare size={14} /> {t("Chat")}
                          </Button>
                        </Link>
                        {event?.endDate && new Date(event.endDate) < new Date() && (
                          <Link to={`/events/${reg.eventId}/evaluate`}>
                            <Button size="sm" variant="outline" className="gap-1.5">
                              <Star size={14} /> {t("Evaluate")}
                            </Button>
                          </Link>
                        )}
                        {new Date(event?.endDate ?? Date.now()) > new Date() && (
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleCancel(reg)}>
                            <XCircle size={14} /> {t("Cancel")}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {myTickets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("My Tickets")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {myTickets.map((ticket) => {
                const badgeVariant = ticket.status === "valid" ? "default" : ticket.status === "used" ? "success" : "destructive"
                return (
                  <Link key={ticket.id} to={`/dashboard/tickets/${ticket.id}`} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors group">
                    <div>
                      <p className="font-mono text-sm font-medium">{ticket.uniqueCode}</p>
                      <p className="text-xs text-muted-foreground">{t("Issued")} {formatDate(new Date(ticket.issuedAt))}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={badgeVariant}>{statusLabel(ticket.status)}</Badge>
                      <ExternalLink size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </Link>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {(stats.upcomingEvents.length > 0 || stats.pastEvents.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>{t("My Events")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.upcomingEvents.length > 0 && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("Upcoming")}</p>
                  {stats.upcomingEvents.map((event: Event) => (
                    <Link key={event.id} to={`/events/${event.id}`} className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors group">
                      <div className="p-2 rounded-xl bg-gradient-to-br from-teal-500/15 to-amber-500/15">
                        <Calendar size={20} className="text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium group-hover:text-primary transition-colors">{event.title}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(new Date(event.startDate))} - {formatDate(new Date(event.endDate))} · {event.capacity} {t("spots")}</p>
                      </div>
                      <ExternalLink size={14} className="text-muted-foreground" />
                    </Link>
                  ))}
                </>
              )}
              {stats.pastEvents.length > 0 && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-4">{t("Past")}</p>
                  {stats.pastEvents.map((event: Event) => (
                    <Link key={event.id} to={`/events/${event.id}`} className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors group opacity-70 hover:opacity-100 transition-opacity">
                      <div className="p-2 rounded-xl bg-gradient-to-br from-muted to-muted">
                        <Calendar size={20} className="text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium group-hover:text-primary transition-colors">{event.title}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(new Date(event.startDate))} - {formatDate(new Date(event.endDate))}</p>
                      </div>
                      <ExternalLink size={14} className="text-muted-foreground" />
                    </Link>
                  ))}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("Notifications")}</CardTitle>
        </CardHeader>
        <CardContent>
          {notifs.length === 0 ? (
            <EmptyState title={t("No notifications")} description={t("You're all caught up!")} />
          ) : (
            <div className="space-y-2">
              {notifs.map((n) => (
                <div key={n.id} className={`p-3 rounded-lg border border-border ${!n.readAt ? "bg-teal-500/5 border-teal-500/20" : ""}`}>
                  <p className="text-sm font-medium">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatDate(new Date(n.createdAt))}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

const adminLinks = [
  { to: "/dashboard/admin/users", label: t("Users"), icon: Users, description: t("Manage user accounts") },
  { to: "/dashboard/admin/venues", label: t("Venues"), icon: Building2, description: t("Manage venues") },
  { to: "/dashboard/admin/categories", label: t("Categories"), icon: Layers, description: t("Manage categories") },
  { to: "/dashboard/admin/files", label: t("Files"), icon: FileUp, description: t("Manage uploaded files") },
  { to: "/dashboard/admin/reports", label: t("Reports"), icon: BarChart3, description: t("View reports") },
  { to: "/dashboard/admin/settings", label: t("Settings"), icon: Settings, description: t("System settings") },
  { to: "/dashboard/admin/security", label: t("Security"), icon: Shield, description: t("Security center") },
]

const activityColors = [
  "from-teal-500/30 to-amber-500/30",
  "from-amber-500/30 to-orange-500/30",
  "from-emerald-500/30 to-teal-500/30",
  "from-yellow-500/30 to-amber-500/30",
  "from-red-500/30 to-amber-500/30",
]

function AdminOverview() {
  const [stats, setStats] = useState<any>(null)
  const [activity, setActivity] = useState<any[]>([])
  const [trends, setTrends] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getAdminStats(), getRecentActivity(), getRegistrationTrends()]).then(([s, a, t]) => {
      setStats(s)
      setActivity(a)
      setTrends(t)
      setLoading(false)
    })
  }, [])

  if (loading) return <Loading text={t("Loading dashboard...")} />
  if (!stats) return null

  return (
    <div className="relative space-y-6 animate-fade-in-up">
      <div className="absolute -top-10 left-1/3 w-80 h-80 bg-teal-500/12 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-20 -right-10 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 left-1/4 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <h1 className="text-2xl font-bold">{t("Admin Dashboard")}</h1>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label={t("Total Users")} value={stats.totalUsers} idx={0} to="/dashboard/admin/users" />
        <StatCard icon={Calendar} label={t("Published Events")} value={stats.publishedEvents} idx={1} to="/dashboard/admin/reports" />
        <StatCard icon={TicketIcon} label={t("Registrations")} value={stats.confirmedRegistrations} idx={2} to="/dashboard/admin/reports" />
        <StatCard icon={Building2} label={t("Venues")} value={stats.totalVenues} idx={3} to="/dashboard/admin/venues" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("Quick Access")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {adminLinks.map((link) => (
              <Link key={link.to} to={link.to} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors group">
                <div className="p-2 rounded-lg bg-gradient-to-br from-teal-500/15 to-amber-500/10 group-hover:from-teal-500/25 group-hover:to-amber-500/20 transition-colors">
                  <link.icon size={18} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{link.label}</p>
                  <p className="text-xs text-muted-foreground">{link.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("Recent Activity")}</CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t("No recent activity")}</p>
          ) : (
            <div className="space-y-4">
              {activity.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className={`p-1.5 rounded-full bg-gradient-to-br ${activityColors[i % activityColors.length]} mt-0.5`}>
                    <Activity size={12} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.action}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.detail}</p>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("Registration Trends (Last 7 Days)")}</CardTitle>
        </CardHeader>
        <CardContent>
          {trends.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t("No registration data")}</p>
          ) : (
            <div className="flex items-end gap-2 h-32">
              {(() => {
                const maxTrend = Math.max(...trends.map((t) => t.count), 1)
                return trends.map((t, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full rounded-md bg-gradient-to-t from-teal-500/70 via-amber-500/40 to-emerald-500/20 transition-all hover:from-teal-500/90 hover:via-amber-500/60"
                      style={{ height: `${(t.count / maxTrend) * 100}%` }}
                    />
                    <span className="text-[10px] text-muted-foreground">{t.month}</span>
                  </div>
                ))
              })()}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function Dashboard() {
  const { role } = useAuth()

  if (role === "admin") return <AdminOverview />
  if (role === "organizer") return <OrganizerDashboard />
  if (role === "attendee") return <AttendeeDashboard />
  return null
}

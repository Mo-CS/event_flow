import { useState, useEffect } from "react"
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom"
import {
  LayoutDashboard, Calendar, User, Moon, Sun, Menu, X,
  LogOut, ChevronDown, UserCog, Layers, Building2, ListTodo,
  Bell, FileUp, BarChart3, Settings, Shield,
} from "lucide-react"
import { Toaster } from "../ui/toaster"
import { Avatar, AvatarFallback } from "../ui/avatar"
import { Button } from "../ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "../ui/dropdown-menu"
import { useAuth } from "../../contexts/AuthContext"
import { useTheme } from "../../contexts/ThemeContext"
import { usePageTitle } from "../../lib/usePageTitle"
import { getUnreadCount, getNotifications, markAllAsRead } from "../../services/notificationService"
import ChatWidget from "../chat/ChatWidget"

export function AppLayout() {
  const { profile, role, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  usePageTitle(location.pathname)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [recentNotifs, setRecentNotifs] = useState<any[]>([])
  const [notifOpen, setNotifOpen] = useState(false)

  useEffect(() => {
    if (!profile) return
    getUnreadCount(profile.userId).then(setUnread)
    getNotifications(profile.userId).then((n) => setRecentNotifs(n.slice(0, 5)))
  }, [profile])

  const handleMarkAllRead = async () => {
    if (!profile) return
    await markAllAsRead(profile.userId)
    setUnread(0)
    setRecentNotifs((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })))
  }

  const initials = `${profile?.firstName?.[0] ?? ""}${profile?.lastName?.[0] ?? ""}`

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  const sidebarLinks = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/events", label: "Browse Events", icon: Calendar },
  ]

  if (role === "organizer" || role === "admin") {
    sidebarLinks.push({ to: "/dashboard/events", label: "My Events", icon: ListTodo })
  }

  if (role === "admin") {
    sidebarLinks.push({ to: "/dashboard/admin/users", label: "Users", icon: UserCog })
    sidebarLinks.push({ to: "/dashboard/admin/categories", label: "Categories", icon: Layers })
    sidebarLinks.push({ to: "/dashboard/admin/venues", label: "Venues", icon: Building2 })
    sidebarLinks.push({ to: "/dashboard/admin/files", label: "Files", icon: FileUp })
    sidebarLinks.push({ to: "/dashboard/admin/reports", label: "Reports", icon: BarChart3 })
    sidebarLinks.push({ to: "/dashboard/admin/settings", label: "Settings", icon: Settings })
    sidebarLinks.push({ to: "/dashboard/admin/security", label: "Security", icon: Shield })
  }

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/")

  return (
    <div className="flex h-screen bg-background">
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-border transform transition-transform lg:relative lg:translate-x-0 bg-white/90 dark:bg-card/90 backdrop-blur-xl ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-border">
          <Link to="/dashboard" className="text-xl font-bold">
            <span className="bg-gradient-to-r from-[hsl(185,85%,38%)] via-[hsl(165,80%,40%)] to-[hsl(35,92%,52%)] bg-clip-text text-transparent">
              EventFlow
            </span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>
        <nav className="p-4 space-y-1">
          {sidebarLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors relative ${
                isActive(link.to)
                  ? "text-primary bg-gradient-to-r from-teal-500/10 to-amber-500/10 font-medium before:absolute before:left-0 before:top-1/4 before:h-1/2 before:w-0.5 before:rounded-full before:bg-gradient-to-b before:from-teal-500 before:to-amber-500"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              <link.icon size={20} /> {link.label}
            </Link>
          ))}
        </nav>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-white/80 dark:bg-card/80 backdrop-blur-sm flex items-center justify-between px-4 lg:px-6 relative">
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-teal-500/30 via-amber-500/30 to-transparent" />
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-muted-foreground hover:text-foreground">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-3 ml-auto">
            <button onClick={toggleTheme} className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-accent/50">
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
              <DropdownMenuTrigger className="relative p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-accent/50 outline-none">
                <Bell size={18} />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground px-1">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <span className="text-sm font-medium">Notifications</span>
                  {unread > 0 && (
                    <Button size="sm" variant="ghost" className="h-auto text-xs py-0.5" onClick={handleMarkAllRead}>
                      Mark all read
                    </Button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {recentNotifs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No notifications</p>
                  ) : (
                    recentNotifs.map((n) => (
                      <div key={n.id} className={`px-3 py-2.5 border-b border-border last:border-0 ${!n.readAt ? "bg-primary/5" : ""}`}>
                        <p className="text-sm">{n.message}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{new Date(n.createdAt).toLocaleDateString()}</p>
                      </div>
                    ))
                  )}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => { navigate("/dashboard/notifications"); setNotifOpen(false) }}>
                  <Bell size={16} /> View all notifications
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-accent/50 transition-colors outline-none">
                <Avatar className="h-7 w-7 ring-2 ring-teal-500/30">
                  <AvatarFallback className="text-xs bg-gradient-to-br from-teal-500/20 to-amber-500/20">{initials}</AvatarFallback>
                </Avatar>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium leading-tight">{profile?.firstName} {profile?.lastName}</p>
                  <p className="text-xs text-muted-foreground capitalize leading-tight">{role}</p>
                </div>
                <ChevronDown size={14} className="text-muted-foreground hidden sm:block" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate("/dashboard/profile")}>
                  <User size={16} /> Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={toggleTheme}>
                  {theme === "light" ? <Moon size={16} /> : <Sun size={16} />} Toggle theme
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut size={16} /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
      <Toaster />
      <ChatWidget />
    </div>
  )
}

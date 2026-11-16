import { Outlet, Link, useLocation } from "react-router-dom"
import { Toaster } from "../ui/toaster"
import { useAuth } from "../../contexts/AuthContext"
import { useSettings } from "../../contexts/SettingsContext"
import { useTheme } from "../../contexts/ThemeContext"
import { usePageTitle } from "../../lib/usePageTitle"
import { Moon, Sun } from "lucide-react"
import ChatWidget from "../chat/ChatWidget"

export function PublicLayout() {
  const { isAuthenticated, profile, role } = useAuth()
  const { appName, logoUrl } = useSettings()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  usePageTitle(location.pathname)

  const isOrganizerOrAdmin = role === "organizer" || role === "admin"

  const navLinks = [
    ...(!isOrganizerOrAdmin ? [{ to: "/", label: "Home" }] : []),
    { to: "/events", label: "Events" },
    ...(!isOrganizerOrAdmin ? [{ to: "/about", label: "About" }, { to: "/contact", label: "Contact" }] : []),
    ...(isOrganizerOrAdmin ? [{ to: "/dashboard", label: "Dashboard" }] : []),
  ]

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-white/80 dark:bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-teal-500/30 via-amber-500/30 via-emerald-500/30 to-transparent" />
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between relative">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold">
            {logoUrl && <img src={logoUrl} alt="" className="h-7 w-auto" />}
            <span className="bg-gradient-to-r from-[hsl(185,85%,38%)] via-[hsl(165,80%,40%)] to-[hsl(35,92%,52%)] bg-clip-text text-transparent">
              {appName}
            </span>
          </Link>
          <nav className="hidden sm:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`text-sm transition-colors relative ${
                  location.pathname === link.to
                    ? "text-foreground font-medium after:absolute after:-bottom-1 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-gradient-to-r after:from-teal-500 after:via-amber-500 after:to-emerald-500"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <button onClick={toggleTheme} className="text-muted-foreground hover:text-foreground transition-colors">
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            {isAuthenticated ? (
              <Link to="/dashboard" className="text-sm bg-gradient-to-r from-teal-500 via-amber-500 to-emerald-500 text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity shadow-lg shadow-teal-500/25">
                Dashboard ({profile?.firstName})
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">Login</Link>
                <Link to="/register" className="text-sm bg-gradient-to-r from-teal-500 via-amber-500 to-emerald-500 text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity shadow-lg shadow-teal-500/25">Register</Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="border-t border-border py-8 mt-16 relative bg-gradient-to-r from-teal-500/[0.03] via-amber-500/[0.03] to-emerald-500/[0.03]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-500/30 via-amber-500/30 via-emerald-500/30 to-transparent" />
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} {appName}. All rights reserved.
        </div>
      </footer>
      <Toaster />
      <ChatWidget />
    </div>
  )
}

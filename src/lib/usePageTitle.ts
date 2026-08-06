import { useEffect } from "react"

const TITLES: Array<[prefix: string, title: string]> = [
  ["/dashboard/admin/users", "User Management"],
  ["/dashboard/admin/categories", "Category Management"],
  ["/dashboard/admin/venues", "Venue Management"],
  ["/dashboard/admin/files", "File Management"],
  ["/dashboard/admin/reports", "Reports"],
  ["/dashboard/admin/settings", "System Settings"],
  ["/dashboard/admin/security", "Security Center"],
  ["/dashboard/events/new", "New Event"],
  ["/dashboard/events", "My Events"],
  ["/dashboard/profile", "Profile"],
  ["/dashboard/notifications", "Notifications"],
  ["/dashboard", "Dashboard"],
  ["/events", "Browse Events"],
  ["/login", "Sign In"],
  ["/register", "Create Account"],
  ["/forgot-password", "Reset Password"],
  ["/reset-password", "Reset Password"],
  ["/about", "About"],
  ["/contact", "Contact"],
  ["/", "Home"],
]

export function usePageTitle(pathname: string): void {
  useEffect(() => {
    const match = TITLES.find(([prefix]) => pathname === prefix || pathname.startsWith(prefix + "/"))
    document.title = match ? `${match[1]} — EventFlow` : "EventFlow"
  }, [pathname])
}

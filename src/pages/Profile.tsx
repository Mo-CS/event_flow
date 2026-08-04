import { useState } from "react"
import { useAuth } from "../contexts/AuthContext"
import { toast } from "sonner"
import { Avatar, AvatarFallback } from "../components/ui/avatar"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { updateUser } from "../services/userService"

export function Profile() {
  const { user, profile, role, refreshProfile } = useAuth()
  const [firstName, setFirstName] = useState(profile?.firstName ?? "")
  const [lastName, setLastName] = useState(profile?.lastName ?? "")
  const [phone, setPhone] = useState(profile?.phoneNumber ?? "")
  const [saving, setSaving] = useState(false)

  const initials = `${profile?.firstName?.[0] ?? ""}${profile?.lastName?.[0] ?? ""}`

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    try {
      await updateUser(user.id, { firstName, lastName, phoneNumber: phone })
      await refreshProfile()
      toast.success("Profile updated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative max-w-2xl mx-auto space-y-6 animate-fade-in-up">
      <div className="absolute -top-10 -right-10 w-64 h-64 bg-teal-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-56 h-56 bg-amber-500/6 rounded-full blur-3xl pointer-events-none" />
      <h1 className="text-2xl font-bold">My Profile</h1>

      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
              <AvatarFallback className="text-lg bg-gradient-to-br from-primary/20 to-accent/20">{initials || "?"}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{profile?.firstName} {profile?.lastName}</p>
              <p className="text-sm text-muted-foreground capitalize">{role}</p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user?.email ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <Button type="submit" className="bg-gradient-to-r from-primary to-[hsl(185,75%,42%)]" disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

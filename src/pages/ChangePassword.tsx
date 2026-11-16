import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { KeyRound, ShieldAlert } from "lucide-react"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { useAuth } from "../contexts/AuthContext"
import { changePassword } from "../services/passwordResetService"

export function ChangePassword() {
  const { user, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const forced = !!user?.mustChangePassword

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!user) return
    if (newPassword.length < 8) {
      setError("The new password must be at least 8 characters.")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.")
      return
    }
    if (newPassword === currentPassword) {
      setError("Choose a password different from the current one.")
      return
    }
    setSaving(true)
    try {
      await changePassword(user.id, currentPassword, newPassword)
      await refreshProfile()
      toast.success("Password changed successfully")
      navigate("/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change the password")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><KeyRound size={24} /> Change password</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {forced
            ? "Your password was reset by an administrator. Set a new password to continue."
            : "Choose a new password for your account."}
        </p>
      </div>

      {forced && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm flex items-start gap-2">
          <ShieldAlert size={17} className="text-amber-500 mt-0.5 shrink-0" />
          <span>
            A temporary password is active until you change it. Use the temporary password as your current password below.
          </span>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Set a new password</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Current password</label>
              <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">New password</label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
              <p className="text-xs text-muted-foreground mt-1">At least 8 characters. A mix of letters, digits and symbols is recommended.</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Confirm new password</label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2 justify-end">
              {!forced && (
                <Button type="button" variant="outline" onClick={() => navigate("/dashboard")}>Cancel</Button>
              )}
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Change password"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

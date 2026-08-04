import { useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { CheckCircle2 } from "lucide-react"

export function ResetPassword() {
  const [searchParams] = useSearchParams()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [done, setDone] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      toast.error("Passwords do not match")
      return
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters")
      return
    }
    setDone(true)
    toast.success("Password reset successfully! (Demo)")
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <CheckCircle2 size={48} className="text-primary mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Password reset complete</h1>
        <p className="text-muted-foreground mb-6">Your password has been updated.</p>
        <Link to="/login" className="text-primary hover:underline text-sm">Back to login</Link>
      </div>
    )
  }

  const token = searchParams.get("token") || "demo-token"

  return (
    <div className="max-w-md mx-auto px-4 py-20">
      <h1 className="text-2xl font-bold text-center mb-8">Reset password</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">New password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Confirm password</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <input type="hidden" name="token" value={token} />
        <button type="submit"
          className="w-full bg-primary text-primary-foreground py-2 rounded-lg font-medium hover:opacity-90 transition-opacity">
          Reset password
        </button>
        <p className="text-center text-sm text-muted-foreground">
          <Link to="/login" className="text-primary hover:underline">Back to login</Link>
        </p>
      </form>
    </div>
  )
}

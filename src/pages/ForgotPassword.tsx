import { useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Mail, Copy, Check } from "lucide-react"
import { requestPasswordReset } from "../services/authService"

export function ForgotPassword() {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [token, setToken] = useState("")
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    try {
      const result = await requestPasswordReset(email)
      if (result.ok && result.token) {
        setToken(result.token)
        setSent(true)
      } else {
        toast.success("If that email exists, a reset link has been sent.")
        setSent(true)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to request reset")
    } finally {
      setLoading(false)
    }
  }

  const resetLink = `${window.location.origin}/reset-password?token=${token}`

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(resetLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Could not copy the link")
    }
  }

  if (sent) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <Mail size={48} className="text-primary mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Check your email</h1>
        <p className="text-muted-foreground mb-6">
          We've sent a password reset link to <strong>{email}</strong>
        </p>
        {token && (
          <div className="rounded-lg border border-border bg-muted/40 p-4 text-left space-y-2 mb-6">
            <p className="text-xs text-muted-foreground">
              No email service is configured in this demo, so here is your reset link
              (valid for 30 minutes, single use):
            </p>
            <button
              type="button"
              onClick={copyLink}
              className="w-full flex items-center gap-2 text-sm font-mono text-primary bg-background border border-border rounded-md px-3 py-2 text-left break-all"
            >
              <span className="flex-1 min-w-0 break-all">{resetLink}</span>
              {copied ? <Check size={14} className="shrink-0 text-green-600" /> : <Copy size={14} className="shrink-0" />}
            </button>
          </div>
        )}
        <Link to="/login" className="text-primary hover:underline text-sm">Back to login</Link>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-20">
      <h1 className="text-2xl font-bold text-center mb-2">Forgot password?</h1>
      <p className="text-sm text-muted-foreground text-center mb-8">
        Enter your email and we'll send you a reset link
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <button type="submit" disabled={loading}
          className="w-full bg-primary text-primary-foreground py-2 rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-60">
          {loading ? "Sending..." : "Send reset link"}
        </button>
        <p className="text-center text-sm text-muted-foreground">
          Remember your password? <Link to="/login" className="text-primary hover:underline">Login</Link>
        </p>
      </form>
    </div>
  )
}

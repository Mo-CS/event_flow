import { useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Mail } from "lucide-react"

export function ForgotPassword() {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setSent(true)
    toast.success("Reset link sent! (Demo: check your inbox)")
  }

  if (sent) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <Mail size={48} className="text-primary mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Check your email</h1>
        <p className="text-muted-foreground mb-6">
          We've sent a password reset link to <strong>{email}</strong>
        </p>
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
        <button type="submit"
          className="w-full bg-primary text-primary-foreground py-2 rounded-lg font-medium hover:opacity-90 transition-opacity">
          Send reset link
        </button>
        <p className="text-center text-sm text-muted-foreground">
          Remember your password? <Link to="/login" className="text-primary hover:underline">Login</Link>
        </p>
      </form>
    </div>
  )
}

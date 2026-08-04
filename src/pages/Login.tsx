import { useState } from "react"
import { Link, useNavigate, Navigate } from "react-router-dom"
import { toast } from "sonner"
import { useAuth } from "../contexts/AuthContext"
import { LogIn } from "lucide-react"

export function Login() {
  const { login, isLoading, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    try {
      await login(email, password)
      toast.success("Welcome back!")
      navigate("/dashboard")
    } catch {
      setError("Invalid email or password")
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-teal-500/15 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-amber-500/12 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-56 h-56 bg-red-500/10 rounded-full blur-3xl" />
      </div>
      <div className="w-full max-w-md animate-fade-in-up relative z-10">
        <div className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-teal-500/30 via-amber-500/30 to-emerald-500/30 rounded-2xl blur-lg" />
          <div className="relative bg-white/80 dark:bg-card/80 backdrop-blur-xl border border-white/50 dark:border-border/50 rounded-2xl p-8 shadow-xl shadow-teal-500/10">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 via-amber-500 to-emerald-500 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-teal-500/25">
                <LogIn size={24} className="text-white" />
              </div>
              <h1 className="text-2xl font-bold">Login</h1>
              <p className="text-sm text-muted-foreground mt-1">Welcome back to EventFlow</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded-lg">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1.5">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background/50 text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                  placeholder="you@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background/50 text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                  placeholder="Enter your password" />
              </div>
              <button type="submit" disabled={isLoading}
                className="w-full bg-gradient-to-r from-teal-500 via-amber-500 to-emerald-500 text-white py-2.5 rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 shadow-lg shadow-teal-500/25">
                {isLoading ? "Logging in..." : "Login"}
              </button>
              <div className="flex justify-between text-sm">
                <Link to="/forgot-password" className="text-primary hover:underline">Forgot password?</Link>
                <Link to="/register" className="text-primary hover:underline">Create account</Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

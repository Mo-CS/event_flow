import { useState } from "react"
import { Mail, Phone, MapPin, Send } from "lucide-react"
import { toast } from "sonner"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"

export function Contact() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [sent, setSent] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !email || !message) return
    setSent(true)
    toast.success("Message sent! (Demo) We'll get back to you soon.")
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold text-center mb-4">Contact Us</h1>
      <p className="text-lg text-muted-foreground text-center mb-12 max-w-xl mx-auto">
        Have a question or need help? We'd love to hear from you.
      </p>

      <div className="grid md:grid-cols-2 gap-12">
        <div>
          {sent ? (
            <div className="text-center py-12">
              <Send size={48} className="text-primary mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">Message Sent!</h2>
              <p className="text-muted-foreground">Thank you for reaching out. We'll respond shortly.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Your name" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="your@email.com" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Message</label>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} required rows={5}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="How can we help?"
                />
              </div>
              <Button type="submit" className="gap-2"><Send size={16} /> Send Message</Button>
            </form>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold mb-4">Get in Touch</h3>
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-3">
                <Mail size={16} className="text-primary" />
                <span className="text-muted-foreground">support@eventflow.com</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone size={16} className="text-primary" />
                <span className="text-muted-foreground">+1 (555) 123-4567</span>
              </div>
              <div className="flex items-center gap-3">
                <MapPin size={16} className="text-primary" />
                <span className="text-muted-foreground">123 Event St, San Francisco, CA 94105</span>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold mb-2">Office Hours</h3>
            <p className="text-sm text-muted-foreground">Monday — Friday: 9:00 AM — 6:00 PM</p>
            <p className="text-sm text-muted-foreground">Saturday: 10:00 AM — 2:00 PM</p>
            <p className="text-sm text-muted-foreground">Sunday: Closed</p>
          </div>
        </div>
      </div>
    </div>
  )
}

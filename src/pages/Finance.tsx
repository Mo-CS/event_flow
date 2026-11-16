import { useState, useEffect, useCallback } from "react"
import {
  Wallet, Plus, Check, X, Coins, ArrowRightLeft, Receipt, Paperclip, Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Badge } from "../components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import { Loading } from "../components/ui/Loading"
import { EmptyState } from "../components/ui/EmptyState"
import { useAuth } from "../contexts/AuthContext"
import {
  getFinanceSummary,
  getCurrencies,
  saveCurrency,
  getFundingSources,
  createFunding,
  getExpenses,
  createExpense,
  approveExpense,
  rejectExpense,
  getFundTransfers,
  createFundTransfer,
  getFundingAvailable,
  formatMoney,
  type ExpenseInput,
} from "../services/financeService"
import { getEventsForUser } from "../services/eventService"
import { EXPENSE_CATEGORIES } from "../constants"
import type { Attachment, Currency, Event, Expense, FundingScope, FundingSource } from "../types"

export function Finance() {
  const { user, profile, role } = useAuth()
  const isAdmin = role === "admin"
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getFinanceSummary>> | null>(null)
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [funding, setFunding] = useState<FundingSource[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [transfers, setTransfers] = useState<Awaited<ReturnType<typeof getFundTransfers>>>([])
  const [events, setEvents] = useState<Event[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, c, f, e, t] = await Promise.all([
        getFinanceSummary(),
        getCurrencies(),
        getFundingSources(),
        getExpenses(),
        getFundTransfers(),
      ])
      setSummary(s)
      setCurrencies(c)
      setFunding(f)
      setExpenses(e)
      setTransfers(t)
      if (profile && user) {
        const ev = await getEventsForUser(profile.id, user.id, role ?? "attendee", profile.managesAllEvents ?? false)
        setEvents(ev)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load finance data")
    } finally {
      setLoading(false)
    }
  }, [profile, role, user])

  useEffect(() => { load() }, [load])

  if (loading) return <Loading text="Loading finance..." />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet size={24} /> Finance</h1>
        <p className="text-sm text-muted-foreground">
          Multi-currency funding, expenses and approvals. USD is the consolidation base; every transaction keeps the rate used at the time.
          {!isAdmin && " Administrators approve expenses and manage currencies and funding."}
        </p>
      </div>

      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat title="Total funding" value={formatMoney(summary.totalFundingUsd, "USD")} hint="Consolidated in USD" />
          <Stat title="Approved expenses" value={formatMoney(summary.approvedExpensesUsd, "USD")} hint={`${formatMoney(summary.pendingExpensesUsd, "USD")} pending`} />
          <Stat title="Balance" value={formatMoney(summary.balanceUsd, "USD")} hint="Funding − approved expenses − transfers" />
          <Stat title="General / event" value={`${formatMoney(summary.generalFundingUsd, "USD")} / ${formatMoney(summary.eventFundingUsd, "USD")}`} hint="Pool split" />
        </div>
      )}

      <Tabs defaultValue="funding">
        <TabsList className="flex-wrap">
          <TabsTrigger value="funding">Funding</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          {isAdmin && <TabsTrigger value="currencies">Currencies</TabsTrigger>}
          {isAdmin && <TabsTrigger value="transfers">Transfers</TabsTrigger>}
        </TabsList>

        <TabsContent value="funding" className="mt-4 space-y-4">
          {isAdmin && <FundingForm currencies={currencies} events={events} userId={user?.id ?? ""} onSaved={load} />}
          <Card>
            <CardHeader><CardTitle className="text-base">Funding sources ({funding.length})</CardTitle></CardHeader>
            <CardContent>
              {funding.length === 0 ? (
                <EmptyState title="No funding recorded" description="Add general or event-designated funding." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Funder</TableHead>
                      <TableHead>Scope</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>USD</TableHead>
                      <TableHead>Received</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {funding.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium text-sm">{f.name}</TableCell>
                        <TableCell className="text-sm">{f.funderName || "—"}</TableCell>
                        <TableCell className="text-sm">
                          {f.scope === "general" ? "General pool" : events.find((e) => e.id === f.eventId)?.title ?? f.scope}
                        </TableCell>
                        <TableCell className="text-sm">{formatMoney(f.amount, f.currencyCode)}</TableCell>
                        <TableCell className="text-sm">{formatMoney(f.amountUsd, "USD")}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(f.receivedAt).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses" className="mt-4 space-y-4">
          <ExpenseForm currencies={currencies} events={events} funding={funding} userId={user?.id ?? ""} onSaved={load} />
          <Card>
            <CardHeader><CardTitle className="text-base">Expenses ({expenses.length})</CardTitle></CardHeader>
            <CardContent>
              {expenses.length === 0 ? (
                <EmptyState title="No expenses" description="Expense requests and approved spending appear here." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Purpose</TableHead>
                      <TableHead>Beneficiary</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell>
                          <p className="text-sm font-medium">{expense.purpose}</p>
                          <p className="text-xs text-muted-foreground capitalize">{expense.category.replace("_", " ")}{expense.attachments.length > 0 ? ` · ${expense.attachments.length} attachment(s)` : ""}</p>
                        </TableCell>
                        <TableCell className="text-sm">{expense.beneficiary}</TableCell>
                        <TableCell className="text-sm">{events.find((e) => e.id === expense.eventId)?.title ?? "General"}</TableCell>
                        <TableCell className="text-sm">
                          {formatMoney(expense.amount, expense.currencyCode)}
                          <span className="block text-xs text-muted-foreground">≈ {formatMoney(expense.amountUsd, "USD")}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={expense.status === "approved" ? "default" : expense.status === "rejected" ? "destructive" : "secondary"}>
                            {expense.status}
                          </Badge>
                          {expense.rejectionReason && <p className="text-xs text-destructive mt-1">{expense.rejectionReason}</p>}
                        </TableCell>
                        <TableCell className="text-right">
                          {isAdmin && expense.status === "pending" && (
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" className="text-green-600 gap-1" onClick={async () => {
                                if (!user) return
                                await approveExpense(expense.id, user.id)
                                toast.success("Expense approved")
                                load()
                              }}>
                                <Check size={14} /> Approve
                              </Button>
                              <Button size="sm" variant="ghost" className="text-destructive gap-1" onClick={async () => {
                                if (!user) return
                                const reason = window.prompt("Rejection reason:") ?? ""
                                await rejectExpense(expense.id, user.id, reason)
                                toast.success("Expense rejected")
                                load()
                              }}>
                                <X size={14} /> Reject
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="currencies" className="mt-4 space-y-4">
            <CurrencyForm adminId={user?.id ?? ""} onSaved={load} />
            <Card>
              <CardHeader><CardTitle className="text-base">Currencies</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Per USD</TableHead>
                      <TableHead>Per YER</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currencies.map((c) => (
                      <TableRow key={c.code}>
                        <TableCell className="font-medium">{c.code}</TableCell>
                        <TableCell className="text-sm">{c.name}</TableCell>
                        <TableCell className="text-sm">{c.ratePerUsd}</TableCell>
                        <TableCell className="text-sm">{c.ratePerYer || "—"}</TableCell>
                        <TableCell><Badge variant={c.isActive ? "default" : "outline"}>{c.isActive ? "active" : "inactive"}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="transfers" className="mt-4 space-y-4">
            <TransferForm funding={funding} currencies={currencies} userId={user?.id ?? ""} onSaved={load} />
            <Card>
              <CardHeader><CardTitle className="text-base">Transfers & refunds ({transfers.length})</CardTitle></CardHeader>
              <CardContent>
                {transfers.length === 0 ? (
                  <EmptyState title="No transfers" description="Leftover funding moved to the general pool or refunded appears here." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Funding</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transfers.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell><Badge variant="outline">{t.type === "to_general" ? "To general pool" : "Refund"}</Badge></TableCell>
                          <TableCell className="text-sm">{funding.find((f) => f.id === t.fundingId)?.name ?? "—"}</TableCell>
                          <TableCell className="text-sm">{formatMoney(t.amount, t.currencyCode)}</TableCell>
                          <TableCell className="text-sm">{t.type === "to_general" ? funding.find((f) => f.id === t.toFundingId)?.name ?? "General pool" : t.refundTo || "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

function Stat({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
        <p className="text-xl font-bold mt-1">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{hint}</p>
      </CardContent>
    </Card>
  )
}

function AttachmentEditor({ value, onChange }: { value: Attachment[]; onChange: (next: Attachment[]) => void }) {
  const [name, setName] = useState("")
  const [url, setUrl] = useState("")

  const add = () => {
    if (!name.trim() || !url.trim()) return
    onChange([...value, { name: name.trim(), url: url.trim() }])
    setName("")
    setUrl("")
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">Attachments</label>
      {value.length > 0 && (
        <div className="space-y-1">
          {value.map((a, i) => (
            <div key={`${a.url}-${i}`} className="flex items-center gap-2 text-sm rounded border border-border px-2 py-1">
              <Paperclip size={13} />
              <span className="flex-1 truncate">{a.name}</span>
              <button type="button" className="text-destructive" onClick={() => onChange(value.filter((_, idx) => idx !== i))}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="File name" />
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://link-to-file" />
        <Button type="button" variant="outline" onClick={add}>Add</Button>
      </div>
    </div>
  )
}

function FundingForm({ currencies, events, userId, onSaved }: { currencies: Currency[]; events: Event[]; userId: string; onSaved: () => void }) {
  const [name, setName] = useState("")
  const [funderName, setFunderName] = useState("")
  const [scope, setScope] = useState<FundingScope>("general")
  const [eventId, setEventId] = useState("")
  const [currencyCode, setCurrencyCode] = useState("USD")
  const [amount, setAmount] = useState("")
  const [receivedAt, setReceivedAt] = useState("")
  const [method, setMethod] = useState("")
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await createFunding({
        name,
        funderName,
        scope,
        eventId: scope === "general" ? undefined : eventId,
        currencyCode,
        amount: Number(amount),
        receivedAt: receivedAt || undefined,
        method,
        reference,
        notes,
        attachments,
      }, userId)
      toast.success("Funding recorded")
      setName(""); setAmount(""); setReference(""); setNotes(""); setAttachments([])
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record funding")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Coins size={16} /> Add funding</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Funding name" required />
            <Input value={funderName} onChange={(e) => setFunderName(e.target.value)} placeholder="Funder name" />
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <select value={scope} onChange={(e) => setScope(e.target.value as FundingScope)}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
              <option value="general">General pool</option>
              <option value="event">Event-designated</option>
              <option value="project">Project</option>
            </select>
            {scope !== "general" && (
              <select value={eventId} onChange={(e) => setEventId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                <option value="">Select event</option>
                {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
              </select>
            )}
            <select value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
              {currencies.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
            </select>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" required />
            <Input type="date" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} />
            <Input value={method} onChange={(e) => setMethod(e.target.value)} placeholder="Method (bank, cash...)" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Reference / receipt no." />
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" />
          </div>
          <AttachmentEditor value={attachments} onChange={setAttachments} />
          <div className="flex justify-end">
            <Button type="submit" disabled={saving} className="gap-2"><Plus size={15} /> {saving ? "Saving..." : "Add funding"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function ExpenseForm({ currencies, events, funding, userId, onSaved }: { currencies: Currency[]; events: Event[]; funding: FundingSource[]; userId: string; onSaved: () => void }) {
  const [eventId, setEventId] = useState("")
  const [fundingId, setFundingId] = useState("")
  const [currencyCode, setCurrencyCode] = useState("USD")
  const [amount, setAmount] = useState("")
  const [beneficiary, setBeneficiary] = useState("")
  const [purpose, setPurpose] = useState("")
  const [category, setCategory] = useState<string>("other")
  const [paymentMethod, setPaymentMethod] = useState("")
  const [expenseDate, setExpenseDate] = useState("")
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const input: ExpenseInput = {
        eventId: eventId || undefined,
        fundingId: fundingId || undefined,
        currencyCode,
        amount: Number(amount),
        beneficiary,
        purpose,
        category,
        paymentMethod,
        expenseDate: expenseDate || undefined,
        attachments,
      }
      await createExpense(input, userId)
      toast.success("Expense submitted for approval")
      setAmount(""); setBeneficiary(""); setPurpose(""); setAttachments([])
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit the expense")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Receipt size={16} /> New expense request</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <select value={eventId} onChange={(e) => setEventId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
              <option value="">General (no event)</option>
              {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
            </select>
            <select value={fundingId} onChange={(e) => setFundingId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
              <option value="">Unassigned funding</option>
              {funding.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm capitalize">
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <select value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
              {currencies.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
            </select>
            <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" required />
            <Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input value={beneficiary} onChange={(e) => setBeneficiary(e.target.value)} placeholder="Beneficiary" required />
            <Input value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} placeholder="Payment method" />
          </div>
          <textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={2} required
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" placeholder="Purpose of the expense" />
          <AttachmentEditor value={attachments} onChange={setAttachments} />
          <div className="flex justify-end">
            <Button type="submit" disabled={saving} className="gap-2"><Plus size={15} /> {saving ? "Submitting..." : "Submit expense"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function CurrencyForm({ adminId, onSaved }: { adminId: string; onSaved: () => void }) {
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [symbol, setSymbol] = useState("")
  const [ratePerUsd, setRatePerUsd] = useState("")
  const [ratePerYer, setRatePerYer] = useState("")
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await saveCurrency(
        { code, name, symbol, ratePerUsd: Number(ratePerUsd), ratePerYer: ratePerYer ? Number(ratePerYer) : undefined },
        adminId,
      )
      toast.success("Currency saved")
      setCode(""); setName(""); setSymbol(""); setRatePerUsd(""); setRatePerYer("")
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save the currency")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Add or update a currency</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid sm:grid-cols-5 gap-3 items-end">
          <div><label className="block text-xs font-medium mb-1">Code</label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="EUR" required maxLength={5} /></div>
          <div><label className="block text-xs font-medium mb-1">Name</label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Euro" /></div>
          <div><label className="block text-xs font-medium mb-1">Symbol</label><Input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="€" /></div>
          <div><label className="block text-xs font-medium mb-1">Units per USD</label><Input type="number" min={0} step="0.0001" value={ratePerUsd} onChange={(e) => setRatePerUsd(e.target.value)} required /></div>
          <div><label className="block text-xs font-medium mb-1">Units per YER</label><Input type="number" min={0} step="0.0001" value={ratePerYer} onChange={(e) => setRatePerYer(e.target.value)} /></div>
          <div className="sm:col-span-5 flex justify-end">
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save currency"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function TransferForm({ funding, currencies, userId, onSaved }: { funding: FundingSource[]; currencies: Currency[]; userId: string; onSaved: () => void }) {
  const [fundingId, setFundingId] = useState("")
  const [type, setType] = useState<"to_general" | "refund">("to_general")
  const [amount, setAmount] = useState("")
  const [refundTo, setRefundTo] = useState("")
  const [notes, setNotes] = useState("")
  const [available, setAvailable] = useState<{ availableUsd: number; availableOriginal: number } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!fundingId) { setAvailable(null); return }
    getFundingAvailable(fundingId).then((a) => setAvailable({ availableUsd: a.availableUsd, availableOriginal: a.availableOriginal })).catch(() => setAvailable(null))
  }, [fundingId])

  const selected = funding.find((f) => f.id === fundingId)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return
    setSaving(true)
    try {
      await createFundTransfer({
        fundingId,
        type,
        amount: Number(amount),
        currencyCode: selected.currencyCode,
        refundTo,
        notes,
      }, userId)
      toast.success("Transfer recorded")
      setAmount(""); setNotes(""); setRefundTo("")
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record the transfer")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><ArrowRightLeft size={16} /> Move or refund leftover funding</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <select value={fundingId} onChange={(e) => setFundingId(e.target.value)} required
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
              <option value="">Select funding source</option>
              {funding.map((f) => <option key={f.id} value={f.id}>{f.name} — {formatMoney(f.amount, f.currencyCode)}</option>)}
            </select>
            <select value={type} onChange={(e) => setType(e.target.value as "to_general" | "refund")}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
              <option value="to_general">Transfer to general pool</option>
              <option value="refund">Refund to funder</option>
            </select>
            <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" required />
          </div>
          {selected && available && (
            <p className="text-xs text-muted-foreground">
              Available: {formatMoney(available.availableOriginal, selected.currencyCode)} ({formatMoney(available.availableUsd, "USD")}). Partial transfers are allowed.
            </p>
          )}
          {type === "refund" && (
            <Input value={refundTo} onChange={(e) => setRefundTo(e.target.value)} placeholder="Refund recipient / reference" />
          )}
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" />
          <div className="flex justify-end">
            <Button type="submit" disabled={saving || !selected}>{saving ? "Saving..." : "Record transfer"}</Button>
          </div>
        </form>
        {currencies.length === 0 && <p className="text-xs text-muted-foreground mt-2">Add a currency first.</p>}
      </CardContent>
    </Card>
  )
}

"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  HelpCircle, Mail, MessageSquare, Phone, Send, CheckCircle, AlertCircle,
  BookOpen, Video, FileText, ExternalLink, ChevronDown, ChevronRight,
  Clock, Tag, AlertTriangle, Ticket, Plus, X, ArrowLeft, Loader2,
  RefreshCw, CheckCheck, Circle,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuthStore } from "@/lib/store/authStore"
import {
  createTicket, listMyTickets, replyToTicket,
  Ticket as TicketType, SupportApiError, SupportCategory, SupportPriority,
} from "@/lib/api/support"

// ─────────────────────────────────────────── types
type View = "faq" | "tickets" | "new-ticket"

const PRIORITY_CONFIG: Record<string, { label: string; color: string; icon: typeof AlertTriangle }> = {
  low: { label: "Low", color: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/30", icon: Circle },
  medium: { label: "Medium", color: "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-900/30", icon: Clock },
  high: { label: "High", color: "text-red-600 bg-red-50 border-red-200 dark:bg-red-900/30", icon: AlertTriangle },
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open: { label: "Open", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  in_progress: { label: "In Progress", color: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  resolved: { label: "Resolved", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  closed: { label: "Closed", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
}

const CATEGORIES = [
  { value: "technical", label: "🔧 Technical Issue" },
  { value: "bug", label: "🐛 Bug Report" },
  { value: "feature", label: "✨ Feature Request" },
  { value: "billing", label: "💳 Billing" },
  { value: "general", label: "💬 General Inquiry" },
]

const FAQ_ITEMS = [
  { q: "How do I enroll a student's fingerprint?", a: "Navigate to the Enrollment page, select a student, choose a device, and click 'Start Enrollment'. The system will guide you through the process." },
  { q: "What should I do if a device goes offline?", a: "Check the device's network connection and power supply. If the issue persists, use the 'Test Connection' feature in the device settings to diagnose the problem." },
  { q: "How do I sync students to a device?", a: "Go to the Devices page, select your device, and click 'Sync Students'. You can sync individual students or all students at once." },
  { q: "Can I export attendance reports?", a: "Yes! Navigate to the Attendance page and use the export feature to download reports in various formats (CSV, PDF)." },
  { q: "How do I add a new class or stream?", a: "Go to the Classes page and click 'Add Class' or 'Add Stream'. Fill in the required information and save." },
  { q: "What happens if I forget my password?", a: "Contact your system administrator or use the password reset feature if available." },
]

// ─────────────────────────────────────────── helpers
function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return "just now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(dateStr).toLocaleDateString()
}

// ─────────────────────────────────────────── sub-components

function PriorityBadge({ priority }: { priority: string }) {
  const cfg = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.medium
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
      <Icon className="h-3 w-3" /> {cfg.label}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.open
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

function FaqItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false)
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left group"
      >
        <div className="flex items-center justify-between rounded-xl border border-border/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm px-5 py-4 shadow-sm hover:shadow-md transition-all duration-200 hover:border-blue-300 dark:hover:border-blue-700">
          <span className="font-medium text-sm sm:text-base text-foreground pr-4">{q}</span>
          <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </motion.div>
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-5 py-4 text-sm text-muted-foreground bg-blue-50/50 dark:bg-blue-900/10 rounded-b-xl border border-t-0 border-border/50 -mt-1">
              {a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─────────────────────────────────────────── Ticket detail view
function TicketDetail({
  ticket,
  onBack,
  userEmail,
  userName,
  token,
  onRefresh,
}: {
  ticket: TicketType
  onBack: () => void
  userEmail: string
  userName: string
  token: string
  onRefresh: (t: TicketType) => void
}) {
  const [replyBody, setReplyBody] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [ticket.messages.length])

  const handleReply = async () => {
    if (!replyBody.trim()) return
    setSending(true)
    setError(null)
    try {
      const msg = await replyToTicket(token, ticket.id, {
        body: replyBody.trim(),
        sender_name: userName,
        sender_email: userEmail,
      })
      setReplyBody("")
      // Optimistically prepend
      onRefresh({ ...ticket, messages: [...ticket.messages, msg] })
    } catch (e) {
      setError(e instanceof SupportApiError ? e.message : "Failed to send reply.")
    } finally {
      setSending(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="mt-0.5 shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold truncate">{ticket.subject}</h2>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            <span className="text-xs text-muted-foreground">#{ticket.id} · {timeAgo(ticket.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
        {ticket.messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.is_admin_reply ? "justify-start" : "justify-end"}`}
          >
            <div className={`rounded-2xl px-4 py-3 max-w-[85%] shadow-sm text-sm
              ${msg.is_admin_reply
                ? "bg-white dark:bg-gray-800 border border-border/50 rounded-tl-sm"
                : "bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-tr-sm"
              }`}
            >
              <p className={`text-xs font-medium mb-1 ${msg.is_admin_reply ? "text-muted-foreground" : "text-blue-100"}`}>
                {msg.is_admin_reply ? "Support Team" : msg.sender_name} · {timeAgo(msg.created_at)}
              </p>
              <p className="whitespace-pre-wrap leading-relaxed">{msg.body}</p>
            </div>
          </motion.div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Reply box */}
      {ticket.status !== "closed" && (
        <div className="rounded-xl border border-border/50 bg-white/80 dark:bg-gray-800/80 p-4 space-y-3">
          <Textarea
            placeholder="Write your reply…"
            rows={3}
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            className="resize-none"
            onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) handleReply() }}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end">
            <Button onClick={handleReply} disabled={sending || !replyBody.trim()} className="gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send Reply
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Tip: Ctrl+Enter to send</p>
        </div>
      )}
    </motion.div>
  )
}

// ─────────────────────────────────────────── Main page

export default function HelpPage() {
  const { user, token } = useAuthStore()
  const [view, setView] = useState<View>("faq")
  const [tickets, setTickets] = useState<TicketType[]>([])
  const [activeTicket, setActiveTicket] = useState<TicketType | null>(null)
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [ticketError, setTicketError] = useState<string | null>(null)

  // new ticket form
  const [form, setForm] = useState({ subject: "", category: "general" as SupportCategory, message: "", priority: "medium" as SupportPriority })
  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<{ ok: boolean; message: string } | null>(null)

  const userName = `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim() || user?.email || ""
  const userEmail = user?.email || ""

  // ── load tickets
  const fetchTickets = async () => {
    if (!token) return
    setLoadingTickets(true)
    setTicketError(null)
    try {
      const data = await listMyTickets(token)
      setTickets(data)
    } catch (e) {
      setTicketError(e instanceof SupportApiError ? e.message : "Failed to load tickets.")
    } finally {
      setLoadingTickets(false)
    }
  }

  useEffect(() => {
    if (view === "tickets") fetchTickets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  // ── submit new ticket
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setSubmitting(true)
    setSubmitResult(null)
    try {
      const ticket = await createTicket(token, {
        ...form,
        user_name: userName,
        user_email: userEmail,
        school_id: user?.school_id,
      })
      setTickets((prev) => [ticket, ...prev])
      setSubmitResult({ ok: true, message: `Ticket #${ticket.id} created! Our team will respond within 24 hours.` })
      setForm({ subject: "", category: "general", message: "", priority: "medium" })
      setTimeout(() => { setView("tickets"); setSubmitResult(null) }, 3000)
    } catch (e) {
      setSubmitResult({ ok: false, message: e instanceof SupportApiError ? e.message : "Failed to create ticket." })
    } finally {
      setSubmitting(false)
    }
  }

  // ── nav tabs
  const tabs: { id: View; label: string; icon: typeof BookOpen }[] = [
    { id: "faq", label: "FAQ", icon: BookOpen },
    { id: "tickets", label: "My Tickets", icon: Ticket },
    { id: "new-ticket", label: "New Ticket", icon: Plus },
  ]

  if (activeTicket) {
    return (
      <div className="w-full p-4 sm:p-6 pb-12">
        <TicketDetail
          ticket={activeTicket}
          onBack={() => setActiveTicket(null)}
          userEmail={userEmail}
          userName={userName}
          token={token!}
          onRefresh={(updated) => {
            setActiveTicket(updated)
            setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
          }}
        />
      </div>
    )
  }

  return (
    <div className="w-full p-4 sm:p-6 pb-12 space-y-6" suppressHydrationWarning>

      {/* ── Hero header */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 px-6 py-8 text-white shadow-xl">
          {/* Decorative blobs */}
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-blue-300/20 blur-2xl" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <HelpCircle className="h-6 w-6 text-blue-200" />
                <span className="text-sm font-medium text-blue-200 uppercase tracking-wider">Support Center</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold">How can we help you?</h1>
              <p className="text-blue-100 mt-1 text-sm sm:text-base max-w-md">
                Browse FAQs, track your tickets, or file a new request — we're here for you.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 shrink-0">
              <a href="mailto:dellyit001@gmail.com" className="flex items-center gap-2 rounded-xl bg-white/15 hover:bg-white/25 transition px-4 py-2 text-sm font-medium">
                <Mail className="h-4 w-4" />Email
              </a>
              <a href="tel:+254758024400" className="flex items-center gap-2 rounded-xl bg-white/15 hover:bg-white/25 transition px-4 py-2 text-sm font-medium">
                <Phone className="h-4 w-4" />Call
              </a>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Tab navigation */}
      <div className="flex gap-1 rounded-xl bg-gray-100/80 dark:bg-gray-800/60 p-1 backdrop-blur-sm">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`relative flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200
              ${view === id
                ? "text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
              }`}
          >
            {view === id && (
              <motion.div
                layoutId="tab-pill"
                className="absolute inset-0 rounded-lg bg-white dark:bg-gray-700 shadow-sm"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <Icon className="relative z-10 h-4 w-4" />
            <span className="relative z-10 hidden sm:inline">{label}</span>
            <span className="relative z-10 sm:hidden">{label.split(" ")[0]}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">

        {/* ────── FAQ tab */}
        {view === "faq" && (
          <motion.div key="faq" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3">
            {FAQ_ITEMS.map((item, i) => (
              <FaqItem key={i} q={item.q} a={item.a} index={i} />
            ))}

            {/* Quick links */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mt-6 mb-3">Additional Resources</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { icon: FileText, title: "Documentation", desc: "User guides & tutorials" },
                  { icon: Video, title: "Video Tutorials", desc: "Step-by-step videos" },
                  { icon: ExternalLink, title: "Community Forum", desc: "Connect with others" },
                ].map(({ icon: Icon, title, desc }) => (
                  <button key={title} className="flex items-center gap-3 rounded-xl border border-border/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm px-4 py-3 text-left shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all group">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 transition-colors">
                      <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{title}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* ────── Tickets tab */}
        {view === "tickets" && (
          <motion.div key="tickets" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">Your Tickets</h2>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={fetchTickets} disabled={loadingTickets}>
                  <RefreshCw className={`h-4 w-4 ${loadingTickets ? "animate-spin" : ""}`} />
                </Button>
                <Button size="sm" onClick={() => setView("new-ticket")} className="gap-1.5">
                  <Plus className="h-4 w-4" /> New Ticket
                </Button>
              </div>
            </div>

            {loadingTickets && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            )}

            {ticketError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{ticketError}</AlertDescription>
              </Alert>
            )}

            {!loadingTickets && !ticketError && tickets.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30">
                  <Ticket className="h-8 w-8 text-blue-500" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">No tickets yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Create a new ticket to get help from our team.</p>
                </div>
                <Button onClick={() => setView("new-ticket")} className="mt-2 gap-2">
                  <Plus className="h-4 w-4" /> Create First Ticket
                </Button>
              </div>
            )}

            {!loadingTickets && tickets.map((ticket, i) => (
              <motion.div
                key={ticket.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <button
                  onClick={() => setActiveTicket(ticket)}
                  className="group w-full text-left rounded-xl border border-border/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm px-5 py-4 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <StatusBadge status={ticket.status} />
                        <PriorityBadge priority={ticket.priority} />
                        <span className="text-xs text-muted-foreground">#{ticket.id}</span>
                      </div>
                      <p className="font-semibold text-sm sm:text-base truncate">{ticket.subject}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{ticket.messages.length} messages</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{timeAgo(ticket.created_at)}</span>
                        <span className="flex items-center gap-1"><Tag className="h-3 w-3" />{ticket.category}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-blue-500 transition-colors shrink-0 mt-1" />
                  </div>
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* ────── New Ticket tab */}
        {view === "new-ticket" && (
          <motion.div key="new-ticket" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

              {/* Form — 3 cols */}
              <div className="lg:col-span-3">
                <div className="rounded-2xl border border-border/50 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-sm overflow-hidden">
                  {/* Gradient top bar */}
                  <div className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
                  <div className="p-6 space-y-5">
                    <div>
                      <h2 className="text-lg font-bold">File a New Ticket</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">Describe your issue and we'll get back to you shortly.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      {/* Subject */}
                      <div className="space-y-1.5">
                        <Label htmlFor="subject">Subject <span className="text-red-500">*</span></Label>
                        <Input
                          id="subject"
                          placeholder="Brief description of your issue"
                          value={form.subject}
                          onChange={(e) => setForm({ ...form, subject: e.target.value })}
                          required
                          minLength={5}
                          className="focus-visible:ring-blue-500"
                        />
                      </div>

                      {/* Category + Priority in a row */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="category">Category <span className="text-red-500">*</span></Label>
                          <select
                            id="category"
                            value={form.category}
                            onChange={(e) => setForm({ ...form, category: e.target.value as SupportCategory })}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                          >
                            {CATEGORIES.map((c) => (
                              <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="priority">Priority</Label>
                          <div className="flex gap-2">
                            {(["low", "medium", "high"] as SupportPriority[]).map((p) => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => setForm({ ...form, priority: p })}
                                className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-all ${form.priority === p
                                    ? p === "high"
                                      ? "border-red-400 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                      : p === "medium"
                                        ? "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                        : "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                    : "border-border/50 text-muted-foreground hover:border-border"
                                  }`}
                              >
                                {p.charAt(0).toUpperCase() + p.slice(1)}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Message */}
                      <div className="space-y-1.5">
                        <Label htmlFor="message">Message <span className="text-red-500">*</span></Label>
                        <Textarea
                          id="message"
                          placeholder="Please describe your issue in detail. Include steps to reproduce, error messages, or any relevant information."
                          value={form.message}
                          onChange={(e) => setForm({ ...form, message: e.target.value })}
                          required
                          minLength={10}
                          rows={6}
                          className="resize-none focus-visible:ring-blue-500"
                        />
                        <p className="text-xs text-muted-foreground">{form.message.length} / 5000 characters</p>
                      </div>

                      {/* Status */}
                      <AnimatePresence>
                        {submitResult && (
                          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                            <Alert className={submitResult.ok
                              ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200"
                              : ""
                            } variant={submitResult.ok ? "default" : "destructive"}>
                              {submitResult.ok
                                ? <CheckCheck className="h-4 w-4 text-emerald-600" />
                                : <AlertCircle className="h-4 w-4" />
                              }
                              <AlertDescription className={submitResult.ok ? "text-emerald-800 dark:text-emerald-200" : ""}>
                                {submitResult.message}
                              </AlertDescription>
                            </Alert>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <Button
                        type="submit"
                        disabled={submitting || !form.subject.trim() || !form.message.trim()}
                        size="lg"
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white gap-2"
                      >
                        {submitting
                          ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating Ticket…</>
                          : <><Send className="h-4 w-4" /> Submit Ticket</>
                        }
                      </Button>
                    </form>
                  </div>
                </div>
              </div>

              {/* Sidebar — 2 cols */}
              <div className="lg:col-span-2 space-y-4">
                {/* Contact info */}
                <div className="rounded-2xl border border-border/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-5 shadow-sm space-y-4">
                  <h3 className="font-semibold">Contact Us Directly</h3>
                  {[
                    { Icon: Mail, label: "Email", value: "dellyit001@gmail.com", href: "mailto:dellyit001@gmail.com" },
                    { Icon: Phone, label: "Phone", value: "+254 758 024 400", href: "tel:+254758024400" },
                    { Icon: Clock, label: "Response Time", value: "Within 24 hours (business days)", href: null },
                  ].map(({ Icon, label, value, href }) => (
                    <div key={label} className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
                        <Icon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">{label}</p>
                        {href
                          ? <a href={href} className="text-sm font-medium text-blue-600 hover:underline">{value}</a>
                          : <p className="text-sm">{value}</p>
                        }
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tips */}
                <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 p-5 shadow-sm">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-indigo-500" />
                    Before You Submit
                  </h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {[
                      "Check the FAQ for common solutions",
                      "Include error messages or screenshots",
                      "Provide your school code & device info",
                      "Describe steps you've already tried",
                    ].map((tip) => (
                      <li key={tip} className="flex items-start gap-2">
                        <ChevronRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-indigo-400" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
    Ticket, MessageSquare, Send, Loader2, AlertCircle, CheckCircle,
    Clock, Tag, ChevronDown, CheckCheck, School, X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
    getTicketByToken, adminReplyByToken, updateTicketStatus,
    Ticket as TicketType, SupportApiError, TicketStatus,
} from "@/lib/api/support"

// ─────────────────────────────────────────── helpers

function timeAgo(dateStr: string) {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
    if (diff < 60) return "just now"
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return new Date(dateStr).toLocaleDateString()
}

const STATUS_COLORS: Record<string, string> = {
    open: "bg-blue-100 text-blue-700",
    in_progress: "bg-violet-100 text-violet-700",
    resolved: "bg-emerald-100 text-emerald-700",
    closed: "bg-gray-100 text-gray-600",
}

const PRIORITY_COLORS: Record<string, string> = {
    low: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    medium: "bg-amber-50 text-amber-700 border border-amber-200",
    high: "bg-red-50 text-red-700 border border-red-200",
}

export default function GuestTicketPage() {
    const params = useParams()
    const accessToken = typeof params.token === "string" ? params.token : ""

    const [ticket, setTicket] = useState<TicketType | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Reply form
    const [replyBody, setReplyBody] = useState("")
    const [adminName, setAdminName] = useState("Support Team")
    const [adminEmail, setAdminEmail] = useState("dellyit001@gmail.com")
    const [sending, setSending] = useState(false)
    const [sendError, setSendError] = useState<string | null>(null)

    // Status update
    const [updatingStatus, setUpdatingStatus] = useState(false)

    useEffect(() => {
        async function load() {
            try {
                const data = await getTicketByToken(accessToken)
                setTicket(data)
            } catch (e) {
                setError(e instanceof SupportApiError ? e.message : "Failed to load ticket.")
            } finally {
                setLoading(false)
            }
        }
        if (accessToken) load()
    }, [accessToken])

    const handleReply = async () => {
        if (!replyBody.trim() || !ticket) return
        setSending(true)
        setSendError(null)
        try {
            const msg = await adminReplyByToken(accessToken, {
                body: replyBody.trim(),
                sender_name: adminName,
                sender_email: adminEmail,
            })
            setTicket({ ...ticket, messages: [...ticket.messages, msg], status: ticket.status === "open" ? "in_progress" : ticket.status })
            setReplyBody("")
        } catch (e) {
            setSendError(e instanceof SupportApiError ? e.message : "Failed to send reply.")
        } finally {
            setSending(false)
        }
    }

    const handleStatus = async (newStatus: TicketStatus) => {
        if (!ticket) return
        setUpdatingStatus(true)
        try {
            const updated = await updateTicketStatus(accessToken, newStatus)
            setTicket(updated)
        } catch { /* silent */ } finally {
            setUpdatingStatus(false)
        }
    }

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
            <div className="flex flex-col items-center gap-3">
                <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-blue-400/20 animate-ping" />
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
                        <Loader2 className="h-7 w-7 animate-spin text-white" />
                    </div>
                </div>
                <p className="text-sm text-gray-500">Loading ticket…</p>
            </div>
        </div>
    )

    if (error || !ticket) return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-6">
            <div className="max-w-md w-full text-center space-y-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 mx-auto">
                    <AlertCircle className="h-8 w-8 text-red-500" />
                </div>
                <h1 className="text-xl font-bold text-gray-900">Ticket Not Found</h1>
                <p className="text-gray-500 text-sm">{error ?? "This ticket link is invalid or has expired."}</p>
            </div>
        </div>
    )

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50 py-8 px-4">
            <div className="mx-auto max-w-2xl space-y-5">

                {/* Brand header */}
                <div className="flex items-center gap-2 text-sm text-gray-500">
                    <School className="h-4 w-4 text-blue-500" />
                    <span className="font-medium text-blue-600">School Biometric System</span>
                    <span>· Support Portal</span>
                </div>

                {/* Ticket info card */}
                <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-white/60 bg-white/90 backdrop-blur-sm shadow-sm overflow-hidden">
                    <div className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
                    <div className="p-5 space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-xs text-gray-400 mb-1">Ticket #{ticket.id}</p>
                                <h1 className="text-xl font-bold text-gray-900">{ticket.subject}</h1>
                                <p className="text-sm text-gray-500 mt-0.5">From: {ticket.reporter_name} &lt;{ticket.reporter_email}&gt;</p>
                            </div>
                            <div className="flex flex-wrap gap-2 shrink-0">
                                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[ticket.status] ?? "bg-gray-100 text-gray-600"}`}>
                                    {ticket.status.replace("_", " ").toUpperCase()}
                                </span>
                                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${PRIORITY_COLORS[ticket.priority] ?? ""}`}>
                                    {ticket.priority.toUpperCase()}
                                </span>
                                <span className="rounded-full bg-gray-100 text-gray-600 px-2.5 py-0.5 text-xs font-semibold">{ticket.category}</span>
                            </div>
                        </div>

                        {/* Status actions */}
                        <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100">
                            <p className="text-xs text-gray-400 self-center mr-1">Change status:</p>
                            {(["open", "in_progress", "resolved", "closed"] as TicketStatus[]).map((s) => (
                                <button
                                    key={s}
                                    disabled={updatingStatus || ticket.status === s}
                                    onClick={() => handleStatus(s)}
                                    className={`rounded-lg px-3 py-1 text-xs font-medium transition-all border
                    ${ticket.status === s
                                            ? "opacity-50 cursor-default border-transparent bg-gray-100 text-gray-500"
                                            : "border-gray-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 text-gray-600"
                                        }`}
                                >
                                    {s.replace("_", " ")}
                                </button>
                            ))}
                            {updatingStatus && <Loader2 className="h-4 w-4 animate-spin text-blue-500 self-center" />}
                        </div>
                    </div>
                </motion.div>

                {/* Message thread */}
                <div className="space-y-3">
                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider px-1">Conversation</h2>
                    <AnimatePresence>
                        {ticket.messages.map((msg, i) => (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className={`flex ${msg.is_admin_reply ? "justify-start" : "justify-end"}`}
                            >
                                <div className={`rounded-2xl px-5 py-3.5 max-w-[85%] shadow-sm
                  ${msg.is_admin_reply
                                        ? "bg-white border border-gray-200 rounded-tl-sm"
                                        : "bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-tr-sm"
                                    }`}
                                >
                                    <p className={`text-xs font-semibold mb-1.5 ${msg.is_admin_reply ? "text-gray-400" : "text-blue-100"}`}>
                                        {msg.is_admin_reply ? "Support Team" : msg.sender_name} · {timeAgo(msg.created_at)}
                                    </p>
                                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.body}</p>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                {/* Admin reply form */}
                {ticket.status !== "closed" && (
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-white/60 bg-white/90 backdrop-blur-sm shadow-sm p-5 space-y-4">
                        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-blue-500" /> Reply
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="admin-name" className="text-xs">Your Name</Label>
                                <Input id="admin-name" value={adminName} onChange={(e) => setAdminName(e.target.value)} className="h-9 text-sm" />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="admin-email" className="text-xs">Your Email</Label>
                                <Input id="admin-email" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} className="h-9 text-sm" />
                            </div>
                        </div>
                        <Textarea
                            placeholder="Write your reply…"
                            value={replyBody}
                            onChange={(e) => setReplyBody(e.target.value)}
                            rows={4}
                            className="resize-none"
                            onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) handleReply() }}
                        />
                        {sendError && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{sendError}</AlertDescription>
                            </Alert>
                        )}
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-400">Ctrl+Enter to send</p>
                            <Button onClick={handleReply} disabled={sending || !replyBody.trim()} className="gap-2">
                                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                Send Reply
                            </Button>
                        </div>
                    </motion.div>
                )}

                {ticket.status === "closed" && (
                    <div className="rounded-xl bg-gray-100 dark:bg-gray-800 px-5 py-4 text-center text-sm text-gray-500">
                        This ticket is closed. Re-open it to continue the conversation.
                    </div>
                )}

                <p className="text-center text-xs text-gray-400 pb-4">
                    This is a secure support portal for School Biometric System administrators.
                    No login required. Keep this link confidential.
                </p>
            </div>
        </div>
    )
}

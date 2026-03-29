"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    X,
    UserCheck,
    Fingerprint,
    Calendar,
    Clock,
    ArrowRight,
    ClipboardList,
    Mail,
    Briefcase,
    ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { format, subDays, startOfMonth, endOfMonth } from "date-fns"
import { listAttendance, type AttendanceEvent } from "@/lib/api/attendance"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface TeacherDetailModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    teacherId: number | null
    teacherName: string | null
    employeeId?: string | null
    token: string | null
}

export function TeacherDetailModal({
    open,
    onOpenChange,
    teacherId,
    teacherName,
    employeeId,
    token,
}: TeacherDetailModalProps) {
    const [events, setEvents] = useState<AttendanceEvent[]>([])
    const [loading, setLoading] = useState(false)
    const [timeRange, setTimeRange] = useState<"7d" | "30d" | "all">("7d")

    const fetchHistory = useCallback(async () => {
        if (!token || !teacherId) return
        setLoading(true)
        try {
            let dateFrom: string | undefined
            if (timeRange === "7d") {
                dateFrom = format(subDays(new Date(), 7), "yyyy-MM-dd")
            } else if (timeRange === "30d") {
                dateFrom = format(startOfMonth(new Date()), "yyyy-MM-dd")
            }

            const res = await listAttendance(token, {
                teacher_id: teacherId,
                date_from: dateFrom,
                page_size: 100,
            })
            setEvents(res.items)
        } catch (err) {
            console.error("Failed to fetch teacher history:", err)
        } finally {
            setLoading(false)
        }
    }, [token, teacherId, timeRange])

    useEffect(() => {
        if (open && teacherId) {
            fetchHistory()
        }
    }, [open, teacherId, fetchHistory])

    const initials = teacherName
        ? teacherName
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2)
        : "T"

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-md"
                        onClick={() => onOpenChange(false)}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-4 sm:inset-auto sm:top-[15%] sm:left-1/2 sm:-translate-x-1/2 sm:w-[500px] sm:max-h-[70%] z-[60] glass-panel shadow-premium rounded-[32px] overflow-hidden flex flex-col border border-white/20 bevel-card"
                    >
                        {/* Header / Profile Section */}
                        <div className="p-6 pb-0 relative">
                            <button
                                onClick={() => onOpenChange(false)}
                                className="absolute top-4 right-4 p-2 rounded-xl hover:bg-primary/10 text-muted-foreground transition-all"
                            >
                                <X className="size-5" />
                            </button>

                            <div className="flex items-center gap-5 mt-2">
                                <Avatar className="h-16 w-16 shadow-premium border-2 border-white/50 dark:border-white/10">
                                    <AvatarFallback className="bg-primary text-white text-xl font-black bevel-sm">
                                        {initials}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <h3 className="text-xl font-black text-foreground tracking-tight">{teacherName}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 border-primary/20 bg-primary/5 text-primary">
                                            {employeeId ?? "STAFF"}
                                        </Badge>
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Verified Teacher</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mt-6">
                                <div className="bg-primary/5 rounded-2xl p-3 border border-primary/10 flex items-center gap-3">
                                    <div className="p-2 bg-white dark:bg-black/20 rounded-lg shadow-sm">
                                        <Briefcase className="size-3.5 text-primary" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Role</span>
                                        <span className="text-xs font-bold">Faculty Member</span>
                                    </div>
                                </div>
                                <div className="bg-primary/5 rounded-2xl p-3 border border-primary/10 flex items-center gap-3">
                                    <div className="p-2 bg-white dark:bg-black/20 rounded-lg shadow-sm">
                                        <Mail className="size-3.5 text-primary" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Status</span>
                                        <span className="text-xs font-bold text-green-500">Active Duty</span>
                                    </div>
                                </div>
                            </div>

                            {/* Range Toggle */}
                            <div className="flex items-center gap-2 mt-8 border-b border-border/50 pb-4">
                                <ClipboardList className="size-4 text-primary" />
                                <h4 className="text-sm font-black uppercase tracking-widest text-foreground flex-1">Activity Log</h4>
                                <div className="flex bg-muted/20 p-1 rounded-xl">
                                    {["7d", "30d", "all"].map((r) => (
                                        <button
                                            key={r}
                                            onClick={() => setTimeRange(r as any)}
                                            className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${timeRange === r ? "bg-white dark:bg-gray-800 shadow-sm text-primary" : "text-muted-foreground opacity-60 hover:opacity-100"
                                                }`}
                                        >
                                            {r}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Scrollable Timeline */}
                        <ScrollArea className="flex-1 px-6 pt-4 pb-6">
                            <div className="space-y-4">
                                {loading ? (
                                    Array.from({ length: 4 }).map((_, i) => (
                                        <div key={i} className="h-14 bg-muted/20 animate-pulse rounded-2xl" />
                                    ))
                                ) : events.length === 0 ? (
                                    <div className="py-12 text-center flex flex-col items-center">
                                        <div className="size-12 rounded-full bg-muted/20 flex items-center justify-center mb-4 text-muted-foreground/30">
                                            <Fingerprint className="size-6" />
                                        </div>
                                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.2em]">No logs on record</p>
                                    </div>
                                ) : (
                                    events.map((evt, i) => {
                                        const date = format(new Date(evt.occurred_at), "MMM d, yyyy")
                                        const time = format(new Date(evt.occurred_at), "h:mm a")
                                        const isIn = evt.event_type === "IN"
                                        const isOut = evt.event_type === "OUT"

                                        return (
                                            <motion.div
                                                key={evt.id}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i * 0.05 }}
                                                className="flex items-center gap-4 group"
                                            >
                                                <div className="flex flex-col items-center gap-1 w-12 shrink-0">
                                                    <span className="text-[10px] font-black text-foreground/80 tabular-nums">{time}</span>
                                                    <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest opacity-40">{date}</span>
                                                </div>

                                                <div className="relative h-10 w-0.5 bg-border/40 group-last:bg-transparent">
                                                    <div className={`absolute top-0 -left-1.5 size-3.5 rounded-full border-2 border-white dark:border-gray-900 shadow-sm bevel-sm ${isIn ? "bg-green-500" : isOut ? "bg-amber-500" : "bg-gray-400"
                                                        }`} />
                                                </div>

                                                <div className="flex-1 p-3 bg-muted/5 rounded-2xl border border-border/50 transition-all hover:bg-white/40 dark:hover:bg-white/5 hover:border-primary/20">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-bold text-foreground">
                                                            {isIn ? "Terminal Check-In" : isOut ? "Terminal Check-Out" : "Manual Record"}
                                                        </span>
                                                        <Badge className={`text-[8px] font-black px-1.5 h-4 tracking-widest ${isIn ? "bg-green-500/10 text-green-600 border-green-200/50" :
                                                                isOut ? "bg-amber-500/10 text-amber-600 border-amber-200/50" : "bg-gray-500/10 text-gray-500"
                                                            }`}>
                                                            {evt.event_type}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground opacity-80 mt-1 flex items-center gap-1">
                                                        <Fingerprint className="size-3" /> {evt.device_name}
                                                    </p>
                                                </div>
                                            </motion.div>
                                        )
                                    })
                                )}
                            </div>
                        </ScrollArea>

                        {/* Footer */}
                        <div className="p-4 border-t border-border/50 bg-muted/5 flex justify-center">
                            <Button
                                variant="ghost"
                                className="text-[10px] font-black uppercase tracking-[0.2em] h-10 px-6 rounded-xl hover:bg-primary/10 hover:text-primary transition-all active:scale-95"
                                onClick={() => onOpenChange(false)}
                            >
                                Close Profile
                            </Button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}

"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X,
  ChevronLeft,
  ChevronRight,
  Users,
  UserCheck,
  LogOut,
  BarChart3,
  Clock,
  CalendarDays,
  Fingerprint,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  format,
  startOfWeek,
  endOfWeek,
  isSameDay,
  isToday,
  parseISO,
  isSameMonth,
  addMonths,
  subMonths,
} from "date-fns"
import {
  listAttendance,
  getAttendanceStats,
  type AttendanceEvent,
  type AttendanceStats,
} from "@/lib/api/attendance"
import { useAuthStore } from "@/lib/store/authStore"

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------

interface CalendarModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  schoolName?: string
}

interface DayData {
  date: Date
  totalEvents: number
  checkedIn: number
  checkedOut: number
  presentRate: number
  hasFetched: boolean
}

// -------------------------------------------------------------------------
// Mini stat pill
// -------------------------------------------------------------------------

function StatPill({
  label,
  value,
  color,
}: {
  label: string
  value: number | string
  color: "blue" | "green" | "amber" | "indigo"
}) {
  const colors = {
    blue: "bg-blue-50/50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200/50 dark:border-blue-800/50",
    green: "bg-green-50/50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200/50 dark:border-green-800/50",
    amber: "bg-amber-50/50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200/50 dark:border-amber-800/50",
    indigo: "bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-indigo-200/50 dark:border-indigo-800/50",
  }
  return (
    <div className={`rounded-2xl px-4 py-3 border flex flex-col items-center justify-center text-center transition-all hover:scale-[1.02] shadow-sm bevel-sm ${colors[color]}`}>
      <p className="text-xl sm:text-2xl font-black tabular-nums tracking-tight">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mt-0.5">{label}</p>
    </div>
  )
}

// -------------------------------------------------------------------------
// Timeline row for one event
// -------------------------------------------------------------------------

function EventRow({ event }: { event: AttendanceEvent }) {
  const time = new Date(event.occurred_at).toLocaleTimeString("en-KE", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  })

  const isIn = event.event_type === "IN"
  const isOut = event.event_type === "OUT"
  const isDup = event.event_type === "DUPLICATE"

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all hover:shadow-md group ${isIn
        ? "border-green-200/50 bg-green-50/30 dark:border-green-800/20 dark:bg-green-900/5"
        : isOut
          ? "border-amber-200/50 bg-amber-50/30 dark:border-amber-800/20 dark:bg-amber-900/5"
          : "border-gray-200/50 bg-gray-50/30 dark:border-gray-800/20 dark:bg-gray-800/5"
        } ${isDup ? "opacity-50 grayscale-[0.5]" : ""}`}
    >
      <div className={`p-2 rounded-xl bevel-sm ${isIn ? "bg-green-500 text-white" : isOut ? "bg-amber-500 text-white" : "bg-gray-400 text-white"
        }`}>
        <Fingerprint className="size-4 shrink-0" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
          {event.student_name ?? "Unknown"}
          {event.admission_number && (
            <span className="ml-1.5 text-[10px] uppercase font-bold tracking-widest opacity-40">
              #{event.admission_number}
            </span>
          )}
        </p>
        <p className="text-[11px] font-medium text-muted-foreground truncate uppercase tracking-tight">
          {event.class_name ?? "General"}{event.class_name ? " • " : ""}{event.device_name}
          {isDup && <span className="ml-1 italic text-purple-500 font-bold"> • DUP</span>}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-[11px] font-black text-foreground/80 tabular-nums">
          {time}
        </span>
        <Badge
          variant="secondary"
          className={`text-[9px] font-black tracking-[0.15em] px-1.5 py-0 rounded-md ${isIn
            ? "bg-green-500/10 text-green-600 border-green-200/50"
            : isOut
              ? "bg-amber-500/10 text-amber-600 border-amber-200/50"
              : "bg-gray-500/10 text-gray-600 border-gray-200/50"
            }`}
        >
          {event.event_type}
        </Badge>
      </div>
    </div>
  )
}

// -------------------------------------------------------------------------
// Main Component
// -------------------------------------------------------------------------

export function CalendarModal({ open, onOpenChange }: CalendarModalProps) {
  const { token } = useAuthStore()
  const today = new Date()

  const [currentMonth, setCurrentMonth] = useState<Date>(today)
  const [selectedDate, setSelectedDate] = useState<Date>(today)
  const [dayEvents, setDayEvents] = useState<AttendanceEvent[]>([])
  const [dayStats, setDayStats] = useState<AttendanceStats | null>(null)
  const [isLoadingDay, setIsLoadingDay] = useState(false)
  // Per-day dot data cache: dateStr → { in, out }
  const [dotCache, setDotCache] = useState<Record<string, { in: number; out: number }>>({})

  // -----------------------------------------------------------------------
  // Calendar grid
  // -----------------------------------------------------------------------

  const getCalendarDays = () => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDate = startOfWeek(firstDay, { weekStartsOn: 1 })

    let endDate = endOfWeek(lastDay, { weekStartsOn: 1 })
    // Minimum 6 rows (42 cells)
    const days: Date[] = []
    const cur = new Date(startDate)
    while (cur <= endDate || days.length < 42) {
      days.push(new Date(cur))
      cur.setDate(cur.getDate() + 1)
      if (days.length >= 42) break
    }
    return days
  }

  // -----------------------------------------------------------------------
  // Fetch day detail
  // -----------------------------------------------------------------------

  const fetchDay = useCallback(
    async (date: Date) => {
      if (!token) return
      setIsLoadingDay(true)
      const dateStr = format(date, "yyyy-MM-dd")
      try {
        const [events, stats] = await Promise.all([
          listAttendance(token, { target_date: dateStr, page_size: 200 }),
          getAttendanceStats(token, dateStr),
        ])
        setDayEvents(events.items)
        setDayStats(stats)
        // cache dots
        setDotCache((prev) => ({
          ...prev,
          [dateStr]: {
            in: stats.checked_in,
            out: stats.checked_out,
          },
        }))
      } catch {
        setDayEvents([])
        setDayStats(null)
      } finally {
        setIsLoadingDay(false)
      }
    },
    [token]
  )

  useEffect(() => {
    if (open) {
      fetchDay(selectedDate)
    }
  }, [open, selectedDate, fetchDay])

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  const prevMonth = () => setCurrentMonth((m) => subMonths(m, 1))
  const nextMonth = () => setCurrentMonth((m) => addMonths(m, 1))

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  const calDays = getCalendarDays()

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md"
            onClick={() => onOpenChange(false)}
          />

          {/* Drawer — full screen on mobile, large centered on desktop */}
          <motion.div
            key="drawer"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 35 }}
            className="fixed inset-x-0 bottom-0 top-0 sm:top-10 sm:bottom-0 sm:mx-auto z-50 flex h-full sm:h-[calc(100%-40px)] w-full sm:max-w-6xl flex-col bg-background/95 glass-panel shadow-premium sm:rounded-t-[40px] overflow-hidden bevel-card"
          >
            {/* Drag Handle for mobile */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-12 h-1.5 bg-muted/30 rounded-full" />
            </div>

            {/* ---- Header ---- */}
            <div className="flex items-center justify-between border-b border-border/50 px-6 py-5 bg-primary/5">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-primary text-white rounded-2xl shadow-glow bevel-sm">
                  <CalendarDays className="size-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black tracking-tight text-foreground">Attendance Intel</h2>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground opacity-60">
                    Historical Log Explorer
                  </p>
                </div>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="p-3 rounded-2xl hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all active:scale-90"
                aria-label="Close"
              >
                <X className="size-6" />
              </button>
            </div>

            {/* ---- Body — Responsive Layout ---- */}
            <div className="flex flex-1 flex-col md:flex-row min-h-0 overflow-hidden">
              {/* LEFT — Calendar & Legend */}
              <div className="w-full md:w-[380px] shrink-0 border-b md:border-b-0 md:border-r border-border/50 flex flex-col bg-muted/10">
                <ScrollArea className="flex-1">
                  <div className="p-6">
                    {/* Month nav */}
                    <div className="flex items-center justify-between mb-6">
                      <button
                        onClick={prevMonth}
                        className="p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-border shadow-sm hover:bg-primary/5 hover:text-primary transition-all"
                      >
                        <ChevronLeft className="size-5" />
                      </button>
                      <h3 className="text-base font-black tracking-tight text-foreground uppercase">
                        {format(currentMonth, "MMMM yyyy")}
                      </h3>
                      <button
                        onClick={nextMonth}
                        className="p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-border shadow-sm hover:bg-primary/5 hover:text-primary transition-all"
                      >
                        <ChevronRight className="size-5" />
                      </button>
                    </div>

                    {/* Weekday labels */}
                    <div className="grid grid-cols-7 mb-2">
                      {weekDays.map((d) => (
                        <div
                          key={d}
                          className="text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground py-2"
                        >
                          {d[0]}
                        </div>
                      ))}
                    </div>

                    {/* Days grid */}
                    <div className="grid grid-cols-7 gap-1.5">
                      {calDays.map((day, idx) => {
                        const dateStr = format(day, "yyyy-MM-dd")
                        const dots = dotCache[dateStr]
                        const isSelected = isSameDay(day, selectedDate)
                        const isCurrentMonth = isSameMonth(day, currentMonth)
                        const isTodayDate = isToday(day)

                        return (
                          <button
                            key={idx}
                            onClick={() => setSelectedDate(day)}
                            className={`relative aspect-square flex flex-col items-center justify-center rounded-2xl p-1 text-sm transition-all duration-300 group ${isSelected
                              ? "bg-primary text-primary-foreground shadow-glow scale-105 z-10"
                              : isTodayDate
                                ? "bg-primary/10 text-primary border border-primary/20"
                                : isCurrentMonth
                                  ? "hover:bg-primary/5 text-foreground font-bold"
                                  : "text-muted-foreground/30 hover:bg-muted/5"
                              }`}
                          >
                            <span className={`text-[13px] ${isSelected ? "font-black" : "font-bold"}`}>{format(day, "d")}</span>
                            {/* Dots */}
                            {dots && (
                              <div className="flex gap-0.5 mt-1">
                                {dots.in > 0 && (
                                  <span
                                    className={`w-1 h-1 rounded-full ${isSelected ? "bg-white" : "bg-green-500"
                                      }`}
                                  />
                                )}
                                {dots.out > 0 && (
                                  <span
                                    className={`w-1 h-1 rounded-full ${isSelected ? "bg-white/60" : "bg-amber-500"
                                      }`}
                                  />
                                )}
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>

                    {/* Legend */}
                    <div className="mt-8 pt-8 border-t border-border/50 space-y-4">
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">
                        Status Indicators
                      </p>
                      <div className="grid grid-cols-1 gap-3">
                        {[
                          { color: "bg-green-500", label: "Check-in Events" },
                          { color: "bg-amber-500", label: "Check-out Events" },
                          { color: "bg-primary text-white", label: "Selected Date", circle: false },
                          { color: "border-primary/50 bg-primary/10", label: "Today's Date", circle: false },
                        ].map((item, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full flex-shrink-0 ${item.color} ${!item.circle ? "rounded-md" : ""}`} />
                            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight">{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </div>

              {/* RIGHT — Day detail */}
              <div className="flex-1 flex flex-col overflow-hidden bg-background">
                {/* Day header with stats */}
                <div className="px-6 py-6 border-b border-border/50 bg-gradient-to-b from-primary/5 to-transparent">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="size-4 text-primary" />
                        <h3 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                          {format(selectedDate, "EEE, d MMMM")}
                        </h3>
                      </div>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest pl-6">
                        {isToday(selectedDate) ? "Active Today" : format(selectedDate, "yyyy")}
                      </p>
                    </div>
                    {isLoadingDay ? (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/10">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full"
                        />
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">Syncing...</span>
                      </div>
                    ) : (
                      <Badge variant="outline" className="w-fit text-[10px] font-black uppercase tracking-widest px-3 py-1 border-primary/20 bg-primary/5 text-primary">
                        Data Live
                      </Badge>
                    )}
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatPill
                      label="Interactions"
                      value={dayStats?.total_events ?? 0}
                      color="blue"
                    />
                    <StatPill
                      label="Entries"
                      value={dayStats?.checked_in ?? 0}
                      color="green"
                    />
                    <StatPill
                      label="Exits"
                      value={dayStats?.checked_out ?? 0}
                      color="amber"
                    />
                    <StatPill
                      label="Presence %"
                      value={dayStats ? `${dayStats.present_rate.toFixed(1)}` : "—"}
                      color="indigo"
                    />
                  </div>
                </div>

                {/* Event list */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  <ScrollArea className="h-full">
                    <div className="space-y-3 pb-8">
                      {isLoadingDay ? (
                        Array.from({ length: 6 }).map((_, i) => (
                          <div
                            key={i}
                            className="h-16 border border-border/50 bg-muted/20 rounded-2xl animate-pulse"
                          />
                        ))
                      ) : dayEvents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                          <div className="w-20 h-20 rounded-full bg-muted/20 flex items-center justify-center mb-6">
                            <Fingerprint className="size-10 text-muted-foreground/40" />
                          </div>
                          <p className="font-black text-lg text-foreground tracking-tight uppercase">Silent Records</p>
                          <p className="text-[11px] font-bold text-muted-foreground mt-1 uppercase tracking-widest opacity-60">No activity captured on this date</p>
                        </div>
                      ) : (
                        <AnimatePresence initial={false}>
                          {dayEvents.map((evt, i) => (
                            <motion.div
                              key={evt.id}
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.03, type: "spring", stiffness: 100 }}
                            >
                              <EventRow event={evt} />
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      )}
                    </div>
                  </ScrollArea>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs bg-muted/5">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-2 font-bold text-muted-foreground uppercase tracking-tight">
                      <Clock className="size-4 text-primary" />
                      {dayEvents.length} Sequential Logs
                    </span>
                    <Separator orientation="vertical" className="h-4 hidden sm:block" />
                    <span className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">
                      Device Auth Guaranteed
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onOpenChange(false)}
                    className="text-[10px] font-black uppercase tracking-[0.2em] h-10 px-6 rounded-xl hover:bg-primary/10 hover:text-primary transition-all active:scale-95"
                  >
                    Close Terminal
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Bell, CheckCircle2, AlertCircle, Activity, UserPlus, Wifi,
  RefreshCw, Check, CheckCheck, Trash2, Filter, Clock, ChevronDown,
} from "lucide-react"
import { useAuthStore } from "@/lib/store/authStore"
import {
  listNotifications,
  markAsRead,
  markAllAsRead,
  Notification,
} from "@/lib/api/notifications"

// ─────────────────────────────────────────── types

type FilterTab = "all" | "unread" | "attendance" | "system" | "enrollment"

// ─────────────────────────────────────────── time helper

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const diff = (Date.now() - date.getTime()) / 1000
  if (diff < 60) return "Just now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return date.toLocaleDateString()
}

function groupByDate(notifs: Notification[]): { label: string; items: Notification[] }[] {
  const map = new Map<string, Notification[]>()
  notifs.forEach((n) => {
    const d = new Date(n.created_at)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1)
    const isYesterday = d.toDateString() === yesterday.toDateString()
    const label = isToday ? "Today" : isYesterday ? "Yesterday" : d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
    if (!map.has(label)) map.set(label, [])
    map.get(label)!.push(n)
  })
  return [...map.entries()].map(([label, items]) => ({ label, items }))
}

// ─────────────────────────────────────────── icon/color maps

const CATEGORY_ICON_MAP: Record<string, typeof Bell> = {
  attendance: Activity,
  enrollment: UserPlus,
  system: Bell,
}

const CATEGORY_COLOR_MAP: Record<string, string> = {
  attendance: "text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30",
  enrollment: "text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-900/30",
  system: "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30",
}

// ─────────────────────────────────────────── deduplication helper

interface GroupedNotif extends Notification {
  _count: number
  _ids: number[]
}

function deduplicateItems(items: Notification[]): GroupedNotif[] {
  const map = new Map<string, GroupedNotif>()
  for (const n of items) {
    const key = `${n.type}::${n.title}::${n.message}`
    if (map.has(key)) {
      const existing = map.get(key)!
      existing._count += 1
      existing._ids.push(n.id)
      // Keep the unread state if any duplicate is unread
      if (!n.is_read) existing.is_read = false
    } else {
      map.set(key, { ...n, _count: 1, _ids: [n.id] })
    }
  }
  return [...map.values()]
}

// ─────────────────────────────────────────── Notification Row

function NotifRow({ notif, onRead }: { notif: GroupedNotif; onRead: (ids: number[]) => void }) {
  const Icon = CATEGORY_ICON_MAP[notif.type] || Bell
  const colors = CATEGORY_COLOR_MAP[notif.type] || "text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800"

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, height: 0 }}
      onClick={() => !notif.is_read && onRead(notif._ids)}
      className={`flex items-start gap-4 p-4 cursor-pointer transition-all hover:scale-[1.005] ${notif.is_read
        ? "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50"
        : "bg-indigo-50/60 dark:bg-indigo-900/10 border-l-2 border-l-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
        }`}
    >
      {/* Icon */}
      <div className={`flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-xl ${colors.split(' ').slice(2).join(' ')}`}>
        <Icon className={`h-5 w-5 ${colors.split(' ').slice(0, 2).join(' ')}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`text-sm font-semibold ${notif.is_read ? "text-gray-700 dark:text-gray-300" : "text-gray-900 dark:text-gray-100"}`}>
                {notif.title}
              </p>
              {!notif.is_read && (
                <span className="h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
              )}
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${colors}`}>
                {notif.type}
              </span>
              {notif._count > 1 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                  ×{notif._count}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">{notif.message}</p>
          </div>
          <p className="text-xs text-gray-400 shrink-0 mt-0.5">{timeAgo(notif.created_at)}</p>
        </div>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────── Main Page

export default function NotificationsPage() {
  const { token } = useAuthStore()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [tab, setTab] = useState<FilterTab>("all")
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date())
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchNotifications = useCallback(async (quiet = false) => {
    if (!token) return
    if (!quiet) setIsLoading(true)
    else setIsRefreshing(true)

    try {
      const res = await listNotifications(token, { page: 1, page_size: 50 })
      setNotifications(res.items)
      setLastRefreshed(new Date())
    } catch { /* silent */ }
    finally { setIsLoading(false); setIsRefreshing(false) }
  }, [token])

  // Load + auto-refresh every 30s
  useEffect(() => {
    fetchNotifications()
    intervalRef.current = setInterval(() => fetchNotifications(true), 30_000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchNotifications])

  const handleMarkRead = async (ids: number[]) => {
    if (!token) return
    try {
      await Promise.all(ids.map((id) => markAsRead(token, id)))
      setNotifications((prev) => prev.map((n) => ids.includes(n.id) ? { ...n, is_read: true } : n))
    } catch { /* silent */ }
  }

  const handleMarkAllRead = async () => {
    if (!token) return
    try {
      await markAllAsRead(token)
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    } catch { /* silent */ }
  }

  // Filter
  const filtered = notifications.filter((n) => {
    if (tab === "unread") return !n.is_read
    if (tab === "attendance") return n.type === "attendance"
    if (tab === "enrollment") return n.type === "enrollment"
    if (tab === "system") return n.type === "system"
    return true
  })

  const unreadCount = notifications.filter((n) => !n.is_read).length
  const groups = groupByDate(filtered)

  const tabs: { id: FilterTab; label: string; count?: number }[] = [
    { id: "all", label: "All", count: notifications.length },
    { id: "unread", label: "Unread", count: unreadCount },
    { id: "attendance", label: "Attendance" },
    { id: "enrollment", label: "Enrollment" },
    { id: "system", label: "System" },
  ]

  return (
    <motion.main
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8"
    >
      {/* ── Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
            Notifications
          </h1>
          <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Live
            </div>
            <span>·</span>
            <span>Last updated {timeAgo(lastRefreshed.toISOString())}</span>
            {isRefreshing && <RefreshCw className="h-3 w-3 animate-spin text-blue-400" />}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => fetchNotifications(true)} disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm">
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* ── Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: notifications.length, icon: Bell, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
          { label: "Unread", value: unreadCount, icon: Activity, color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-900/20" },
          { label: "Attendance", value: notifications.filter((n) => n.type === "attendance").length, icon: Activity, color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-900/20" },
          { label: "System", value: notifications.filter((n) => n.type === "system").length, icon: Wifi, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
        ].map(({ label, value, icon: Icon, color, bg }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200/70 dark:border-gray-700/70 shadow-sm p-4 flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${bg} shrink-0`}>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">{value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 self-start w-fit">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${tab === t.id ? "bg-white dark:bg-gray-700 text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}>
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === t.id ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                }`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Notification list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <Bell className="h-16 w-16 mb-4 opacity-20" />
          <p className="font-semibold text-lg text-gray-500">No notifications</p>
          <p className="text-sm mt-1">{tab === "unread" ? "You're all caught up!" : "Nothing here yet."}</p>
        </div>
      ) : (
        <div className="space-y-6">
          <AnimatePresence>
            {groups.map(({ label, items }) => (
              <motion.div key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-1">{label}</p>
                <div className="rounded-2xl border border-gray-200/70 dark:border-gray-700/70 bg-gray-50 dark:bg-gray-800/50 divide-y divide-gray-100 dark:divide-gray-700/50 overflow-hidden shadow-sm">
                  <AnimatePresence>
                    {deduplicateItems(items).map((n) => (
                      <NotifRow key={n.id} notif={n} onRead={handleMarkRead} />
                    ))}
                  </AnimatePresence>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.main>
  )
}

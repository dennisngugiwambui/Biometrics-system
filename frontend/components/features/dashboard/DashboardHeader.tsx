"use client"

import { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useSidebar } from "@/components/ui/sidebar"
import { useRouter } from "next/navigation"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Bell, Calendar, Settings, LogOut, Activity, UserPlus, CheckCheck, ExternalLink, User, CalendarDays } from "lucide-react"
import { CalendarModal } from "./CalendarModal"
import Link from "next/link"
import { listNotifications, markAllAsRead, Notification } from "@/lib/api/notifications"

// ── Animated hamburger / X toggle

function SidebarToggleButton() {
  const { open, toggleSidebar, isMobile } = useSidebar()
  return (
    <button
      onClick={toggleSidebar}
      className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition-all hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${!open ? "ml-0" : ""}`}
      aria-label={open ? "Close sidebar" : "Open sidebar"}
    >
      <div className="flex h-5 w-5 flex-col items-center justify-center gap-[5px]">
        <motion.span
          animate={open ? { rotate: 45, y: 7, width: "100%" } : { rotate: 0, y: 0, width: "100%" }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="block h-[2px] w-full rounded-full bg-foreground origin-center"
        />
        <motion.span
          animate={open ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.15, ease: "easeInOut" }}
          className="block h-[2px] w-4/5 rounded-full bg-foreground origin-center"
        />
        <motion.span
          animate={open ? { rotate: -45, y: -7, width: "100%" } : { rotate: 0, y: 0, width: "100%" }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="block h-[2px] w-full rounded-full bg-foreground origin-center"
        />
      </div>
    </button>
  )
}

// ── Type icon/color helpers

const TYPE_ICON: Record<string, typeof Bell> = {
  attendance: Activity,
  enrollment: UserPlus,
  system: Bell,
}

const TYPE_COLOR: Record<string, string> = {
  attendance: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  enrollment: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  system: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
}

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return "Just now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// ── Notification Dropdown

function NotificationDropdown({ token, count }: { token: string; count: number }) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)

  const fetchRecent = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await listNotifications(token, { page: 1, page_size: 5, is_read: false })
      setNotifications(res.items)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => {
    if (open) fetchRecent()
  }, [open, fetchRecent])

  const handleMarkAll = async () => {
    if (!token) return
    try {
      await markAllAsRead(token)
      setNotifications([])
    } catch { /* silent */ }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white shadow-sm">
              {count > 99 ? "99+" : count}
            </span>
          )}
          <span className="sr-only">View notifications ({count} unread)</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 rounded-xl p-0 shadow-xl" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Notifications</span>
            {count > 0 && (
              <Badge variant="destructive" className="h-5 min-w-5 rounded-full px-1.5 text-[10px]">
                {count}
              </Badge>
            )}
          </div>
          {count > 0 && (
            <button
              onClick={handleMarkAll}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium transition-colors"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-[320px] overflow-y-auto divide-y divide-border/40">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <div className="h-8 w-8 rounded-lg bg-muted animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-3/4 rounded bg-muted animate-pulse" />
                  <div className="h-2.5 w-full rounded bg-muted animate-pulse" />
                </div>
              </div>
            ))
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Bell className="h-10 w-10 mb-2 opacity-20" />
              <p className="text-sm font-medium">All caught up!</p>
              <p className="text-xs mt-0.5">No unread notifications</p>
            </div>
          ) : (
            notifications.map((n) => {
              const Icon = TYPE_ICON[n.type] || Bell
              const colorClass = TYPE_COLOR[n.type] || "bg-gray-100 text-gray-700"
              return (
                <div key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-accent/50 transition-colors">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${colorClass}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-semibold text-foreground truncate">{n.title}</p>
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-snug">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border/50 p-2">
          <Link href="/dashboard/notifications" onClick={() => setOpen(false)}>
            <button className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 transition-colors">
              <ExternalLink className="h-3.5 w-3.5" />
              View all notifications
            </button>
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Main Header

export interface DashboardHeaderProps {
  title?: string
  adminName: string
  adminAvatar?: string | null
  notificationCount?: number
  token?: string
  onLogout?: () => void
  onSettings?: () => void
}

export function DashboardHeader({
  title = "Dashboard",
  adminName,
  adminAvatar,
  notificationCount = 0,
  token = "",
  onLogout,
  onSettings,
}: DashboardHeaderProps) {
  const router = useRouter()
  const [calendarOpen, setCalendarOpen] = useState(false)
  const initials = adminName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center gap-2 border-b border-border/50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-sm px-3 sm:px-6 md:sticky md:inset-x-auto md:top-0">
        <SidebarToggleButton />
        <Separator orientation="vertical" className="h-6 mx-1" />
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold tracking-tight text-foreground sm:text-lg truncate">{title}</h1>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Notifications */}
          <div className="hover-lift">
            <NotificationDropdown token={token} count={notificationCount} />
          </div>

          <div className="hover-lift">
            <Button
              variant="ghost"
              size="icon"
              className="relative h-9 w-9 hover:bg-primary/10 hover:text-primary transition-colors"
              onClick={() => setCalendarOpen(true)}
              aria-label="Open attendance calendar"
            >
              <CalendarDays className="h-5 w-5" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-4 mx-0.5 sm:mx-2" />

          {/* User Profile */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/5 hover:ring-2 hover:ring-primary/30 transition-all overflow-hidden border border-primary/20 shadow-sm active:scale-95 group">
                <Avatar className="h-full w-full transition-transform group-hover:scale-110">
                  <AvatarImage src={adminAvatar || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 rounded-2xl p-2 shadow-2xl border-border/50 glass-panel" align="end" sideOffset={10}>
              <div className="flex items-center gap-3 p-3 mb-2 rounded-xl bg-primary/5 border border-primary/10">
                <Avatar className="h-10 w-10 border-2 border-white dark:border-gray-800 shadow-premium">
                  <AvatarImage src={adminAvatar || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <p className="text-sm font-bold truncate text-foreground">{adminName}</p>
                  <p className="text-[11px] text-muted-foreground font-medium">Administrator</p>
                </div>
              </div>
              <DropdownMenuItem
                className="rounded-xl py-2.5 cursor-pointer focus:bg-primary/10 focus:text-primary transition-colors"
                onSelect={() => router.push("/dashboard/profile")}
              >
                <User className="mr-2 h-4 w-4" />
                <span>Full Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="rounded-xl py-2.5 cursor-pointer focus:bg-primary/10 focus:text-primary transition-colors"
                onSelect={() => (onSettings ? onSettings() : router.push("/dashboard/settings"))}
              >
                <Settings className="mr-2 h-4 w-4" />
                <span>System Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-2 opacity-50" />
              <DropdownMenuItem
                className="rounded-xl py-2.5 cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive font-semibold transition-colors"
                onSelect={() => onLogout?.()}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <CalendarModal open={calendarOpen} onOpenChange={setCalendarOpen} />
    </>
  )
}

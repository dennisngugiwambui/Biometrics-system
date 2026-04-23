"use client"

import { useState, useEffect, useCallback } from "react"
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
import {
  Bell, Menu, Settings, LogOut, Activity, UserPlus,
  CheckCheck, ExternalLink, User, CalendarDays, AlertCircle,
} from "lucide-react"
import { CalendarModal } from "./CalendarModal"
import Link from "next/link"
import { listNotifications, markAllAsRead, Notification } from "@/lib/api/notifications"

function SidebarToggleButton() {
  const { toggleSidebar } = useSidebar()
  return (
    <button
      onClick={toggleSidebar}
      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="Toggle sidebar"
    >
      <Menu className="h-4 w-4" />
    </button>
  )
}

const TYPE_ICON: Record<string, typeof Bell> = {
  attendance: Activity,
  enrollment: UserPlus,
  system: AlertCircle,
}

const TYPE_COLOR: Record<string, string> = {
  attendance: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  enrollment: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  system:     "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
}

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60)    return "Just now"
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function NotificationDropdown({ token, count }: { token: string; count: number }) {
  const [open, setOpen]               = useState(false)
  const [items, setItems]             = useState<Notification[]>([])
  const [loading, setLoading]         = useState(false)

  const fetchRecent = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await listNotifications(token, { page: 1, page_size: 5, is_read: false })
      setItems(res.items)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { if (open) fetchRecent() }, [open, fetchRecent])

  const handleMarkAll = async () => {
    if (!token) return
    try { await markAllAsRead(token); setItems([]) } catch { /* silent */ }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8 text-muted-foreground hover:text-foreground">
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] font-bold text-white">
              {count > 99 ? "99+" : count}
            </span>
          )}
          <span className="sr-only">Notifications ({count} unread)</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 rounded-xl p-0 shadow-xl border border-border" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-semibold">Notifications</span>
            {count > 0 && (
              <Badge className="h-4 min-w-4 rounded-full px-1.5 text-[10px] bg-blue-600 text-white border-0">
                {count}
              </Badge>
            )}
          </div>
          {count > 0 && (
            <button
              onClick={handleMarkAll}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              <CheckCheck className="h-3 w-3" />
              Mark all read
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-72 overflow-y-auto divide-y divide-border/50">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3">
                  <div className="h-7 w-7 rounded-lg bg-muted animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 w-3/4 rounded bg-muted animate-pulse" />
                    <div className="h-2 w-full rounded bg-muted animate-pulse" />
                  </div>
                </div>
              ))
            : items.length === 0
            ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Bell className="h-8 w-8 mb-2 opacity-20" />
                <p className="text-sm font-medium">All caught up</p>
                <p className="text-xs mt-0.5">No unread notifications</p>
              </div>
            )
            : items.map((n) => {
                const Icon = TYPE_ICON[n.type] ?? Bell
                const color = TYPE_COLOR[n.type] ?? "bg-slate-100 text-slate-600"
                return (
                  <div key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-accent/40 transition-colors">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${color}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold truncate">{n.title}</p>
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-snug">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                )
              })
          }
        </div>

        {/* Footer */}
        <div className="border-t border-border p-2">
          <Link href="/dashboard/notifications" onClick={() => setOpen(false)}>
            <button className="flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
              <ExternalLink className="h-3.5 w-3.5" />
              View all notifications
            </button>
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

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
    .split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-white dark:bg-card px-3 sm:px-5 md:sticky md:inset-x-auto md:top-0 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">

        <SidebarToggleButton />
        <Separator orientation="vertical" className="h-5 mx-1" />

        {/* Page title */}
        <div className="flex-1 min-w-0">
          <h1 className="text-[15px] font-semibold tracking-tight text-foreground truncate">{title}</h1>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1 shrink-0">
          <NotificationDropdown token={token} count={notificationCount} />

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setCalendarOpen(true)}
            aria-label="Attendance calendar"
          >
            <CalendarDays className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-4 mx-1.5" />

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={adminAvatar || undefined} />
                  <AvatarFallback className="bg-blue-600 text-white text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:block text-sm font-medium text-foreground">{adminName}</span>
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent className="w-56 rounded-xl shadow-xl border border-border" align="end" sideOffset={6}>
              <div className="flex items-center gap-3 px-3 py-2.5 border-b border-border">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={adminAvatar || undefined} />
                  <AvatarFallback className="bg-blue-600 text-white text-xs font-semibold">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <p className="text-sm font-semibold truncate">{adminName}</p>
                  <p className="text-xs text-muted-foreground">Administrator</p>
                </div>
              </div>

              <div className="p-1">
                <DropdownMenuItem
                  className="cursor-pointer rounded-lg text-sm"
                  onSelect={() => router.push("/dashboard/profile")}
                >
                  <User className="mr-2 h-4 w-4" />
                  My Profile
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer rounded-lg text-sm"
                  onSelect={() => (onSettings ? onSettings() : router.push("/dashboard/settings"))}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  System Settings
                </DropdownMenuItem>
              </div>

              <DropdownMenuSeparator />

              <div className="p-1">
                <DropdownMenuItem
                  className="cursor-pointer rounded-lg text-sm text-destructive focus:bg-destructive/10 focus:text-destructive"
                  onSelect={() => onLogout?.()}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <CalendarModal open={calendarOpen} onOpenChange={setCalendarOpen} />
    </>
  )
}

"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  LayoutDashboard, Users, Smartphone, ClipboardCheck, UserPlus,
  Bell, Settings, School, HelpCircle, LogOut, ChevronUp,
  LucideIcon, GraduationCap, UserCheck, X, FileText, DoorOpen,
} from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useAuthStore } from "@/lib/store/authStore"
import { getUnreadCount } from "@/lib/api/notifications"

export interface NavigationItem {
  name: string
  icon: LucideIcon
  href: string
  badge?: number
}

export interface DashboardSidebarProps {
  adminName: string
  adminEmail: string
  adminAvatar?: string | null
  currentPath?: string
  onLogout?: () => void
  onSettings?: () => void
  schoolName?: string
  logoDataUrl?: string | null
}

const coreNavigation: NavigationItem[] = [
  { name: "Dashboard",  icon: LayoutDashboard, href: "/dashboard" },
  { name: "Students",   icon: Users,           href: "/dashboard/students" },
  { name: "Classes",    icon: GraduationCap,   href: "/dashboard/classes" },
  { name: "Devices",    icon: Smartphone,      href: "/dashboard/devices" },
  { name: "Attendance", icon: ClipboardCheck,  href: "/dashboard/attendance" },
  { name: "Presence",   icon: DoorOpen,        href: "/dashboard/presence" },
  { name: "Teachers",   icon: UserCheck,       href: "/dashboard/teachers" },
  { name: "Enrollment", icon: UserPlus,        href: "/dashboard/enrollment" },
  { name: "Reports",    icon: FileText,        href: "/dashboard/reports" },
]

const systemNavigation: NavigationItem[] = [
  { name: "Notifications", icon: Bell,        href: "/dashboard/notifications" },
  { name: "Settings",      icon: Settings,    href: "/dashboard/settings" },
  { name: "Help & Support",icon: HelpCircle,  href: "/dashboard/help" },
]

function MobileCloseButton() {
  const { isMobile, setOpenMobile } = useSidebar()
  if (!isMobile) return null
  return (
    <button
      onClick={() => setOpenMobile(false)}
      className="absolute top-3.5 right-3.5 z-50 flex h-7 w-7 items-center justify-center rounded-md bg-sidebar-accent/60 hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
      aria-label="Close menu"
    >
      <X className="h-3.5 w-3.5" />
    </button>
  )
}

export function DashboardSidebar({
  adminName,
  adminEmail,
  adminAvatar,
  currentPath,
  onLogout,
  onSettings,
  schoolName = "SchoolAdmin",
  logoDataUrl,
}: DashboardSidebarProps) {
  const { token } = useAuthStore()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!token) return
    const fetchCount = async () => {
      try {
        const { isTokenExpired } = await import("@/lib/utils/jwt")
        if (isTokenExpired(token)) return
        setUnreadCount(await getUnreadCount(token))
      } catch (err: unknown) {
        const e = err as { response?: { status?: number } }
        if (e?.response?.status === 401) return
        if (process.env.NODE_ENV === "development") console.error(err)
      }
    }
    fetchCount()
    const id = setInterval(fetchCount, 30_000)
    return () => clearInterval(id)
  }, [token])

  const initials = adminName
    .split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)

  const navItem = (item: NavigationItem, badge = 0) => {
    const isActive =
      currentPath === item.href ||
      (item.href !== "/dashboard" && currentPath?.startsWith(item.href))

    return (
      <SidebarMenuItem key={item.name}>
        <SidebarMenuButton
          asChild
          isActive={isActive}
          tooltip={item.name}
          className={[
            "relative h-9 rounded-xl transition-all duration-150",
            "group-data-[collapsible=icon]:justify-center",
            isActive
              ? "bg-blue-600 text-white shadow-sm"
              : "text-sidebar-foreground/55 hover:bg-white/8 hover:text-sidebar-accent-foreground",
          ].join(" ")}
        >
          <Link
            href={item.href}
            className="flex items-center gap-2.5 pl-3 group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:justify-center"
          >
            <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : ""}`} />
            <span className={`text-sm group-data-[collapsible=icon]:hidden ${isActive ? "font-semibold" : "font-medium"}`}>
              {item.name}
            </span>
            {badge > 0 && (
              <Badge
                variant="destructive"
                className="ml-auto mr-2 h-4 min-w-4 rounded-full px-1 text-[10px] font-bold group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:-top-1 group-data-[collapsible=icon]:-right-1"
              >
                {badge}
              </Badge>
            )}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/20 transition-all duration-200">

      {/* ── Header ── */}
      <SidebarHeader className="relative border-b border-sidebar-border/20 px-3 py-4">
        <MobileCloseButton />
        <div className="flex items-center gap-3 overflow-hidden pr-8 md:pr-0">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-sm"
            style={{ background: "linear-gradient(135deg,#2563eb,#1d4ed8)" }}
          >
            {logoDataUrl
              ? <img src={logoDataUrl} alt="Logo" className="h-full w-full object-cover" />
              : <School className="h-5 w-5 text-white" />
            }
          </div>
          <div className="flex min-w-0 flex-col leading-none group-data-[collapsible=icon]:hidden">
            <span className="max-w-36 truncate text-sm font-bold text-sidebar-accent-foreground">
              {schoolName}
            </span>
            <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-sidebar-foreground/35">
              Administration
            </span>
          </div>
        </div>
      </SidebarHeader>

      {/* ── Content ── */}
      <SidebarContent className="bg-transparent">
        <ScrollArea className="h-full">

          {/* Core nav */}
          <SidebarGroup className="px-2 pt-4">
            <SidebarGroupLabel className="px-3 pb-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-sidebar-foreground/30">
              Menu
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {coreNavigation.map((item) => navItem(item))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Separator */}
          <div className="mx-3 my-3 border-t border-sidebar-border/20 group-data-[collapsible=icon]:mx-2" />

          {/* System nav */}
          <SidebarGroup className="px-2">
            <SidebarGroupLabel className="px-3 pb-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-sidebar-foreground/30 group-data-[collapsible=icon]:hidden">
              System
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {systemNavigation.map((item) => {
                  const badge = item.name === "Notifications" ? unreadCount : (item.badge ?? 0)
                  return navItem(item, badge)
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

        </ScrollArea>
      </SidebarContent>

      {/* ── Footer ── */}
      <SidebarFooter className="border-t border-sidebar-border/20 p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground h-11"
                >
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarImage src={adminAvatar || undefined} />
                    <AvatarFallback className="bg-blue-600 text-white text-xs font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden min-w-0">
                    <span className="truncate font-semibold text-sidebar-accent-foreground text-sm">{adminName}</span>
                    <span className="truncate text-[11px] text-sidebar-foreground/50">{adminEmail}</span>
                  </div>
                  <ChevronUp className="ml-auto h-3.5 w-3.5 text-sidebar-foreground/40 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg shadow-xl border border-border"
                side="top"
                align="end"
                sideOffset={6}
              >
                <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-border">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-blue-600 text-white text-xs font-semibold">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold truncate">{adminName}</span>
                    <span className="text-xs text-muted-foreground truncate">{adminEmail}</span>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onSettings} className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  Account Settings
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">
                  <HelpCircle className="mr-2 h-4 w-4" />
                  Help & Support
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive cursor-pointer"
                  onClick={onLogout}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

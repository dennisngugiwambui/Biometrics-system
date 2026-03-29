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
  LayoutDashboard,
  Users,
  Smartphone,
  ClipboardCheck,
  UserPlus,
  Bell,
  Settings,
  School,
  HelpCircle,
  LogOut,
  ChevronUp,
  LucideIcon,
  GraduationCap,
  UserCheck,
  X,
  FileText,
  DoorOpen,
} from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useAuthStore } from "@/lib/store/authStore"
import { getUnreadCount } from "@/lib/api/notifications"

export interface NavigationItem {
  name: string
  icon: LucideIcon
  href: string
  current?: boolean
  badge?: number
}

export interface DashboardSidebarProps {
  adminName: string
  adminEmail: string
  adminAvatar?: string | null
  currentPath?: string
  onLogout?: () => void
  onSettings?: () => void
  /** School name shown in sidebar header – defaults to "SchoolAdmin" */
  schoolName?: string
  /** Base64 data URL of the school logo */
  logoDataUrl?: string | null
}

const coreNavigation: NavigationItem[] = [
  { name: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { name: "Students", icon: Users, href: "/dashboard/students" },
  { name: "Classes", icon: GraduationCap, href: "/dashboard/classes" },
  { name: "Devices", icon: Smartphone, href: "/dashboard/devices" },
  { name: "Attendance", icon: ClipboardCheck, href: "/dashboard/attendance" },
  { name: "Presence", icon: DoorOpen, href: "/dashboard/presence" },
  { name: "Teachers", icon: UserCheck, href: "/dashboard/teachers" },
  { name: "Enrollment", icon: UserPlus, href: "/dashboard/enrollment" },
  { name: "Reports", icon: FileText, href: "/dashboard/reports" },
]

const systemNavigationItems: NavigationItem[] = [
  { name: "Notifications", icon: Bell, href: "/dashboard/notifications" },
  { name: "Settings", icon: Settings, href: "/dashboard/settings" },
  { name: "Help & Support", icon: HelpCircle, href: "/dashboard/help" },
]

/** Mobile close X button - only shows on mobile inside the sheet */
function MobileCloseButton() {
  const { isMobile, setOpenMobile } = useSidebar()
  if (!isMobile) return null
  return (
    <button
      onClick={() => setOpenMobile(false)}
      className="absolute top-3.5 right-3.5 z-50 flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-accent/70 hover:bg-sidebar-accent text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors"
      aria-label="Close menu"
    >
      <X className="h-4 w-4" />
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
  const [unreadCount, setUnreadCount] = useState<number>(0)

  useEffect(() => {
    if (!token) return

    const fetchCount = async () => {
      try {
        // Check if token is expired before making request
        const { isTokenExpired } = await import('@/lib/utils/jwt')
        if (isTokenExpired(token)) {
          // Token expired, don't make request
          return
        }

        const count = await getUnreadCount(token)
        setUnreadCount(count)
      } catch (error: unknown) {
        // Silently handle 401 errors (token expired/invalid) - this is a background task
        if (error && typeof error === 'object' && 'response' in error) {
          const axiosError = error as { response?: { status?: number } }
          if (axiosError.response?.status === 401) {
            // Token is invalid/expired, don't spam console
            return
          }
        }
        // Only log other errors in development
        if (process.env.NODE_ENV === 'development') {
          console.error("Failed to fetch unread count:", error)
        }
      }
    }

    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    return () => clearInterval(interval)
  }, [token])

  const initials = adminName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50 glass-panel shadow-premium transition-all duration-300">
      <SidebarHeader className="border-b border-sidebar-border/30 p-3 relative bg-primary/5 transition-all">
        <MobileCloseButton />
        <div className="flex items-center gap-3 pr-8 md:pr-0 overflow-hidden">
          {/* School Logo */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-glow overflow-hidden bevel-sm transition-transform hover:scale-105 active:scale-95 duration-300">
            {logoDataUrl ? (
              <img
                src={logoDataUrl}
                alt="School Logo"
                className="h-full w-full object-cover"
              />
            ) : (
              <School className="h-5 w-5" />
            )}
          </div>
          {/* School Name */}
          <div className="flex flex-col gap-0.5 leading-none transition-all duration-300 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:hidden min-w-0">
            <span className="font-bold tracking-tight text-sidebar-foreground truncate max-w-[140px] text-sm leading-tight">
              {schoolName}
            </span>
            <span className="text-[9px] uppercase font-black tracking-widest text-sidebar-foreground/40 mt-0.5 opacity-70">
              Management
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-transparent">
        <ScrollArea className="h-full">
          {/* Core Navigation */}
          <SidebarGroup className="px-3">
            <SidebarGroupLabel className="px-2 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-sidebar-foreground/30">
              Core Fleet
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1.5">
                {coreNavigation.map((item) => {
                  const isActive = currentPath === item.href || (item.href !== "/dashboard" && currentPath?.startsWith(item.href))
                  return (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.name}
                        size="lg"
                        className={`
                          group transition-all duration-300 rounded-xl
                          group-data-[collapsible=icon]:justify-center
                          ${isActive
                            ? "bg-primary text-primary-foreground shadow-glow bevel-sm"
                            : "hover:bg-primary/10 hover:text-primary"}
                        `}
                      >
                        <Link href={item.href} className="flex items-center gap-3 group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:justify-center">
                          <item.icon className={`h-5 w-5 transition-transform duration-300 group-hover:scale-110 ${isActive ? "text-white" : ""}`} />
                          <span className="font-semibold group-data-[collapsible=icon]:hidden">{item.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* System Navigation */}
          <SidebarGroup className="px-3 mt-4 group-data-[collapsible=icon]:mt-2">
            <SidebarGroupLabel className="px-2 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-sidebar-foreground/30 group-data-[collapsible=icon]:hidden">
              System Support
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1.5">
                {systemNavigationItems.map((item) => {
                  const isActive = currentPath === item.href || (item.href !== "/dashboard/settings" && currentPath?.startsWith(item.href))
                  const badge = (item.name === "Notifications" ? unreadCount : item.badge) || 0
                  return (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.name}
                        size="lg"
                        className={`
                          group transition-all duration-300 rounded-xl
                          group-data-[collapsible=icon]:justify-center
                          ${isActive
                            ? "bg-primary text-primary-foreground shadow-glow bevel-sm"
                            : "hover:bg-primary/10 hover:text-primary"}
                        `}
                      >
                        <Link href={item.href} className="relative flex items-center gap-3 group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:justify-center">
                          <item.icon className={`h-5 w-5 transition-transform duration-300 group-hover:scale-110 ${isActive ? "text-white" : ""}`} />
                          <span className="font-semibold group-data-[collapsible=icon]:hidden">{item.name}</span>
                          {badge > 0 && (
                            <Badge
                              variant="destructive"
                              className="ml-auto h-5 min-w-5 rounded-full px-1.5 text-xs font-bold border-2 border-background animate-pulse group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:-top-1 group-data-[collapsible=icon]:-right-1 group-data-[collapsible=icon]:h-4 group-data-[collapsible=icon]:min-w-4 group-data-[collapsible=icon]:text-[8px]"
                            >
                              {badge}
                            </Badge>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </ScrollArea>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/50 p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={adminAvatar || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-semibold text-sidebar-foreground">{adminName}</span>
                    <span className="truncate text-xs text-sidebar-foreground/60">{adminEmail}</span>
                  </div>
                  <ChevronUp className="ml-auto h-4 w-4 text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-xl shadow-xl"
                side="top"
                align="end"
                sideOffset={8}
              >
                <div className="flex items-center gap-3 p-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary text-primary-foreground">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{adminName}</span>
                    <span className="text-xs text-muted-foreground">{adminEmail}</span>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onSettings}>
                  <Settings className="mr-2 h-4 w-4" />
                  Account Settings
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <HelpCircle className="mr-2 h-4 w-4" />
                  Help & Support
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onLogout}>
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

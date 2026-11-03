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
import { ScrollArea } from "@/components/ui/scroll-area"
import { Fingerprint, KeyRound, LogOut, PanelLeftClose, Search, X } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { useAuthStore } from "@/lib/store/authStore"
import { getUnreadCount } from "@/lib/api/notifications"
import { NAV_SECTIONS, isNavActive, type NavigationItem } from "./navigation"

export type { NavigationItem } from "./navigation"

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

function HeaderToggle() {
  const { isMobile, setOpenMobile, toggleSidebar } = useSidebar()
  return (
    <button
      onClick={() => (isMobile ? setOpenMobile(false) : toggleSidebar())}
      className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-white group-data-[collapsible=icon]:hidden"
      aria-label={isMobile ? "Close menu" : "Collapse menu"}
    >
      {isMobile ? <X className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
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
  const [filter, setFilter] = useState("")
  const filterRef = useRef<HTMLInputElement>(null)

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

  // "/" jumps to the menu search, unless someone is typing elsewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (e.key !== "/" || el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return
      e.preventDefault()
      filterRef.current?.focus()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const sections = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return NAV_SECTIONS
    return NAV_SECTIONS
      .map((s) => ({ ...s, items: s.items.filter((i) => `${i.name} ${i.hint ?? ""}`.toLowerCase().includes(q)) }))
      .filter((s) => s.items.length)
  }, [filter])

  const initials = adminName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)

  const navItem = (item: NavigationItem) => {
    const active = isNavActive(item.href, currentPath)
    const badge = item.name === "Notifications" ? unreadCount : (item.badge ?? 0)
    return (
      <SidebarMenuItem key={item.href}>
        <SidebarMenuButton
          asChild
          isActive={active}
          tooltip={item.name}
          className={[
            "relative h-10 rounded-[10px] border transition-colors duration-150 group-data-[collapsible=icon]:justify-center",
            active
              ? "border-white/20 bg-white/12 font-semibold text-white hover:bg-white/15 hover:text-white data-[active=true]:bg-white/12 data-[active=true]:text-white"
              : "border-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-white",
          ].join(" ")}
        >
          <Link
            href={item.href}
            onClick={() => setFilter("")}
            className="flex items-center gap-2.5 px-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0"
          >
            <span className="side-tile"><item.icon className="h-[15px] w-[15px]" /></span>
            <span className="truncate text-[13.5px] group-data-[collapsible=icon]:hidden">{item.name}</span>
            {badge > 0 && (
              <span className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#fbbf24] px-1 text-[10px] font-bold text-[#422006] group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:-right-0.5 group-data-[collapsible=icon]:-top-0.5">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
            {active && !badge && <span className="ml-auto mr-1 h-1.5 w-1.5 rounded-full bg-white group-data-[collapsible=icon]:hidden" />}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      {/* School */}
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3">
        <div className="flex items-center gap-2.5 overflow-hidden group-data-[collapsible=icon]:justify-center">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm">
            {logoDataUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={logoDataUrl} alt="" className="h-full w-full object-contain" />
              : <Fingerprint className="h-5 w-5 text-[#15803d]" />}
          </div>
          <div className="flex min-w-0 flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-[14px] font-bold text-white">{schoolName}</span>
            <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#fbbf24]">Attendance</span>
          </div>
          <HeaderToggle />
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-transparent">
        {/* Menu search */}
        <div className="px-3 pt-3 group-data-[collapsible=icon]:hidden">
          <label className="relative block">
            <span className="sr-only">Search the menu</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/55" />
            <input
              ref={filterRef}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { setFilter(""); e.currentTarget.blur() } }}
              placeholder="Search the menu…"
              className="h-9 w-full rounded-[10px] border border-white/15 bg-white/8 pl-8 pr-8 text-[13px] text-white outline-none transition-colors placeholder:text-white/55 focus:border-white/40 focus:bg-white/12"
            />
            <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-white/20 px-1.5 text-[10px] text-white/55">/</kbd>
          </label>
        </div>

        <ScrollArea className="h-full">
          {sections.map((section) => (
            <SidebarGroup key={section.label} className="px-2 pt-3 pb-0">
              <SidebarGroupLabel className="h-6 px-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">
                {section.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">{section.items.map(navItem)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
          {sections.length === 0 && (
            <p className="px-5 py-6 text-center text-[13px] text-white/60">Nothing in the menu matches “{filter}”.</p>
          )}
        </ScrollArea>
      </SidebarContent>

      {/* Signed-in user */}
      <SidebarFooter className="border-t border-sidebar-border p-2.5">
        <div className="flex items-center gap-2.5 rounded-xl bg-white/8 p-2 ring-1 ring-white/10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:ring-0">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={adminAvatar || undefined} />
            <AvatarFallback className="bg-white text-xs font-bold text-[#14532d]">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
            <p className="truncate text-[13px] font-semibold text-white">{adminName}</p>
            <p className="truncate text-[11px] text-white/65">{adminEmail}</p>
          </div>
          <button
            onClick={onSettings}
            aria-label="Account settings"
            title="Account settings"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/12 hover:text-white group-data-[collapsible=icon]:hidden"
          >
            <KeyRound className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onLogout}
            aria-label="Sign out"
            title="Sign out"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/12 hover:text-white group-data-[collapsible=icon]:hidden"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

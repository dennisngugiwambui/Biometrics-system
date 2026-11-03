"use client"

import Link from "next/link"
import { ClipboardCheck, DoorOpen, FileText, LayoutDashboard, Menu } from "lucide-react"
import { useSidebar } from "@/components/ui/sidebar"
import { isNavActive } from "./navigation"

const TABS = [
  { name: "Home", icon: LayoutDashboard, href: "/dashboard" },
  { name: "Attendance", icon: ClipboardCheck, href: "/dashboard/attendance" },
  { name: "Presence", icon: DoorOpen, href: "/dashboard/presence" },
  { name: "Reports", icon: FileText, href: "/dashboard/reports" },
]

/** The bottom tab bar on phones, as on the portal. "Menu" opens the full sidebar. */
export function MobileTabBar({ currentPath }: { currentPath?: string | null }) {
  const { setOpenMobile } = useSidebar()
  const cls = (active: boolean) =>
    `flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${active ? "text-primary" : "text-slate-500"}`

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 flex h-[60px] border-t border-border bg-white pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
      style={{ height: "calc(60px + env(safe-area-inset-bottom))" }}
    >
      {TABS.map((t) => {
        const active = isNavActive(t.href, currentPath)
        return (
          <Link key={t.href} href={t.href} className={cls(active)} aria-current={active ? "page" : undefined}>
            <t.icon className="h-5 w-5" />
            {t.name}
          </Link>
        )
      })}
      <button onClick={() => setOpenMobile(true)} className={cls(false)}>
        <Menu className="h-5 w-5" />
        Menu
      </button>
    </nav>
  )
}

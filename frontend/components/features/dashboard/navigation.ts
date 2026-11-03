import {
  Bell, ClipboardCheck, DoorOpen, FileText, GraduationCap, HelpCircle, LayoutDashboard, Settings,
  Smartphone, UserCheck, UserPlus, Users, type LucideIcon,
} from "lucide-react"

export interface NavigationItem {
  name: string
  icon: LucideIcon
  href: string
  hint?: string
  badge?: number
}

export const NAV_SECTIONS: { label: string; items: NavigationItem[] }[] = [
  {
    label: "Daily",
    items: [
      { name: "Dashboard", icon: LayoutDashboard, href: "/dashboard", hint: "Today at a glance" },
      { name: "Attendance", icon: ClipboardCheck, href: "/dashboard/attendance", hint: "Registers and clock-ins" },
      { name: "Presence", icon: DoorOpen, href: "/dashboard/presence", hint: "Who is in right now" },
      { name: "Reports", icon: FileText, href: "/dashboard/reports", hint: "PDF registers and summaries" },
    ],
  },
  {
    label: "School",
    items: [
      { name: "Students", icon: Users, href: "/dashboard/students", hint: "Learners and guardians" },
      { name: "Teachers", icon: UserCheck, href: "/dashboard/teachers", hint: "Staff records" },
      { name: "Classes", icon: GraduationCap, href: "/dashboard/classes", hint: "Classes and streams" },
    ],
  },
  {
    label: "Biometrics",
    items: [
      { name: "Devices", icon: Smartphone, href: "/dashboard/devices", hint: "ZKTeco terminals" },
      { name: "Enrollment", icon: UserPlus, href: "/dashboard/enrollment", hint: "Capture fingerprints" },
    ],
  },
  {
    label: "System",
    items: [
      { name: "Notifications", icon: Bell, href: "/dashboard/notifications", hint: "Alerts and messages" },
      { name: "Settings", icon: Settings, href: "/dashboard/settings", hint: "School, branding and SMS" },
      { name: "Help & Support", icon: HelpCircle, href: "/dashboard/help", hint: "Guides and contacts" },
    ],
  },
]

export const ALL_NAV_ITEMS: NavigationItem[] = NAV_SECTIONS.flatMap((s) => s.items)

export function isNavActive(href: string, path?: string | null): boolean {
  if (!path) return false
  return path === href || (href !== "/dashboard" && path.startsWith(`${href}/`)) || (href !== "/dashboard" && path === href)
}

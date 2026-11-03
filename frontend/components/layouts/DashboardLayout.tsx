"use client"

import { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { DashboardSidebar, DashboardHeader } from "@/components/features/dashboard"
import type { UserResponse } from "@/lib/api/auth"

export interface DashboardLayoutProps {
  children: ReactNode
  title?: string
  user: UserResponse
  onLogout: () => void
  onSettings?: () => void
}

export function DashboardLayout({
  children,
  title = "Dashboard",
  user,
  onLogout,
  onSettings,
}: DashboardLayoutProps) {
  const pathname = usePathname()
  const adminFirstName = user.first_name || user.email.split("@")[0]
  const adminFullName = `${user.first_name} ${user.last_name}`.trim() || user.email

  const handleSettings = () => {
    if (onSettings) {
      onSettings()
    }
  }

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={true}>
        <div className="flex min-h-screen w-full ">
          <DashboardSidebar
            adminName={adminFullName}
            adminEmail={user.email}
            adminAvatar={null}
            currentPath={pathname}
            onLogout={onLogout}
            onSettings={handleSettings}
          />

          <SidebarInset>
            <DashboardHeader
              title={title}
              adminName={adminFullName}
              notificationCount={3}
              onLogout={onLogout}
              onSettings={handleSettings}
            />

            {children}
          </SidebarInset>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  )
}


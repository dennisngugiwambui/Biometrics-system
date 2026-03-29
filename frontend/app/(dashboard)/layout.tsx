"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { SidebarProvider, SidebarInset, useSidebar } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { DashboardSidebar, DashboardHeader } from "@/components/features/dashboard"
import { useAuthStore } from "@/lib/store/authStore"
import { useSessionCheck } from "@/lib/hooks/useSessionCheck"
import { isTokenExpired } from "@/lib/utils/jwt"
import { useSchoolBrandingStore } from "@/lib/store/schoolBrandingStore"
import { getMySchool } from "@/lib/api/schools"
import { getUnreadCount } from "@/lib/api/notifications"
import Loading from "./dashboard/loading"

/** Closes the sidebar on every route change when the viewport is mobile */
function SidebarCloser() {
  const pathname = usePathname()
  const { setOpen, setOpenMobile, isMobile } = useSidebar()
  useEffect(() => {
    // Always close any mobile sheet sidebar on navigation
    if (isMobile) {
      setOpenMobile(false)
      setOpen(false)
    }
  }, [pathname, isMobile, setOpen, setOpenMobile])
  return null
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { token, user, logout, hasHydrated, setHasHydrated } = useAuthStore()
  const { schoolName, logoDataUrl, setSchoolName, setLogo, setLoginBg, setColors } = useSchoolBrandingStore()
  const [title, setTitle] = useState("Dashboard")
  const [unreadCount, setUnreadCount] = useState(0)
  // Default sidebar to CLOSED on mobile, OPEN on desktop
  const [sidebarDefaultOpen, setSidebarDefaultOpen] = useState(true)

  useEffect(() => {
    const checkMobile = () => setSidebarDefaultOpen(window.innerWidth >= 768)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Sync school name and branding from API so dashboard is same on any device/IP
  useEffect(() => {
    if (!token) return
    getMySchool(token)
      .then((school) => {
        setSchoolName(school.name)
        if (school.branding) {
          if (school.branding.logoDataUrl != null) setLogo(school.branding.logoDataUrl)
          if (school.branding.loginBgDataUrl != null) setLoginBg(school.branding.loginBgDataUrl)
          if (school.branding.colors?.length) setColors(school.branding.colors)
        }
      })
      .catch(() => {/* silently ignore */ })
  }, [token, setSchoolName, setLogo, setLoginBg, setColors])

  // Fetch real notification unread count
  useEffect(() => {
    if (!token) return
    const fetchCount = async () => {
      try {
        const count = await getUnreadCount(token)
        setUnreadCount(count)
      } catch { /* silent */ }
    }
    fetchCount()
    const interval = setInterval(fetchCount, 30_000)
    return () => clearInterval(interval)
  }, [token])

  // Update page title based on route
  useEffect(() => {
    if (pathname === "/dashboard/settings") {
      setTitle("Settings")
    } else if (pathname === "/dashboard") {
      setTitle("Dashboard")
    } else if (pathname.startsWith("/dashboard/")) {
      const segments = pathname.split("/").filter(Boolean)
      if (segments.length > 1) {
        const pageName = segments[segments.length - 1]
        setTitle(pageName.charAt(0).toUpperCase() + pageName.slice(1))
      }
    }
  }, [pathname])

  // Ensure hydration is marked as complete on client side
  useEffect(() => {
    if (typeof window !== 'undefined' && !hasHydrated) {
      const timer = setTimeout(() => {
        setHasHydrated(true)
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [hasHydrated, setHasHydrated])

  // Wait for hydration before checking authentication
  useEffect(() => {
    if (!hasHydrated) return
    if (!token || !user) {
      router.push("/login")
      return
    }
    if (token && isTokenExpired(token)) {
      logout()
      router.push("/login")
    }
  }, [hasHydrated, token, user, router, logout])

  useSessionCheck({
    checkInterval: 60000,
    warningBufferSeconds: 300,
    logoutBufferSeconds: 0,
    showWarning: true,
  })

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  const handleSettings = () => {
    router.push("/dashboard/settings")
  }

  if (!hasHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-50/30 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full"
          />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </motion.div>
      </div>
    )
  }

  if (!token || !user) {
    return null
  }

  const adminFullName = `${user.first_name} ${user.last_name}`.trim() || user.email

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={sidebarDefaultOpen}>
        <SidebarCloser />
        <div className="flex min-h-screen w-full bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-50/30 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
          <DashboardSidebar
            adminName={adminFullName}
            adminEmail={user.email}
            adminAvatar={user.avatar}
            currentPath={pathname}
            onLogout={handleLogout}
            onSettings={handleSettings}
            schoolName={schoolName}
            logoDataUrl={logoDataUrl}
          />

          <SidebarInset className="flex flex-col bg-slate-50/50 dark:bg-gray-950/50">
            <DashboardHeader
              title={title}
              adminName={adminFullName}
              adminAvatar={user.avatar}
              notificationCount={unreadCount}
              token={token || ""}
              onLogout={handleLogout}
              onSettings={handleSettings}
            />

            <main className="flex-1 overflow-y-auto custom-scrollbar pt-16 md:pt-0">
              <Suspense fallback={
                <div className="flex h-[60vh] w-full items-center justify-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="h-10 w-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest animate-pulse">Loading</p>
                  </div>
                </div>
              }>
                <motion.div
                  key={pathname}
                  initial={{ opacity: 0, scale: 0.995, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                  className="p-0"
                >
                  <div className="w-full bg-white dark:bg-gray-900 min-h-[calc(100vh-4rem)] transition-all">
                    {children}
                  </div>
                </motion.div>
              </Suspense>
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  )
}

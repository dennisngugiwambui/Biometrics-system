"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { Toaster } from "@/components/ui/sonner"
import { SchoolThemeProvider } from "@/components/features/school/SchoolThemeProvider"
import { useSchoolBrandingStore } from "@/lib/store/schoolBrandingStore"
import { PwaRegister } from "@/components/shared/PwaRegister"

// Import axios instance to initialize global interceptors
import "@/lib/api/axios-instance"

/**
 * Client-side wrapper for every page. The root layout stays a server component
 * so search engines get the real <title> and description; the school's own
 * title only replaces it inside the signed-in app.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { schoolName } = useSchoolBrandingStore()
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname?.startsWith("/dashboard")) return
    document.title = schoolName && schoolName !== "SchoolAdmin"
      ? `${schoolName} | Management System`
      : "Shulepoa Attendance"
  }, [schoolName, pathname])

  return (
    <>
      <SchoolThemeProvider>
        {children}
      </SchoolThemeProvider>
      <Toaster />
      <PwaRegister />
    </>
  )
}

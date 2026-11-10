"use client"

import { Toaster } from "@/components/ui/sonner"
import { SchoolThemeProvider } from "@/components/features/school/SchoolThemeProvider"
import { PwaRegister } from "@/components/shared/PwaRegister"

// Import axios instance to initialize global interceptors
import "@/lib/api/axios-instance"

/**
 * Client-side wrapper for every page. The root layout stays a server component
 * so search engines get the real <title> and description; the school's own
 * title only replaces it inside the signed-in app.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  // Tab titles: SchoolThemeProvider (pageTitle.ts) for app pages, metadata elsewhere.

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

"use client"

import { Toaster } from "@/components/ui/sonner"
import { SchoolThemeProvider } from "@/components/features/school/SchoolThemeProvider"
import { PwaRegister } from "@/components/shared/PwaRegister"
import { FeedbackRoot, installErrorDialog } from "@/components/shared/FeedbackDialogs"

// Import axios instance to initialize global interceptors
import "@/lib/api/axios-instance"

/**
 * Client-side wrapper for every page. The root layout stays a server component
 * so search engines get the real <title> and description; the school's own
 * title only replaces it inside the signed-in app.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  // Errors become dialogs, as on the portal (once, before anything renders a toast).
  installErrorDialog()
  // Tab titles: SchoolThemeProvider (pageTitle.ts) for app pages, metadata elsewhere.

  return (
    <>
      <SchoolThemeProvider>
        {children}
      </SchoolThemeProvider>
      <Toaster />
      <FeedbackRoot />
      <PwaRegister />
    </>
  )
}

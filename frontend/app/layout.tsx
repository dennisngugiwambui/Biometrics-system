"use client"

import { useEffect } from "react"
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { SchoolThemeProvider } from "@/components/features/school/SchoolThemeProvider"
import { useSchoolBrandingStore } from "@/lib/store/schoolBrandingStore"

// Import axios instance to initialize global interceptors
import "@/lib/api/axios-instance"

const inter = Inter({ subsets: ["latin"] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { schoolName } = useSchoolBrandingStore()

  useEffect(() => {
    if (schoolName && schoolName !== 'SchoolAdmin') {
      document.title = `${schoolName} | Management System`
    } else {
      document.title = "School Biometric Management System"
    }
  }, [schoolName])

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="SchoolBMS" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <SchoolThemeProvider>
          {children}
        </SchoolThemeProvider>
        <Toaster />
      </body>
    </html>
  )
}

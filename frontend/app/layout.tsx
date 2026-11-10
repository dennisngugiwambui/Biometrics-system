"use client"

import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { SchoolThemeProvider } from "@/components/features/school/SchoolThemeProvider"

// Import axios instance to initialize global interceptors
import "@/lib/api/axios-instance"

const inter = Inter({ subsets: ["latin"] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // The tab title is set per page by <SchoolThemeProvider> (see pageTitle.ts).

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>School Biometric Attendance</title>
        <meta name="description" content="Fingerprint attendance for learners and staff." />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#15803d" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Attendance" />
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

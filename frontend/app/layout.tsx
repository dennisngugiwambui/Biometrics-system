import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"
import "./globals.css"
import { AppShell } from "@/components/shared/AppShell"
import { SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/seo"

const jakarta = localFont({ src: "./fonts/plus-jakarta-sans.woff2", weight: "200 800", variable: "--font-jakarta", display: "swap" })
const bricolage = localFont({ src: "./fonts/bricolage-grotesque.woff2", weight: "500 800", variable: "--font-bricolage", display: "swap" })

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  applicationName: SITE_NAME,
  authors: [{ name: "Shulepoa", url: "https://shulepoa.co.ke" }],
  creator: "Shulepoa",
  publisher: "Shulepoa",
  category: "education",
  alternates: { canonical: "/" },
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: "en_KE",
  },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
  appleWebApp: { capable: true, title: "Shulepoa", statusBarStyle: "default" },
  // Set NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION to the code from Google Search Console.
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
}

export const viewport: Viewport = { themeColor: "#15803d" }

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${jakarta.variable} ${bricolage.variable} font-sans`} suppressHydrationWarning>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}

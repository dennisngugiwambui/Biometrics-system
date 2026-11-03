"use client"

import "./globals.css"
import { ErrorScreen } from "@/components/shared/ErrorScreen"

// Replaces the root layout when the app itself fails, so it brings its own <html>.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <ErrorScreen
          code="500"
          title="Shulepoa hit a problem"
          message="The system couldn’t start this page. Please try again in a moment."
          onRetry={reset}
          detail={error.digest}
        />
      </body>
    </html>
  )
}

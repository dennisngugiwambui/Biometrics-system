"use client"

import { useEffect } from "react"
import { ErrorScreen } from "@/components/shared/ErrorScreen"

// Inside the dashboard: the sidebar stays, only the page area shows the error.
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <ErrorScreen
      inline
      code="Oops"
      title="This page couldn’t load"
      message="Something went wrong showing this page. Your data is safe — try again, or open another page from the menu."
      onRetry={reset}
      detail={error.digest}
    />
  )
}

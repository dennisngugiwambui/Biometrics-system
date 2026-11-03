"use client"

import { useEffect } from "react"
import { ErrorScreen } from "@/components/shared/ErrorScreen"

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <ErrorScreen
      code="500"
      title="Something went wrong"
      message="This page ran into a problem while loading. Try again — if it keeps happening, let support know the reference below."
      onRetry={reset}
      detail={error.digest}
    />
  )
}

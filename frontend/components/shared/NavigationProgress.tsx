"use client"

/**
 * NavigationProgress
 *
 * App Router keeps the old page on screen until the next one is ready, and a
 * sibling route (Students → Teachers) has no loading boundary of its own, so a
 * click looked like it did nothing while the tab spinner turned. This shows
 * that the click registered: a progress bar along the top at once, and a
 * spinner over the content if the page takes longer than a moment. Both clear
 * when the pathname changes.
 *
 * Programmatic navigation can opt in with startNavigation() before router.push.
 */

import { useEffect, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"

const EVENT = "app:navigation-start"

export function startNavigation() {
  window.dispatchEvent(new Event(EVENT))
}

function isInternalNavigation(e: MouseEvent): boolean {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false
  const a = (e.target as Element | null)?.closest?.("a")
  if (!a || !a.href || a.target === "_blank" || a.hasAttribute("download")) return false
  const url = new URL(a.href, window.location.href)
  if (url.origin !== window.location.origin) return false
  // Same page (or only a #hash) — nothing will load.
  return url.pathname + url.search !== window.location.pathname + window.location.search
}

export function NavigationProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, setPending] = useState(false)
  const [slow, setSlow] = useState(false)

  // Arrived: clear.
  useEffect(() => {
    setPending(false)
    setSlow(false)
  }, [pathname, searchParams])

  useEffect(() => {
    const begin = () => setPending(true)
    const onClick = (e: MouseEvent) => { if (isInternalNavigation(e)) begin() }
    document.addEventListener("click", onClick, true)
    window.addEventListener(EVENT, begin)
    return () => {
      document.removeEventListener("click", onClick, true)
      window.removeEventListener(EVENT, begin)
    }
  }, [])

  // Only cover the page when it is actually slow; a fast hop shows just the bar.
  // Give up after 20s so a cancelled navigation never leaves the screen covered.
  useEffect(() => {
    if (!pending) return
    const t = setTimeout(() => setSlow(true), 250)
    const giveUp = setTimeout(() => { setPending(false); setSlow(false) }, 20_000)
    return () => { clearTimeout(t); clearTimeout(giveUp) }
  }, [pending])

  if (!pending) return null
  return (
    <>
      <div className="fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden bg-green-100" role="progressbar" aria-label="Loading page">
        <div className="nav-progress-bar h-full w-1/3 rounded-full bg-green-600" />
      </div>
      {slow && (
        <div className="absolute inset-0 z-40 flex items-start justify-center bg-white/60 backdrop-blur-[1px] dark:bg-gray-950/60" aria-live="polite">
          <div className="sticky top-1/3 mt-32 flex flex-col items-center gap-3 rounded-2xl bg-white px-7 py-5 shadow-lg ring-1 ring-slate-200 dark:bg-gray-900 dark:ring-gray-800">
            <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-green-100 border-t-green-600" />
            <p className="text-xs font-semibold tracking-wide text-slate-500">Loading…</p>
          </div>
        </div>
      )}
    </>
  )
}

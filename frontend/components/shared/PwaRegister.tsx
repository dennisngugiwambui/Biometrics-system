"use client"

/**
 * Makes the site installable as an app (PWA): registers /app-sw.js and keeps
 * the browser's one-time install prompt so the dashboard's "Install app"
 * button can show it later. The installed app is this same site — same
 * sign-in, same per-role pages — just in its own window on the home screen.
 */

import { useEffect, useSyncExternalStore } from "react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

let deferred: BeforeInstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
}

/** "installed" | "available" (Android/desktop Chrome, Edge) | "manual" (iOS Safari, Firefox …) */
export function useInstallState(): "installed" | "available" | "manual" {
  return useSyncExternalStore(
    subscribe,
    () => (installed || isStandalone() ? "installed" : deferred ? "available" : "manual"),
    () => "manual",
  )
}

/** Shows the browser's install dialog. Resolves true when the person accepted. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  const e = deferred
  deferred = null
  notify()
  await e.prompt()
  const { outcome } = await e.userChoice
  return outcome === "accepted"
}

export function PwaRegister() {
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      deferred = e as BeforeInstallPromptEvent
      notify()
    }
    const onInstalled = () => {
      installed = true
      deferred = null
      notify()
    }
    window.addEventListener("beforeinstallprompt", onPrompt)
    window.addEventListener("appinstalled", onInstalled)
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/app-sw.js").catch(() => { /* site still works without it */ })
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])
  return null
}

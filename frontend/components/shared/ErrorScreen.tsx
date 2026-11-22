"use client"

import Link from "next/link"
import { ArrowLeft, Home, RotateCw } from "lucide-react"

/**
 * The one error screen every failure uses (404, a page that crashed, the whole app crashing),
 * laid out like the portal's: the illustration, a big green code, a plain sentence of what
 * happened, and the ways forward.
 */
export function ErrorScreen({
  code,
  title,
  message,
  onRetry,
  homeHref = "/dashboard",
  homeLabel = "Go to dashboard",
  inline = false,
  detail,
}: {
  code: string
  title: string
  message: string
  onRetry?: () => void
  homeHref?: string
  homeLabel?: string
  /** Inside the dashboard (keeps the sidebar) rather than a full page. */
  inline?: boolean
  /** e.g. an error digest to quote to support */
  detail?: string
}) {
  return (
    <main
      className={
        inline
          ? "flex min-h-[70vh] items-center justify-center px-4 py-10"
          : "flex min-h-screen min-h-[100dvh] items-center justify-center bg-gradient-to-b from-green-50/70 via-white to-white px-4 py-12"
      }
    >
      <div className="w-full max-w-lg text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/img/error-boy.png"
          alt=""
          className={inline ? "mx-auto mb-1 w-40 select-none drop-shadow-sm" : "mx-auto mb-2 w-56 select-none drop-shadow-sm sm:w-64"}
          draggable={false}
        />
        <p className="mb-2 text-6xl font-bold tabular-nums tracking-tighter text-green-600 sm:text-7xl" aria-hidden="true">
          {code}
        </p>
        <h1 className="mb-2 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        <p className="mx-auto mb-8 max-w-sm leading-relaxed text-slate-500">{message}</p>

        <div className="flex flex-col-reverse items-stretch justify-center gap-2.5 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? window.history.back() : (window.location.href = homeHref))}
            className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 shadow-[var(--shadow-key-2)] transition-colors hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" /> Go back
          </button>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-green-200 bg-green-50 px-5 text-sm font-semibold text-green-800 transition-colors hover:bg-green-100"
            >
              <RotateCw className="h-4 w-4" /> Try again
            </button>
          )}
          <Link
            href={homeHref}
            className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-[var(--shadow-key)] transition-[filter] hover:brightness-95"
          >
            <Home className="h-4 w-4" /> {homeLabel}
          </Link>
        </div>

        {detail && <p className="mt-6 text-[11px] text-slate-400">Reference: {detail}</p>}
        {!inline && (
          <p className="mt-8 text-xs text-slate-400">
            Still stuck? <Link href="/support" className="font-semibold text-slate-500 hover:underline">Contact support</Link>
          </p>
        )}
      </div>
    </main>
  )
}

"use client"

import Link from "next/link"
import { ArrowLeft, Home, RotateCw } from "lucide-react"

/**
 * The one error screen every failure uses (404, a page that crashed, the whole
 * app crashing), in the Shulepoa sign-in style: a big muted code, a plain
 * sentence of what happened, and the ways forward.
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
      className={inline
        ? "flex min-h-[70vh] items-center justify-center px-4 py-10"
        : "flex min-h-screen min-h-[100dvh] items-center justify-center px-4 py-10"}
      style={inline ? undefined : { background: "linear-gradient(160deg, #f0fdf4 0%, #f4f6f9 55%, #eef2f6 100%)" }}
    >
      <div
        className="w-full max-w-[520px] rounded-3xl bg-white px-6 py-10 text-center sm:px-12"
        style={{ boxShadow: "0 0 0 1px rgb(15 23 42 / 0.05), 0 30px 70px -24px rgb(15 23 42 / 0.22), 0 6px 16px -6px rgb(15 23 42 / 0.08)" }}
      >
        {!inline && (
          <div className="mb-8 flex items-center justify-center gap-2.5">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl text-lg font-black text-white shadow-sm"
              style={{ background: "linear-gradient(135deg, #16a34a, #166534)" }}
            >
              S
            </span>
            <span className="text-[19px] font-extrabold tracking-tight text-slate-900">Shulepoa</span>
          </div>
        )}
        <p className="bg-gradient-to-b from-green-600 to-green-800 bg-clip-text text-7xl font-black tracking-tight text-transparent sm:text-8xl">
          {code}
        </p>
        <h1 className="mt-4 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        <p className="mx-auto mt-2 max-w-[380px] text-sm leading-relaxed text-slate-500">{message}</p>

        <div className="mt-8 flex flex-col-reverse items-stretch justify-center gap-2.5 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? window.history.back() : (window.location.href = homeHref))}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" /> Go back
          </button>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 px-5 text-sm font-semibold text-green-800 transition-colors hover:bg-green-100"
            >
              <RotateCw className="h-4 w-4" /> Try again
            </button>
          )}
          <Link
            href={homeHref}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-green-600 px-5 text-sm font-semibold text-white shadow-sm transition-[filter] hover:brightness-95"
          >
            <Home className="h-4 w-4" /> {homeLabel}
          </Link>
        </div>

        {detail && <p className="mt-6 text-[11px] text-slate-400">Reference: {detail}</p>}
        {!inline && (
          <p className="mt-8 border-t border-slate-100 pt-5 text-xs text-slate-400">
            Still stuck? <Link href="/support" className="font-semibold text-slate-500 hover:underline">Contact support</Link>
          </p>
        )}
      </div>
    </main>
  )
}

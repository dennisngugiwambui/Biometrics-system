"use client"

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"

import { cn } from "@/lib/utils"

export interface PremiumPaginationProps {
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
  label?: string
  pageSize?: number
  /** Drop the footer's own chrome when it sits inside a card that already has one. */
  bare?: boolean
}

function pageWindow(page: number, count: number): (number | "…")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1)
  const set = new Set([1, count, page, page - 1, page + 1])
  if (page <= 3) [2, 3, 4].forEach((n) => set.add(n))
  if (page >= count - 2) [count - 3, count - 2, count - 1].forEach((n) => set.add(n))
  const nums = [...set].filter((n) => n >= 1 && n <= count).sort((a, b) => a - b)
  const out: (number | "…")[] = []
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1] > 1) out.push("…")
    out.push(n)
  })
  return out
}

const NAV =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 active:bg-slate-100 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10"

/** The portal pager: "21–40 of 412 students" on the left, numbered pages on the right. */
export function PremiumPagination({ page, totalPages, total, onPageChange, label = "records", pageSize, bare }: PremiumPaginationProps) {
  const pages = Math.max(1, Number.isFinite(totalPages) ? totalPages : Math.ceil(total / (pageSize || 20)))
  const safe = Math.min(Math.max(1, page), pages)
  const from = total === 0 ? 0 : pageSize ? (safe - 1) * pageSize + 1 : null
  const to = pageSize ? Math.min(safe * pageSize, total) : null

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3", !bare && "data-footer")}>
      <p className="text-xs tabular-nums text-slate-500" aria-live="polite">
        {from !== null && to !== null ? (
          <>
            <span className="font-semibold text-slate-800">
              {from.toLocaleString()}–{to.toLocaleString()}
            </span>{" "}
            of{" "}
          </>
        ) : (
          <>
            Page <span className="font-semibold text-slate-800">{safe}</span> / {pages} ·{" "}
          </>
        )}
        <span className="font-semibold text-slate-800">{total.toLocaleString()}</span> {label}
      </p>

      {pages > 1 ? (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <button onClick={() => onPageChange(1)} disabled={safe === 1} className={cn(NAV, "hidden sm:inline-flex")} aria-label="First page">
            <ChevronsLeft className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onPageChange(safe - 1)} disabled={safe === 1} className={NAV} aria-label="Previous page">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <div className="hidden items-center gap-1 sm:flex">
            {pageWindow(safe, pages).map((n, i) =>
              n === "…" ? (
                <span key={`gap-${i}`} className="w-6 text-center text-xs text-slate-400" aria-hidden="true">
                  …
                </span>
              ) : (
                <button
                  key={n}
                  onClick={() => onPageChange(n)}
                  aria-label={`Page ${n}`}
                  aria-current={n === safe ? "page" : undefined}
                  className={cn(
                    "h-8 w-8 rounded-lg text-xs font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                    n === safe
                      ? "bg-primary text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  {n}
                </button>
              )
            )}
          </div>
          <span className="px-2 text-xs font-semibold tabular-nums text-slate-700 sm:hidden">
            {safe} / {pages}
          </span>
          <button onClick={() => onPageChange(safe + 1)} disabled={safe >= pages} className={NAV} aria-label="Next page">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onPageChange(pages)} disabled={safe >= pages} className={cn(NAV, "hidden sm:inline-flex")} aria-label="Last page">
            <ChevronsRight className="h-3.5 w-3.5" />
          </button>
        </nav>
      ) : null}
    </div>
  )
}

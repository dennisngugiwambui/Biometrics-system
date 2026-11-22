"use client"

import type { ReactNode } from "react"
import { Search, X } from "lucide-react"

import { cn } from "@/lib/utils"

/** The portal list card: toolbar, ruled table, pager, all one white surface. */
export function DataCard({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("data-card", className)}>{children}</section>
}

/** Search box + filters + right-aligned extras, in the card's own top bar. */
export function DataToolbar({
  search,
  onSearch,
  placeholder = "Search…",
  filters,
  right,
  className,
}: {
  search?: string
  onSearch?: (value: string) => void
  placeholder?: string
  filters?: ReactNode
  right?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("data-toolbar", className)}>
      {onSearch ? (
        <label className="relative min-w-[200px] flex-1 basis-64">
          <span className="sr-only">{placeholder}</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search ?? ""}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={placeholder}
            className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-9 text-sm text-slate-900 shadow-[var(--shadow-field)] outline-none transition-[border-color,box-shadow] placeholder:text-slate-400 hover:border-slate-400 focus:border-primary focus:ring-[3px] focus:ring-primary/25"
          />
          {search ? (
            <button
              type="button"
              onClick={() => onSearch("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </label>
      ) : null}
      {filters ? <div className="flex flex-wrap items-center gap-2">{filters}</div> : null}
      {right ? <div className="ml-auto flex flex-wrap items-center gap-2 text-xs text-slate-500">{right}</div> : null}
    </div>
  )
}

/** Scroll box for a wide table: rows scroll, the green header stays put. */
export function DataScroll({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("table-scroll", className)}>{children}</div>
}

const AVATAR_TINTS = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-violet-100 text-violet-700",
  "bg-cyan-100 text-cyan-700",
  "bg-orange-100 text-orange-700",
]

/** Initials avatar for table rows, tinted from the name so rows are easy to tell apart. */
export function InitialsAvatar({ name, className }: { name: string; className?: string }) {
  const parts = name.trim().split(/\s+/)
  const initials = ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase()
  const tint = AVATAR_TINTS[(name.charCodeAt(0) + name.length) % AVATAR_TINTS.length]
  return (
    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold", tint, className)}>
      {initials || "?"}
    </span>
  )
}

/** Soft status pill, same tones as the portal. */
export function StatusPill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "success" | "info" | "warning" | "danger" | "neutral" | "primary"
  children: ReactNode
  className?: string
}) {
  return <span className={cn("pill", `pill-${tone}`, className)}>{children}</span>
}

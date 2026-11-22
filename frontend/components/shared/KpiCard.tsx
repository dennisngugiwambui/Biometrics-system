"use client"

import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export type Tone = "primary" | "success" | "info" | "warning" | "danger" | "neutral"

/** One status vocabulary: a tone is a meaning, never a colour name. */
export const TONES: Record<Tone, { icon: string; ring: string; bar: string; text: string; bg: string }> = {
  primary: { icon: "bg-primary/10 text-primary", ring: "ring-primary/20", bar: "var(--primary)", text: "text-primary", bg: "bg-primary/10" },
  success: { icon: "bg-emerald-50 text-emerald-600", ring: "ring-emerald-200/70", bar: "#10b981", text: "text-emerald-700", bg: "bg-emerald-50" },
  info: { icon: "bg-blue-50 text-blue-600", ring: "ring-blue-200/70", bar: "#3b82f6", text: "text-blue-700", bg: "bg-blue-50" },
  warning: { icon: "bg-amber-50 text-amber-600", ring: "ring-amber-200/70", bar: "#f59e0b", text: "text-amber-700", bg: "bg-amber-50" },
  danger: { icon: "bg-rose-50 text-rose-500", ring: "ring-rose-200/70", bar: "#f43f5e", text: "text-rose-700", bg: "bg-rose-50" },
  neutral: { icon: "bg-slate-100 text-slate-500", ring: "ring-slate-200/70", bar: "#94a3b8", text: "text-slate-600", bg: "bg-slate-100" },
}

/** KPI card: small-caps label, big number, a muted hint or a progress bar. */
export function KpiCard({
  label,
  value,
  unit,
  icon: Icon,
  tone = "primary",
  hint,
  bar,
  className,
}: {
  label: ReactNode
  value: ReactNode
  unit?: string
  icon?: LucideIcon
  tone?: Tone
  hint?: ReactNode
  bar?: { value: number; label?: ReactNode; tone?: Tone }
  className?: string
}) {
  const t = TONES[tone]
  return (
    <div className={cn("card-portal flex min-w-0 flex-col p-3 sm:p-[18px]", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="line-clamp-2 text-[10.5px] font-semibold uppercase leading-snug tracking-[0.06em] text-slate-500 sm:text-[11px] sm:tracking-[0.08em]">{label}</p>
        {Icon ? (
          <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset sm:h-9 sm:w-9 sm:rounded-xl", t.icon, t.ring)}>
            <Icon className="h-[15px] w-[15px] sm:h-[17px] sm:w-[17px]" strokeWidth={2.1} />
          </span>
        ) : null}
      </div>
      <div className="mt-0.5 flex items-baseline gap-1.5 sm:mt-1">
        <span className="text-[22px] font-bold leading-none tracking-tight text-slate-900 tabular-nums sm:text-[28px]">{value ?? "—"}</span>
        {unit ? <span className="text-sm font-semibold text-slate-400">{unit}</span> : null}
      </div>
      {bar ? (
        <div className="mt-2 sm:mt-3.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{ width: `${Math.max(0, Math.min(100, bar.value || 0))}%`, background: TONES[bar.tone ?? tone].bar }}
            />
          </div>
          {bar.label ? <p className="mt-1.5 truncate text-[11.5px] text-slate-500">{bar.label}</p> : null}
        </div>
      ) : hint ? (
        <p className="mt-2 truncate text-[11.5px] text-slate-500 sm:mt-3">{hint}</p>
      ) : null}
    </div>
  )
}

/** Panel: a white card with a 15px title, a muted subtitle and actions on the right. */
export function Panel({
  title,
  subtitle,
  icon: Icon,
  actions,
  children,
  className,
  bodyClassName,
  pad = true,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  icon?: LucideIcon
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  pad?: boolean
}) {
  return (
    <section className={cn("card-portal flex min-w-0 flex-col", className)}>
      {title || actions ? (
        <header className="flex items-start justify-between gap-3 px-4 pb-2 pt-3 sm:px-5 sm:pb-3 sm:pt-4">
          <div className="flex min-w-0 items-start gap-2.5">
            {Icon ? (
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Icon className="h-3.5 w-3.5" />
              </span>
            ) : null}
            <div className="min-w-0">
              <h3 className="text-[14px] font-semibold leading-tight tracking-tight text-slate-900 sm:text-[15px]">{title}</h3>
              {subtitle ? <p className="mt-0.5 text-[12px] leading-snug text-slate-500">{subtitle}</p> : null}
            </div>
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn("min-h-0 flex-1", pad && "px-4 pb-4 sm:px-5 sm:pb-5", bodyClassName)}>{children}</div>
    </section>
  )
}

/** Empty state inside a panel or table card. */
export function PanelEmpty({ icon: Icon, title, hint, action }: { icon?: LucideIcon; title: ReactNode; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-[160px] flex-col items-center justify-center px-4 py-8 text-center">
      {Icon ? (
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-inset ring-slate-200/70">
          <Icon className="h-5 w-5 text-slate-400" />
        </span>
      ) : null}
      <p className="text-[13px] font-semibold text-slate-700">{title}</p>
      {hint ? <p className="mt-1 max-w-xs text-[12px] leading-relaxed text-slate-500">{hint}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  )
}

"use client"

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function EnterprisePage({
  kicker,
  title,
  description,
  actions,
  stats,
  children,
  className,
}: {
  kicker?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  stats?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("page-shell space-y-6 lg:space-y-8", className)}>
      <section className="enterprise-shell p-3 sm:p-4 lg:p-5">
        <div className="enterprise-hero px-5 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-9">
          <div className="enterprise-grid relative z-10">
            <div className="space-y-4">
              {kicker ? (
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/14 bg-white/10 px-3 py-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.18em] text-white/82">
                  {kicker}
                </div>
              ) : null}
              <div className="space-y-3">
                <h1 className="text-[clamp(2rem,4vw,3.4rem)] font-extrabold leading-[0.96] tracking-[-0.04em] text-white">
                  {title}
                </h1>
                {description ? <p className="max-w-3xl text-sm leading-7 text-white/74">{description}</p> : null}
              </div>
              {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
            </div>

            {stats ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">{stats}</div> : null}
          </div>
        </div>
      </section>

      {children}
    </div>
  )
}

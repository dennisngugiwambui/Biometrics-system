"use client"

import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * The portal page header: a brand icon tile, the title, one muted line under
 * it, and the page actions on the right. Phones stack it and give the
 * actions a full-width row.
 */
export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  icon?: LucideIcon
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-3 sm:items-center", className)}>
      <div className="flex min-w-0 flex-1 basis-56 items-center gap-3 sm:gap-3.5">
        {Icon ? (
          <span className="icon-tile h-9 w-9 sm:h-10 sm:w-10" aria-hidden="true">
            <Icon className="h-[17px] w-[17px]" />
          </span>
        ) : null}
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold leading-tight tracking-tight text-slate-900 sm:text-[22px]">{title}</h1>
          {subtitle ? (
            <p className="mt-0.5 line-clamp-1 text-xs leading-snug text-slate-500 sm:line-clamp-none sm:text-[13px]">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end [&>*]:max-sm:flex-1">{actions}</div>
      ) : null}
    </div>
  )
}

"use client"

import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"

export interface PremiumPaginationProps {
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
  label?: string
}

export function PremiumPagination({
  page,
  totalPages,
  total,
  onPageChange,
  label = "records",
}: PremiumPaginationProps) {
  const safePage = Math.min(Math.max(1, page), Math.max(1, totalPages))

  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const p = safePage
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (p > 4) pages.push("ellipsis-start")

      const start = Math.max(2, p - 2)
      const end = Math.min(totalPages - 1, p + 2)

      for (let i = start; i <= end; i++) pages.push(i)

      if (p < totalPages - 3) pages.push("ellipsis-end")
      pages.push(totalPages)
    }
    return pages
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm px-3 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4">
      <p className="text-center text-xs text-muted-foreground sm:text-left">
        Page{" "}
        <span className="font-semibold text-gray-900 dark:text-gray-100">{safePage}</span>
        {" / "}
        <span className="font-semibold text-gray-900 dark:text-gray-100">{totalPages}</span>
        <span className="mx-2 hidden text-gray-300 dark:text-gray-600 sm:inline">·</span>
        <span className="block sm:inline">
          <span className="font-semibold text-gray-700 dark:text-gray-300">{total}</span>{" "}
          {label}
        </span>
      </p>

      <div className="flex items-center justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          className="h-10 min-w-10 rounded-xl border-blue-600 px-3 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 disabled:opacity-40"
        >
          <ChevronLeft className="size-4 sm:mr-1" />
          <span className="hidden text-xs font-semibold sm:inline">Prev</span>
        </Button>

        <div className="hidden sm:flex items-center gap-1">
          {getPageNumbers().map((pageNum, idx) => {
            if (typeof pageNum === "string") {
              return (
                <div key={`${pageNum}-${idx}`} className="px-0.5">
                  <MoreHorizontal className="size-4 text-gray-400" />
                </div>
              )
            }

            const isActive = safePage === pageNum
            return (
              <Button
                key={pageNum}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(pageNum)}
                className={cn(
                  "h-9 min-w-9 rounded-lg p-0 text-xs font-bold transition-all",
                  isActive
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/25 hover:bg-blue-700"
                    : "border-gray-200 dark:border-gray-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                )}
              >
                {pageNum}
              </Button>
            )
          })}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= totalPages}
          className="h-10 min-w-10 rounded-xl border-blue-600 px-3 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 disabled:opacity-40"
        >
          <span className="hidden text-xs font-semibold sm:inline">Next</span>
          <ChevronRight className="size-4 sm:ml-1" />
        </Button>
      </div>
    </div>
  )
}

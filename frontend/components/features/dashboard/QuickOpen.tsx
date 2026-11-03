"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { CornerDownLeft, LayoutGrid, Search } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { ALL_NAV_ITEMS } from "./navigation"

/** "Go to…" on the top bar, or Ctrl+K anywhere: jump to any page by typing. */
export function QuickOpen() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? ALL_NAV_ITEMS.filter((i) => `${i.name} ${i.hint ?? ""}`.toLowerCase().includes(q)) : ALL_NAV_ITEMS
  }, [query])

  const go = (href: string) => {
    setOpen(false)
    setQuery("")
    router.push(href)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden h-9 items-center gap-2 rounded-[10px] border border-border bg-white px-2.5 text-[13px] font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 md:flex"
      >
        <LayoutGrid className="h-3.5 w-3.5 text-primary" />
        Go to…
        <kbd className="ml-1 rounded border border-border bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">Ctrl K</kbd>
      </button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQuery(""); setIndex(0) }}>
        <DialogContent
          showCloseButton={false}
          className="top-[18%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg"
          onOpenAutoFocus={(e) => { e.preventDefault(); inputRef.current?.focus() }}
        >
          <DialogTitle className="sr-only">Go to a page</DialogTitle>
          <DialogDescription className="sr-only">Type a page name, then press Enter.</DialogDescription>
          <div className="flex items-center gap-2.5 border-b border-border px-4">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setIndex(0) }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setIndex((i) => Math.min(i + 1, results.length - 1)) }
                if (e.key === "ArrowUp") { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)) }
                if (e.key === "Enter" && results[index]) go(results[index].href)
              }}
              placeholder="Where to?"
              className="h-12 w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>
          <ul className="max-h-[50vh] overflow-y-auto p-1.5">
            {results.map((item, i) => (
              <li key={item.href}>
                <button
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => go(item.href)}
                  className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${i === index ? "bg-accent" : ""}`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <item.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{item.name}</span>
                    <span className="block truncate text-xs text-slate-500">{item.hint}</span>
                  </span>
                  {i === index && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                </button>
              </li>
            ))}
            {results.length === 0 && <li className="px-3 py-8 text-center text-sm text-slate-500">No page matches “{query}”.</li>}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  )
}

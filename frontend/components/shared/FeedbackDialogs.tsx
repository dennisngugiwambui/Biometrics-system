"use client"

/**
 * The portal's way of telling you something: errors stop the page in a dialog (a corner toast is
 * too easy to miss for "the report could not be built"), results and questions get their own
 * dialogs, quick confirmations stay as toasts.
 *
 *   alertDialog({ title, message, tone })      a message to acknowledge   → Promise<void>
 *   successDialog(message, title?)             a result worth reading      → Promise<void>
 *   confirmDialog({ title, message, ... })     a question                  → Promise<boolean>
 *   installErrorDialog()                       points sonner's toast.error here, so every
 *                                              existing toast.error(...) becomes a dialog.
 *                                              toast.error(msg, { asToast: true }) keeps a toast.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { AlertTriangle, CheckCircle2, Info, ShieldQuestion } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"

type Tone = "danger" | "warning" | "success" | "info"

interface DialogOptions {
  title?: string
  message: ReactNode
  tone?: Tone
  okLabel?: string
}
interface ConfirmOptions {
  title?: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: "danger" | "primary"
}

type Item =
  | { id: number; kind: "alert"; opts: DialogOptions; resolve: () => void }
  | { id: number; kind: "confirm"; opts: ConfirmOptions; resolve: (ok: boolean) => void }

let push: ((item: Omit<Item, "id">) => void) | null = null

export function alertDialog(o: string | DialogOptions): Promise<void> {
  const opts = typeof o === "string" ? { message: o } : o
  return new Promise((resolve) => {
    if (!push) {
      window.alert([opts.title, typeof opts.message === "string" ? opts.message : ""].filter(Boolean).join("\n\n"))
      resolve()
      return
    }
    push({ kind: "alert", opts, resolve })
  })
}

export const successDialog = (message: ReactNode, title = "Done") => alertDialog({ title, message, tone: "success" })

export function confirmDialog(o: string | ConfirmOptions): Promise<boolean> {
  const opts = typeof o === "string" ? { message: o } : o
  return new Promise((resolve) => {
    if (!push) {
      resolve(window.confirm(typeof opts.message === "string" ? opts.message : "Are you sure?"))
      return
    }
    push({ kind: "confirm", opts, resolve })
  })
}

let installed = false
/** Every toast.error(...) in the app becomes a dialog; `{ asToast: true }` opts one out. */
export function installErrorDialog() {
  if (installed) return
  installed = true
  const native = toast.error.bind(toast)
  ;(toast as unknown as { error: unknown }).error = (message: ReactNode, opts?: { id?: string | number; asToast?: boolean; duration?: number }) => {
    if (opts?.asToast) return native(message as string, opts as never)
    if (opts?.id !== undefined) toast.dismiss(opts.id)
    void alertDialog({ message })
    return opts?.id ?? "alert-dialog"
  }
}

const TONES: Record<Tone, { icon: typeof Info; ring: string; bg: string; fg: string; title: string }> = {
  danger: { icon: AlertTriangle, ring: "ring-rose-200/60", bg: "bg-rose-50", fg: "text-rose-600", title: "Something went wrong" },
  warning: { icon: AlertTriangle, ring: "ring-amber-200/60", bg: "bg-amber-50", fg: "text-amber-600", title: "Please note" },
  success: { icon: CheckCircle2, ring: "ring-emerald-200/60", bg: "bg-emerald-50", fg: "text-emerald-600", title: "Done" },
  info: { icon: Info, ring: "ring-blue-200/60", bg: "bg-blue-50", fg: "text-blue-600", title: "Note" },
}

export function FeedbackRoot() {
  const [items, setItems] = useState<Item[]>([])
  const nextId = useRef(1)
  const okRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    push = (item) => setItems((cur) => [...cur, { ...item, id: nextId.current++ } as Item])
    return () => { push = null }
  }, [])

  const current = items[0]
  const close = useCallback((ok: boolean) => {
    setItems((cur) => {
      const [first, ...rest] = cur
      if (first) { if (first.kind === "confirm") first.resolve(ok); else first.resolve() }
      return rest
    })
  }, [])

  useEffect(() => {
    if (!current) return
    okRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(false) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [current, close])

  if (!current) return null

  const isConfirm = current.kind === "confirm"
  const tone: Tone = isConfirm ? (current.opts.tone === "danger" ? "danger" : "info") : (current.opts as DialogOptions).tone ?? "danger"
  const t = TONES[tone]
  const Icon = isConfirm && tone === "info" ? ShieldQuestion : t.icon
  const title = current.opts.title ?? (isConfirm ? "Are you sure?" : t.title)

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[3px]" onMouseDown={(e) => { if (e.target === e.currentTarget && !isConfirm) close(false) }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="fb-title" className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-[0_24px_64px_-16px_rgb(15_23_42/0.4)]">
        <span className={cn("mx-auto flex h-14 w-14 items-center justify-center rounded-full ring-8", t.bg, t.fg, t.ring)}>
          <Icon className="h-7 w-7" />
        </span>
        <h2 id="fb-title" className="mt-4 text-[17px] font-bold tracking-tight text-slate-900">{title}</h2>
        <div className="mt-1.5 text-sm leading-relaxed text-slate-600">{current.opts.message}</div>
        <div className={cn("mt-6 grid gap-2", isConfirm ? "grid-cols-2" : "grid-cols-1")}>
          {isConfirm && (
            <button type="button" onClick={() => close(false)} className="h-10 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 shadow-[var(--shadow-key-2)] transition-colors hover:bg-slate-50">
              {current.opts.cancelLabel ?? "Cancel"}
            </button>
          )}
          <button
            ref={okRef}
            type="button"
            onClick={() => close(true)}
            className={cn(
              "h-10 rounded-xl text-sm font-semibold text-white transition-[filter] hover:brightness-95",
              isConfirm && (current.opts as ConfirmOptions).tone === "danger" ? "bg-rose-600" : "bg-primary shadow-[var(--shadow-key)]"
            )}
          >
            {isConfirm ? ((current.opts as ConfirmOptions).confirmLabel ?? "Yes, continue") : ((current.opts as DialogOptions).okLabel ?? "OK")}
          </button>
        </div>
      </div>
    </div>
  )
}

"use client"

import type React from "react"
import { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, Link2Off, Loader2, Lock } from "lucide-react"
import AuthLayout from "@/components/auth/AuthLayout"
import { authButtonCls, authInputCls, authLabelCls, authLinkCls } from "@/components/auth/formStyles"
import { useSchoolBrandingStore } from "@/lib/store/schoolBrandingStore"
import { resetPassword, verifyResetToken } from "@/lib/api/passwordReset"

/**
 * Step 2 of "Forgot password?": the page the emailed link opens.
 * It checks the link first, then lets the user choose a new password.
 */
export default function ResetPasswordPage() {
  const { schoolName, logoDataUrl } = useSchoolBrandingStore()
  const displayName = schoolName && schoolName !== "SchoolAdmin" ? schoolName : "Shulepoa Attendance"
  return (
    <AuthLayout
      brandName={displayName}
      logoUrl={logoDataUrl}
      headline="Choose a new password."
      sub="Pick something you haven't used here before. You'll sign in with it straight away."
      footer={<span>© {new Date().getFullYear()} Shulepoa Attendance</span>}
    >
      <Suspense fallback={<Checking />}>
        <ResetFlow />
      </Suspense>
    </AuthLayout>
  )
}

function Checking() {
  return (
    <div className="flex flex-col items-center py-10 text-center text-slate-500" role="status">
      <Loader2 className="mb-3 h-7 w-7 animate-spin text-[var(--auth-600)]" />
      <p className="text-sm">Checking your reset link…</p>
    </div>
  )
}

function strength(pw: string): { score: number; label: string } {
  let s = 0
  if (pw.length >= 8) s++
  if (pw.length >= 12) s++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++
  if (/\d/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  const score = Math.min(4, s)
  return { score, label: ["Too short", "Weak", "Fair", "Good", "Strong"][score] }
}

function ResetFlow() {
  const router = useRouter()
  const token = useSearchParams().get("token") ?? ""

  const [state, setState] = useState<"checking" | "invalid" | "form" | "done">(token ? "checking" : "invalid")
  const [linkError, setLinkError] = useState(token ? "" : "This page needs the link from your reset email.")
  const [accountEmail, setAccountEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!token) return
    let alive = true
    verifyResetToken(token)
      .then((email) => { if (alive) { setAccountEmail(email); setState("form") } })
      .catch((err: Error) => { if (alive) { setLinkError(err.message); setState("invalid") } })
    return () => { alive = false }
  }, [token])

  // After success, head to sign-in on its own.
  useEffect(() => {
    if (state !== "done") return
    const t = setTimeout(() => router.replace("/login"), 4000)
    return () => clearTimeout(t)
  }, [state, router])

  const meter = useMemo(() => strength(password), [password])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const pw = password.trim()
    if (pw.length < 4) return setError("Use at least 4 characters (8 or more is better).")
    if (pw !== confirm.trim()) return setError("The two passwords don't match.")
    setBusy(true)
    setError("")
    try {
      await resetPassword(token, pw)
      setState("done")
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not change the password."
      if (/link/i.test(msg)) { setLinkError(msg); setState("invalid") } else setError(msg)
    } finally {
      setBusy(false)
    }
  }

  if (state === "checking") return <Checking />

  if (state === "invalid") {
    return (
      <div className="auth-rise text-center" role="alert">
        <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 ring-8 ring-rose-50/50">
          <Link2Off className="h-8 w-8 text-rose-500" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Link not valid</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{linkError}</p>
        <Link href="/forgot-password" className={`${authButtonCls} mt-7`}>Send me a new link</Link>
        <Link href="/login" className="mt-4 inline-block text-[13px] font-medium text-slate-500 hover:text-slate-800 hover:underline underline-offset-2">
          Back to sign in
        </Link>
      </div>
    )
  }

  if (state === "done") {
    return (
      <div className="auth-rise text-center" role="status">
        <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--auth-100)] ring-8 ring-[var(--auth-50)]">
          <CheckCircle2 className="h-8 w-8 text-[var(--auth-700)]" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Password changed</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          You can now sign in with your new password. Taking you to sign in…
        </p>
        <Link href="/login" className={`${authButtonCls} mt-7`}>Sign in now</Link>
      </div>
    )
  }

  const meterColor = ["bg-rose-400", "bg-rose-400", "bg-amber-400", "bg-[var(--auth-500)]", "bg-[var(--auth-600)]"][meter.score]

  return (
    <>
      <div className="auth-rise mb-6 [animation-delay:.2s]">
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-slate-900">Set a new password</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          For <span className="font-semibold text-slate-700">{accountEmail}</span>
        </p>
      </div>

      {error && (
        <div key={error} role="alert"
          className="auth-shake mb-5 flex items-start gap-2.5 rounded-xl border border-rose-200 border-l-[3px] border-l-rose-500 bg-rose-50 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" aria-hidden="true" />
          <p className="text-sm leading-snug text-rose-700">{error}</p>
        </div>
      )}

      <form onSubmit={submit} noValidate className="auth-rise space-y-4 [animation-delay:.3s]">
        <div>
          <label htmlFor="new-password" className={authLabelCls}>New password</label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id="new-password" type={show ? "text" : "password"} autoComplete="new-password" autoFocus
              value={password} disabled={busy}
              onChange={(e) => { setPassword(e.target.value); setError("") }}
              placeholder="At least 8 characters" className={authInputCls}
            />
            <button type="button" onClick={() => setShow(!show)}
              aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}
              className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {password && (
            <div className="mt-2 flex items-center gap-2" aria-live="polite">
              <div className="flex flex-1 gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= Math.max(1, meter.score) ? meterColor : "bg-slate-200"}`} />
                ))}
              </div>
              <span className="w-16 text-right text-[11.5px] font-medium text-slate-500">{meter.label}</span>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="confirm-password" className={authLabelCls}>Confirm new password</label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id="confirm-password" type={show ? "text" : "password"} autoComplete="new-password"
              value={confirm} disabled={busy}
              onChange={(e) => { setConfirm(e.target.value); setError("") }}
              placeholder="Type it again" className={authInputCls}
            />
          </div>
        </div>

        <button type="submit" disabled={busy} className={`${authButtonCls} !mt-6`}>
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : "Change password"}
        </button>
      </form>

      <p className="auth-rise mt-6 border-t border-slate-100 pt-5 text-center text-[13px] text-slate-500 [animation-delay:.4s]">
        <Link href="/login" className={authLinkCls}>Back to sign in</Link>
      </p>
    </>
  )
}

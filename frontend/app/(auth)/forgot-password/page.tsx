"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { Mail, ArrowLeft, Loader2, AlertCircle, MailCheck, Send } from "lucide-react"
import AuthLayout from "@/components/auth/AuthLayout"
import { authButtonCls, authInputCls, authLabelCls, authLinkCls } from "@/components/auth/formStyles"
import { useSchoolBrandingStore } from "@/lib/store/schoolBrandingStore"
import { requestPasswordReset } from "@/lib/api/passwordReset"

/**
 * Step 1 of "Forgot password?": ask for the account email and have the server
 * email a one-time reset link. The answer is the same whether or not the email
 * has an account (see backend password_reset_service.py).
 */
export default function ForgotPasswordPage() {
  const { schoolName, logoDataUrl } = useSchoolBrandingStore()
  const displayName = schoolName && schoolName !== "SchoolAdmin" ? schoolName : "Shulepoa Attendance"

  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [sent, setSent] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const value = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("Enter the email address you sign in with.")
      return
    }
    setBusy(true)
    setError("")
    try {
      setSent(await requestPasswordReset(value))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the reset email.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      brandName={displayName}
      logoUrl={logoDataUrl}
      headline="Locked out? It happens."
      sub="We'll email you a secure link to choose a new password. It works once, for 30 minutes."
      footer={<span>© {new Date().getFullYear()} Shulepoa Attendance</span>}
    >
      {sent ? (
        <div className="auth-rise text-center" role="status">
          <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--auth-100)] ring-8 ring-[var(--auth-50)]">
            <MailCheck className="h-8 w-8 text-[var(--auth-700)]" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Check your email</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{sent}</p>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
            Sent to <span className="font-semibold text-slate-700">{email.trim().toLowerCase()}</span>.
            The link works once, for 30 minutes.
          </p>
          <Link href="/login" className={`${authButtonCls} mt-7`}>
            <ArrowLeft className="h-4 w-4" />Back to sign in
          </Link>
          <button
            type="button"
            onClick={() => setSent(null)}
            className="mt-4 text-[13px] font-medium text-slate-500 hover:text-slate-800 hover:underline underline-offset-2"
          >
            Didn&apos;t get it? Try again
          </button>
        </div>
      ) : (
        <>
          <div className="auth-rise mb-6 [animation-delay:.25s]">
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-slate-900">Forgot your password?</h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Enter the email you sign in with and we&apos;ll send you a reset link.
            </p>
          </div>

          {error && (
            <div key={error} role="alert"
              className="auth-shake mb-5 flex items-start gap-2.5 rounded-xl border border-rose-200 border-l-[3px] border-l-rose-500 bg-rose-50 px-4 py-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" aria-hidden="true" />
              <p className="text-sm leading-snug text-rose-700">{error}</p>
            </div>
          )}

          <form onSubmit={submit} noValidate className="auth-rise space-y-5 [animation-delay:.35s]">
            <div>
              <label htmlFor="email" className={authLabelCls}>Email address</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  id="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none"
                  spellCheck={false} autoFocus disabled={busy}
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError("") }}
                  placeholder="admin@yourschool.ac.ke"
                  className={authInputCls}
                />
              </div>
            </div>

            <button type="submit" disabled={busy} className={authButtonCls}>
              {busy
                ? <><Loader2 className="h-4 w-4 animate-spin" />Sending…</>
                : <><Send className="h-4 w-4" />Email me a reset link</>}
            </button>
          </form>

          <p className="auth-rise mt-6 border-t border-slate-100 pt-5 text-center text-[13px] text-slate-500 [animation-delay:.45s]">
            Remembered it?{" "}
            <Link href="/login" className={authLinkCls}>Back to sign in</Link>
          </p>
        </>
      )}
    </AuthLayout>
  )
}

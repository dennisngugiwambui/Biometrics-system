"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck } from "lucide-react"
import { AuthShell, authIconCls, authInputCls, authLabelCls } from "@/components/features/auth/AuthShell"
import { platformApi, PlatformError } from "@/lib/api/platform"
import { usePlatformAuthStore } from "@/lib/store/platformAuthStore"

export default function ManagementLoginPage() {
  const router = useRouter()
  const { token, hasHydrated, signIn } = usePlatformAuthStore()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (hasHydrated && token) router.replace("/management")
  }, [hasHydrated, token, router])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setBusy(true)
    try {
      const s = await platformApi.login(email.trim(), password)
      signIn({ token: s.access_token, email: s.email, fullName: s.full_name, mustChangePassword: s.must_change_password })
      router.replace("/management")
    } catch (err) {
      setError(err instanceof PlatformError ? err.message : "Sign-in failed")
      setBusy(false)
    }
  }

  return (
    <AuthShell
      badge="Management"
      headline="Every school, one console."
      sub="Onboard schools, grant and renew licences, issue certificates and send each school its sign-in details."
      footer={<>© {new Date().getFullYear()} Shulepoa · Platform owner access only</>}
    >
      <div className="mb-7 flex flex-col items-center text-center">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-2xl"
          style={{ background: "#15803d" }}
        >
          <ShieldCheck className="h-9 w-9 text-white" />
        </div>
        <p className="mt-3 text-lg font-bold leading-none tracking-tight text-slate-900">Shulepoa Management</p>
        <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">Platform owner console</p>
      </div>

      <div className="mb-6 border-t border-slate-100" />

      <div className="mb-6">
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-slate-900">Sign in</h1>
        <p className="mt-1.5 text-sm text-slate-500">Use the platform owner account.</p>
      </div>

      {error && (
        <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-200 border-l-[3px] border-l-rose-500 bg-rose-50 px-4 py-3">
          <AlertCircle className="mt-0.5 h-[15px] w-[15px] shrink-0 text-rose-500" aria-hidden="true" />
          <p className="text-sm leading-snug text-rose-700">{error}</p>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4" autoComplete="on">
        <div>
          <label htmlFor="pemail" className={authLabelCls}>Email address</label>
          <div className="relative">
            <Mail className={authIconCls} aria-hidden="true" />
            <input id="pemail" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required
              value={email} onChange={(e) => { setEmail(e.target.value); setError("") }}
              placeholder="attedance@shulepoa.co.ke" disabled={busy} className={authInputCls} />
          </div>
        </div>
        <div>
          <label htmlFor="ppass" className={authLabelCls}>Password</label>
          <div className="relative">
            <Lock className={authIconCls} aria-hidden="true" />
            <input id="ppass" type={show ? "text" : "password"} autoComplete="current-password" required
              value={password} onChange={(e) => { setPassword(e.target.value); setError("") }}
              placeholder="••••••••" disabled={busy} className={authInputCls} />
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}
              className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <button type="submit" disabled={busy}
          className="mt-1 flex h-11 w-full items-center justify-center gap-2.5 rounded-xl bg-green-600 text-sm font-semibold text-white shadow-sm transition-[filter,transform] duration-150 hover:brightness-95 enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60">
          {busy
            ? <><span className="h-[15px] w-[15px] animate-spin rounded-full border-2 border-white/30 border-t-white" />Signing in…</>
            : <><span>Sign in</span><ArrowRight className="h-[15px] w-[15px]" /></>}
        </button>
      </form>

      <p className="mt-6 border-t border-slate-100 pt-5 text-center text-xs leading-relaxed text-slate-400">
        School staff sign in at <a href="/login" className="font-semibold text-green-700 hover:underline">the school login</a>.
      </p>
    </AuthShell>
  )
}

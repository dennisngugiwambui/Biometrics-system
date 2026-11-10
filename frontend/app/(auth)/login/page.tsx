"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Mail, Lock, Eye, EyeOff, AlertCircle, ServerOff, ArrowRight, Loader2,
} from "lucide-react"
import Link from "next/link"
import { login, LoginError, type UserResponse } from "@/lib/api/auth"
import { useAuthStore } from "@/lib/store/authStore"
import { useSchoolBrandingStore } from "@/lib/store/schoolBrandingStore"
import { decodeJwtPayload } from "@/lib/utils/jwt"
import { toast } from "sonner"
import AuthLayout from "@/components/auth/AuthLayout"
import { authInputCls, authLabelCls } from "@/components/auth/formStyles"

const inputCls = authInputCls
const labelCls = authLabelCls

export default function LoginPage() {
  const router = useRouter()
  const { login: setAuth } = useAuthStore()
  const { schoolName, logoDataUrl } = useSchoolBrandingStore()

  const [rawEmail, setEmail]                = useState("")
  const [password, setPassword]             = useState("")
  const [showPassword, setShowPassword]     = useState(false)
  const [isLoading, setIsLoading]           = useState(false)
  const [error, setError]                   = useState("")
  const [isServiceError, setIsServiceError] = useState(false)
  const [rememberMe, setRememberMe]         = useState(false)

  const displayName = schoolName && schoolName !== "SchoolAdmin" ? schoolName : "School Admin"

  useEffect(() => {
    if (typeof window !== "undefined") {
      const msg = sessionStorage.getItem("session_expired_message")
      if (msg) {
        toast.error(msg, { duration: 5000 })
        sessionStorage.removeItem("session_expired_message")
      }
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsServiceError(false)
    const email = rawEmail.trim().toLowerCase()
    if (!email || !password) { setError("Please fill in all fields"); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address"); return
    }
    setIsLoading(true)
    try {
      const tokenResponse = await login({ email, password })
      const payload = decodeJwtPayload<{
        sub?: string; email?: string; first_name?: string
        last_name?: string; school_id?: number; role?: string
      }>(tokenResponse.access_token)
      const user: UserResponse = {
        id: payload?.sub ? parseInt(payload.sub, 10) : 0,
        email: payload?.email || email,
        first_name: payload?.first_name || "",
        last_name: payload?.last_name || "",
        role: payload?.role || "school_admin",
        school_id: payload?.school_id || 0,
        is_active: true,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: null,
      }
      setAuth(tokenResponse.access_token, user, tokenResponse.refresh_token ?? null)
      router.push("/dashboard")
    } catch (err: unknown) {
      setIsLoading(false)
      if (err instanceof LoginError) {
        const msg = err.message
        const isConnErr =
          msg.toLowerCase().includes("service timeout") ||
          msg.toLowerCase().includes("service unavailable") ||
          msg.toLowerCase().includes("unable to connect") ||
          msg.toLowerCase().includes("network error") ||
          msg.toLowerCase().includes("econnrefused")
        setIsServiceError(isConnErr)
        setError(isConnErr ? "Cannot reach the backend. Please ensure the server is running." : msg)
      } else {
        setError(err instanceof Error ? err.message : "An unexpected error occurred.")
      }
    }
  }

  return (
    <AuthLayout
      brandName={displayName}
      logoUrl={logoDataUrl}
      headline="Every check-in, captured in real time."
      sub="Fingerprint attendance for learners and staff — live from every device, with parents notified the moment their child arrives."
      footer={
        <span className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <span>© {new Date().getFullYear()} School Biometric System</span>
          <span aria-hidden="true">·</span>
          <Link href="/support" className="hover:text-slate-700 transition-colors">Contact Support</Link>
          <span aria-hidden="true" className="hidden sm:inline">·</span>
          <span className="hidden sm:inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 auth-twinkle" />Secure · Always on
          </span>
        </span>
      }
    >
      {/* Heading */}
      <div className="auth-rise mb-6 [animation-delay:.25s]">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-tight">Welcome back 👋</h1>
        <p className="text-slate-500 text-sm mt-1.5">Sign in to continue to your attendance portal.</p>
      </div>

      {/* Error */}
      {error && (
        <div
          key={error}
          role="alert"
          className="auth-shake mb-5 flex items-start gap-2.5 rounded-xl px-4 py-3 bg-rose-50 border border-rose-200 border-l-[3px] border-l-rose-500"
        >
          {isServiceError
            ? <ServerOff className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" aria-hidden="true" />
            : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" aria-hidden="true" />}
          <p className="text-sm leading-snug text-rose-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth-rise space-y-4 [animation-delay:.35s]" autoComplete="on">
        {/* Email */}
        <div>
          <label htmlFor="email" className={labelCls}>Email address</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              value={rawEmail}
              onChange={(e) => { setEmail(e.target.value); setError("") }}
              placeholder="admin@yourschool.ac.ke"
              disabled={isLoading}
              required
              className={inputCls}
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className={labelCls}>Password</label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError("") }}
              placeholder="••••••••"
              disabled={isLoading}
              required
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 -mt-1">
          <label className="flex cursor-pointer items-center gap-2 select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-[var(--auth-600)]"
            />
            <span className="text-[13px] text-slate-600">Keep me signed in</span>
          </label>
          <Link href="/forgot-password" className="text-[12.5px] font-semibold text-[var(--auth-700)] hover:underline underline-offset-2">
            Forgot password?
          </Link>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="group mt-1 flex h-12 lg:h-11 w-full items-center justify-center gap-2.5 rounded-xl text-[15px] lg:text-sm font-semibold text-white bg-[var(--auth-600)] transition-[filter,transform] duration-150 hover:brightness-95 enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--auth-600)]"
          style={{ boxShadow: "0 1px 2px rgb(15 23 42 / 0.15), 0 8px 18px -6px rgb(22 163 74 / 0.6), inset 0 1px 0 rgb(255 255 255 / 0.15)" }}
        >
          {isLoading ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Signing in…</>
          ) : (
            <>Sign in<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>
          )}
        </button>
      </form>

      <p className="auth-rise text-[13px] text-slate-500 text-center leading-relaxed mt-6 pt-5 border-t border-slate-100 [animation-delay:.45s]">
        New to the platform?{" "}
        <Link href="/register" className="font-semibold text-[var(--auth-700)] hover:underline underline-offset-2">
          Register your school
        </Link>
      </p>
    </AuthLayout>
  )
}

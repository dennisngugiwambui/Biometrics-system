"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Mail, Lock, Eye, EyeOff, AlertCircle, ServerOff, ArrowRight, Fingerprint } from "lucide-react"
import Link from "next/link"
import { login, LoginError, type UserResponse } from "@/lib/api/auth"
import { useAuthStore } from "@/lib/store/authStore"
import { useSchoolBrandingStore } from "@/lib/store/schoolBrandingStore"
import { decodeJwtPayload } from "@/lib/utils/jwt"
import { toast } from "sonner"
import { AuthShell, authIconCls as iconCls, authInputCls as inputCls, authLabelCls as labelCls } from "@/components/features/auth/AuthShell"

// Shulepoa green, as on portal.shulepoa.co.ke
const ACCENT = "#15803d"

export default function LoginPage() {
  const router = useRouter()
  const { login: setAuth } = useAuthStore()
  const { schoolName, logoDataUrl } = useSchoolBrandingStore()

  const [email, setEmail]                   = useState("")
  const [password, setPassword]             = useState("")
  const [showPassword, setShowPassword]     = useState(false)
  const [isLoading, setIsLoading]           = useState(false)
  const [error, setError]                   = useState("")
  const [isServiceError, setIsServiceError] = useState(false)

  const hasSchool = !!schoolName && schoolName !== "SchoolAdmin"

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
    <AuthShell
      badge="Attendance"
      headline="Every arrival, accounted for."
      sub="Fingerprint and card check-ins, live class registers and instant parent alerts — from the gate to the office."
      footer={<>© {new Date().getFullYear()} Shulepoa · Secure · Always on · Biometric attendance</>}
    >
      {/* School identity */}
      <div className="mb-7 flex flex-col items-center text-center">
        {logoDataUrl ? (
          <div
            className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-white"
            style={{ boxShadow: "0 4px 16px rgba(0,0,0,.1), 0 0 0 1px rgba(0,0,0,.06)" }}
          >
            <img src={logoDataUrl} alt={hasSchool ? schoolName : "School logo"} className="h-full w-full object-contain p-1" />
          </div>
        ) : (
          <div
            className="flex h-20 w-20 items-center justify-center rounded-2xl"
            style={{ background: "#15803d" }}
          >
            <Fingerprint className="h-9 w-9 text-white" />
          </div>
        )}
        <p className="mt-3 text-lg font-bold leading-none tracking-tight text-slate-900">
          {hasSchool ? schoolName : "Shulepoa Attendance"}
        </p>
        <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
          Biometric Attendance Platform
        </p>
      </div>

      <div className="mb-6 border-t border-slate-100" />

      <div className="mb-6">
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-slate-900">Welcome back</h1>
        <p className="mt-1.5 text-sm text-slate-500">Sign in to continue to your dashboard.</p>
      </div>

      {/* Error */}
      {error && (
        <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-200 border-l-[3px] border-l-rose-500 bg-rose-50 px-4 py-3">
          {isServiceError
            ? <ServerOff className="mt-0.5 h-[15px] w-[15px] shrink-0 text-rose-500" aria-hidden="true" />
            : <AlertCircle className="mt-0.5 h-[15px] w-[15px] shrink-0 text-rose-500" aria-hidden="true" />
          }
          <p className="text-sm leading-snug text-rose-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
        <div>
          <label htmlFor="email" className={labelCls}>Email address</label>
          <div className="relative">
            <Mail className={iconCls} aria-hidden="true" />
            <input
              id="email"
              type="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError("") }}
              placeholder="admin@school.ac.ke"
              disabled={isLoading}
              required
              aria-invalid={error && !isServiceError ? true : undefined}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className={labelCls}>Password</label>
          <div className="relative">
            <Lock className={iconCls} aria-hidden="true" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError("") }}
              placeholder="••••••••"
              disabled={isLoading}
              required
              aria-invalid={error && !isServiceError ? true : undefined}
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="mt-1 flex h-11 w-full items-center justify-center gap-2.5 rounded-xl text-sm font-semibold text-white transition-[filter,box-shadow,transform] duration-150 hover:brightness-95 enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{
            background: ACCENT,
            boxShadow: `0 1px 2px rgb(15 23 42 / 0.15), 0 6px 14px -6px ${ACCENT}99, inset 0 1px 0 rgb(255 255 255 / 0.15)`,
            outlineColor: ACCENT,
          }}
        >
          {isLoading ? (
            <>
              <span className="h-[15px] w-[15px] animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Signing in…
            </>
          ) : (
            <>
              <span>Sign in</span>
              <ArrowRight className="h-[15px] w-[15px]" />
            </>
          )}
        </button>
      </form>

      <p className="mt-5 text-center text-[11px] leading-relaxed text-slate-500">
        School administrators and teachers sign in with their school email.
      </p>

      <p className="mt-6 border-t border-slate-100 pt-5 text-center text-xs leading-relaxed text-slate-400">
        New school?{" "}
        <Link href="/register" className="font-semibold text-green-700 underline-offset-2 hover:text-green-800 hover:underline">
          Register your school
        </Link>
        {" "}· Forgotten credentials?{" "}
        <Link href="/support" className="font-semibold text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline">
          Contact support
        </Link>
      </p>
    </AuthShell>
  )
}


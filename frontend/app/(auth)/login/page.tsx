"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Mail, Lock, Eye, EyeOff, School, AlertCircle, ServerOff,
  ArrowRight, Fingerprint, ClipboardCheck, Users, Wifi,
} from "lucide-react"
import Link from "next/link"
import { login, LoginError, type UserResponse } from "@/lib/api/auth"
import { useAuthStore } from "@/lib/store/authStore"
import { useSchoolBrandingStore } from "@/lib/store/schoolBrandingStore"
import { decodeJwtPayload } from "@/lib/utils/jwt"
import { toast } from "sonner"

const FEATURES = [
  { icon: Fingerprint,    text: "Biometric Auth" },
  { icon: ClipboardCheck, text: "Live Attendance" },
  { icon: Users,          text: "Student Management" },
  { icon: Wifi,           text: "Real-time Sync" },
]

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
    <div
      className="relative min-h-screen flex flex-col items-center justify-center px-4 py-12 overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0c0f1e 0%, #111827 40%, #0c1a35 100%)" }}
    >
      {/* Background glow effects */}
      <div
        className="pointer-events-none absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full opacity-[0.12]"
        style={{ background: "radial-gradient(circle, #3b82f6, transparent 65%)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full opacity-[0.08]"
        style={{ background: "radial-gradient(circle, #6366f1, transparent 65%)" }}
      />
      {/* Subtle dot grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Brand header */}
      <div className="relative z-10 flex flex-col items-center mb-8">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl shadow-xl mb-4 overflow-hidden"
          style={{ background: "linear-gradient(135deg, #2563eb, #1d4ed8)", boxShadow: "0 8px 32px rgba(37,99,235,0.45)" }}
        >
          {logoDataUrl
            ? <img src={logoDataUrl} alt="Logo" className="h-full w-full object-cover" />
            : <School className="h-8 w-8 text-white" />
          }
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight">{displayName}</h1>
        <p className="mt-1 text-sm" style={{ color: "rgba(147,197,253,0.65)" }}>Biometric Management Portal</p>
      </div>

      {/* Login card */}
      <div
        className="relative z-10 w-full max-w-md rounded-2xl bg-white p-8 sm:p-10"
        style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)" }}
      >
        {/* Card heading */}
        <div className="mb-7">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Welcome back</h2>
          <p className="mt-1.5 text-sm text-gray-500">Sign in to your administrator account</p>
        </div>

        {/* Error */}
        {error && (
          <div
            className="mb-6 flex items-start gap-3 rounded-xl px-4 py-3.5"
            style={{ background: "#fef2f2", border: "1px solid #fecaca" }}
          >
            {isServiceError
              ? <ServerOff className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            }
            <p className="text-sm leading-snug text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">
              Email address
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError("") }}
                placeholder="admin@yourschool.edu"
                disabled={isLoading}
                required
                style={{ boxShadow: "none" }}
                className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50/80 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-all duration-150 focus:border-blue-500 focus:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.12)")}
                onBlur={(e)  => (e.currentTarget.style.boxShadow = "none")}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium text-gray-700">Password</label>
              <Link href="/forgot-password" className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError("") }}
                placeholder="Enter your password"
                disabled={isLoading}
                required
                style={{ boxShadow: "none" }}
                className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50/80 pl-10 pr-11 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-all duration-150 focus:border-blue-500 focus:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.12)")}
                onBlur={(e)  => (e.currentTarget.style.boxShadow = "none")}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 transition-colors hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Remember me */}
          <label className="flex cursor-pointer items-center gap-2.5 select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 accent-blue-600"
            />
            <span className="text-sm text-gray-600">Keep me signed in for 30 days</span>
          </label>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-all duration-150 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
              boxShadow: "0 4px 16px rgba(37,99,235,0.4), 0 1px 3px rgba(37,99,235,0.3)",
            }}
          >
            {isLoading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Verifying credentials…
              </>
            ) : (
              <>
                Sign in to Dashboard
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Divider + register */}
        <div className="mt-7 border-t border-gray-100 pt-6">
          <p className="text-center text-sm text-gray-500">
            New to the platform?{" "}
            <Link href="/register" className="font-semibold text-blue-600 hover:text-blue-700 transition-colors">
              Register your school
            </Link>
          </p>
        </div>
      </div>

      {/* Feature chips */}
      <div className="relative z-10 mt-8 grid w-full max-w-md grid-cols-2 gap-2.5">
        {FEATURES.map(({ icon: Icon, text }) => (
          <div
            key={text}
            className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <Icon className="h-4 w-4 shrink-0" style={{ color: "#93c5fd" }} />
            <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.65)" }}>{text}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="relative z-10 mt-8 flex items-center gap-4 text-xs" style={{ color: "rgba(255,255,255,0.22)" }}>
        <span>© {new Date().getFullYear()} School Biometric System</span>
        <span style={{ color: "rgba(255,255,255,0.1)" }}>·</span>
        <Link href="/support" className="transition-colors hover:text-white/40">Contact Support</Link>
        <span style={{ color: "rgba(255,255,255,0.1)" }}>·</span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Systems OK
        </span>
      </div>
    </div>
  )
}

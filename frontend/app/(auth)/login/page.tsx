"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Mail, Lock, Eye, EyeOff, School, AlertCircle, ServerOff,
  Shield, Activity, Users, CheckCircle2,
} from "lucide-react"
import Link from "next/link"
import { login, LoginError, type UserResponse } from "@/lib/api/auth"
import { useAuthStore } from "@/lib/store/authStore"
import { useSchoolBrandingStore } from "@/lib/store/schoolBrandingStore"
import { decodeJwtPayload } from "@/lib/utils/jwt"
import { toast } from "sonner"

const FEATURES = [
  { icon: Shield,    text: "Biometric fingerprint authentication" },
  { icon: Activity,  text: "Real-time attendance tracking" },
  { icon: Users,     text: "Student & staff management" },
  { icon: CheckCircle2, text: "Automated reporting & audit trails" },
]

export default function LoginPage() {
  const router = useRouter()
  const { login: setAuth } = useAuthStore()
  const { schoolName, logoDataUrl, loginBgDataUrl } = useSchoolBrandingStore()

  const [email, setEmail]           = useState("")
  const [password, setPassword]     = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading]   = useState(false)
  const [error, setError]           = useState("")
  const [isServiceError, setIsServiceError] = useState(false)

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
        setError(
          isConnErr
            ? "Cannot reach the backend services. Please ensure the server is running."
            : msg,
        )
      } else {
        setError(err instanceof Error ? err.message : "An unexpected error occurred.")
      }
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left brand panel ── */}
      <div
        className="hidden lg:flex lg:w-[420px] xl:w-[480px] shrink-0 flex-col relative overflow-hidden"
        style={
          loginBgDataUrl
            ? { backgroundImage: `url(${loginBgDataUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
            : {}
        }
      >
        {/* Background — dark navy or image overlay */}
        <div
          className="absolute inset-0"
          style={
            loginBgDataUrl
              ? { background: "rgba(10,18,36,0.78)" }
              : { background: "linear-gradient(160deg, #0c1728 0%, #0f2044 55%, #0c1728 100%)" }
          }
        />

        {/* Subtle grid texture */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "repeating-linear-gradient(0deg,#fff 0px,#fff 1px,transparent 1px,transparent 32px),repeating-linear-gradient(90deg,#fff 0px,#fff 1px,transparent 1px,transparent 32px)",
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full px-10 py-12">
          {/* Logo + name */}
          <div className="flex items-center gap-3.5 mb-auto">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 shadow-lg overflow-hidden">
              {logoDataUrl
                ? <img src={logoDataUrl} alt="logo" className="h-full w-full object-cover" />
                : <School className="h-6 w-6 text-white" />
              }
            </div>
            <div>
              <p className="text-base font-bold text-white leading-tight">{displayName}</p>
              <p className="text-[11px] text-white/40 uppercase tracking-widest mt-0.5">Management Portal</p>
            </div>
          </div>

          {/* Hero text */}
          <div className="my-12">
            <h1 className="text-3xl font-extrabold text-white leading-snug">
              Intelligent<br />Biometric<br />Attendance
            </h1>
            <p className="mt-4 text-sm text-white/55 leading-relaxed max-w-xs">
              Streamline attendance, secure access, and gain real-time visibility across your institution.
            </p>
          </div>

          {/* Feature list */}
          <ul className="space-y-4 mb-auto">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icon className="h-3.5 w-3.5 text-blue-300" />
                </div>
                <span className="text-sm text-white/70">{text}</span>
              </li>
            ))}
          </ul>

          {/* Footer */}
          <p className="mt-10 text-[11px] text-white/25 uppercase tracking-widest">
            Biometric Security · v2.0
          </p>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 px-6 py-12 sm:px-10">

        {/* Mobile logo (only shows on small screens) */}
        <div className="lg:hidden flex items-center gap-3 mb-10">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 overflow-hidden">
            {logoDataUrl
              ? <img src={logoDataUrl} alt="logo" className="h-full w-full object-cover" />
              : <School className="h-5 w-5 text-white" />
            }
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">{displayName}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Management Portal</p>
          </div>
        </div>

        <div className="w-full max-w-[380px]">
          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground">Sign in</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Enter your administrator credentials to continue.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error */}
            {error && (
              <Alert variant="destructive" className="py-3">
                {isServiceError ? <ServerOff className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Email address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError("") }}
                  placeholder="admin@yourschool.edu"
                  className="pl-9 h-11 bg-white border-border focus-visible:ring-primary/30"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError("") }}
                  placeholder="••••••••"
                  className="pl-9 pr-10 h-11 bg-white border-border focus-visible:ring-primary/30"
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 mt-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm transition-colors"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Verifying…
                </span>
              ) : "Sign In"}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-slate-50 px-3 text-[11px] text-muted-foreground uppercase tracking-wider">
                Or
              </span>
            </div>
          </div>

          {/* Secondary actions */}
          <div className="grid grid-cols-2 gap-3">
            <Link href="/register" className="w-full">
              <Button
                type="button"
                variant="outline"
                className="w-full h-10 text-xs font-semibold border-border bg-white hover:bg-slate-50"
              >
                Register School
              </Button>
            </Link>
            <Link href="/support" className="w-full">
              <Button
                type="button"
                variant="ghost"
                className="w-full h-10 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-slate-100"
              >
                Get Support
              </Button>
            </Link>
          </div>

          <p className="mt-8 text-center text-[11px] text-muted-foreground/60">
            © {new Date().getFullYear()} School Biometric System. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}

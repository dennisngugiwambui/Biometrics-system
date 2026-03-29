"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Mail, Lock, Eye, EyeOff, School, ArrowLeft, AlertCircle, ServerOff } from "lucide-react"
import Link from "next/link"
import { login, LoginError, type UserResponse } from "@/lib/api/auth"
import { useAuthStore } from "@/lib/store/authStore"
import { useSchoolBrandingStore } from "@/lib/store/schoolBrandingStore"
import { decodeJwtPayload } from "@/lib/utils/jwt"
import { toast } from "sonner"

// ---------------------------------------------------------------------------
// Animated background blob that follows mouse proximity on each side
// ---------------------------------------------------------------------------

function SideBlob({
  side,
  color1,
  color2,
  mouseX,
  mouseY,
}: {
  side: "left" | "right"
  color1: string
  color2: string
  mouseX: React.MutableRefObject<number>
  mouseY: React.MutableRefObject<number>
}) {
  const blobX = useMotionValue(side === "left" ? -96 : 96)
  const blobY = useMotionValue(0)
  const springX = useSpring(blobX, { stiffness: 60, damping: 20 })
  const springY = useSpring(blobY, { stiffness: 60, damping: 20 })

  useEffect(() => {
    let rafId: number
    const animate = () => {
      const nx = mouseX.current // 0 to 1 (left to right)
      const ny = mouseY.current // 0 to 1 (top to bottom)

      // Proximity factor: closer the mouse to this side → more movement
      const proximity = side === "left" ? (1 - nx) : nx
      const shift = proximity * 60

      if (side === "left") {
        blobX.set(-120 + shift)
      } else {
        blobX.set(120 - shift)
      }
      blobY.set((ny - 0.5) * 80)

      rafId = requestAnimationFrame(animate)
    }
    rafId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafId)
  }, [blobX, blobY, mouseX, mouseY, side])

  const style =
    side === "left"
      ? { left: 0, top: "20%", translateX: springX, translateY: springY }
      : { right: 0, bottom: "20%", translateX: springX, translateY: springY }

  return (
    <motion.div
      style={style as any}
      className="absolute w-[360px] h-[360px] sm:w-[520px] sm:h-[520px] rounded-full filter blur-3xl opacity-40 pointer-events-none"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 0.45, scale: 1 }}
      transition={{ duration: 1.2 }}
      css-style={{ background: `radial-gradient(circle, ${color1}, ${color2})` }}
    >
      {/* Use inline style since Tailwind can't do dynamic radial gradients */}
      <div
        className="w-full h-full rounded-full"
        style={{ background: `radial-gradient(circle at center, ${color1}, ${color2} 80%)` }}
      />
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Main Login Page
// ---------------------------------------------------------------------------

export default function LoginPage() {
  const router = useRouter()
  const { login: setAuth } = useAuthStore()
  const { schoolName, logoDataUrl, loginBgDataUrl } = useSchoolBrandingStore()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [isServiceError, setIsServiceError] = useState(false)

  // Display name shown on the login card
  const displayName = schoolName && schoolName !== "SchoolAdmin" ? schoolName : "School Admin"

  // Mouse position refs for blob animation (avoid re-renders)
  const mouseXRef = useRef(0.5)
  const mouseYRef = useRef(0.5)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    mouseXRef.current = e.clientX / window.innerWidth
    mouseYRef.current = e.clientY / window.innerHeight
  }

  // Check for session expired message on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const expiredMessage = sessionStorage.getItem("session_expired_message")
      if (expiredMessage) {
        toast.error(expiredMessage, { duration: 5000 })
        sessionStorage.removeItem("session_expired_message")
      }
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsServiceError(false)

    if (!email || !password) {
      setError("Please fill in all fields")
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address")
      return
    }

    setIsLoading(true)

    try {
      const tokenResponse = await login({ email, password })

      const tokenPayload = decodeJwtPayload<{
        sub?: string
        email?: string
        first_name?: string
        last_name?: string
        school_id?: number
        role?: string
      }>(tokenResponse.access_token)

      const user: UserResponse = {
        id: tokenPayload?.sub ? parseInt(tokenPayload.sub, 10) : 0,
        email: tokenPayload?.email || email,
        first_name: tokenPayload?.first_name || "",
        last_name: tokenPayload?.last_name || "",
        role: tokenPayload?.role || "school_admin",
        school_id: tokenPayload?.school_id || 0,
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
        // Detect service-unavailable / timeout errors
        const isConnErr =
          msg.toLowerCase().includes("service timeout") ||
          msg.toLowerCase().includes("service unavailable") ||
          msg.toLowerCase().includes("unable to connect") ||
          msg.toLowerCase().includes("network error") ||
          msg.toLowerCase().includes("econnrefused")
        setIsServiceError(isConnErr)
        setError(
          isConnErr
            ? "Cannot reach the backend services. Please ensure the school service is running on port 8001."
            : msg
        )
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("An unexpected error occurred. Please try again.")
      }
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-hidden"
      onMouseMove={handleMouseMove}
      style={
        loginBgDataUrl
          ? {
            backgroundImage: `url(${loginBgDataUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }
          : {}
      }
    >
      {/* ── Gradient fallback (only shown when no bg image) ── */}
      {!loginBgDataUrl && (
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900" />
      )}

      {/* ── Overlay (dim bg image for readability) ── */}
      {loginBgDataUrl && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      )}

      {/* ── Animated side blobs ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <SideBlob
          side="left"
          color1="#93c5fd"
          color2="#6366f1"
          mouseX={mouseXRef}
          mouseY={mouseYRef}
        />
        <SideBlob
          side="right"
          color1="#c084fc"
          color2="#f472b6"
          mouseX={mouseXRef}
          mouseY={mouseYRef}
        />
      </div>

      {/* ── Login card ── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-[400px] relative z-10 px-2 sm:px-0"
      >
        <Card className="shadow-2xl border border-white/20 glass-panel bevel-card overflow-hidden">
          <CardHeader className="space-y-4 pb-6 pt-8">
            {/* Logo — shows uploaded school logo or default School icon */}
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.2 }}
              className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center mx-auto shadow-glow bevel-sm overflow-hidden group hover:scale-105 transition-transform duration-500"
            >
              {logoDataUrl ? (
                <img
                  src={logoDataUrl}
                  alt={`${displayName} logo`}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
              ) : (
                <School className="w-10 h-10 text-white" />
              )}
            </motion.div>

            {/* Header Text */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-center"
            >
              <CardTitle className="text-2xl font-black tracking-tight text-foreground">
                {displayName}
              </CardTitle>
              <CardDescription className="text-sm font-medium mt-1 uppercase tracking-widest opacity-60">
                School Management Portal
              </CardDescription>
            </motion.div>
          </CardHeader>

          <CardContent className="pb-8 space-y-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Error Alert */}
              {error && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                  <Alert
                    variant="destructive"
                    className="border-destructive/20 bg-destructive/10 text-destructive bevel-sm"
                  >
                    {isServiceError ? (
                      <ServerOff className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    <AlertDescription className="text-xs font-medium">
                      {error}
                    </AlertDescription>
                  </Alert>
                </motion.div>
              )}

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-[11px] font-bold uppercase tracking-wider opacity-70 ml-1">
                  Email Address
                </Label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      setError("")
                      setIsServiceError(false)
                    }}
                    placeholder="admin@school.edu"
                    className="pl-11 h-12 bg-white/50 dark:bg-black/20 border-white/20 dark:border-white/10 focus:ring-4 focus:ring-primary/10 transition-all rounded-xl font-medium"
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-[11px] font-bold uppercase tracking-wider opacity-70 ml-1">
                  Password
                </Label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setError("")
                      setIsServiceError(false)
                    }}
                    placeholder="••••••••"
                    className="pl-11 pr-11 h-12 bg-white/50 dark:bg-black/20 border-white/20 dark:border-white/10 focus:ring-4 focus:ring-primary/10 transition-all rounded-xl font-medium"
                    disabled={isLoading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow bevel-sm transition-all duration-300 active:scale-95 font-bold rounded-xl"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full mr-2"
                      />
                      Verifying...
                    </div>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </div>

              {/* Secondary Links */}
              <div className="space-y-4 pt-2">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-muted/30" />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest">
                    <span className="px-3 bg-white/50 dark:bg-black/20 backdrop-blur-sm rounded-full text-muted-foreground">Or continue with</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Link href="/register" className="w-full">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-10 border-white/20 dark:border-white/10 bg-white/40 dark:bg-white/5 hover:bg-white/60 dark:hover:bg-white/10 transition-all rounded-lg text-[11px] font-bold uppercase tracking-tight"
                    >
                      Register
                    </Button>
                  </Link>
                  <Link href="/support" className="w-full">
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full h-10 hover:bg-primary/5 transition-all rounded-lg text-[11px] font-bold uppercase tracking-tight text-muted-foreground hover:text-primary"
                    >
                      Support
                    </Button>
                  </Link>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-center text-[11px] font-bold uppercase tracking-[0.3em] text-white/50 mt-8 drop-shadow-md"
        >
          Biometric Security • Ver 2.0
        </motion.p>
      </motion.div>
    </div>
  )
}

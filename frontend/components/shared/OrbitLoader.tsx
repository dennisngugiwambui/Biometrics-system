"use client"

import { cn } from "@/lib/utils"

/** The portal's busy animation: a glowing core with dots orbiting on three rings. */
export function OrbitLoader({ size = 64, className }: { size?: number; className?: string }) {
  return (
    <span className={cn("orbit", className)} style={{ width: size, height: size }} role="status" aria-label="Loading">
      <span className="orbit-core" />
      <span className="orbit-ring orbit-ring-1"><i /></span>
      <span className="orbit-ring orbit-ring-2"><i /></span>
      <span className="orbit-ring orbit-ring-3"><i /></span>
    </span>
  )
}

/** Centered in a section, with a caption. */
export function PageLoader({ label = "Loading…", size = 60, className }: { label?: string; size?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3.5 py-16", className)} role="status">
      <OrbitLoader size={size} />
      {label ? <p className="text-[13px] font-semibold tracking-wide text-slate-500">{label}</p> : null}
    </div>
  )
}

/** Full-screen deep-green splash, used while the app starts and while signing in. */
export function FullPageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      className="on-dark fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5"
      style={{ background: "linear-gradient(160deg,#0a3a1c 0%,#14532d 55%,#0c3f20 100%)" }}
      role="status"
    >
      <OrbitLoader size={84} />
      <p className="text-[13px] font-semibold tracking-wide text-emerald-50/90">{label}</p>
    </div>
  )
}

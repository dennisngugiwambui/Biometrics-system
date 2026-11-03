import type { ReactNode } from "react"
import Link from "next/link"
import { CheckCircle2 } from "lucide-react"

/**
 * The sign-in frame shared by the school login, registration and the
 * /management login. The same colours and controls as the portal, but its own
 * layout: the full page is split in two, with the school photo fading into deep
 * green on one side and the form on the other. On phones the photo is a band
 * above the form.
 */
export function AuthShell({
  badge,
  headline,
  sub,
  footer,
  children,
}: {
  badge: string
  headline: string
  sub: string
  footer: ReactNode
  children: ReactNode
}) {
  return (
    <main className="grid min-h-screen min-h-[100dvh] bg-white lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* Photo side */}
      <aside className="relative isolate flex min-h-[172px] flex-col overflow-hidden bg-[#0b1a12] px-5 py-5 text-white sm:px-8 lg:min-h-0 lg:px-12 lg:py-10">
        <div className="absolute inset-0 -z-20">
          <picture>
            <source media="(max-width: 1023px)" srcSet="/img/school-courtyard-sm.webp" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/school-courtyard.webp" alt="" className="h-full w-full object-cover" />
          </picture>
        </div>
        <div
          className="absolute inset-0 -z-10"
          style={{ background: "linear-gradient(180deg, rgba(11,26,18,.72) 0%, rgba(11,26,18,.5) 38%, rgba(11,26,18,.94) 100%)" }}
        />

        <Link href="/" className="flex w-fit items-center gap-2.5" aria-label="Shulepoa Attendance home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" width={40} height={40} className="h-10 w-10" />
          <span className="font-display text-[21px] font-bold leading-none tracking-tight">Shulepoa</span>
          <span className="ml-1 rounded-full bg-white/12 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider ring-1 ring-white/25">
            {badge}
          </span>
        </Link>

        <div className="mt-auto hidden max-w-[520px] pt-6 lg:block">
          <h2 className="font-display text-[clamp(2rem,3.2vw,3.1rem)] font-bold leading-[1.06] tracking-tight">{headline}</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-white/80">{sub}</p>
          <ul className="mt-6 grid gap-2.5 text-sm font-medium text-white/90">
            {["Fingerprint clock-in at the gate", "Instant SMS to parents", "Live registers and PDF reports"].map((t) => (
              <li key={t} className="flex items-center gap-2.5">
                <CheckCircle2 className="h-[18px] w-[18px] shrink-0 text-[#4ade80]" /> {t}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Form side */}
      <section className="flex flex-col px-5 py-7 sm:px-10 lg:px-14 lg:py-10">
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-[420px]">{children}</div>
        </div>
        <div className="mt-6 text-center text-[11.5px] text-slate-500">{footer}</div>
      </section>
    </main>
  )
}

export const authLabelCls = "mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-600"
export const authIconCls = "pointer-events-none absolute left-3.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-slate-400"
export const authInputCls =
  "h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-11 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-[border-color,box-shadow] duration-150 hover:border-slate-400 focus:border-green-600 focus:ring-[3px] focus:ring-green-500/25 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-rose-500"

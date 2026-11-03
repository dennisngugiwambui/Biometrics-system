import type { ReactNode } from "react"
import { SchoolIllustration } from "@/components/features/auth/SchoolIllustration"

/**
 * The sign-in frame shared by the school login and the /management login, in
 * the portal.shulepoa.co.ke style: the illustration on a soft green panel on
 * one side, the form on the other. On phones the illustration shrinks to a
 * band above the form.
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
    <main
      className="min-h-screen min-h-[100dvh] flex items-center justify-center px-3 py-5 sm:p-6 lg:p-10"
      style={{ background: "linear-gradient(160deg, #f0fdf4 0%, #f4f6f9 55%, #eef2f6 100%)" }}
    >
      <div className="w-full max-w-[1080px]">
        <div
          className="grid overflow-hidden rounded-3xl bg-white lg:grid-cols-[1.08fr_1fr]"
          style={{ boxShadow: "0 0 0 1px rgb(15 23 42 / 0.05), 0 30px 70px -24px rgb(15 23 42 / 0.22), 0 6px 16px -6px rgb(15 23 42 / 0.08)" }}
        >
          {/* Illustration side */}
          <aside className="relative flex flex-col overflow-hidden bg-[#f5f8f6] lg:min-h-[640px]">
            <div className="pointer-events-none absolute -top-24 -left-20 h-72 w-72 rounded-full bg-[#dcfce7] opacity-60" />
            <div className="pointer-events-none absolute -bottom-28 -right-16 h-80 w-80 rounded-full bg-[#dcfce7] opacity-50" />

            <div className="relative flex items-center gap-2.5 px-6 pt-5 lg:px-10 lg:pt-9">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl text-lg font-black text-white shadow-sm"
                style={{ background: "linear-gradient(135deg, #16a34a, #166534)" }}
              >
                S
              </span>
              <span className="text-[19px] font-extrabold tracking-tight text-slate-900">Shulepoa</span>
              <span className="ml-1 rounded-full bg-white/80 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-green-800 ring-1 ring-green-200">
                {badge}
              </span>
            </div>

            <div className="relative flex flex-1 items-center justify-center px-6 lg:px-8">
              <SchoolIllustration className="-mb-2 h-auto w-full max-w-[300px] sm:max-w-[360px] lg:mb-0 lg:max-w-[460px]" />
            </div>

            <div className="relative hidden px-10 pb-10 lg:block">
              <h2 className="text-[22px] font-extrabold leading-snug tracking-tight text-slate-900">{headline}</h2>
              <p className="mt-2 max-w-[420px] text-[14px] leading-relaxed text-slate-500">{sub}</p>
            </div>
          </aside>

          {/* Form side */}
          <section className="flex flex-col justify-center px-6 py-7 sm:px-10 sm:py-10 lg:px-14">
            <div className="mx-auto w-full max-w-[400px]">{children}</div>
          </section>
        </div>
        <div className="mt-5 text-center text-[11px] text-slate-500">{footer}</div>
      </div>
    </main>
  )
}

export const authLabelCls = "mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-600"
export const authIconCls = "pointer-events-none absolute left-3.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-slate-400"
export const authInputCls =
  "h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-11 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-[border-color,box-shadow] duration-150 hover:border-slate-400 focus:border-green-600 focus:ring-[3px] focus:ring-green-500/25 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-rose-500"

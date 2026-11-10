import type { CSSProperties, ReactNode } from "react"
import { Fingerprint } from "lucide-react"
import SchoolIllustration from "./SchoolIllustration"

/**
 * The sign-in frame (after the CSMS / Shulepoa sign-in).
 *
 *  • Desktop (lg+): the school illustration on one side, the form on the other,
 *    in one floating card.
 *  • Phones and the Android app: the illustration is a soft, animated hero at the
 *    top of the screen and the form sits in a white sheet that slides up over it.
 *  • Tablets: the same hero, with the sheet as a centred card.
 *
 * The form is rendered once; only the frame around it changes with the width.
 */

// The brand greens. Scoped to this frame so the dashboard keeps its own theme.
const PALETTE = {
  "--auth-50": "#f0fdf4",
  "--auth-100": "#dcfce7",
  "--auth-200": "#bbf7d0",
  "--auth-300": "#86efac",
  "--auth-500": "#22c55e",
  "--auth-600": "#16a34a",
  "--auth-700": "#15803d",
  "--auth-800": "#166534",
  "--auth-900": "#14532d",
} as CSSProperties

interface AuthLayoutProps {
  children: ReactNode
  brandName?: string
  logoUrl?: string | null
  headline?: string
  sub?: string
  footer?: ReactNode
}

export default function AuthLayout({
  children,
  brandName = "Shulepoa Attendance",
  logoUrl,
  headline,
  sub,
  footer,
}: AuthLayoutProps) {
  return (
    <main
      style={PALETTE}
      className="auth-frame min-h-screen min-h-[100dvh] flex flex-col bg-[var(--auth-50)] lg:bg-[#f1f4f7] lg:items-center lg:justify-center lg:p-10"
    >
      <div className="flex-1 lg:flex-none w-full lg:max-w-[1080px] flex flex-col">
        <div className="flex-1 flex flex-col lg:grid lg:grid-cols-[1.08fr_1fr] lg:bg-white lg:rounded-3xl lg:overflow-hidden lg:shadow-[0_0_0_1px_rgb(15_23_42/0.05),0_30px_70px_-24px_rgb(15_23_42/0.22),0_6px_16px_-6px_rgb(15_23_42/0.08)]">

          {/* ── Brand + illustration ───────────────────────────────────── */}
          <aside className="relative overflow-hidden flex flex-col text-slate-900 bg-[var(--auth-50)] lg:bg-[#f5f8f6] lg:min-h-[640px] pt-[max(1.25rem,env(safe-area-inset-top))] lg:pt-0">
            {/* soft blobs */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              <div className="auth-blob absolute -top-24 -left-20 w-72 h-72 rounded-full opacity-70 bg-[var(--auth-100)]" />
              <div className="auth-blob auth-blob-alt absolute -bottom-28 -right-16 w-80 h-80 rounded-full opacity-60 bg-[var(--auth-100)]" />
              <div className="absolute top-1/3 right-8 w-3 h-3 rounded-full bg-[var(--auth-300)] auth-twinkle" />
              <div className="absolute top-16 left-1/2 w-2 h-2 rounded-full bg-[var(--auth-500)] opacity-60 auth-twinkle [animation-delay:1.2s]" />
            </div>

            {/* brand mark */}
            <div className="auth-rise relative flex items-center justify-center lg:justify-start w-full px-6 lg:px-10 lg:pt-9">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center text-white bg-[var(--auth-600)] shadow-[0_6px_16px_-4px_rgb(22_163_74/0.55)]">
                  {logoUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={logoUrl} alt="" className="w-full h-full object-cover" />
                    : <Fingerprint className="w-5 h-5" />}
                </span>
                <span className="text-lg lg:text-[19px] font-extrabold tracking-tight truncate max-w-[240px]">{brandName}</span>
              </div>
            </div>

            {/* illustration */}
            <div className="relative flex flex-1 items-center justify-center px-8 pt-3 pb-12 sm:pb-14 lg:px-8 lg:py-0">
              <SchoolIllustration className="auth-float w-full max-w-[300px] sm:max-w-[360px] lg:max-w-[460px] h-auto" />
            </div>

            {(headline || sub) && (
              <div className="auth-rise relative hidden lg:block lg:px-10 lg:pb-10 [animation-delay:.15s]">
                {headline && <h2 className="text-[22px] font-extrabold tracking-tight leading-snug">{headline}</h2>}
                {sub && <p className="text-[14px] text-slate-500 mt-2 leading-relaxed max-w-[420px]">{sub}</p>}
              </div>
            )}
          </aside>

          {/* ── Form: a sheet on phones, a card on tablets, the right column on desktop ── */}
          <section className="auth-sheet relative z-10 -mt-8 lg:mt-0 flex-1 sm:flex-none lg:flex-1 flex flex-col lg:justify-center bg-white rounded-t-[28px] sm:rounded-3xl lg:rounded-none sm:w-full sm:max-w-md sm:mx-auto lg:max-w-none shadow-[0_-12px_40px_-16px_rgb(15_23_42/0.18)] sm:shadow-[0_20px_50px_-24px_rgb(15_23_42/0.25)] lg:shadow-none sm:border sm:border-slate-200/80 lg:border-0">
            <span aria-hidden="true" className="sm:hidden mx-auto mt-3 h-1.5 w-10 rounded-full bg-slate-200" />
            <div className="w-full max-w-[400px] mx-auto px-6 pt-6 pb-8 sm:px-9 sm:py-9 lg:px-0 lg:py-10">{children}</div>
          </section>
        </div>

        {footer && (
          <div className="bg-white sm:bg-transparent text-center text-[11px] text-slate-400 sm:text-slate-500 px-6 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] sm:py-6 lg:pb-0 lg:pt-5">
            {footer}
          </div>
        )}
      </div>
    </main>
  )
}

import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight, BellRing, CheckCircle2, ChevronDown, Clock3, Cloud, FileText, Fingerprint,
  GraduationCap, LayoutDashboard, MessageSquareText, ShieldCheck, Smartphone, Users,
} from "lucide-react"
import { FAQ, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/seo"

// Public home page: what search engines and new schools see first.
export const metadata: Metadata = {
  title: { absolute: SITE_TITLE },
  alternates: { canonical: "/" },
}

const FEATURES = [
  {
    icon: Fingerprint,
    title: "Fingerprint clock-in",
    text: "Students and teachers clock in and out on ZKTeco biometric terminals at the gate. No cards to lose, no buddy-signing.",
  },
  {
    icon: MessageSquareText,
    title: "Instant parent SMS",
    text: "Parents get an SMS the moment their child checks in or out — peace of mind every single morning.",
  },
  {
    icon: LayoutDashboard,
    title: "Live attendance dashboard",
    text: "See who is in, who is late and who is absent across every class and stream, updated as each finger is scanned.",
  },
  {
    icon: FileText,
    title: "Print-ready PDF reports",
    text: "Daily registers, date-range summaries, late-comer and absentee lists — one click to a clean PDF for the office or the board.",
  },
  {
    icon: Cloud,
    title: "Cloud-connected devices",
    text: "Terminals talk to Shulepoa over the internet in push (ADMS) mode. No school server, no fixed IP, no technician on call.",
  },
  {
    icon: Smartphone,
    title: "Works on any phone",
    text: "Runs in the browser on computers, tablets and Android phones, and installs to the home screen like an app.",
  },
]

const STEPS = [
  { n: "01", title: "Register your school", text: "Create your school account, add classes, streams, students and staff." },
  { n: "02", title: "Connect the device", text: "Point your ZKTeco terminal at Shulepoa and enrol fingerprints — it works over any internet connection." },
  { n: "03", title: "Watch attendance happen", text: "Every scan lands on your dashboard in seconds and parents are notified automatically." },
]

const AUDIENCE = [
  { icon: GraduationCap, title: "Day & boarding schools", text: "Morning arrival, evening departure and exeat tracking for every learner." },
  { icon: Users, title: "Teachers & staff", text: "Accurate staff arrival and departure times without paper sign-in books." },
  { icon: ShieldCheck, title: "Head teachers & boards", text: "Hard numbers on punctuality and absenteeism, ready for every meeting." },
]

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://shulepoa.co.ke/#org",
      name: "Shulepoa",
      url: "https://shulepoa.co.ke",
      logo: `${SITE_URL}/icons/icon-512.png`,
      areaServed: { "@type": "Country", name: "Kenya" },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      alternateName: ["Shulepoa", "Shule Poa Attendance", "Shulepoa Biometric"],
      publisher: { "@id": "https://shulepoa.co.ke/#org" },
      inLanguage: "en-KE",
    },
    {
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      url: SITE_URL,
      applicationCategory: "EducationalApplication",
      applicationSubCategory: "Biometric attendance system",
      operatingSystem: "Web, Android, iOS, Windows",
      description: SITE_DESCRIPTION,
      publisher: { "@id": "https://shulepoa.co.ke/#org" },
      featureList: FEATURES.map((f) => f.title),
      areaServed: { "@type": "Country", name: "Kenya" },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  ],
}

function Logo({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon.svg" alt="" width={36} height={36} className="h-9 w-9" />
      <span className={`whitespace-nowrap text-[19px] font-extrabold tracking-tight ${light ? "text-white" : "text-slate-900"}`}>
        Shulepoa<span className={`${light ? "text-green-300" : "text-green-600"} ${compact ? "hidden sm:inline" : ""}`}> Attendance</span>
      </span>
    </span>
  )
}

// Illustrative dashboard card for the hero (sample data).
function HeroPreview() {
  const rows = [
    { name: "Grade 7 East", pct: 98 },
    { name: "Grade 8 West", pct: 94 },
    { name: "Form 2 North", pct: 91 },
    { name: "Form 3 South", pct: 87 },
  ]
  return (
    <div className="relative mx-auto w-full max-w-[460px]" aria-hidden="true">
      <div className="absolute -inset-6 rounded-[2rem] bg-green-400/20 blur-2xl" />
      <div className="relative rounded-3xl bg-white p-5 shadow-[0_30px_70px_-24px_rgb(15_23_42/0.35)] ring-1 ring-slate-900/5 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Today · Live</p>
            <p className="mt-1 text-[28px] font-extrabold tracking-tight text-slate-900">
              1,248 <span className="text-base font-semibold text-slate-500">of 1,302 in</span>
            </p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700 ring-1 ring-green-200">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" /> 95.9%
          </span>
        </div>
        <div className="mt-5 space-y-3">
          {rows.map((r) => (
            <div key={r.name}>
              <div className="flex justify-between text-[13px] font-medium text-slate-700">
                <span>{r.name}</span>
                <span className="font-bold text-slate-900">{r.pct}%</span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-gradient-to-r from-green-500 to-green-700" style={{ width: `${r.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-600 text-white">
            <Fingerprint className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-slate-900">Wanjiru K. · Grade 7 East</p>
            <p className="text-[12px] text-slate-500">Checked in 7:12 AM · Parent notified</p>
          </div>
          <BellRing className="h-4 w-4 shrink-0 text-amber-500" />
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6" aria-label="Main">
          <Link href="/" aria-label="Shulepoa Attendance home"><Logo compact /></Link>
          <div className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
            <a href="#features" className="hover:text-green-700">Features</a>
            <a href="#how-it-works" className="hover:text-green-700">How it works</a>
            <a href="#faq" className="hover:text-green-700">FAQ</a>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" className="whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:px-4">
              Sign in
            </Link>
            <Link
              href="/register"
              className="whitespace-nowrap rounded-xl bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700 sm:px-4"
            >
              Get started
            </Link>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section
          className="relative overflow-hidden"
          style={{ background: "linear-gradient(160deg, #f0fdf4 0%, #ffffff 55%, #f4f6f9 100%)" }}
        >
          <div className="pointer-events-none absolute -top-32 -right-24 h-96 w-96 rounded-full bg-green-100 opacity-70" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.1fr_1fr] lg:py-24">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-green-800 ring-1 ring-green-200">
                <Fingerprint className="h-3.5 w-3.5" /> Biometric attendance for Kenyan schools
              </p>
              <h1 className="mt-5 text-[36px] font-black leading-[1.05] tracking-tight text-slate-900 sm:text-5xl lg:text-[58px]">
                Know who&apos;s in school <span className="text-green-600">the second they arrive.</span>
              </h1>
              <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-slate-600">
                Shulepoa Attendance replaces paper registers with fingerprint clock-in. Every learner and teacher is
                recorded at the gate, parents get an instant SMS, and you get live registers and PDF reports — from any
                phone or computer.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-3.5 text-[15px] font-bold text-white shadow-lg shadow-green-600/25 hover:bg-green-700"
                >
                  Register your school <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3.5 text-[15px] font-bold text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50"
                >
                  Sign in to your school
                </Link>
              </div>
              <ul className="mt-8 grid gap-2 text-sm font-medium text-slate-600 sm:grid-cols-2">
                {["No school server needed", "Works with ZKTeco devices", "SMS alerts to parents", "Students and staff"].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <HeroPreview />
          </div>
        </section>

        {/* Problem */}
        <section className="border-y border-slate-100 bg-slate-50/60">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:px-6 md:grid-cols-3">
            {[
              { icon: Clock3, t: "Roll call wastes lesson time", d: "Calling names every morning eats minutes from every class, every day." },
              { icon: FileText, t: "Paper registers go missing", d: "Books get lost, smudged or filled in after the fact — and can't be searched." },
              { icon: BellRing, t: "Parents are left guessing", d: "Without a record at the gate, nobody knows for sure who arrived and when." },
            ].map(({ icon: Icon, t, d }) => (
              <div key={t} className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 ring-1 ring-rose-100">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-bold text-slate-900">{t}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-bold uppercase tracking-wider text-green-700">Features</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                Everything a school needs to take attendance seriously
              </h2>
              <p className="mt-4 text-slate-600">
                One system for the gate, the office and the parents — built around the way Kenyan schools actually run.
              </p>
            </div>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <article
                  key={title}
                  className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 transition-shadow hover:shadow-[0_20px_40px_-20px_rgb(15_23_42/0.25)]"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-700 ring-1 ring-green-100">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-lg font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-20 bg-[#0f2a1b] text-white">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="max-w-2xl">
              <p className="text-sm font-bold uppercase tracking-wider text-green-300">How it works</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Up and running in a day</h2>
            </div>
            <ol className="mt-12 grid gap-6 md:grid-cols-3">
              {STEPS.map((s) => (
                <li key={s.n} className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
                  <span className="text-4xl font-black text-green-400">{s.n}</span>
                  <h3 className="mt-3 text-lg font-bold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-green-50/75">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Audience */}
        <section>
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <h2 className="text-center text-3xl font-black tracking-tight sm:text-4xl">Made for the whole school</h2>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {AUDIENCE.map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-2xl bg-gradient-to-b from-green-50 to-white p-6 ring-1 ring-green-100">
                  <Icon className="h-7 w-7 text-green-700" />
                  <h3 className="mt-4 text-lg font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 bg-slate-50/70">
          <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
            <h2 className="text-center text-3xl font-black tracking-tight sm:text-4xl">Frequently asked questions</h2>
            <div className="mt-10 space-y-3">
              {FAQ.map(({ q, a }) => (
                <details key={q} className="group rounded-2xl bg-white p-5 ring-1 ring-slate-200 open:ring-green-200">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-slate-900">
                    <h3>{q}</h3>
                    <ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 py-16 sm:px-6 sm:py-20">
          <div
            className="mx-auto max-w-5xl rounded-3xl px-6 py-12 text-center text-white sm:px-12 sm:py-16"
            style={{ background: "linear-gradient(135deg, #14532d 0%, #166534 45%, #16a34a 100%)" }}
          >
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Stop guessing. Start knowing.</h2>
            <p className="mx-auto mt-4 max-w-xl text-green-50/85">
              Bring fingerprint attendance, parent alerts and live registers to your school with Shulepoa.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 font-bold text-green-800 hover:bg-green-50"
              >
                Register your school <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-xl px-6 py-3.5 font-bold text-white ring-1 ring-white/40 hover:bg-white/10"
              >
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <Logo />
            <p className="mt-3 max-w-sm text-sm text-slate-500">
              Biometric school attendance system for Kenya — fingerprint clock-in, parent SMS and attendance reports.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-slate-600" aria-label="Footer">
            <a href="https://shulepoa.co.ke" className="hover:text-green-700">shulepoa.co.ke</a>
            <a href="https://portal.shulepoa.co.ke" className="hover:text-green-700">School ERP portal</a>
            <Link href="/register" className="hover:text-green-700">Register</Link>
            <Link href="/login" className="hover:text-green-700">Sign in</Link>
          </nav>
        </div>
        <p className="border-t border-slate-100 py-5 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Shulepoa. All rights reserved.
        </p>
      </footer>
    </div>
  )
}

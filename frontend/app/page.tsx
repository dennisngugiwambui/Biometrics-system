import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight, BellRing, CheckCircle2, ChevronDown, Clock3, Cloud, FileText, Fingerprint,
  GraduationCap, LayoutDashboard, Lock, Mail, MessageCircle, MessageSquareText, Phone, ShieldCheck, Smartphone, Users,
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

const PHONE = "+254 758 024 400"
const PHONE_LINK = "tel:+254758024400"
const WHATSAPP = "https://wa.me/254758024400"
const EMAIL = "info@shulepoa.co.ke"

function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon.svg" alt="" width={40} height={40} className="h-10 w-10" />
      <span className={`font-display text-[22px] font-bold leading-[1.1] tracking-tight ${light ? "text-white" : "text-[#101828]"}`}>
        Shulepoa
        <small className={`hidden font-sans text-[11px] font-medium tracking-normal sm:block ${light ? "text-white/75" : "text-[#475467]"}`}>
          Biometric Attendance System
        </small>
      </span>
    </span>
  )
}

// What a morning looks like, over the hero photo (sample data, and labelled so).
function HeroPreview() {
  const rows = [
    { icon: Fingerprint, title: "07:12 clocked in", sub: "Main gate terminal" },
    { icon: MessageSquareText, title: "SMS sent to parent", sub: "Arrived safely at 07:12" },
    { icon: FileText, title: "Daily register ready", sub: "Grade 7 East, as a PDF" },
  ]
  return (
    <div className="w-full max-w-[330px] rounded-2xl bg-white p-4 text-[#101828] shadow-[0_24px_50px_rgba(0,0,0,.35)]" aria-hidden="true">
      <div className="flex items-center justify-between border-b border-[#e4e7ec] pb-2.5">
        <p className="flex items-center gap-2 text-[13px] font-bold">
          <span className="h-2 w-2 rounded-full bg-[#16a34a]" /> Today at the gate
        </p>
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#667085]">Sample</span>
      </div>
      <ul className="divide-y divide-[#f2f4f7]">
        {rows.map((r) => (
          <li key={r.title} className="flex items-center gap-3 py-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#f2f4f7] text-[#15803d]">
              <r.icon className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13.5px] font-bold">{r.title}</span>
              <span className="block truncate text-[12px] text-[#667085]">{r.sub}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const BAND = [
  { icon: Fingerprint, title: "ZKTeco biometric", text: "learners and staff, live" },
  { icon: MessageSquareText, title: "Parent SMS", text: "the moment they arrive" },
  { icon: FileText, title: "PDF reports", text: "registers, one click away" },
  { icon: Cloud, title: "No school server", text: "works over any internet" },
]

const btn = "inline-flex items-center justify-center gap-2 whitespace-nowrap font-bold transition-[background,border-color,color,transform,box-shadow] duration-150 hover:-translate-y-0.5"

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-[#101828]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Contact strip */}
      <div className="bg-[#166534] text-[12.5px] text-white/85">
        <div className="mx-auto flex h-[34px] max-w-[1360px] items-center justify-between gap-4 px-[clamp(16px,4vw,40px)]">
          <span className="truncate">Biometric attendance for Kenyan schools</span>
          <div className="hidden items-center gap-5 font-semibold text-white sm:flex">
            <a href={PHONE_LINK} className="inline-flex items-center gap-1.5 hover:text-[#dcfce7]"><Phone className="h-3.5 w-3.5" /> {PHONE}</a>
            <a href={WHATSAPP} className="inline-flex items-center gap-1.5 hover:text-[#dcfce7]"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a>
            <a href={`mailto:${EMAIL}`} className="hidden items-center gap-1.5 hover:text-[#dcfce7] md:inline-flex"><Mail className="h-3.5 w-3.5" /> {EMAIL}</a>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-[#e4e7ec] bg-white">
        <nav className="mx-auto flex h-[72px] max-w-[1360px] items-center justify-between gap-4 px-[clamp(16px,4vw,40px)]" aria-label="Main">
          <Link href="/" aria-label="Shulepoa Attendance home"><Logo /></Link>
          <div className="hidden items-center gap-0.5 text-sm font-semibold md:flex">
            {[["#features", "Features"], ["#how-it-works", "How it works"], ["#faq", "FAQ"]].map(([href, label]) => (
              <a key={href} href={href} className="rounded-[10px] px-3 py-2 hover:bg-[#f2f4f7]">{label}</a>
            ))}
            <a href="https://shulepoa.co.ke" className="rounded-[10px] px-3 py-2 hover:bg-[#f2f4f7]">School system</a>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <Link href="/login" className="inline-flex h-11 items-center gap-1.5 whitespace-nowrap px-2 text-sm font-bold hover:text-[#15803d] sm:px-2.5">
              <Lock className="h-4 w-4" /> Sign in
            </Link>
            <Link href="/register" className={`${btn} h-11 rounded-xl bg-[#15803d] px-4 text-sm text-white hover:bg-[#166534] hover:shadow-[0_10px_22px_rgba(21,128,61,.28)] sm:h-[46px] sm:px-5`}>
              Register
            </Link>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero: the photo fills the right and fades into the deep green */}
        <section className="relative isolate flex items-center overflow-hidden bg-[#0b1a12] text-white lg:min-h-[640px]">
          <picture className="contents">
            <source media="(max-width: 767px)" srcSet="/img/school-campus-sm.webp" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/img/school-campus.webp"
              alt="A school campus with classroom blocks"
              fetchPriority="high"
              className="absolute inset-y-0 right-0 -z-20 h-full w-full object-cover object-[50%_45%] lg:w-[64%]"
            />
          </picture>
          <div className="absolute inset-0 -z-10 hidden lg:block" style={{ background: "linear-gradient(90deg, #0b1a12 36%, rgba(11,26,18,.82) 52%, rgba(11,26,18,.1) 78%)" }} />
          <div className="absolute inset-0 -z-10 lg:hidden" style={{ background: "linear-gradient(180deg, rgba(11,26,18,.8) 0%, rgba(11,26,18,.9) 100%)" }} />

          <div className="mx-auto grid w-full max-w-[1360px] items-end gap-10 px-[clamp(16px,4vw,40px)] py-14 sm:py-20 lg:grid-cols-[minmax(0,1fr)_auto] lg:py-24">
            <div className="max-w-[720px]">
              <p className="inline-flex items-center gap-2.5 rounded-full border border-white/30 px-3.5 py-1.5 text-[13px] font-semibold">
                <span className="h-2 w-2 rounded-full bg-[#4ade80]" /> Fingerprint clock-in for Kenyan schools
              </p>
              <h1 className="mt-5 font-display text-[clamp(2.5rem,6vw,4.5rem)] font-bold leading-[1.04] tracking-[-0.02em]">
                Know who&apos;s in school <span className="text-[#fbbf24]">the second they arrive.</span>
              </h1>
              <p className="mt-5 max-w-[600px] text-[clamp(1rem,1.5vw,1.2rem)] leading-relaxed text-white/85">
                Shulepoa Attendance replaces paper registers with fingerprint clock-in. Every learner and teacher is
                recorded at the gate, parents get an instant SMS, and you get live registers and PDF reports, from any
                phone or computer.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/register" className={`${btn} h-14 rounded-[14px] bg-[#4ade80] px-7 text-base text-[#052e16] hover:bg-[#86efac]`}>
                  Register your school <ArrowRight className="h-[18px] w-[18px]" />
                </Link>
                <Link href="/login" className={`${btn} h-14 rounded-[14px] border-[1.5px] border-white/40 px-7 text-base text-white hover:border-white hover:bg-white hover:text-[#101828]`}>
                  Sign in to your school
                </Link>
              </div>
            </div>
            <div className="hidden justify-self-end lg:block"><HeroPreview /></div>
          </div>
        </section>

        {/* Band */}
        <section className="bg-[#15803d] text-white" aria-label="At a glance">
          <div className="mx-auto grid max-w-[1360px] grid-cols-2 lg:grid-cols-4">
            {BAND.map(({ icon: Icon, title, text }, i) => (
              <div
                key={title}
                className={`flex items-center gap-3 px-[clamp(16px,3vw,32px)] py-4 ${i ? "lg:border-l lg:border-white/20" : ""} ${i % 2 ? "border-l border-white/20" : ""} ${i > 1 ? "border-t border-white/20 lg:border-t-0" : ""}`}
              >
                <Icon className="h-6 w-6 shrink-0" />
                <p className="min-w-0 leading-tight">
                  <span className="block font-display text-[15.5px] font-bold sm:text-[17px]">{title}</span>
                  <span className="block text-[12px] text-white/85 sm:text-[13px]">{text}</span>
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* The problem */}
        <section className="border-b border-[#e4e7ec]">
          <div className="mx-auto grid max-w-[1360px] gap-8 px-[clamp(16px,4vw,40px)] py-12 md:grid-cols-3">
            {[
              { icon: Clock3, t: "Roll call wastes lesson time", d: "Calling names every morning eats minutes from every class, every day." },
              { icon: FileText, t: "Paper registers go missing", d: "Books get lost, smudged or filled in after the fact, and can't be searched." },
              { icon: BellRing, t: "Parents are left guessing", d: "Without a record at the gate, nobody knows for sure who arrived and when." },
            ].map(({ icon: Icon, t, d }) => (
              <div key={t} className="flex gap-4">
                <Icon className="mt-0.5 h-6 w-6 shrink-0 text-[#15803d]" />
                <div>
                  <h2 className="font-display text-[19px] font-bold leading-snug">{t}</h2>
                  <p className="mt-1 text-[14.5px] leading-relaxed text-[#475467]">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Features: thin rules, not boxed cards */}
        <section id="features" className="scroll-mt-24">
          <div className="mx-auto max-w-[1360px] px-[clamp(16px,4vw,40px)] py-16 sm:py-24">
            <div className="max-w-[760px]">
              <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#15803d]">Features</p>
              <h2 className="mt-2 font-display text-[clamp(1.9rem,4vw,3rem)] font-bold leading-[1.08] tracking-[-0.02em]">
                Everything a school needs to take attendance seriously
              </h2>
              <p className="mt-4 text-[17px] leading-relaxed text-[#475467]">
                One system for the gate, the office and the parents, built around the way Kenyan schools actually run.
              </p>
            </div>
            <div className="mt-10 grid border-t border-[#e4e7ec] sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <article key={title} className="border-b border-[#e4e7ec] py-7 sm:pr-10">
                  <Icon className="h-7 w-7 text-[#15803d]" />
                  <h3 className="mt-4 font-display text-[21px] font-bold leading-snug">{title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-[#475467]">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-24 bg-[#f7f9fb]">
          <div className="mx-auto max-w-[1360px] px-[clamp(16px,4vw,40px)] py-16 sm:py-24">
            <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#15803d]">How it works</p>
            <h2 className="mt-2 font-display text-[clamp(1.9rem,4vw,3rem)] font-bold leading-[1.08] tracking-[-0.02em]">Up and running in a day</h2>
            <ol className="mt-10 grid gap-8 md:grid-cols-3">
              {STEPS.map((s) => (
                <li key={s.n} className="border-t-2 border-[#15803d] pt-5">
                  <span className="font-display text-[34px] font-bold leading-none text-[#15803d]">{s.n}</span>
                  <h3 className="mt-3 font-display text-[21px] font-bold leading-snug">{s.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-[#475467]">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Audience */}
        <section>
          <div className="mx-auto max-w-[1360px] px-[clamp(16px,4vw,40px)] py-16 sm:py-24">
            <h2 className="font-display text-[clamp(1.9rem,4vw,3rem)] font-bold leading-[1.08] tracking-[-0.02em]">Made for the whole school</h2>
            <div className="mt-10 grid border-t border-[#e4e7ec] md:grid-cols-3">
              {AUDIENCE.map(({ icon: Icon, title, text }) => (
                <div key={title} className="border-b border-[#e4e7ec] py-7 md:pr-10">
                  <Icon className="h-7 w-7 text-[#15803d]" />
                  <h3 className="mt-4 font-display text-[21px] font-bold leading-snug">{title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-[#475467]">{text}</p>
                </div>
              ))}
            </div>
            <ul className="mt-8 grid gap-2.5 text-[14.5px] font-medium text-[#344054] sm:grid-cols-2 lg:grid-cols-4">
              {["No school server needed", "Works with ZKTeco devices", "SMS alerts to parents", "Students and staff"].map((t) => (
                <li key={t} className="flex items-center gap-2"><CheckCircle2 className="h-[18px] w-[18px] shrink-0 text-[#15803d]" /> {t}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-24 bg-[#f7f9fb]">
          <div className="mx-auto max-w-[900px] px-[clamp(16px,4vw,40px)] py-16 sm:py-24">
            <h2 className="font-display text-[clamp(1.9rem,4vw,3rem)] font-bold leading-[1.08] tracking-[-0.02em]">Frequently asked questions</h2>
            <div className="mt-8 border-t border-[#d0d5dd]">
              {FAQ.map(({ q, a }) => (
                <details key={q} className="group border-b border-[#d0d5dd] py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                    <h3 className="font-display text-[18px] font-bold leading-snug group-open:text-[#15803d]">{q}</h3>
                    <ChevronDown className="h-5 w-5 shrink-0 text-[#667085] transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-2.5 text-[15px] leading-relaxed text-[#475467]">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Call to action */}
        <section className="bg-[#15803d] text-white">
          <div className="mx-auto flex max-w-[1360px] flex-col gap-6 px-[clamp(16px,4vw,40px)] py-12 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-display text-[clamp(1.7rem,3.4vw,2.6rem)] font-bold leading-[1.1] tracking-[-0.02em]">Stop guessing. Start knowing.</h2>
              <p className="mt-2 max-w-[560px] text-white/90">Bring fingerprint attendance, parent alerts and live registers to your school with Shulepoa.</p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <Link href="/register" className={`${btn} h-[52px] rounded-xl bg-white px-6 text-[#166534] hover:bg-[#f2f4f7]`}>
                Register your school <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/login" className={`${btn} h-[52px] rounded-xl border-[1.5px] border-white/50 px-6 text-white hover:bg-white hover:text-[#101828]`}>
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#0b1a12] text-white/80">
        <div className="mx-auto flex max-w-[1360px] flex-col gap-6 px-[clamp(16px,4vw,40px)] py-10 md:flex-row md:items-center md:justify-between">
          <div>
            <Logo light />
            <p className="mt-3 max-w-sm text-sm">Biometric school attendance system for Kenya: fingerprint clock-in, parent SMS and attendance reports.</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium" aria-label="Footer">
            <a href="https://shulepoa.co.ke" className="hover:text-white">shulepoa.co.ke</a>
            <a href="https://portal.shulepoa.co.ke" className="hover:text-white">School ERP portal</a>
            <Link href="/register" className="hover:text-white">Register</Link>
            <Link href="/login" className="hover:text-white">Sign in</Link>
            <a href={WHATSAPP} className="hover:text-white">WhatsApp</a>
          </nav>
        </div>
        <p className="border-t border-white/10 py-5 text-center text-xs text-white/60">
          © {new Date().getFullYear()} Shulepoa. All rights reserved.
        </p>
      </footer>
    </div>
  )
}

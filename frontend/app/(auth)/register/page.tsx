"use client"

import type React from "react"
import { useRef, useState } from "react"
import Link from "next/link"
import {
  AlertCircle, ArrowLeft, ArrowRight, Building2, Check, CheckCircle2, Eye, EyeOff, Hash, Lock, Mail, MapPin, Phone, User,
} from "lucide-react"
import { AuthShell, authIconCls, authInputCls, authLabelCls } from "@/components/features/auth/AuthShell"
import { registerSchool, SchoolRegistrationError } from "@/lib/api/schools"
import type { SchoolRegistrationWithAdminFormData } from "@/lib/validations/school"

type Step = 1 | 2

interface SchoolForm { schoolName: string; schoolCode: string; address: string; phone: string; schoolEmail: string }
interface AdminForm { firstName: string; lastName: string; email: string; password: string; confirmPassword: string }
type Errors<T> = Partial<Record<keyof T, string>>

const PASSWORD_RULES: { test: (p: string) => boolean; label: string }[] = [
  { test: (p) => p.length >= 8, label: "8+ characters" },
  { test: (p) => /[A-Z]/.test(p), label: "Uppercase letter" },
  { test: (p) => /[a-z]/.test(p), label: "Lowercase letter" },
  { test: (p) => /[0-9]/.test(p), label: "Number" },
  { test: (p) => /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(p), label: "Symbol (!@#$…)" },
]

export default function RegistrationPage() {
  const [step, setStep] = useState<Step>(1)
  const [done, setDone] = useState<{ school: string; email: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [showPw, setShowPw] = useState(false)
  const submitting = useRef(false)

  const [school, setSchool] = useState<SchoolForm>({ schoolName: "", schoolCode: "", address: "", phone: "", schoolEmail: "" })
  const [admin, setAdmin] = useState<AdminForm>({ firstName: "", lastName: "", email: "", password: "", confirmPassword: "" })
  const [schoolErrors, setSchoolErrors] = useState<Errors<SchoolForm>>({})
  const [adminErrors, setAdminErrors] = useState<Errors<AdminForm>>({})

  const setS = (k: keyof SchoolForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setSchool((p) => ({ ...p, [k]: k === "schoolCode" ? e.target.value.toUpperCase() : e.target.value }))
    if (schoolErrors[k]) setSchoolErrors((p) => ({ ...p, [k]: undefined }))
  }
  const setA = (k: keyof AdminForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setAdmin((p) => ({ ...p, [k]: e.target.value }))
    if (adminErrors[k]) setAdminErrors((p) => ({ ...p, [k]: undefined }))
  }

  const validateSchool = () => {
    const e: Errors<SchoolForm> = {}
    if (!school.schoolName.trim()) e.schoolName = "School name is required"
    if (!school.schoolCode.trim()) e.schoolCode = "School code is required"
    else if (school.schoolCode.length < 3) e.schoolCode = "At least 3 characters"
    else if (!/^[A-Za-z0-9-]+$/.test(school.schoolCode)) e.schoolCode = "Letters, numbers and hyphens only"
    if (school.schoolEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(school.schoolEmail)) e.schoolEmail = "Enter a valid email"
    setSchoolErrors(e)
    return Object.keys(e).length === 0
  }

  const validateAdmin = () => {
    const e: Errors<AdminForm> = {}
    if (!admin.firstName.trim()) e.firstName = "First name is required"
    if (!admin.lastName.trim()) e.lastName = "Last name is required"
    if (!admin.email.trim()) e.email = "Email is required"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(admin.email)) e.email = "Enter a valid email"
    const failed = PASSWORD_RULES.find((r) => !r.test(admin.password))
    if (!admin.password) e.password = "Password is required"
    else if (failed) e.password = `Password needs: ${failed.label.toLowerCase()}`
    if (admin.password !== admin.confirmPassword) e.confirmPassword = "Passwords do not match"
    setAdminErrors(e)
    return Object.keys(e).length === 0
  }

  const next = (e: React.FormEvent) => {
    e.preventDefault()
    setGeneralError(null)
    if (validateSchool()) setStep(2)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting.current || loading || !validateAdmin()) return
    submitting.current = true
    setLoading(true)
    setGeneralError(null)
    try {
      const body: SchoolRegistrationWithAdminFormData = {
        name: school.schoolName.trim(),
        code: school.schoolCode.toUpperCase(),
        address: school.address || undefined,
        phone: school.phone || undefined,
        email: school.schoolEmail || undefined,
        admin: {
          first_name: admin.firstName.trim(), last_name: admin.lastName.trim(), email: admin.email.trim(),
          password: admin.password, confirmPassword: admin.confirmPassword,
        },
      }
      const res = await registerSchool(body)
      setDone({ school: res.name, email: res.admin_user?.email ?? admin.email })
    } catch (err) {
      // Put each server error back on the field (and step) it belongs to.
      if (err instanceof SchoolRegistrationError) {
        const se: Errors<SchoolForm> = {}
        const ae: Errors<AdminForm> = {}
        const schoolMap: Record<string, keyof SchoolForm> = { name: "schoolName", code: "schoolCode", address: "address", phone: "phone", email: "schoolEmail" }
        const adminMap: Record<string, keyof AdminForm> = { first_name: "firstName", last_name: "lastName", email: "email", password: "password" }
        for (const [field, message] of Object.entries(err.fieldErrors ?? {})) {
          const isAdmin = field.startsWith("admin") || field === "password" || /password|admin/i.test(message)
          const key = field.replace(/^admin[._]/, "")
          if (isAdmin && adminMap[key]) ae[adminMap[key]] = message
          else if (!isAdmin && schoolMap[field]) se[schoolMap[field]] = message
        }
        if (err.statusCode === 409) {
          const m = err.message.toLowerCase()
          if (m.includes("password")) ae.password = err.message
          else if (m.includes("code")) se.schoolCode = err.message
          else if (m.includes("email")) ae.email = err.message
        }
        if (Object.keys(se).length) { setSchoolErrors(se); setStep(1) }
        else if (Object.keys(ae).length) { setAdminErrors(ae); setStep(2) }
        else setGeneralError(err.message)
      } else {
        setGeneralError(err instanceof Error ? err.message : "Registration failed. Please try again.")
      }
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  const shell = (children: React.ReactNode) => (
    <AuthShell
      badge="Attendance"
      headline="Bring your school on board."
      sub="Register your school and its administrator. Shulepoa activates your licence and emails your sign-in details."
      footer={<>© {new Date().getFullYear()} Shulepoa · Secure · Always on · Biometric attendance</>}
    >
      {children}
    </AuthShell>
  )

  if (done) {
    return shell(
      <div className="py-4 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-50 ring-8 ring-green-50/60">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">Registration received</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          <b className="text-slate-700">{done.school}</b> is registered. Shulepoa will activate your licence and email
          your sign-in details to <b className="text-slate-700">{done.email}</b>.
        </p>
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs leading-relaxed text-slate-500">
          You can sign in once the licence is active. Questions? <Link href="/support" className="font-semibold text-green-700 hover:underline">Contact support</Link>.
        </div>
        <Link href="/login" className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-green-600 text-sm font-semibold text-white shadow-sm hover:brightness-95">
          Go to sign in <ArrowRight className="h-4 w-4" />
        </Link>
      </div>,
    )
  }

  return shell(
    <>
      {/* Steps */}
      <ol className="mb-7 flex items-center gap-3" aria-label="Registration steps">
        {[{ n: 1, label: "School" }, { n: 2, label: "Administrator" }].map(({ n, label }, i) => (
          <li key={n} className="flex flex-1 items-center gap-3">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors ${step > n
              ? "bg-green-600 text-white" : step === n ? "bg-green-600 text-white ring-4 ring-green-100" : "bg-slate-100 text-slate-400"}`}
              aria-current={step === n ? "step" : undefined}>
              {step > n ? <Check className="h-4 w-4" /> : n}
            </span>
            <span className={`text-sm font-semibold ${step >= n ? "text-slate-900" : "text-slate-400"}`}>{label}</span>
            {i === 0 && <span className={`h-px flex-1 ${step > 1 ? "bg-green-500" : "bg-slate-200"}`} />}
          </li>
        ))}
      </ol>

      <div className="mb-6">
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-slate-900">
          {step === 1 ? "Register your school" : "School administrator"}
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          {step === 1 ? "Tell us about the school." : "The person who will manage the system for the school."}
        </p>
      </div>

      {generalError && (
        <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-200 border-l-[3px] border-l-rose-500 bg-rose-50 px-4 py-3">
          <AlertCircle className="mt-0.5 h-[15px] w-[15px] shrink-0 text-rose-500" />
          <p className="text-sm leading-snug text-rose-700">{generalError}</p>
        </div>
      )}

      {step === 1 ? (
        <form onSubmit={next} className="space-y-4" noValidate>
          <Field id="schoolName" label="School name" icon={Building2} error={schoolErrors.schoolName}>
            <input id="schoolName" value={school.schoolName} onChange={setS("schoolName")} placeholder="e.g. Greenfield Academy" autoComplete="organization" className={authInputCls} aria-invalid={!!schoolErrors.schoolName} />
          </Field>
          <Field id="schoolCode" label="School code" icon={Hash} error={schoolErrors.schoolCode} hint="Short unique code, e.g. GFA-001">
            <input id="schoolCode" value={school.schoolCode} onChange={setS("schoolCode")} placeholder="GFA-001" className={authInputCls + " font-mono uppercase"} aria-invalid={!!schoolErrors.schoolCode} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="phone" label="Phone" icon={Phone} optional>
              <input id="phone" type="tel" value={school.phone} onChange={setS("phone")} placeholder="0712 345 678" autoComplete="tel" className={authInputCls} />
            </Field>
            <Field id="schoolEmail" label="School email" icon={Mail} optional error={schoolErrors.schoolEmail}>
              <input id="schoolEmail" type="email" value={school.schoolEmail} onChange={setS("schoolEmail")} placeholder="info@school.ac.ke" className={authInputCls} aria-invalid={!!schoolErrors.schoolEmail} />
            </Field>
          </div>
          <Field id="address" label="Address / town" icon={MapPin} optional>
            <input id="address" value={school.address} onChange={setS("address")} placeholder="P.O. Box 123, Nairobi" autoComplete="street-address" className={authInputCls} />
          </Field>
          <button type="submit" className="mt-1 flex h-11 w-full items-center justify-center gap-2.5 rounded-xl bg-green-600 text-sm font-semibold text-white shadow-sm transition-[filter,transform] hover:brightness-95 active:scale-[0.99]">
            Continue <ArrowRight className="h-[15px] w-[15px]" />
          </button>
        </form>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="firstName" label="First name" icon={User} error={adminErrors.firstName}>
              <input id="firstName" value={admin.firstName} onChange={setA("firstName")} autoComplete="given-name" className={authInputCls} aria-invalid={!!adminErrors.firstName} />
            </Field>
            <Field id="lastName" label="Last name" icon={User} error={adminErrors.lastName}>
              <input id="lastName" value={admin.lastName} onChange={setA("lastName")} autoComplete="family-name" className={authInputCls} aria-invalid={!!adminErrors.lastName} />
            </Field>
          </div>
          <Field id="adminEmail" label="Email (used to sign in)" icon={Mail} error={adminErrors.email}>
            <input id="adminEmail" type="email" value={admin.email} onChange={setA("email")} placeholder="admin@school.ac.ke" autoComplete="email" autoCapitalize="none" className={authInputCls} aria-invalid={!!adminErrors.email} />
          </Field>
          <Field id="password" label="Password" icon={Lock} error={adminErrors.password}
            suffix={
              <button type="button" onClick={() => setShowPw(!showPw)} aria-label={showPw ? "Hide password" : "Show password"}
                className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }>
            <input id="password" type={showPw ? "text" : "password"} value={admin.password} onChange={setA("password")} autoComplete="new-password" className={authInputCls} aria-invalid={!!adminErrors.password} />
          </Field>
          {admin.password && (
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-3" aria-label="Password requirements">
              {PASSWORD_RULES.map((r) => {
                const ok = r.test(admin.password)
                return (
                  <li key={r.label} className={`flex items-center gap-1.5 ${ok ? "text-green-700" : "text-slate-400"}`}>
                    <Check className={`h-3.5 w-3.5 ${ok ? "" : "opacity-30"}`} />{r.label}
                  </li>
                )
              })}
            </ul>
          )}
          <Field id="confirmPassword" label="Confirm password" icon={Lock} error={adminErrors.confirmPassword}>
            <input id="confirmPassword" type={showPw ? "text" : "password"} value={admin.confirmPassword} onChange={setA("confirmPassword")} autoComplete="new-password" className={authInputCls} aria-invalid={!!adminErrors.confirmPassword} />
          </Field>
          <div className="flex flex-col-reverse gap-2.5 pt-1 sm:flex-row">
            <button type="button" onClick={() => { setStep(1); setGeneralError(null) }} disabled={loading}
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button type="submit" disabled={loading}
              className="flex h-11 flex-1 items-center justify-center gap-2.5 rounded-xl bg-green-600 text-sm font-semibold text-white shadow-sm transition-[filter,transform] hover:brightness-95 enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60">
              {loading
                ? <><span className="h-[15px] w-[15px] animate-spin rounded-full border-2 border-white/30 border-t-white" />Registering…</>
                : <>Complete registration <ArrowRight className="h-[15px] w-[15px]" /></>}
            </button>
          </div>
        </form>
      )}

      <p className="mt-6 border-t border-slate-100 pt-5 text-center text-xs leading-relaxed text-slate-400">
        Already registered?{" "}
        <Link href="/login" className="font-semibold text-green-700 underline-offset-2 hover:underline">Sign in</Link>
      </p>
    </>,
  )
}

function Field({
  id, label, icon: Icon, error, hint, optional, suffix, children,
}: {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  error?: string
  hint?: string
  optional?: boolean
  suffix?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className={authLabelCls}>
        {label}{optional && <span className="ml-1 font-medium normal-case tracking-normal text-slate-400">(optional)</span>}
      </label>
      <div className="relative">
        <Icon className={authIconCls} aria-hidden="true" />
        {children}
        {suffix}
      </div>
      {error ? (
        <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-rose-600"><AlertCircle className="h-3 w-3" />{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-slate-400">{hint}</p>
      ) : null}
    </div>
  )
}

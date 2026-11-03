"use client"

/**
 * Platform owner console: every school on the system, their licences and
 * their admin sign-in. Granting a licence switches the school admin on and
 * emails them a temporary password with the licence certificate.
 */

import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle, Award, Building2, Check, Copy, Download, KeyRound, LogOut, Mail, Pencil, Plus,
  RefreshCw, Search, ShieldCheck, Users, X,
} from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  platformApi, PlatformError,
  type CredentialsResult, type LicenseState, type PlatformLicense, type PlatformOverview, type PlatformSchool,
} from "@/lib/api/platform"
import { usePlatformAuthStore } from "@/lib/store/platformAuthStore"

const STATE_STYLE: Record<LicenseState, string> = {
  active: "bg-green-50 text-green-700 ring-green-200",
  scheduled: "bg-sky-50 text-sky-700 ring-sky-200",
  expired: "bg-amber-50 text-amber-800 ring-amber-200",
  suspended: "bg-orange-50 text-orange-700 ring-orange-200",
  revoked: "bg-rose-50 text-rose-700 ring-rose-200",
  unlicensed: "bg-slate-100 text-slate-600 ring-slate-200",
}

const fmtDate = (iso?: string | null) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"

function StateBadge({ state }: { state: LicenseState }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ring-1 ${STATE_STYLE[state]}`}>
      {state}
    </span>
  )
}

const inputCls =
  "h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-[border-color,box-shadow] hover:border-slate-400 focus:border-green-600 focus:ring-[3px] focus:ring-green-500/25"
const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-600"
const primaryBtn =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-green-600 px-4 text-sm font-semibold text-white shadow-sm transition-[filter] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
const secondaryBtn =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <span className={`${className} inline-block animate-spin rounded-full border-2 border-current/30 border-t-current`} />
}

export default function ManagementPage() {
  const router = useRouter()
  const { token, email, mustChangePassword, hasHydrated, signOut } = usePlatformAuthStore()
  const [data, setData] = useState<PlatformOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [stateFilter, setStateFilter] = useState<"all" | LicenseState>("all")
  const [openId, setOpenId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<PlatformSchool | null>(null)
  const [licensing, setLicensing] = useState<PlatformSchool | null>(null)
  const [creds, setCreds] = useState<CredentialsResult | null>(null)

  const fail = useCallback((err: unknown) => {
    if (err instanceof PlatformError && err.status === 401) {
      signOut()
      router.replace("/management/login")
      return
    }
    toast.error(err instanceof Error ? err.message : "Something went wrong")
  }, [router, signOut])

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      setData(await platformApi.overview(token))
    } catch (err) {
      fail(err)
    } finally {
      setLoading(false)
    }
  }, [token, fail])

  useEffect(() => {
    if (!hasHydrated) return
    if (!token) router.replace("/management/login")
    else load()
  }, [hasHydrated, token, router, load])

  const upsert = (school: PlatformSchool) =>
    setData((d) => d && {
      ...d,
      schools: d.schools.some((s) => s.id === school.id)
        ? d.schools.map((s) => (s.id === school.id ? school : s))
        : [...d.schools, school].sort((a, b) => a.name.localeCompare(b.name)),
    })

  const schools = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (data?.schools ?? []).filter((s) =>
      (stateFilter === "all" || s.license_state === stateFilter) &&
      (!q || [s.name, s.code, s.email, s.admin?.email].some((v) => v?.toLowerCase().includes(q))))
  }, [data, query, stateFilter])

  const open = data?.schools.find((s) => s.id === openId) ?? null

  if (!hasHydrated || !token) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50"><Spinner className="h-8 w-8 text-green-600" /></div>
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg font-black text-white"
            style={{ background: "#15803d" }}>S</span>
          <div className="min-w-0 leading-tight">
            <p className="font-extrabold tracking-tight text-slate-900">Shulepoa</p>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-green-700">Management</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden truncate text-sm text-slate-500 sm:block">{email}</span>
            <button className={secondaryBtn + " h-9 px-3"} onClick={() => { signOut(); router.replace("/management/login") }}>
              <LogOut className="h-4 w-4" /><span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Schools</h1>
            <p className="mt-1 text-sm text-slate-500">Onboard schools, grant licences and send each school its sign-in.</p>
          </div>
          <div className="flex gap-2">
            <button className={secondaryBtn} onClick={load} disabled={loading} aria-label="Refresh">
              {loading ? <Spinner /> : <RefreshCw className="h-4 w-4" />}
            </button>
            <button className={primaryBtn} onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New school</button>
          </div>
        </div>

        {data && !data.mail_configured && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <p className="text-sm text-amber-900">
              <b>Email is not set up yet.</b> When you grant a licence, the school admin’s temporary password is shown here
              once so you can pass it on. Add the SMTP settings to the server’s .env to send it by email automatically.
            </p>
          </div>
        )}

        {/* Totals */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { label: "Schools", value: data?.totals.schools, icon: Building2 },
            { label: "Licensed", value: data?.totals.licensed, icon: ShieldCheck },
            { label: "Not licensed", value: data?.totals.unlicensed, icon: AlertTriangle },
            { label: "Expiring in 30 days", value: data?.totals.expiring_30d, icon: Award },
            { label: "Learners", value: data?.totals.students, icon: Users },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-slate-500">
                <Icon className="h-4 w-4" /><span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {value == null ? <span className="inline-block h-7 w-10 animate-pulse rounded bg-slate-100" /> : value.toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by school, code or admin email"
              className={inputCls + " pl-9"} />
          </div>
          <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value as typeof stateFilter)} className={inputCls + " sm:w-48"}>
            <option value="all">All licence states</option>
            {(["active", "unlicensed", "expired", "suspended", "scheduled", "revoked"] as const).map((s) => (
              <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>

        {/* List */}
        {loading && !data ? (
          <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-green-600" /></div>
        ) : schools.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <Building2 className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 font-semibold text-slate-700">{data?.schools.length ? "No school matches" : "No schools yet"}</p>
            <p className="mt-1 text-sm text-slate-500">{data?.schools.length ? "Try another search." : "Add the first school to get started."}</p>
          </div>
        ) : (
          <>
            {/* Phones: cards */}
            <div className="space-y-2 md:hidden">
              {schools.map((s) => (
                <button key={s.id} onClick={() => setOpenId(s.id)}
                  className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-green-300">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{s.name}</p>
                      <p className="truncate text-xs text-slate-500">{s.code} · {s.admin?.email ?? "no admin"}</p>
                    </div>
                    <StateBadge state={s.license_state} />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {s.current_license ? `Until ${fmtDate(s.current_license.expires_on)}` : "No current licence"} · {s.students} learners
                  </p>
                </button>
              ))}
            </div>
            {/* Wider screens: table */}
            <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">School</th>
                    <th className="px-4 py-3">Admin</th>
                    <th className="px-4 py-3">Licence</th>
                    <th className="px-4 py-3">Valid until</th>
                    <th className="px-4 py-3 text-right">Learners</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {schools.map((s) => (
                    <tr key={s.id} onClick={() => setOpenId(s.id)} className="cursor-pointer transition-colors hover:bg-green-50/40">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{s.name}</p>
                        <p className="text-xs text-slate-500">{s.code}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{s.admin?.email ?? "—"}</td>
                      <td className="px-4 py-3"><StateBadge state={s.license_state} /></td>
                      <td className="px-4 py-3 text-slate-600">{fmtDate(s.current_license?.expires_on)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{s.students.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      {open && (
        <SchoolPanel
          school={open}
          token={token}
          onClose={() => setOpenId(null)}
          onChange={upsert}
          onEdit={() => setEditing(open)}
          onIssue={() => setLicensing(open)}
          onCredentials={setCreds}
          onError={fail}
        />
      )}
      {(creating || editing) && (
        <SchoolForm
          token={token}
          school={editing}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSaved={(s) => { upsert(s); setCreating(false); setEditing(null); setOpenId(s.id); load() }}
          onError={fail}
        />
      )}
      {licensing && (
        <IssueLicense
          token={token}
          school={licensing}
          onClose={() => setLicensing(null)}
          onIssued={(s, c) => { upsert(s); setLicensing(null); if (c) setCreds(c); load() }}
          onError={fail}
        />
      )}
      {creds && <CredentialsDialog result={creds} onClose={() => setCreds(null)} />}
      {mustChangePassword && <ChangePassword token={token} onError={fail} />}
    </div>
  )
}

/* ── School side panel ─────────────────────────────────────────────────── */

function SchoolPanel({
  school, token, onClose, onChange, onEdit, onIssue, onCredentials, onError,
}: {
  school: PlatformSchool
  token: string
  onClose: () => void
  onChange: (s: PlatformSchool) => void
  onEdit: () => void
  onIssue: () => void
  onCredentials: (c: CredentialsResult) => void
  onError: (e: unknown) => void
}) {
  const [busy, setBusy] = useState<string | null>(null)

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    try { await fn() } catch (e) { onError(e) } finally { setBusy(null) }
  }
  const setStatus = (lic: PlatformLicense, status: "active" | "suspended" | "revoked") =>
    run(`${status}-${lic.id}`, async () => {
      if (status === "revoked" && !window.confirm(`Revoke ${lic.certificate_no}? This cannot be undone.`)) return
      onChange(await platformApi.setLicenseStatus(token, school.id, lic.id, status))
      toast.success(`Licence ${status === "active" ? "reinstated" : status}`)
    })

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2"><StateBadge state={school.license_state} /></div>
          <SheetTitle className="text-xl">{school.name}</SheetTitle>
          <SheetDescription>{school.code} · {school.school_type} school · {school.students} learners</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 p-4">
          <div className="grid grid-cols-2 gap-2">
            <button className={primaryBtn} onClick={onIssue}><Award className="h-4 w-4" />{school.current_license ? "Renew licence" : "Grant licence"}</button>
            <button className={secondaryBtn} disabled={!school.current_license || busy === "resend"}
              onClick={() => run("resend", async () => {
                if (!window.confirm(`Reset ${school.admin?.email}'s password and send new sign-in details?`)) return
                onCredentials(await platformApi.resendCredentials(token, school.id))
              })}>
              {busy === "resend" ? <Spinner /> : <KeyRound className="h-4 w-4" />}Resend login
            </button>
          </div>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Details</h3>
              <button onClick={onEdit} className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 hover:underline">
                <Pencil className="h-3 w-3" />Edit
              </button>
            </div>
            <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
              {[
                ["Admin", school.admin ? `${school.admin.first_name} ${school.admin.last_name}` : "—"],
                ["Admin email", school.admin?.email ?? "—"],
                ["Admin account", school.admin ? (school.admin.is_active ? "Active" : "Off until licensed") : "—"],
                ["School email", school.email ?? "—"],
                ["Phone", school.phone ?? "—"],
                ["Address", [school.po_box && `P.O. Box ${school.po_box}`, school.address].filter(Boolean).join(", ") || "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-3 px-3 py-2">
                  <dt className="w-28 shrink-0 text-slate-500">{k}</dt>
                  <dd className="min-w-0 break-words font-medium text-slate-900">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Licences</h3>
            {school.licenses.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
                No licence yet. Grant one to switch the school admin on.
              </p>
            ) : (
              <ul className="space-y-2">
                {school.licenses.map((l) => (
                  <li key={l.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">{l.certificate_no}</p>
                        <p className="text-xs capitalize text-slate-500">
                          {l.plan} · {fmtDate(l.starts_on)} – {fmtDate(l.expires_on)}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-slate-400">{l.license_key}</p>
                      </div>
                      <StateBadge state={l.state} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <button className={secondaryBtn + " h-8 px-3 text-xs"} disabled={busy === `cert-${l.id}`}
                        onClick={() => run(`cert-${l.id}`, () => platformApi.downloadCertificate(token, school.id, l))}>
                        {busy === `cert-${l.id}` ? <Spinner className="h-3 w-3" /> : <Download className="h-3.5 w-3.5" />}Certificate
                      </button>
                      {l.status === "active" && (
                        <button className={secondaryBtn + " h-8 px-3 text-xs"} disabled={!!busy} onClick={() => setStatus(l, "suspended")}>Suspend</button>
                      )}
                      {l.status === "suspended" && (
                        <button className={secondaryBtn + " h-8 px-3 text-xs"} disabled={!!busy} onClick={() => setStatus(l, "active")}>Reinstate</button>
                      )}
                      {l.status !== "revoked" && (
                        <button className={secondaryBtn + " h-8 px-3 text-xs text-rose-700 hover:bg-rose-50"} disabled={!!busy} onClick={() => setStatus(l, "revoked")}>Revoke</button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/* ── New / edit school ─────────────────────────────────────────────────── */

function SchoolForm({
  token, school, onClose, onSaved, onError,
}: {
  token: string
  school: PlatformSchool | null
  onClose: () => void
  onSaved: (s: PlatformSchool) => void
  onError: (e: unknown) => void
}) {
  const [f, setF] = useState({
    name: school?.name ?? "", email: school?.email ?? "", phone: school?.phone ?? "",
    po_box: school?.po_box ?? "", address: school?.address ?? "", school_type: school?.school_type ?? "mixed",
    admin_first_name: school?.admin?.first_name ?? "", admin_last_name: school?.admin?.last_name ?? "",
    admin_email: school?.admin?.email ?? "",
  })
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const body = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() === "" ? null : v.trim()]))
    try {
      const saved = school ? await platformApi.updateSchool(token, school.id, body) : await platformApi.createSchool(token, body)
      toast.success(school ? "School updated" : "School added — grant a licence to switch its admin on")
      onSaved(saved)
    } catch (err) {
      onError(err)
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{school ? "Edit school" : "New school"}</DialogTitle>
          <DialogDescription>
            {school ? "Changes apply straight away." : "The admin account stays off until you grant the school a licence."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className={labelCls}>School name</label><input required className={inputCls} value={f.name} onChange={set("name")} /></div>
            <div><label className={labelCls}>School email</label><input type="email" className={inputCls} value={f.email} onChange={set("email")} /></div>
            <div><label className={labelCls}>Phone</label><input className={inputCls} value={f.phone} onChange={set("phone")} /></div>
            <div><label className={labelCls}>P.O. Box</label><input className={inputCls} value={f.po_box} onChange={set("po_box")} /></div>
            <div>
              <label className={labelCls}>Type</label>
              <select className={inputCls} value={f.school_type} onChange={set("school_type")}>
                <option value="day">Day</option><option value="boarding">Boarding</option><option value="mixed">Day &amp; boarding</option>
              </select>
            </div>
            <div className="sm:col-span-2"><label className={labelCls}>Address / town</label><input className={inputCls} value={f.address} onChange={set("address")} /></div>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="mb-3 text-sm font-semibold text-slate-900">School admin</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className={labelCls}>First name</label><input required={!school} className={inputCls} value={f.admin_first_name} onChange={set("admin_first_name")} /></div>
              <div><label className={labelCls}>Last name</label><input required={!school} className={inputCls} value={f.admin_last_name} onChange={set("admin_last_name")} /></div>
              <div className="sm:col-span-2"><label className={labelCls}>Admin email (sign-in)</label><input required={!school} type="email" className={inputCls} value={f.admin_email} onChange={set("admin_email")} /></div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className={secondaryBtn} onClick={onClose}>Cancel</button>
            <button type="submit" className={primaryBtn} disabled={busy}>{busy && <Spinner />}{school ? "Save changes" : "Add school"}</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ── Grant / renew a licence ───────────────────────────────────────────── */

function IssueLicense({
  token, school, onClose, onIssued, onError,
}: {
  token: string
  school: PlatformSchool
  onClose: () => void
  onIssued: (s: PlatformSchool, c?: CredentialsResult) => void
  onError: (e: unknown) => void
}) {
  const renewing = !!school.current_license
  const nextStart = renewing
    ? new Date(new Date(`${school.current_license!.expires_on}T12:00:00`).getTime() + 86_400_000).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10)
  const [f, setF] = useState({ plan: "standard", months: "12", starts_on: nextStart, max_students: "", max_devices: "", notes: "" })
  const [send, setSend] = useState(!renewing)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const r = await platformApi.issueLicense(token, school.id, {
        plan: f.plan, months: Number(f.months), starts_on: f.starts_on,
        max_students: f.max_students ? Number(f.max_students) : null,
        max_devices: f.max_devices ? Number(f.max_devices) : null,
        notes: f.notes || null, send_credentials: send,
      })
      toast.success(`Licence ${r.license.certificate_no} granted`)
      onIssued(r.school, r.credentials)
    } catch (err) {
      onError(err)
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{renewing ? "Renew licence" : "Grant licence"}</DialogTitle>
          <DialogDescription>{school.name}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Plan</label>
              <select className={inputCls} value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value })}>
                <option value="trial">Trial</option><option value="standard">Standard</option><option value="premium">Premium</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Length</label>
              <select className={inputCls} value={f.months} onChange={(e) => setF({ ...f, months: e.target.value })}>
                {[1, 3, 6, 12, 24, 36].map((m) => <option key={m} value={m}>{m === 1 ? "1 month" : m < 12 ? `${m} months` : `${m / 12} year${m > 12 ? "s" : ""}`}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2"><label className={labelCls}>Starts on</label><input type="date" required className={inputCls} value={f.starts_on} onChange={(e) => setF({ ...f, starts_on: e.target.value })} /></div>
            <div><label className={labelCls}>Max learners</label><input type="number" min={1} placeholder="No limit" className={inputCls} value={f.max_students} onChange={(e) => setF({ ...f, max_students: e.target.value })} /></div>
            <div><label className={labelCls}>Max devices</label><input type="number" min={1} placeholder="No limit" className={inputCls} value={f.max_devices} onChange={(e) => setF({ ...f, max_devices: e.target.value })} /></div>
            <div className="sm:col-span-2"><label className={labelCls}>Notes (internal)</label><textarea rows={2} className={inputCls + " h-auto py-2"} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
          </div>
          <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 p-3 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-green-600" checked={send} onChange={(e) => setSend(e.target.checked)} />
            <span>
              <span className="font-semibold text-slate-900">Send sign-in details to {school.admin?.email ?? "the admin"}</span>
              <span className="block text-slate-500">Switches the admin on with a new temporary password and emails it with the certificate.</span>
            </span>
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className={secondaryBtn} onClick={onClose}>Cancel</button>
            <button type="submit" className={primaryBtn} disabled={busy}>{busy && <Spinner />}{renewing ? "Renew" : "Grant licence"}</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ── Result of sending credentials ─────────────────────────────────────── */

function CredentialsDialog({ result, onClose }: { result: CredentialsResult; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(`Email: ${result.admin_email}\nTemporary password: ${result.temporary_password}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {result.emailed ? <><Check className="h-5 w-5 text-green-600" />Sign-in details sent</> : <><KeyRound className="h-5 w-5 text-amber-600" />Pass these on to the school</>}
          </DialogTitle>
          <DialogDescription>
            {result.emailed
              ? `${result.admin_email} has been emailed a temporary password and the licence certificate.`
              : `${result.email_error ?? "The email did not go."} This password is shown only once.`}
          </DialogDescription>
        </DialogHeader>
        {!result.emailed && result.temporary_password && (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <p className="text-slate-500">Email</p>
              <p className="font-semibold text-slate-900">{result.admin_email}</p>
              <p className="mt-3 text-slate-500">Temporary password</p>
              <p className="select-all font-mono text-lg font-bold tracking-wide text-slate-900">{result.temporary_password}</p>
            </div>
            <button className={secondaryBtn + " w-full"} onClick={copy}>
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}Copy both
            </button>
          </div>
        )}
        <div className="flex justify-end"><button className={primaryBtn} onClick={onClose}>Done</button></div>
      </DialogContent>
    </Dialog>
  )
}

/* ── First sign-in: choose a password ──────────────────────────────────── */

function ChangePassword({ token, onError }: { token: string; onError: (e: unknown) => void }) {
  const { passwordChanged } = usePlatformAuthStore()
  const [f, setF] = useState({ current: "", next: "", confirm: "" })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState("")

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (f.next.length < 10) return setMsg("Use at least 10 characters.")
    if (f.next !== f.confirm) return setMsg("The two new passwords don’t match.")
    setBusy(true)
    setMsg("")
    try {
      await platformApi.changePassword(token, f.current, f.next)
      passwordChanged()
      toast.success("Password changed")
    } catch (err) {
      if (err instanceof PlatformError && err.status === 400) setMsg(err.message)
      else onError(err)
      setBusy(false)
    }
  }

  return (
    <Dialog open>
      <DialogContent showCloseButton={false} className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Choose your own password</DialogTitle>
          <DialogDescription>You signed in with a temporary password. Set a new one to continue.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div><label className={labelCls}>Temporary password</label><input type="password" required autoComplete="current-password" className={inputCls} value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} /></div>
          <div><label className={labelCls}>New password</label><input type="password" required autoComplete="new-password" className={inputCls} value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} /></div>
          <div><label className={labelCls}>Confirm new password</label><input type="password" required autoComplete="new-password" className={inputCls} value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></div>
          {msg && <p className="flex items-center gap-1.5 text-sm text-rose-600"><X className="h-4 w-4" />{msg}</p>}
          <button type="submit" className={primaryBtn + " w-full"} disabled={busy}>{busy && <Spinner />}Save password</button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

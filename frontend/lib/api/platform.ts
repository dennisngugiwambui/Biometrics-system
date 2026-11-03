/**
 * Platform owner console API (/management) — /api/v1/platform/*.
 *
 * Uses fetch, not the shared axios instance: that instance's interceptors send
 * any 401 to the school /login, while the console has its own sign-in.
 */

import { getApiBaseUrlOrFallback } from "@/lib/env"

export type LicenseState = "active" | "scheduled" | "expired" | "suspended" | "revoked" | "unlicensed"

export interface PlatformLicense {
  id: number
  license_key: string
  certificate_no: string
  plan: "trial" | "standard" | "premium"
  max_students: number | null
  max_devices: number | null
  starts_on: string
  expires_on: string
  status: "active" | "suspended" | "revoked"
  state: LicenseState
  notes: string | null
  issued_at: string | null
  credentials_sent_at: string | null
}

export interface PlatformSchool {
  id: number
  name: string
  code: string
  email: string | null
  phone: string | null
  address: string | null
  po_box: string | null
  school_type: "day" | "boarding" | "mixed"
  created_at: string | null
  students: number
  admin: { id: number; email: string; first_name: string; last_name: string; is_active: boolean } | null
  license_state: LicenseState
  current_license: PlatformLicense | null
  licenses: PlatformLicense[]
}

export interface PlatformOverview {
  mail_configured: boolean
  totals: { schools: number; licensed: number; unlicensed: number; expiring_30d: number; students: number }
  schools: PlatformSchool[]
}

export interface PlatformSession {
  access_token: string
  email: string
  full_name: string
  must_change_password: boolean
}

export interface CredentialsResult {
  emailed: boolean
  email_error: string | null
  admin_email: string
  temporary_password: string | null
}

export class PlatformError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

async function call<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, headers, ...rest } = init
  let res: Response
  try {
    res = await fetch(`${getApiBaseUrlOrFallback()}/api/v1/platform${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    })
  } catch {
    throw new PlatformError("Cannot reach the server. Check your connection and try again.", 0)
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    try {
      const body = await res.json()
      const d = body?.detail
      msg = typeof d === "string" ? d : Array.isArray(d) ? d.map((x: { msg?: string }) => x?.msg).filter(Boolean).join("; ") || msg : msg
    } catch { /* keep msg */ }
    throw new PlatformError(msg, res.status)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const platformApi = {
  login: (email: string, password: string) =>
    call<PlatformSession>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  changePassword: (token: string, current_password: string, new_password: string) =>
    call<void>("/auth/change-password", { method: "POST", token, body: JSON.stringify({ current_password, new_password }) }),
  overview: (token: string) => call<PlatformOverview>("/overview", { token }),
  createSchool: (token: string, body: Record<string, unknown>) =>
    call<PlatformSchool>("/schools", { method: "POST", token, body: JSON.stringify(body) }),
  updateSchool: (token: string, id: number, body: Record<string, unknown>) =>
    call<PlatformSchool>(`/schools/${id}`, { method: "PATCH", token, body: JSON.stringify(body) }),
  issueLicense: (token: string, id: number, body: Record<string, unknown>) =>
    call<{ license: PlatformLicense; credentials?: CredentialsResult; school: PlatformSchool }>(
      `/schools/${id}/licenses`, { method: "POST", token, body: JSON.stringify(body) }),
  setLicenseStatus: (token: string, id: number, licenseId: number, status: "active" | "suspended" | "revoked") =>
    call<PlatformSchool>(`/schools/${id}/licenses/${licenseId}`, { method: "PATCH", token, body: JSON.stringify({ status }) }),
  resendCredentials: (token: string, id: number) =>
    call<CredentialsResult>(`/schools/${id}/resend-credentials`, { method: "POST", token }),
  /** Fetches the certificate PDF and saves it. */
  async downloadCertificate(token: string, id: number, lic: PlatformLicense) {
    let res: Response
    try {
      res = await fetch(`${getApiBaseUrlOrFallback()}/api/v1/platform/schools/${id}/licenses/${lic.id}/certificate`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch {
      throw new PlatformError("Cannot reach the server.", 0)
    }
    if (!res.ok) throw new PlatformError("Could not generate the certificate", res.status)
    const url = URL.createObjectURL(await res.blob())
    const a = document.createElement("a")
    a.href = url
    a.download = `licence-${lic.certificate_no.replace(/\//g, "-")}.pdf`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  },
}

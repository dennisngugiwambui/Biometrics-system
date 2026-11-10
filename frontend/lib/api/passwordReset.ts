/**
 * Forgot-password API (School Service, via the gateway).
 *
 *  POST /api/v1/auth/forgot-password        { email }               → { message }
 *  POST /api/v1/auth/reset-password/verify  { token }               → { valid, email }
 *  POST /api/v1/auth/reset-password         { token, new_password } → { message }
 */
import axios from "axios"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

function messageFrom(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) return "Cannot reach the server. Please make sure the backend is running."
    if (err.response.status === 429) return "Too many requests. Please wait a few minutes and try again."
    const detail = (err.response.data as { detail?: unknown } | undefined)?.detail
    if (typeof detail === "string") return detail
    if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg).replace(/^Value error, /, "")
  }
  return fallback
}

export async function requestPasswordReset(email: string): Promise<string> {
  try {
    const r = await axios.post<{ message: string }>(`${API_BASE_URL}/api/v1/auth/forgot-password`, { email })
    return r.data.message
  } catch (err) {
    throw new Error(messageFrom(err, "Could not send the reset email. Please try again."))
  }
}

export async function verifyResetToken(token: string): Promise<string> {
  try {
    const r = await axios.post<{ valid: boolean; email: string }>(
      `${API_BASE_URL}/api/v1/auth/reset-password/verify`, { token })
    return r.data.email
  } catch (err) {
    throw new Error(messageFrom(err, "This reset link is invalid or has expired."))
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<string> {
  try {
    const r = await axios.post<{ message: string }>(
      `${API_BASE_URL}/api/v1/auth/reset-password`, { token, new_password: newPassword })
    return r.data.message
  } catch (err) {
    throw new Error(messageFrom(err, "Could not change the password. Please try again."))
  }
}

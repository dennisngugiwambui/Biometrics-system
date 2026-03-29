/**
 * Environment-derived URLs for API and WebSockets.
 *
 * When hosted (e.g. School A at https://api.school-a.com, School B at https://api.school-b.com),
 * set NEXT_PUBLIC_API_URL (and optionally NEXT_PUBLIC_WS_URL) per deployment. No code changes
 * are required — each school's build or runtime uses their own env.
 *
 * - NEXT_PUBLIC_API_URL: backend API gateway (HTTP). e.g. https://api.school-a.com
 * - NEXT_PUBLIC_WS_URL: optional; if unset, WebSocket base is derived from API URL (same host, ws/wss).
 */

const FALLBACK_API = "http://localhost:8000"

function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    return (process.env.NEXT_PUBLIC_API_URL || FALLBACK_API).replace(/\/$/, "")
  }
  return process.env.NEXT_PUBLIC_API_URL || FALLBACK_API
}

/**
 * Base URL for HTTP API (gateway). Use for REST calls.
 */
export function getApiBaseUrlOrFallback(): string {
  return getApiBaseUrl()
}

/**
 * Base URL for WebSocket connections. Uses NEXT_PUBLIC_WS_URL if set;
 * otherwise same host as API with scheme ws/wss (hosting-friendly).
 */
export function getWsBaseUrl(): string {
  const wsEnv = process.env.NEXT_PUBLIC_WS_URL
  if (wsEnv && wsEnv.trim()) {
    return wsEnv.replace(/\/$/, "")
  }
  const api = getApiBaseUrl()
  return api.replace(/^http/, "ws")
}

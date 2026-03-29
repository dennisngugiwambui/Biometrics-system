# Deployment: One Instance Per School

The system is designed so that **each school can run its own deployment** (School A on their server, School B on another) with **no code changes**. All URLs and origins are driven by **environment variables** per deployment.

## How it works

- **Backend**: Every service (API Gateway, School Service, Device Service, etc.) reads URLs and secrets from env (e.g. `.env` or your host’s env config). Defaults in code are for local development only.
- **Frontend**: Build or runtime uses `NEXT_PUBLIC_API_URL` (and optionally `NEXT_PUBLIC_WS_URL`). Same codebase; each school sets their own API URL for their deployment.

So when you host for School A you set their API URL and origins; when you host for School B you set different values. The two deployments are independent.

## Backend (per service)

Set these in `.env` or your hosting panel for **each** deployment.

| Variable | Where | Purpose |
|----------|--------|---------|
| `SCHOOL_SERVICE_URL` | API Gateway | URL of school service (e.g. `http://school-service:8001` or `http://localhost:8001`) |
| `DEVICE_SERVICE_URL` | API Gateway | URL of device service |
| `ATTENDANCE_SERVICE_URL` | API Gateway | URL of attendance service |
| `NOTIFICATION_SERVICE_URL` | API Gateway | URL of notification service |
| `APP_BASE_URL` | API Gateway | Public URL of the frontend (e.g. `https://app.school-a.com`) |
| `ALLOWED_ORIGINS` | API Gateway | CORS: comma-separated frontend origins (e.g. `https://app.school-a.com`) |
| `NOTIFICATION_INTERNAL_KEY` | API Gateway | Shared secret for internal trigger (same as below) |
| `INTERNAL_API_KEY` | School Service | Same value as `NOTIFICATION_INTERNAL_KEY` (for internal API) |
| `API_GATEWAY_URL` | Device Service | Gateway URL (e.g. `http://gateway:8000`) |
| `NOTIFICATION_INTERNAL_KEY` | Device Service | Same as API Gateway (for trigger-attendance-internal) |
| `DATABASE_URL` | All services | PostgreSQL connection string for that deployment |

Defaults in code use `localhost` and dev ports; override everything in production.

## Frontend

Set at **build time** or in your host’s env (e.g. Vercel, Netlify):

| Variable | Purpose |
|----------|--------|
| `NEXT_PUBLIC_API_URL` | Backend API gateway URL (e.g. `https://api.school-a.com`) |
| `NEXT_PUBLIC_WS_URL` | Optional. WebSocket base URL. If unset, derived from API URL (same host, `ws`/`wss`). |

Example for School A:

- `NEXT_PUBLIC_API_URL=https://api.school-a.com`
- (Optional) `NEXT_PUBLIC_WS_URL=wss://api.school-a.com`

Example for School B:

- `NEXT_PUBLIC_API_URL=https://api.school-b.com`

REST and WebSocket URLs then target the correct host per deployment.

## WebSockets when hosted

- If the frontend uses the **same host** for API and WebSockets (e.g. `https://api.school-a.com`), ensure your **reverse proxy** (e.g. nginx) or API gateway proxies `/ws/*` to the device service so that `wss://api.school-a.com/ws/device-status` and similar paths work.
- Alternatively, expose the device service and set `NEXT_PUBLIC_WS_URL` to that base URL (e.g. `wss://ws.school-a.com`).

## Summary

- **No hardcoded school-specific URLs** in code; all are from config/env.
- **One deployment per school**: each has its own `.env` (or equivalent) with its own URLs and secrets.
- **Same codebase** for every school; only environment variables change per host.

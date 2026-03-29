/**
 * Axios configuration with global interceptors for authentication.
 * 
 * Features:
 * - Automatic token injection in requests
 * - Automatic logout on 401 (Unauthorized) responses
 * - Token expiration checking
 * - Centralized error handling
 * 
 * This sets up global axios defaults and interceptors that apply to ALL axios requests,
 * including those made directly with `axios.get()`, `axios.post()`, etc.
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/lib/store/authStore';
import { isTokenExpired } from '@/lib/utils/jwt';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const LAST_ACTIVITY_KEY = 'last_activity_at';

function getIdleForMs(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(LAST_ACTIVITY_KEY);
    const last = raw ? Number(raw) : NaN;
    const lastActivity = Number.isFinite(last) ? last : Date.now();
    return Math.max(0, Date.now() - lastActivity);
  } catch {
    return 0;
  }
}

// Keep in sync with useSessionCheck default
const DEFAULT_IDLE_TIMEOUT_MS = 300000; // 5 minutes

// Separate axios instance with NO interceptors (avoids refresh recursion)
const refreshAxios = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const authStore = useAuthStore.getState();
  const refreshToken = authStore.refreshToken;
  if (!refreshToken) {
    throw new Error('No refresh token');
  }

  const res = await refreshAxios.post<{
    access_token: string;
    refresh_token?: string | null;
    token_type: string;
  }>('/api/v1/auth/refresh', { refresh_token: refreshToken });

  if (!res.data?.access_token) {
    throw new Error('Refresh failed');
  }

  authStore.setTokens({
    accessToken: res.data.access_token,
    refreshToken: res.data.refresh_token ?? refreshToken,
  });

  return res.data.access_token;
}

// Set axios default base URL (used by all axios requests)
axios.defaults.baseURL = API_BASE_URL;
axios.defaults.timeout = 30000; // 30 seconds
axios.defaults.headers.common['Content-Type'] = 'application/json';

/**
 * Handle automatic logout when session expires.
 * This function is called from interceptors and can be called from anywhere.
 */
function handleSessionExpiration(message: string = 'Your session has expired. Please log in again.'): void {
  // Only run on client side
  if (typeof window === 'undefined') {
    return;
  }

  const authStore = useAuthStore.getState();

  // Only logout if user is actually authenticated
  if (authStore.isAuthenticated && authStore.token) {
    // Clear authentication state
    authStore.logout();

    // Store message for display after redirect (using sessionStorage which clears on tab close)
    if (message) {
      sessionStorage.setItem('session_expired_message', message);
    }

    // Redirect to login page
    window.location.href = '/login';
  }
}

/**
 * Global request interceptor: Add authentication token to ALL requests.
 * This applies to all axios requests made anywhere in the app.
 */
axios.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Only run on client side
    if (typeof window === 'undefined') {
      return config;
    }

    const authStore = useAuthStore.getState();
    const token = authStore.token;

    // Check if token exists and is not expired before adding to request
    if (token) {
      // Check token expiration (with 5 second buffer to account for network delay)
      if (isTokenExpired(token, 5)) {
        // Token is expired. If user is active, auto-refresh; if idle, logout.
        const idleForMs = getIdleForMs();
        if (idleForMs < DEFAULT_IDLE_TIMEOUT_MS && authStore.refreshToken) {
          try {
            if (!isRefreshing) {
              isRefreshing = true;
              refreshPromise = refreshAccessToken().finally(() => {
                isRefreshing = false;
                refreshPromise = null;
              });
            }
            const newToken = await (refreshPromise ?? refreshAccessToken());
            config.headers.Authorization = `Bearer ${newToken}`;
            return config;
          } catch {
            // Fall through to logout handling below
          }
        }

        if (idleForMs >= DEFAULT_IDLE_TIMEOUT_MS) {
          handleSessionExpiration('Your session has expired. Please log in again.');
        }

        // Cancel the request (expired token cannot succeed)
        return Promise.reject(new Error('Token expired'));
      }

      // Add token to Authorization header (only if not already set)
      if (!config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Global response interceptor: Handle 401 (Unauthorized) responses and token expiration.
 * This applies to all axios responses from anywhere in the app.
 */
axios.interceptors.response.use(
  (response) => {
    // Successful response, return as-is
    return response;
  },
  async (error: AxiosError) => {
    // Only run on client side
    if (typeof window === 'undefined') {
      return Promise.reject(error);
    }

    // Handle 401 Unauthorized (token expired or invalid)
    if (error.response?.status === 401) {
      // Only handle 401 if it's not from the login endpoint (to avoid logout loop)
      const url = error.config?.url || '';
      if (!url.includes('/auth/login')) {
        const idleForMs = getIdleForMs();
        const authStore = useAuthStore.getState();

        // Try auto-refresh once if user is active and we have refresh token
        const originalConfig = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
        if (!originalConfig._retry && idleForMs < DEFAULT_IDLE_TIMEOUT_MS && authStore.refreshToken) {
          originalConfig._retry = true;
          try {
            if (!isRefreshing) {
              isRefreshing = true;
              refreshPromise = refreshAccessToken().finally(() => {
                isRefreshing = false;
                refreshPromise = null;
              });
            }
            const newToken = await (refreshPromise ?? refreshAccessToken());
            originalConfig.headers = originalConfig.headers || {};
            originalConfig.headers.Authorization = `Bearer ${newToken}`;
            return axios.request(originalConfig);
          } catch {
            // If refresh fails, fall back to logout rules below
          }
        }

        // If user is idle (or refresh isn't possible), logout
        if (idleForMs >= DEFAULT_IDLE_TIMEOUT_MS) {
          handleSessionExpiration('Your session has expired. Please log in again.');
        }
      }
      return Promise.reject(error);
    }

    // Handle network errors
    if (!error.response) {
      // Could be network error, timeout, etc.
      // Let the calling code handle it
      return Promise.reject(error);
    }

    // For other errors, reject as-is
    return Promise.reject(error);
  }
);

/**
 * Export axios for use in API modules.
 * All axios requests will automatically include the auth token and handle 401 responses.
 * 
 * Usage:
 * ```typescript
 * import axios from 'axios';
 * 
 * const response = await axios.get('/api/v1/endpoint');
 * // Token is automatically added, 401 automatically handled
 * ```
 */
export default axios;

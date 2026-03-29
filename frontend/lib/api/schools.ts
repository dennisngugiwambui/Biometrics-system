/**
 * API client functions for School management.
 * 
 * Base URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'
 * Endpoints:
 * - POST /api/v1/schools/register - Register a new school
 * - GET /api/v1/schools/me - Get current user's school (requires authentication)
 */

import axios from 'axios';
import type {
  SchoolRegistrationFormData,
  SchoolRegistrationWithAdminFormData,
} from '@/lib/validations/school';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Admin user info in registration response.
 */
export interface AdminUserInfo {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  school_id: number;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string; // ISO datetime
  updated_at: string | null;
}

/** Branding payload stored per school (same on any device/IP when logged in). */
export interface SchoolBrandingApi {
  logoDataUrl?: string | null;
  loginBgDataUrl?: string | null;
  colors?: string[];
}

/**
 * Response type from the API after successful registration.
 */
/** Per-school SMS/WhatsApp provider and message templates. */
export interface NotificationSettingsApi {
  provider?: string | null;
  /** How to send parent notifications: sms, whatsapp, or both. */
  parent_delivery?: "sms" | "whatsapp" | "both" | null;
  /** @deprecated Prefer parent_delivery. */
  channel?: "sms" | "whatsapp" | null;
  api_key?: string | null;
  sender_id?: string | null;
  username?: string | null;
  whatsapp_phone_number_id?: string | null;
  whatsapp_api_key?: string | null;
  /** Use Africa's Talking sandbox (true) or production (false). Default true. */
  sandbox?: boolean | null;
  templates?: {
    student_checkin?: string;
    student_checkout?: string;
    teacher_weekly_reminder?: string;
  } | null;
}

/** Default message templates (parents: Dear parent...; teacher: Dear {{teacher_name}}...). */
export const DEFAULT_NOTIFICATION_TEMPLATES = {
  student_checkin:
    "Dear parent, {{student_name}} has checked in at {{time}} on {{date}}. - {{school_name}}",
  student_checkout:
    "Dear parent, {{student_name}} has checked out at {{time}} on {{date}}. - {{school_name}}",
  teacher_weekly_reminder:
    "Dear {{teacher_name}}, Your attendance summary for the week: {{present_days}}/{{total_days}} days ({{percentage}}%). - {{school_name}}",
} as const;

export interface SchoolResponse {
  id: number;
  name: string;
  code: string; // Uppercase
  address: string | null;
  po_box: string | null;
  phone: string | null;
  email: string | null;
  school_type?: "day" | "boarding" | "mixed";
  branding?: SchoolBrandingApi | null;
  notification_settings?: NotificationSettingsApi | null;
  geofence_lat?: number | null;
  geofence_lng?: number | null;
  geofence_radius_m?: number | null;
  is_deleted: boolean;
  created_at: string; // ISO datetime
  updated_at: string | null;
  admin_user?: AdminUserInfo; // Included when registering with admin
  user?: AdminUserInfo; // Included when fetching /me endpoint
}

/**
 * API error response structure.
 */
export interface ApiError {
  detail: string | Array<{
    loc: (string | number)[];
    msg: string;
    type: string;
  }>;
}

/**
 * Interface for school update data.
 */
export interface SchoolUpdateData {
  name?: string;
  address?: string | null;
  po_box?: string | null;
  phone?: string | null;
  email?: string | null;
  school_type?: "day" | "boarding" | "mixed";
  branding?: SchoolBrandingApi | null;
  notification_settings?: NotificationSettingsApi | null;
  geofence_lat?: number | null;
  geofence_lng?: number | null;
  geofence_radius_m?: number | null;
}

/**
 * Custom error class for API errors with status code and details.
 */
export class SchoolRegistrationError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public fieldErrors?: Record<string, string>
  ) {
    super(message);
    this.name = 'SchoolRegistrationError';
  }
}

/**
 * Register a new school with admin user.
 * 
 * @param data - School registration data with admin user details
 * @returns Promise resolving to the created school and admin user
 * @throws SchoolRegistrationError if registration fails
 * 
 * Comprehensive error handling:
 * - 400: Bad request (invalid data format)
 * - 422: Validation errors (returns fieldErrors map)
 * - 409: Duplicate code or email error
 * - 401/403: Authentication/authorization errors
 * - 500: Server error
 * - 502/503/504: Gateway/service unavailable errors
 * - Network errors: Connection/timeout/CORS errors
 */
export async function registerSchool(
  data: SchoolRegistrationWithAdminFormData
): Promise<SchoolResponse> {
  try {
    // Prepare request payload (exclude confirmPassword from admin)
    const { admin, ...schoolData } = data;
    const { confirmPassword, ...adminData } = admin;

    const payload = {
      ...schoolData,
      admin: adminData,
    };

    const response = await axios.post<SchoolResponse>(
      `${API_BASE_URL}/api/v1/schools/register`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        validateStatus: (status) => status < 500, // Don't throw on 4xx errors
      }
    );

    // Check for error responses (4xx status codes)
    if (response.status >= 400) {
      const errorData = response.data as unknown as ApiError | undefined;
      const statusCode = response.status;

      // Handle 422 - Validation errors (most common)
      if (statusCode === 422 && errorData?.detail) {
        const fieldErrors: Record<string, string> = {};

        if (Array.isArray(errorData.detail)) {
          // FastAPI validation errors format: [{loc: ['body', 'field'], msg: 'error', type: 'type'}]
          errorData.detail.forEach((err) => {
            // Get the last element of loc array (field name)
            // Skip 'body' prefix if present
            const locArray = err.loc || [];
            const fieldIndex = locArray.findIndex((item, idx) =>
              idx > 0 && (typeof item === 'string' && item !== 'body')
            );
            const field = fieldIndex >= 0
              ? String(locArray[fieldIndex])
              : String(locArray[locArray.length - 1]);

            if (field && field !== 'body') {
              // Map backend field names to frontend field names if needed
              const mappedField = mapBackendFieldToFrontend(field);
              fieldErrors[mappedField] = err.msg || 'Invalid value';
            }
          });
        } else if (typeof errorData.detail === 'string') {
          // Single string error message
          throw new SchoolRegistrationError(errorData.detail, statusCode);
        }

        const message = Object.keys(fieldErrors).length > 0
          ? 'Please correct the validation errors below'
          : 'Validation failed. Please check your input.';

        throw new SchoolRegistrationError(message, statusCode, fieldErrors);
      }

      // Handle 400 - Bad request
      if (statusCode === 400) {
        const message = typeof errorData?.detail === 'string'
          ? errorData.detail
          : 'Invalid request. Please check your input and try again.';
        throw new SchoolRegistrationError(message, statusCode);
      }

      // Handle 409 - Duplicate code, email, or validation errors (conflict)
      if (statusCode === 409) {
        const message = typeof errorData?.detail === 'string'
          ? errorData.detail
          : 'School code already exists. Please use a different code.';

        // Check if it's a password error
        const errorMsg = message.toLowerCase();
        const fieldErrors: Record<string, string> = {};

        if (errorMsg.includes('password')) {
          fieldErrors['admin.password'] = message;
        } else if (errorMsg.includes('code')) {
          fieldErrors['code'] = message;
        } else if (errorMsg.includes('email')) {
          fieldErrors['admin.email'] = message;
        } else {
          // Default to code error for backward compatibility
          fieldErrors['code'] = message;
        }

        throw new SchoolRegistrationError(message, statusCode, fieldErrors);
      }

      // Handle 401/403 - Authentication/Authorization
      if (statusCode === 401 || statusCode === 403) {
        const message = statusCode === 401
          ? 'Authentication required. Please log in and try again.'
          : 'You do not have permission to perform this action.';
        throw new SchoolRegistrationError(message, statusCode);
      }

      // Handle other 4xx errors
      const message = typeof errorData?.detail === 'string'
        ? errorData.detail
        : `Request failed with status ${statusCode}. Please try again.`;
      throw new SchoolRegistrationError(message, statusCode);
    }

    return response.data;
  } catch (error) {
    console.log('error', error);
    // Handle axios errors
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status || 500;
      const errorData = error.response?.data as ApiError | undefined;


      if (!error.response) {
        // Connection timeout
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
          throw new SchoolRegistrationError(
            'Request timed out. Please check your internet connection and try again.',
            0
          );
        }

        // Network error (server unreachable, CORS, etc.)
        if (error.code === 'ERR_NETWORK') {
          throw new SchoolRegistrationError(
            'Unable to connect to the server. Please ensure:\n' +
            '• The backend services are running\n' +
            '• Your internet connection is stable\n' +
            '• There are no firewall restrictions',
            0
          );
        }

        // CORS error
        if (error.code === 'ERR_CORS') {
          throw new SchoolRegistrationError(
            'Cross-origin request blocked. Please contact support if this issue persists.',
            0
          );
        }

        // Generic network error
        throw new SchoolRegistrationError(
          'Network error. Please check your connection and try again.',
          0
        );
      }

      // Handle 500 - Internal server error
      if (statusCode === 500) {
        const message = typeof errorData?.detail === 'string'
          ? errorData.detail
          : 'Server error. Our team has been notified. Please try again later.';
        throw new SchoolRegistrationError(message, statusCode);
      }

      // Handle 502 - Bad Gateway
      if (statusCode === 502) {
        throw new SchoolRegistrationError(
          'Service temporarily unavailable. Please try again in a few moments.',
          statusCode
        );
      }

      // Handle 503 - Service Unavailable
      if (statusCode === 503) {
        throw new SchoolRegistrationError(
          'Service is currently unavailable. Please try again later.',
          statusCode
        );
      }

      // Handle 504 - Gateway Timeout
      if (statusCode === 504) {
        throw new SchoolRegistrationError(
          'Request timed out. Please check your connection and try again.',
          statusCode
        );
      }

      // Handle network errors (no response received)


      // Generic axios error with response
      const message = error.response?.data?.detail
        ? String(error.response.data.detail)
        : error.message || 'An unexpected error occurred';
      throw new SchoolRegistrationError(message, statusCode);
    }

    // Handle SchoolRegistrationError (re-throw as-is)
    if (error instanceof SchoolRegistrationError) {
      throw error;
    }

    // Handle unknown errors
    const errorMessage = error instanceof Error
      ? error.message
      : 'An unexpected error occurred. Please try again.';

    // Log unexpected errors for debugging
    console.error('Unexpected error during school registration:', error);

    throw new SchoolRegistrationError(errorMessage, 500);
  }
}

/**
 * Get current user's school information.
 * 
 * @param token - JWT authentication token
 * @returns Promise resolving to the school information
 * @throws SchoolRegistrationError if request fails
 * 
 * Error handling:
 * - 401: Authentication required
 * - 404: School not found
 * - 500: Server error
 * - Network errors: Connection/timeout/CORS errors
 */
export async function getMySchool(token?: string): Promise<SchoolResponse> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add authentication token if provided
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await axios.get<SchoolResponse>(
      `${API_BASE_URL}/api/v1/schools/me`,
      {
        headers,
        validateStatus: (status) => status < 500, // Don't throw on 4xx errors
      }
    );

    // Check for error responses (4xx status codes)
    if (response.status >= 400) {
      const errorData = response.data as unknown as ApiError | undefined;
      const statusCode = response.status;

      // Handle 401 - Authentication required
      if (statusCode === 401) {
        throw new SchoolRegistrationError(
          'Authentication required. Please log in and try again.',
          statusCode
        );
      }

      // Handle 404 - School not found
      if (statusCode === 404) {
        throw new SchoolRegistrationError(
          'School not found. Please contact support.',
          statusCode
        );
      }

      // Handle other 4xx errors
      const message = typeof errorData?.detail === 'string'
        ? errorData.detail
        : `Failed to load school information (${statusCode})`;
      throw new SchoolRegistrationError(message, statusCode);
    }

    return response.data;
  } catch (error) {
    // Handle SchoolRegistrationError (re-throw as-is)
    if (error instanceof SchoolRegistrationError) {
      throw error;
    }

    // Handle axios errors
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status || 500;
      const errorData = error.response?.data as ApiError | undefined;

      // Handle 500 - Internal server error
      if (statusCode === 500) {
        const message = typeof errorData?.detail === 'string'
          ? errorData.detail
          : 'Server error. Our team has been notified. Please try again later.';
        throw new SchoolRegistrationError(message, statusCode);
      }

      // Handle network errors (no response received)
      if (!error.response) {
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
          throw new SchoolRegistrationError(
            'Request timed out. Please check your internet connection and try again.',
            0
          );
        }

        if (error.code === 'ERR_NETWORK') {
          throw new SchoolRegistrationError(
            'Unable to connect to the server. Please ensure:\n' +
            '• The backend services are running\n' +
            '• Your internet connection is stable\n' +
            '• There are no firewall restrictions',
            0
          );
        }

        throw new SchoolRegistrationError(
          'Network error. Please check your connection and try again.',
          0
        );
      }

      // Generic axios error with response
      const message = error.response?.data?.detail
        ? String(error.response.data.detail)
        : error.message || 'An unexpected error occurred';
      throw new SchoolRegistrationError(message, statusCode);
    }

    // Handle unknown errors
    const errorMessage = error instanceof Error
      ? error.message
      : 'An unexpected error occurred. Please try again.';

    console.error('Unexpected error while fetching school data:', error);
    throw new SchoolRegistrationError(errorMessage, 500);
  }
}

/** Response from parsing a Google Maps URL (short or full) to coordinates. */
export interface MapsUrlParseResult {
  lat: number;
  lng: number;
  formatted_address: string | null;
}

/**
 * Resolve a Google Maps URL to latitude/longitude (and optional place name).
 * Supports short links (e.g. https://maps.app.goo.gl/...) and full URLs.
 *
 * @param token - JWT authentication token
 * @param url - Google Maps URL to resolve
 */
export async function parseMapsUrl(
  token: string,
  url: string
): Promise<MapsUrlParseResult> {
  const response = await axios.post<MapsUrlParseResult>(
    `${API_BASE_URL}/api/v1/schools/parse-maps-url`,
    { url: url.trim() },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      validateStatus: (status) => status < 500,
    }
  );

  if (response.status >= 400) {
    const detail =
      typeof response.data === 'object' && response.data !== null && 'detail' in response.data
        ? String((response.data as { detail: string }).detail)
        : 'Could not resolve map URL';
    throw new SchoolRegistrationError(detail, response.status);
  }

  return response.data;
}

/**
 * Update current user's school information.
 * 
 * @param token - JWT authentication token
 * @param updateData - School update data (name, address, phone, email)
 * @returns Promise resolving to the updated school information
 * @throws SchoolRegistrationError if update fails
 * 
 * Error handling:
 * - 400: Validation error
 * - 401: Authentication required
 * - 404: School not found
 * - 500: Server error
 * - Network errors: Connection/timeout/CORS errors
 */
export async function updateMySchool(
  token: string,
  updateData: SchoolUpdateData
): Promise<SchoolResponse> {
  try {
    const response = await axios.put<SchoolResponse>(
      `${API_BASE_URL}/api/v1/schools/me`,
      updateData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        validateStatus: (status) => status < 500, // Don't throw on 4xx errors
      }
    );

    if (response.status >= 400) {
      const errorData = response.data as unknown as ApiError | undefined;
      const statusCode = response.status;

      if (statusCode === 401 || statusCode === 403) {
        const message = statusCode === 401
          ? 'Authentication required. Please log in and try again.'
          : 'You do not have permission to update this school.';
        throw new SchoolRegistrationError(message, statusCode);
      }

      if (statusCode === 404) {
        const message = typeof errorData?.detail === 'string'
          ? errorData.detail
          : 'School not found.';
        throw new SchoolRegistrationError(message, statusCode);
      }

      if (statusCode === 422) {
        // Validation errors
        const detail = errorData?.detail;
        if (Array.isArray(detail)) {
          const fieldErrors: Record<string, string> = {};
          detail.forEach((error: any) => {
            if (error.loc && error.loc.length > 1) {
              const field = error.loc[error.loc.length - 1];
              fieldErrors[field] = error.msg || 'Invalid value';
            }
          });
          throw new SchoolRegistrationError(
            'Please correct the errors in the form.',
            statusCode,
            fieldErrors
          );
        }
        const message = typeof detail === 'string'
          ? detail
          : 'Validation error. Please check your input.';
        throw new SchoolRegistrationError(message, statusCode);
      }

      // Generic 4xx error
      const message = typeof errorData?.detail === 'string'
        ? errorData.detail
        : 'Failed to update school information.';
      throw new SchoolRegistrationError(message, statusCode);
    }

    return response.data;
  } catch (error) {
    // Handle axios errors
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status || 0;

      // Handle timeout errors
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        throw new SchoolRegistrationError(
          'Request timed out. Please check your internet connection and try again.',
          0
        );
      }

      // Network error
      if (error.code === 'ERR_NETWORK') {
        throw new SchoolRegistrationError(
          'Unable to connect to the server. Please ensure the backend services are running.',
          0
        );
      }

      // Re-throw SchoolRegistrationError
      if (error instanceof SchoolRegistrationError) {
        throw error;
      }

      // Generic axios error
      const message = error.response?.data?.detail
        ? String(error.response.data.detail)
        : error.message || 'An unexpected error occurred';
      throw new SchoolRegistrationError(message, statusCode);
    }

    // Re-throw SchoolRegistrationError
    if (error instanceof SchoolRegistrationError) {
      throw error;
    }

    // Handle unknown errors
    const errorMessage = error instanceof Error
      ? error.message
      : 'An unexpected error occurred. Please try again.';
    throw new SchoolRegistrationError(errorMessage, 500);
  }
}

/**
 * Map backend field names to frontend field names.
 * Handles any differences in naming conventions.
 */
function mapBackendFieldToFrontend(backendField: string): string {
  const fieldMap: Record<string, string> = {
    // Add mappings if backend uses different field names
    // Example: 'school_name' -> 'name'
  };

  return fieldMap[backendField] || backendField;
}


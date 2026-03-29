/**
 * API client functions for Authentication.
 * 
 * Base URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
 * Endpoints:
 * - POST /api/v1/auth/register - Register a new user
 * - POST /api/v1/auth/login/json - User login (JSON body)
 */

import axios from 'axios';
import type { AdminAccountFormData } from '@/lib/validations/user';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Response type from the API after successful user registration.
 */
export interface UserResponse {
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
  avatar?: string | null;
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
 * Custom error class for API errors with status code and details.
 */
export class UserRegistrationError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public fieldErrors?: Record<string, string>
  ) {
    super(message);
    this.name = 'UserRegistrationError';
  }
}

/**
 * Register a new user (admin account).
 * 
 * @param data - User registration data (includes school_id)
 * @returns Promise resolving to the created user
 * @throws UserRegistrationError if registration fails
 * 
 * Comprehensive error handling:
 * - 400: Bad request (invalid data format, email already exists)
 * - 422: Validation errors (returns fieldErrors map)
 * - 500: Server error
 * - Network errors: Connection/timeout/CORS errors
 */
export async function registerUser(
  data: AdminAccountFormData & { school_id: number }
): Promise<UserResponse> {
  try {
    // Prepare request payload (exclude confirmPassword)
    const { confirmPassword, ...payload } = data;

    const response = await axios.post<UserResponse>(
      `${API_BASE_URL}/api/v1/auth/register`,
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
          throw new UserRegistrationError(errorData.detail, statusCode);
        }

        const message = Object.keys(fieldErrors).length > 0
          ? 'Please correct the validation errors below'
          : 'Validation failed. Please check your input.';

        throw new UserRegistrationError(message, statusCode, fieldErrors);
      }

      // Handle 400 - Bad request (email already exists, weak password, etc.)
      if (statusCode === 400) {
        const message = typeof errorData?.detail === 'string'
          ? errorData.detail
          : 'Invalid request. Please check your input and try again.';

        // Check if it's an email duplicate error
        if (message.toLowerCase().includes('email') && message.toLowerCase().includes('already')) {
          throw new UserRegistrationError(message, statusCode, { email: message });
        }

        throw new UserRegistrationError(message, statusCode);
      }

      // Handle 401/403 - Authentication/Authorization
      if (statusCode === 401 || statusCode === 403) {
        const message = statusCode === 401
          ? 'Authentication required. Please log in and try again.'
          : 'You do not have permission to perform this action.';
        throw new UserRegistrationError(message, statusCode);
      }

      // Handle other 4xx errors
      const message = typeof errorData?.detail === 'string'
        ? errorData.detail
        : `Request failed with status ${statusCode}. Please try again.`;
      throw new UserRegistrationError(message, statusCode);
    }

    return response.data;
  } catch (error) {
    // Handle axios errors
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status || 500;
      const errorData = error.response?.data as ApiError | undefined;

      // Handle 500 - Internal server error
      if (statusCode === 500) {
        const message = typeof errorData?.detail === 'string'
          ? errorData.detail
          : 'Server error. Our team has been notified. Please try again later.';
        throw new UserRegistrationError(message, statusCode);
      }

      // Handle 502 - Bad Gateway
      if (statusCode === 502) {
        throw new UserRegistrationError(
          'Service temporarily unavailable. Please try again in a few moments.',
          statusCode
        );
      }

      // Handle 503 - Service Unavailable
      if (statusCode === 503) {
        throw new UserRegistrationError(
          'Service is currently unavailable. Please try again later.',
          statusCode
        );
      }

      // Handle 504 - Gateway Timeout
      if (statusCode === 504) {
        throw new UserRegistrationError(
          'Request timed out. Please check your connection and try again.',
          statusCode
        );
      }

      // Handle network errors (no response received)
      if (!error.response) {
        // Connection timeout
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
          throw new UserRegistrationError(
            'Request timed out. Please check your internet connection and try again.',
            0
          );
        }

        // Network error (server unreachable, CORS, etc.)
        if (error.code === 'ERR_NETWORK') {
          throw new UserRegistrationError(
            'Unable to connect to the server. Please ensure:\n' +
            '• The backend services are running\n' +
            '• Your internet connection is stable\n' +
            '• There are no firewall restrictions',
            0
          );
        }

        // CORS error
        if (error.code === 'ERR_CORS') {
          throw new UserRegistrationError(
            'Cross-origin request blocked. Please contact support if this issue persists.',
            0
          );
        }

        // Generic network error
        throw new UserRegistrationError(
          'Network error. Please check your connection and try again.',
          0
        );
      }

      // Generic axios error with response
      const message = error.response?.data?.detail
        ? String(error.response.data.detail)
        : error.message || 'An unexpected error occurred';
      throw new UserRegistrationError(message, statusCode);
    }

    // Handle UserRegistrationError (re-throw as-is)
    if (error instanceof UserRegistrationError) {
      throw error;
    }

    // Handle unknown errors
    const errorMessage = error instanceof Error
      ? error.message
      : 'An unexpected error occurred. Please try again.';

    // Log unexpected errors for debugging
    console.error('Unexpected error during user registration:', error);

    throw new UserRegistrationError(errorMessage, 500);
  }
}

/**
 * Token response from login API.
 */
export interface TokenResponse {
  access_token: string;
  refresh_token?: string | null;
  token_type: string;
}

/**
 * Login credentials.
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Custom error class for login errors.
 */
export class LoginError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'LoginError';
  }
}

/**
 * Login a user and get JWT token.
 * 
 * @param credentials - Login credentials (email and password)
 * @returns Promise resolving to token response
 * @throws LoginError if login fails
 * 
 * Error handling:
 * - 401: Invalid credentials
 * - 422: Validation errors
 * - 500: Server error
 * - Network errors: Connection/timeout/CORS errors
 */
export async function login(credentials: LoginCredentials): Promise<TokenResponse> {
  try {
    const response = await axios.post<TokenResponse>(
      `${API_BASE_URL}/api/v1/auth/login/json`,
      credentials,
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

      // Handle 401 - Invalid credentials
      if (statusCode === 401) {
        const message = typeof errorData?.detail === 'string'
          ? errorData.detail
          : 'Incorrect email or password';
        throw new LoginError(message, statusCode);
      }

      // Handle 422 - Validation errors
      if (statusCode === 422) {
        const message = typeof errorData?.detail === 'string'
          ? errorData.detail
          : 'Validation failed. Please check your input.';
        throw new LoginError(message, statusCode);
      }

      // Handle other 4xx errors
      const message = typeof errorData?.detail === 'string'
        ? errorData.detail
        : `Login failed with status ${statusCode}. Please try again.`;
      throw new LoginError(message, statusCode);
    }

    return response.data;
  } catch (error) {
    // Handle LoginError (re-throw as-is)
    if (error instanceof LoginError) {
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
        throw new LoginError(message, statusCode);
      }

      // Handle network errors (no response received)
      if (!error.response) {
        // Connection timeout
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
          throw new LoginError(
            'Request timed out. Please check your internet connection and try again.',
            0
          );
        }

        // Network error (server unreachable, CORS, etc.)
        if (error.code === 'ERR_NETWORK') {
          throw new LoginError(
            'Unable to connect to the server. Please ensure:\n' +
            '• The backend services are running\n' +
            '• Your internet connection is stable\n' +
            '• There are no firewall restrictions',
            0
          );
        }

        // Generic network error
        throw new LoginError(
          'Network error. Please check your connection and try again.',
          0
        );
      }

      // Generic axios error with response
      const message = error.response?.data?.detail
        ? String(error.response.data.detail)
        : error.message || 'An unexpected error occurred';
      throw new LoginError(message, statusCode);
    }

    // Handle unknown errors
    const errorMessage = error instanceof Error
      ? error.message
      : 'An unexpected error occurred. Please try again.';

    // Log unexpected errors for debugging
    console.error('Unexpected error during login:', error);

    throw new LoginError(errorMessage, 500);
  }
}

/**
 * Map backend field names to frontend field names.
 * Handles any differences in naming conventions.
 */
function mapBackendFieldToFrontend(backendField: string): string {
  const fieldMap: Record<string, string> = {
    // Add mappings if backend uses different field names
    // Example: 'first_name' -> 'first_name' (already matches)
  };

  return fieldMap[backendField] || backendField;
}




/**
 * Enrollment API client.
 * 
 * Handles enrollment operations including starting enrollment sessions.
 */

import axios from "axios";
import { useAuthStore } from "../store/authStore";

// import axios from '@/lib/api/axios-instance';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export type EnrollmentStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export interface EnrollmentStartRequest {
  student_id: number;
  device_id: number;
  finger_id: number;
}

export interface EnrollmentStartRequestTeacher {
  teacher_id: number;
  device_id: number;
  finger_id: number;
}

export interface EnrollmentStartResponse {
  session_id: string;
  student_id?: number | null;
  teacher_id?: number | null;
  device_id: number;
  finger_id: number;
  status: EnrollmentStatus;
  started_at: string;
}

export interface EnrollmentCountResponse {
  successful_enrollments: number;
}

export interface ApiError {
  detail?: string;
  message?: string;
  code?: string;
  field_errors?: Record<string, string[]>;
}

/**
 * Custom error class for enrollment API errors.
 */
export class EnrollmentApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
    public fieldErrors?: Record<string, string>
  ) {
    super(message);
    this.name = 'EnrollmentApiError';
  }
}

/**
 * Start fingerprint enrollment for a student on a device.
 * 
 * This creates an enrollment session and sends the enrollment command to the device.
 * The device will enter enrollment mode and wait for the student to place their finger.
 * 
 * @param request - Enrollment start request with student_id, device_id, and finger_id
 * @returns Promise resolving to enrollment start response with session information
 * @throws EnrollmentApiError if request fails
 */
export async function startEnrollment(
  request: EnrollmentStartRequest
): Promise<EnrollmentStartResponse> {
  try {

    const authStore = useAuthStore.getState();
    const token = authStore.token;

    const response = await axios.post<EnrollmentStartResponse>(
      `${API_BASE_URL}/api/v1/enrollment/start`,
      request,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status || 500;
      const errorData = error.response?.data as ApiError | undefined;

      // Handle field errors
      if (errorData?.field_errors) {
        const fieldErrors: Record<string, string> = {};
        Object.entries(errorData.field_errors).forEach(([field, messages]) => {
          fieldErrors[field] = messages.join(', ');
        });

        const message = errorData?.detail || errorData?.message || 'Validation error';
        throw new EnrollmentApiError(message, statusCode, errorData?.code, fieldErrors);
      }

      // Handle structured error responses (detail may be { message, code })
      if (errorData?.detail || errorData?.message) {
        const raw = errorData.detail || errorData.message;
        const message =
          typeof raw === "object" && raw && "message" in raw
            ? String((raw as { message: string }).message)
            : String(raw || `Failed to start enrollment (${statusCode})`);
        const code =
          typeof raw === "object" && raw && "code" in raw
            ? (raw as { code?: string }).code
            : errorData.code;
        throw new EnrollmentApiError(message, statusCode, code);
      }

      // Handle HTTP status codes with friendly messages
      if (statusCode === 404) {
        throw new EnrollmentApiError('Student or device not found', statusCode, 'NOT_FOUND');
      }
      if (statusCode === 503) {
        throw new EnrollmentApiError('Device is offline or unreachable', statusCode, 'DEVICE_OFFLINE');
      }
      if (statusCode === 409) {
        throw new EnrollmentApiError('Enrollment already in progress', statusCode, 'ENROLLMENT_IN_PROGRESS');
      }
      if (statusCode === 400) {
        throw new EnrollmentApiError(errorData?.detail || 'Invalid request', statusCode, errorData?.code);
      }

      const message = error.message || `Failed to start enrollment (${statusCode})`;
      throw new EnrollmentApiError(message, statusCode);
    }

    if (error instanceof EnrollmentApiError) {
      throw error;
    }

    throw new EnrollmentApiError('An unexpected error occurred', 500);
  }
}

/**
 * Start fingerprint enrollment for a teacher on a device (for check-in/check-out).
 * Teacher must be synced to the device first.
 */
export async function startTeacherEnrollment(
  request: EnrollmentStartRequestTeacher
): Promise<EnrollmentStartResponse> {
  try {
    const authStore = useAuthStore.getState();
    const token = authStore.token;

    const response = await axios.post<EnrollmentStartResponse>(
      `${API_BASE_URL}/api/v1/enrollment/start/teacher`,
      request,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status || 500;
      const errorData = error.response?.data as ApiError | undefined;

      if (errorData?.detail || errorData?.message) {
        const raw = errorData.detail || errorData.message;
        const message =
          typeof raw === 'object' && raw && 'message' in raw
            ? String((raw as { message: string }).message)
            : String(raw || `Failed to start teacher enrollment (${statusCode})`);
        const code =
          typeof raw === 'object' && raw && 'code' in raw
            ? (raw as { code?: string }).code
            : errorData.code;
        throw new EnrollmentApiError(message, statusCode, code);
      }
      if (statusCode === 404) {
        throw new EnrollmentApiError('Device not found', statusCode, 'NOT_FOUND');
      }
      if (statusCode === 503) {
        throw new EnrollmentApiError('Device is offline or unreachable', statusCode, 'DEVICE_OFFLINE');
      }
      if (statusCode === 400) {
        throw new EnrollmentApiError(
          errorData?.detail || 'Invalid request',
          statusCode,
          errorData?.code ?? (errorData?.detail as { code?: string })?.code
        );
      }
      const message = error.message || `Failed to start teacher enrollment (${statusCode})`;
      throw new EnrollmentApiError(message, statusCode);
    }
    throw new EnrollmentApiError('An unexpected error occurred', 500);
  }
}

/**
 * Get list of finger IDs already enrolled for a student on a device.
 *
 * @param deviceId - Device ID
 * @param studentId - Student ID
 * @returns Enrolled finger IDs (0-9)
 */
export async function getEnrolledFingers(
  deviceId: number,
  studentId: number
): Promise<{ device_id: number; student_id: number; finger_ids: number[] }> {
  const authStore = useAuthStore.getState();
  const token = authStore.token;

  const response = await axios.get<{ device_id: number; student_id: number; finger_ids: number[] }>(
    `${API_BASE_URL}/api/v1/enrollment/devices/${deviceId}/students/${studentId}/fingers`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return response.data;
}

/**
 * Delete a fingerprint template for a student on a device.
 *
 * @param deviceId - Device ID
 * @param studentId - Student ID
 * @param fingerId - Finger index (0-9)
 */
export async function deleteFingerprint(
  deviceId: number,
  studentId: number,
  fingerId: number
): Promise<void> {
  const authStore = useAuthStore.getState();
  const token = authStore.token;

  await axios.delete(
    `${API_BASE_URL}/api/v1/enrollment/devices/${deviceId}/students/${studentId}/fingers/${fingerId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
}

/**
 * Cancel an ongoing enrollment session.
 *
 * Sends cancel command to the device. The backend broadcasts the cancellation
 * via WebSocket so the frontend receives the update.
 *
 * @param sessionId - Enrollment session ID from start response
 * @throws EnrollmentApiError if request fails
 */
export async function cancelEnrollment(sessionId: string): Promise<void> {
  try {
    const authStore = useAuthStore.getState();
    const token = authStore.token;

    await axios.post(
      `${API_BASE_URL}/api/v1/enrollment/cancel/${encodeURIComponent(sessionId)}`,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      }
    );
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status || 500;
      const errorData = error.response?.data as ApiError | undefined;

      if (errorData?.detail || errorData?.message) {
        const message = errorData.detail || errorData.message || `Failed to cancel enrollment (${statusCode})`;
        throw new EnrollmentApiError(message, statusCode, errorData?.code);
      }
      throw new EnrollmentApiError(error.message || `Failed to cancel enrollment (${statusCode})`, statusCode);
    }
    throw new EnrollmentApiError('An unexpected error occurred', 500);
  }
}

/**
 * Get successful enrollment count for dashboard statistics.
 *
 * @param token - JWT authentication token
 * @returns Promise resolving to successful enrollment count
 */
export async function getSuccessfulEnrollmentCount(token: string): Promise<number> {
  const response = await axios.get<EnrollmentCountResponse>(
    `${API_BASE_URL}/api/v1/enrollment/stats/count`,
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  return response.data.successful_enrollments;
}

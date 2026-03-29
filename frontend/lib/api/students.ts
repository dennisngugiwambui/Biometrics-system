/**
 * API client functions for Student management.
 * 
 * Base URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'
 * Endpoints:
 * - GET /api/v1/students - List students (with pagination, filtering, search)
 * - GET /api/v1/students/{id} - Get student by ID
 * - POST /api/v1/students - Create a new student
 * - PUT /api/v1/students/{id} - Update student
 * - DELETE /api/v1/students/{id} - Soft delete student
 */

import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Gender enumeration.
 */
export type Gender = 'male' | 'female' | 'other';

/**
 * Student response type from the API.
 */
export interface StudentResponse {
  id: number;
  school_id: number;
  admission_number: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null; // ISO date string
  gender: Gender | null;
  class_id: number | null;
  stream_id: number | null;
  class_name?: string | null;
  stream_name?: string | null;
  parent_phone: string | null;
  parent_email: string | null;
  enrollment_status?: string;
  graduated_at?: string | null;
  is_deleted: boolean;
  created_at: string; // ISO datetime
  updated_at: string | null;
}

/**
 * Paginated student list response.
 */
export interface PaginatedStudentResponse {
  items: StudentResponse[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/**
 * Student creation data (school_id is auto-assigned).
 */
export interface StudentCreateData {
  admission_number: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string | null;
  gender?: Gender | null;
  class_id?: number | null;
  stream_id?: number | null;
  parent_phone?: string | null;
  parent_email?: string | null;
}

/**
 * Student update data.
 */
export interface StudentUpdateData {
  first_name?: string;
  last_name?: string;
  date_of_birth?: string | null;
  gender?: Gender | null;
  class_id?: number | null;
  stream_id?: number | null;
  parent_phone?: string | null;
  parent_email?: string | null;
}

/**
 * List students query parameters.
 */
export interface ListStudentsParams {
  page?: number;
  page_size?: number;
  class_id?: number;
  stream_id?: number;
  search?: string;
  include_graduated?: boolean;
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
 * Custom error class for student API errors.
 */
export class StudentApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public fieldErrors?: Record<string, string>
  ) {
    super(message);
    this.name = 'StudentApiError';
  }
}

/**
 * List students with pagination, filtering, and search.
 * 
 * @param token - JWT authentication token
 * @param params - Query parameters (page, page_size, filters, search)
 * @returns Promise resolving to paginated student list
 * @throws StudentApiError if request fails
 */
export async function listStudents(
  token: string,
  params: ListStudentsParams = {}
): Promise<PaginatedStudentResponse> {
  try {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.page_size) queryParams.append('page_size', params.page_size.toString());
    if (params.class_id) queryParams.append('class_id', params.class_id.toString());
    if (params.stream_id) queryParams.append('stream_id', params.stream_id.toString());
    if (params.search) queryParams.append('search', params.search);
    if (params.include_graduated) queryParams.append('include_graduated', 'true');

    const response = await axios.get<PaginatedStudentResponse>(
      `${API_BASE_URL}/api/v1/students?${queryParams.toString()}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        validateStatus: (status) => status < 500,
      }
    );

    if (response.status >= 400) {
      const errorData = response.data as unknown as ApiError | undefined;
      const statusCode = response.status;

      if (statusCode === 401) {
        throw new StudentApiError(
          'Authentication required. Please log in and try again.',
          statusCode
        );
      }

      const message = typeof errorData?.detail === 'string'
        ? errorData.detail
        : `Failed to load students (${statusCode})`;
      throw new StudentApiError(message, statusCode);
    }

    return response.data;
  } catch (error) {
    if (error instanceof StudentApiError) {
      throw error;
    }

    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status || 0;

      if (!error.response) {
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
          throw new StudentApiError(
            'Request timed out. Please check your internet connection and try again.',
            0
          );
        }

        if (error.code === 'ERR_NETWORK') {
          throw new StudentApiError(
            'Unable to connect to the server. Please ensure the backend services are running.',
            0
          );
        }

        throw new StudentApiError(
          'Network error. Please check your connection and try again.',
          0
        );
      }

      const errorData = error.response?.data as ApiError | undefined;
      const message = typeof errorData?.detail === 'string'
        ? errorData.detail
        : error.message || 'An unexpected error occurred';
      throw new StudentApiError(message, statusCode);
    }

    const errorMessage = error instanceof Error
      ? error.message
      : 'An unexpected error occurred. Please try again.';
    throw new StudentApiError(errorMessage, 500);
  }
}

/**
 * Get a student by ID.
 * 
 * @param token - JWT authentication token
 * @param studentId - Student ID
 * @returns Promise resolving to student data
 * @throws StudentApiError if request fails
 */
export async function getStudent(
  token: string,
  studentId: number
): Promise<StudentResponse> {
  try {
    const response = await axios.get<StudentResponse>(
      `${API_BASE_URL}/api/v1/students/${studentId}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        validateStatus: (status) => status < 500,
      }
    );

    if (response.status >= 400) {
      const errorData = response.data as unknown as ApiError | undefined;
      const statusCode = response.status;

      if (statusCode === 401) {
        throw new StudentApiError(
          'Authentication required. Please log in and try again.',
          statusCode
        );
      }

      if (statusCode === 404) {
        throw new StudentApiError(
          'Student not found.',
          statusCode
        );
      }

      const message = typeof errorData?.detail === 'string'
        ? errorData.detail
        : `Failed to load student (${statusCode})`;
      throw new StudentApiError(message, statusCode);
    }

    return response.data;
  } catch (error) {
    if (error instanceof StudentApiError) {
      throw error;
    }

    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status || 0;

      if (!error.response) {
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
          throw new StudentApiError(
            'Request timed out. Please check your internet connection and try again.',
            0
          );
        }

        if (error.code === 'ERR_NETWORK') {
          throw new StudentApiError(
            'Unable to connect to the server. Please ensure the backend services are running.',
            0
          );
        }

        throw new StudentApiError(
          'Network error. Please check your connection and try again.',
          0
        );
      }

      const errorData = error.response?.data as ApiError | undefined;
      const message = typeof errorData?.detail === 'string'
        ? errorData.detail
        : error.message || 'An unexpected error occurred';
      throw new StudentApiError(message, statusCode);
    }

    const errorMessage = error instanceof Error
      ? error.message
      : 'An unexpected error occurred. Please try again.';
    throw new StudentApiError(errorMessage, 500);
  }
}

/**
 * Create a new student.
 * 
 * @param token - JWT authentication token
 * @param data - Student creation data
 * @returns Promise resolving to created student
 * @throws StudentApiError if creation fails
 */
export async function createStudent(
  token: string,
  data: StudentCreateData
): Promise<StudentResponse> {
  try {
    const response = await axios.post<StudentResponse>(
      `${API_BASE_URL}/api/v1/students`,
      data,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        validateStatus: (status) => status < 500,
      }
    );

    if (response.status >= 400) {
      const errorData = response.data as unknown as ApiError | undefined;
      const statusCode = response.status;

      if (statusCode === 401) {
        throw new StudentApiError(
          'Authentication required. Please log in and try again.',
          statusCode
        );
      }

      if (statusCode === 409) {
        const message = typeof errorData?.detail === 'string'
          ? errorData.detail
          : 'Admission number already exists for this school.';
        throw new StudentApiError(message, statusCode, { admission_number: message });
      }

      if (statusCode === 422) {
        const fieldErrors: Record<string, string> = {};
        if (Array.isArray(errorData?.detail)) {
          errorData.detail.forEach((err) => {
            const locArray = err.loc || [];
            const field = String(locArray[locArray.length - 1]);
            if (field && field !== 'body') {
              fieldErrors[field] = err.msg || 'Invalid value';
            }
          });
        }
        const message = Object.keys(fieldErrors).length > 0
          ? 'Please correct the validation errors below'
          : (typeof errorData?.detail === 'string' ? errorData.detail : 'Validation failed. Please check your input.');
        throw new StudentApiError(message, statusCode, fieldErrors);
      }

      const message = typeof errorData?.detail === 'string'
        ? errorData.detail
        : `Failed to create student (${statusCode})`;
      throw new StudentApiError(message, statusCode);
    }

    return response.data;
  } catch (error) {
    if (error instanceof StudentApiError) {
      throw error;
    }

    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status || 0;

      if (!error.response) {
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
          throw new StudentApiError(
            'Request timed out. Please check your internet connection and try again.',
            0
          );
        }

        if (error.code === 'ERR_NETWORK') {
          throw new StudentApiError(
            'Unable to connect to the server. Please ensure the backend services are running.',
            0
          );
        }

        throw new StudentApiError(
          'Network error. Please check your connection and try again.',
          0
        );
      }

      const errorData = error.response?.data as ApiError | undefined;
      const message = typeof errorData?.detail === 'string'
        ? errorData.detail
        : error.message || 'An unexpected error occurred';
      throw new StudentApiError(message, statusCode);
    }

    const errorMessage = error instanceof Error
      ? error.message
      : 'An unexpected error occurred. Please try again.';
    throw new StudentApiError(errorMessage, 500);
  }
}

/**
 * Update a student.
 * 
 * @param token - JWT authentication token
 * @param studentId - Student ID
 * @param data - Student update data
 * @returns Promise resolving to updated student
 * @throws StudentApiError if update fails
 */
export async function updateStudent(
  token: string,
  studentId: number,
  data: StudentUpdateData
): Promise<StudentResponse> {
  try {
    const response = await axios.put<StudentResponse>(
      `${API_BASE_URL}/api/v1/students/${studentId}`,
      data,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        validateStatus: (status) => status < 500,
      }
    );

    if (response.status >= 400) {
      const errorData = response.data as unknown as ApiError | undefined;
      const statusCode = response.status;

      if (statusCode === 401) {
        throw new StudentApiError(
          'Authentication required. Please log in and try again.',
          statusCode
        );
      }

      if (statusCode === 404) {
        throw new StudentApiError(
          'Student not found.',
          statusCode
        );
      }

      if (statusCode === 422) {
        const fieldErrors: Record<string, string> = {};
        if (Array.isArray(errorData?.detail)) {
          errorData.detail.forEach((err) => {
            const locArray = err.loc || [];
            const field = String(locArray[locArray.length - 1]);
            if (field && field !== 'body') {
              fieldErrors[field] = err.msg || 'Invalid value';
            }
          });
        }
        const message = Object.keys(fieldErrors).length > 0
          ? 'Please correct the validation errors below'
          : (typeof errorData?.detail === 'string' ? errorData.detail : 'Validation failed. Please check your input.');
        throw new StudentApiError(message, statusCode, fieldErrors);
      }

      const message = typeof errorData?.detail === 'string'
        ? errorData.detail
        : `Failed to update student (${statusCode})`;
      throw new StudentApiError(message, statusCode);
    }

    return response.data;
  } catch (error) {
    if (error instanceof StudentApiError) {
      throw error;
    }

    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status || 0;

      if (!error.response) {
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
          throw new StudentApiError(
            'Request timed out. Please check your internet connection and try again.',
            0
          );
        }

        if (error.code === 'ERR_NETWORK') {
          throw new StudentApiError(
            'Unable to connect to the server. Please ensure the backend services are running.',
            0
          );
        }

        throw new StudentApiError(
          'Network error. Please check your connection and try again.',
          0
        );
      }

      const errorData = error.response?.data as ApiError | undefined;
      const message = typeof errorData?.detail === 'string'
        ? errorData.detail
        : error.message || 'An unexpected error occurred';
      throw new StudentApiError(message, statusCode);
    }

    const errorMessage = error instanceof Error
      ? error.message
      : 'An unexpected error occurred. Please try again.';
    throw new StudentApiError(errorMessage, 500);
  }
}

/**
 * Delete (soft delete) a student.
 * 
 * @param token - JWT authentication token
 * @param studentId - Student ID
 * @throws StudentApiError if deletion fails
 */
export async function deleteStudent(
  token: string,
  studentId: number
): Promise<void> {
  try {
    const response = await axios.delete(
      `${API_BASE_URL}/api/v1/students/${studentId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        validateStatus: (status) => status < 500,
      }
    );

    if (response.status >= 400) {
      const errorData = response.data as unknown as ApiError | undefined;
      const statusCode = response.status;

      if (statusCode === 401) {
        throw new StudentApiError(
          'Authentication required. Please log in and try again.',
          statusCode
        );
      }

      if (statusCode === 404) {
        throw new StudentApiError(
          'Student not found.',
          statusCode
        );
      }

      const message = typeof errorData?.detail === 'string'
        ? errorData.detail
        : `Failed to delete student (${statusCode})`;
      throw new StudentApiError(message, statusCode);
    }
  } catch (error) {
    if (error instanceof StudentApiError) {
      throw error;
    }

    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status || 0;

      if (!error.response) {
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
          throw new StudentApiError(
            'Request timed out. Please check your internet connection and try again.',
            0
          );
        }

        if (error.code === 'ERR_NETWORK') {
          throw new StudentApiError(
            'Unable to connect to the server. Please ensure the backend services are running.',
            0
          );
        }

        throw new StudentApiError(
          'Network error. Please check your connection and try again.',
          0
        );
      }

      const errorData = error.response?.data as ApiError | undefined;
      const message = typeof errorData?.detail === 'string'
        ? errorData.detail
        : error.message || 'An unexpected error occurred';
      throw new StudentApiError(message, statusCode);
    }

    const errorMessage = error instanceof Error
      ? error.message
      : 'An unexpected error occurred. Please try again.';
    throw new StudentApiError(errorMessage, 500);
  }
}

export interface StudentBulkImportResult {
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}

/**
 * Bulk import students from a JSON array.
 */
export async function bulkImportStudentsJson(
  token: string,
  students: any[]
): Promise<StudentBulkImportResult> {
  const response = await axios.post<StudentBulkImportResult>(
    `${API_BASE_URL}/api/v1/students/import/json`,
    { students },
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      validateStatus: (status) => status < 500,
    }
  );

  if (response.status >= 400) {
    throw new StudentApiError('Failed to import students', response.status);
  }

  return response.data;
}

/** Timeout for bulk file import (10 min) - backend streams NDJSON progress. */
const BULK_IMPORT_TIMEOUT_MS = 600_000;

/**
 * Bulk import students from a CSV/TSV file.
 * Consumes NDJSON stream from backend for real-time progress updates.
 */
export async function bulkImportStudentsFile(
  token: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<StudentBulkImportResult> {
  const formData = new FormData();
  formData.append('file', file);

  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), BULK_IMPORT_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/students/import/file`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
      signal: ac.signal,
    });

    if (!res.ok && res.headers.get('content-type')?.includes('application/json')) {
      const j = await res.json();
      throw new StudentApiError(j?.detail ?? 'Import failed', res.status);
    }
    if (!res.ok) {
      throw new StudentApiError(`Import failed: ${res.statusText}`, res.status);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new StudentApiError('No response body', res.status);

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const msg = JSON.parse(trimmed) as { type?: string; pct?: number; detail?: string; inserted?: number; updated?: number; skipped?: number; errors?: string[]; total?: number };
          if (msg.type === 'progress' && typeof msg.pct === 'number' && onProgress) {
            onProgress(Math.min(100, Math.max(0, msg.pct)));
          } else if (msg.type === 'result') {
            return {
              inserted: msg.inserted ?? 0,
              updated: msg.updated ?? 0,
              skipped: msg.skipped ?? 0,
              errors: msg.errors ?? [],
              total: msg.total ?? 0,
            };
          } else if (msg.type === 'error') {
            throw new StudentApiError(msg.detail ?? 'Import failed', 500);
          }
        } catch (e) {
          if (e instanceof StudentApiError) throw e;
          // Ignore JSON parse (SyntaxError) for malformed chunks
          if (!(e instanceof SyntaxError)) throw e;
        }
      }
    }

    if (buffer.trim()) {
      const msg = JSON.parse(buffer.trim()) as { type?: string; detail?: string; inserted?: number; updated?: number; skipped?: number; errors?: string[]; total?: number };
      if (msg.type === 'result') return { inserted: msg.inserted ?? 0, updated: msg.updated ?? 0, skipped: msg.skipped ?? 0, errors: msg.errors ?? [], total: msg.total ?? 0 };
      if (msg.type === 'error') throw new StudentApiError(msg.detail ?? 'Import failed', 500);
    }

    throw new StudentApiError('Import completed with no result', 500);
  } catch (err: unknown) {
    if (err instanceof StudentApiError) throw err;
    if (err instanceof Error) {
      if (err.name === 'AbortError') throw new StudentApiError('Upload timed out. Try a smaller file.', 408);
      throw new StudentApiError(err.message || 'Connection error. Ensure the backend is running.', 0);
    }
    throw err;
  } finally {
    clearTimeout(to);
  }
}

export interface CohortPromotionBody {
  ladder_class_ids: number[];
  use_all_school_chains?: boolean;
  normalize_ladder_order?: boolean;
  graduate_top_rung?: boolean;
  remove_graduates_from_devices?: boolean;
  create_target_streams_if_missing?: boolean;
  resync_all_devices_after?: boolean;
}

export interface CohortPromotionResult {
  graduated_count: number;
  graduated_student_ids: number[];
  moved_count: number;
  moves_by_step: { from_class_id: number; to_class_id: number; students_moved: number }[];
  chains_executed?: number;
  alumni_records_created?: number;
  device_removal?: Record<string, unknown> | null;
  device_removal_error?: string | null;
  device_resync?: Record<string, unknown> | null;
  device_resync_error?: string | null;
}

export async function promoteCohort(
  token: string,
  body: CohortPromotionBody
): Promise<CohortPromotionResult> {
  const res = await axios.post<CohortPromotionResult>(
    `${API_BASE_URL}/api/v1/students/promote-cohort`,
    {
      ladder_class_ids: body.ladder_class_ids ?? [],
      use_all_school_chains: body.use_all_school_chains ?? false,
      normalize_ladder_order: body.normalize_ladder_order ?? true,
      graduate_top_rung: body.graduate_top_rung ?? true,
      remove_graduates_from_devices: body.remove_graduates_from_devices ?? true,
      create_target_streams_if_missing: body.create_target_streams_if_missing ?? true,
      resync_all_devices_after: body.resync_all_devices_after ?? true,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      validateStatus: () => true,
    }
  );
  if (res.status >= 400) {
    const d = res.data as { detail?: string };
    throw new StudentApiError(
      typeof d?.detail === 'string' ? d.detail : `Promotion failed (${res.status})`,
      res.status
    );
  }
  return res.data;
}

export interface BulkGraduateBody {
  class_id: number;
  stream_id?: number;
  remove_from_devices?: boolean;
}

export interface BulkGraduateResult {
  graduated_count: number;
  graduated_student_ids: number[];
  device_removal?: Record<string, unknown> | null;
  device_removal_error?: string | null;
}

export async function bulkGraduateStudents(
  token: string,
  body: BulkGraduateBody
): Promise<BulkGraduateResult> {
  const res = await axios.post<BulkGraduateResult>(
    `${API_BASE_URL}/api/v1/students/bulk/graduate`,
    {
      class_id: body.class_id,
      stream_id: body.stream_id,
      remove_from_devices: body.remove_from_devices ?? true,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      validateStatus: () => true,
    }
  );
  if (res.status >= 400) {
    const d = res.data as { detail?: string };
    throw new StudentApiError(
      typeof d?.detail === 'string' ? d.detail : `Request failed (${res.status})`,
      res.status
    );
  }
  return res.data;
}

export async function bulkRemoveStudentsFromDevices(
  token: string,
  body: {
    student_ids?: number[];
    class_id?: number;
    stream_id?: number;
    include_graduated_in_class?: boolean;
  }
): Promise<{ student_ids: number[]; gateway_response?: unknown; warning?: string | null }> {
  const res = await axios.post(
    `${API_BASE_URL}/api/v1/students/bulk/remove-from-devices`,
    body,
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      validateStatus: () => true,
    }
  );
  if (res.status >= 400) {
    const d = res.data as { detail?: string };
    throw new StudentApiError(
      typeof d?.detail === 'string' ? d.detail : `Request failed (${res.status})`,
      res.status
    );
  }
  return res.data as { student_ids: number[]; gateway_response?: unknown; warning?: string | null };
}

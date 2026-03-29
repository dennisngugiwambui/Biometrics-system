/**
 * API client functions for Class management.
 * 
 * Base URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'
 * Endpoints:
 * - GET /api/v1/classes - List classes
 * - GET /api/v1/classes/{id} - Get class by ID
 * - POST /api/v1/classes - Create a new class
 * - PUT /api/v1/classes/{id} - Update class
 * - DELETE /api/v1/classes/{id} - Soft delete class
 */

import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Class response type from the API.
 */
export interface ClassResponse {
  id: number;
  school_id: number;
  name: string;
  description: string | null;
  is_deleted: boolean;
  created_at: string; // ISO datetime
  updated_at: string | null;
}

/**
 * Class creation data.
 */
export interface ClassCreateData {
  name: string;
  description?: string | null;
}

/**
 * Class update data.
 */
export interface ClassUpdateData {
  name?: string;
  description?: string | null;
}

/**
 * API error response structure.
 */
export interface ApiError {
  detail: string | Array<{ loc: string[]; msg: string; type: string }>;
}

/**
 * Custom error class for Class API errors.
 */
export class ClassApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public fieldErrors?: Record<string, string>
  ) {
    super(message);
    this.name = 'ClassApiError';
  }
}

/**
 * List all classes for the authenticated user's school.
 * 
 * @param token - JWT authentication token
 * @returns Promise resolving to list of classes
 * @throws ClassApiError if request fails
 */
export async function listClasses(
  token: string
): Promise<ClassResponse[]> {
  try {
    const response = await axios.get<ClassResponse[]>(
      `${API_BASE_URL}/api/v1/classes`,
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
        throw new ClassApiError(
          'Authentication required. Please log in and try again.',
          statusCode
        );
      }

      const message = typeof errorData?.detail === 'string'
        ? errorData.detail
        : `Failed to load classes (${statusCode})`;
      throw new ClassApiError(message, statusCode);
    }

    return response.data;
  } catch (error) {
    if (error instanceof ClassApiError) {
      throw error;
    }
    if (axios.isAxiosError(error)) {
      throw new ClassApiError(
        error.message || 'Failed to load classes',
        error.response?.status || 500
      );
    }
    throw new ClassApiError('An unexpected error occurred', 500);
  }
}

/**
 * Get a class by ID.
 * 
 * @param token - JWT authentication token
 * @param classId - Class ID
 * @returns Promise resolving to class data
 * @throws ClassApiError if request fails
 */
export async function getClass(
  token: string,
  classId: number
): Promise<ClassResponse> {
  try {
    const response = await axios.get<ClassResponse>(
      `${API_BASE_URL}/api/v1/classes/${classId}`,
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
        throw new ClassApiError(
          'Authentication required. Please log in and try again.',
          statusCode
        );
      }

      if (statusCode === 404) {
        throw new ClassApiError('Class not found', statusCode);
      }

      const message = typeof errorData?.detail === 'string'
        ? errorData.detail
        : `Failed to load class (${statusCode})`;
      throw new ClassApiError(message, statusCode);
    }

    return response.data;
  } catch (error) {
    if (error instanceof ClassApiError) {
      throw error;
    }
    if (axios.isAxiosError(error)) {
      throw new ClassApiError(
        error.message || 'Failed to load class',
        error.response?.status || 500
      );
    }
    throw new ClassApiError('An unexpected error occurred', 500);
  }
}

/**
 * Create a new class.
 * 
 * @param token - JWT authentication token
 * @param data - Class creation data
 * @returns Promise resolving to created class
 * @throws ClassApiError if request fails
 */
export async function createClass(
  token: string,
  data: ClassCreateData
): Promise<ClassResponse> {
  try {
    const response = await axios.post<ClassResponse>(
      `${API_BASE_URL}/api/v1/classes`,
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
        throw new ClassApiError(
          'Authentication required. Please log in and try again.',
          statusCode
        );
      }

      if (statusCode === 409) {
        const message = typeof errorData?.detail === 'string'
          ? errorData.detail
          : 'Class name already exists';
        throw new ClassApiError(message, statusCode);
      }

      // Handle validation errors
      if (statusCode === 422 && Array.isArray(errorData?.detail)) {
        const fieldErrors: Record<string, string> = {};
        errorData.detail.forEach((err) => {
          if (err.loc && err.loc.length > 0) {
            const field = err.loc[err.loc.length - 1];
            fieldErrors[field] = err.msg;
          }
        });
        throw new ClassApiError(
          'Validation failed. Please check your input.',
          statusCode,
          fieldErrors
        );
      }

      const message = typeof errorData?.detail === 'string'
        ? errorData.detail
        : `Failed to create class (${statusCode})`;
      throw new ClassApiError(message, statusCode);
    }

    return response.data;
  } catch (error) {
    if (error instanceof ClassApiError) {
      throw error;
    }
    if (axios.isAxiosError(error)) {
      throw new ClassApiError(
        error.message || 'Failed to create class',
        error.response?.status || 500
      );
    }
    throw new ClassApiError('An unexpected error occurred', 500);
  }
}

/**
 * Update a class.
 * 
 * @param token - JWT authentication token
 * @param classId - Class ID
 * @param data - Class update data
 * @returns Promise resolving to updated class
 * @throws ClassApiError if request fails
 */
export async function updateClass(
  token: string,
  classId: number,
  data: ClassUpdateData
): Promise<ClassResponse> {
  try {
    const response = await axios.put<ClassResponse>(
      `${API_BASE_URL}/api/v1/classes/${classId}`,
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
        throw new ClassApiError(
          'Authentication required. Please log in and try again.',
          statusCode
        );
      }

      if (statusCode === 404) {
        throw new ClassApiError('Class not found', statusCode);
      }

      if (statusCode === 409) {
        const message = typeof errorData?.detail === 'string'
          ? errorData.detail
          : 'Class name already exists';
        throw new ClassApiError(message, statusCode);
      }

      // Handle validation errors
      if (statusCode === 422 && Array.isArray(errorData?.detail)) {
        const fieldErrors: Record<string, string> = {};
        errorData.detail.forEach((err) => {
          if (err.loc && err.loc.length > 0) {
            const field = err.loc[err.loc.length - 1];
            fieldErrors[field] = err.msg;
          }
        });
        throw new ClassApiError(
          'Validation failed. Please check your input.',
          statusCode,
          fieldErrors
        );
      }

      const message = typeof errorData?.detail === 'string'
        ? errorData.detail
        : `Failed to update class (${statusCode})`;
      throw new ClassApiError(message, statusCode);
    }

    return response.data;
  } catch (error) {
    if (error instanceof ClassApiError) {
      throw error;
    }
    if (axios.isAxiosError(error)) {
      throw new ClassApiError(
        error.message || 'Failed to update class',
        error.response?.status || 500
      );
    }
    throw new ClassApiError('An unexpected error occurred', 500);
  }
}

/**
 * Delete a class (soft delete).
 * 
 * @param token - JWT authentication token
 * @param classId - Class ID
 * @throws ClassApiError if request fails
 */
export async function deleteClass(
  token: string,
  classId: number
): Promise<void> {
  try {
    const response = await axios.delete(
      `${API_BASE_URL}/api/v1/classes/${classId}`,
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
        throw new ClassApiError(
          'Authentication required. Please log in and try again.',
          statusCode
        );
      }

      if (statusCode === 404) {
        throw new ClassApiError('Class not found', statusCode);
      }

      const message = typeof errorData?.detail === 'string'
        ? errorData.detail
        : `Failed to delete class (${statusCode})`;
      throw new ClassApiError(message, statusCode);
    }
  } catch (error) {
    if (error instanceof ClassApiError) {
      throw error;
    }
    if (axios.isAxiosError(error)) {
      throw new ClassApiError(
        error.message || 'Failed to delete class',
        error.response?.status || 500
      );
    }
    throw new ClassApiError('An unexpected error occurred', 500);
  }
}


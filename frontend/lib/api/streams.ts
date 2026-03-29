/**
 * API client functions for Stream management.
 * 
 * Base URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'
 * Endpoints:
 * - GET /api/v1/streams - List streams (optionally filtered by class)
 * - GET /api/v1/streams/{id} - Get stream by ID
 * - POST /api/v1/streams - Create a new stream
 * - PUT /api/v1/streams/{id} - Update stream
 * - DELETE /api/v1/streams/{id} - Soft delete stream
 */

import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Stream response type from the API.
 */
export interface StreamResponse {
  id: number;
  class_id: number;
  name: string;
  description: string | null;
  is_deleted: boolean;
  created_at: string; // ISO datetime
  updated_at: string | null;
}

/**
 * Stream creation data.
 */
export interface StreamCreateData {
  class_id: number;
  name: string;
  description?: string | null;
}

/**
 * Stream update data.
 */
export interface StreamUpdateData {
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
 * Custom error class for Stream API errors.
 */
export class StreamApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public fieldErrors?: Record<string, string>
  ) {
    super(message);
    this.name = 'StreamApiError';
  }
}

/**
 * List streams, optionally filtered by class.
 * 
 * @param token - JWT authentication token
 * @param classId - Optional class ID to filter by
 * @returns Promise resolving to list of streams
 * @throws StreamApiError if request fails
 */
export async function listStreams(
  token: string,
  classId?: number | null
): Promise<StreamResponse[]> {
  try {
    const queryParams = new URLSearchParams();
    if (classId) {
      queryParams.append('class_id', classId.toString());
    }

    const url = classId
      ? `${API_BASE_URL}/api/v1/streams?${queryParams.toString()}`
      : `${API_BASE_URL}/api/v1/streams`;

    const response = await axios.get<StreamResponse[]>(
      url,
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
        throw new StreamApiError(
          'Authentication required. Please log in and try again.',
          statusCode
        );
      }

      if (statusCode === 404) {
        throw new StreamApiError('Class not found', statusCode);
      }

      const message = typeof errorData?.detail === 'string'
        ? errorData.detail
        : `Failed to load streams (${statusCode})`;
      throw new StreamApiError(message, statusCode);
    }

    return response.data;
  } catch (error) {
    if (error instanceof StreamApiError) {
      throw error;
    }
    if (axios.isAxiosError(error)) {
      throw new StreamApiError(
        error.message || 'Failed to load streams',
        error.response?.status || 500
      );
    }
    throw new StreamApiError('An unexpected error occurred', 500);
  }
}

/**
 * Get a stream by ID.
 * 
 * @param token - JWT authentication token
 * @param streamId - Stream ID
 * @returns Promise resolving to stream data
 * @throws StreamApiError if request fails
 */
export async function getStream(
  token: string,
  streamId: number
): Promise<StreamResponse> {
  try {
    const response = await axios.get<StreamResponse>(
      `${API_BASE_URL}/api/v1/streams/${streamId}`,
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
        throw new StreamApiError(
          'Authentication required. Please log in and try again.',
          statusCode
        );
      }

      if (statusCode === 404) {
        throw new StreamApiError('Stream not found', statusCode);
      }

      const message = typeof errorData?.detail === 'string'
        ? errorData.detail
        : `Failed to load stream (${statusCode})`;
      throw new StreamApiError(message, statusCode);
    }

    return response.data;
  } catch (error) {
    if (error instanceof StreamApiError) {
      throw error;
    }
    if (axios.isAxiosError(error)) {
      throw new StreamApiError(
        error.message || 'Failed to load stream',
        error.response?.status || 500
      );
    }
    throw new StreamApiError('An unexpected error occurred', 500);
  }
}

/**
 * Create a new stream.
 * 
 * @param token - JWT authentication token
 * @param data - Stream creation data
 * @returns Promise resolving to created stream
 * @throws StreamApiError if request fails
 */
export async function createStream(
  token: string,
  data: StreamCreateData
): Promise<StreamResponse> {
  try {
    const response = await axios.post<StreamResponse>(
      `${API_BASE_URL}/api/v1/streams`,
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
        throw new StreamApiError(
          'Authentication required. Please log in and try again.',
          statusCode
        );
      }

      if (statusCode === 404) {
        throw new StreamApiError('Class not found', statusCode);
      }

      if (statusCode === 409) {
        const message = typeof errorData?.detail === 'string'
          ? errorData.detail
          : 'Stream name already exists for this class';
        throw new StreamApiError(message, statusCode);
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
        throw new StreamApiError(
          'Validation failed. Please check your input.',
          statusCode,
          fieldErrors
        );
      }

      const message = typeof errorData?.detail === 'string'
        ? errorData.detail
        : `Failed to create stream (${statusCode})`;
      throw new StreamApiError(message, statusCode);
    }

    return response.data;
  } catch (error) {
    if (error instanceof StreamApiError) {
      throw error;
    }
    if (axios.isAxiosError(error)) {
      throw new StreamApiError(
        error.message || 'Failed to create stream',
        error.response?.status || 500
      );
    }
    throw new StreamApiError('An unexpected error occurred', 500);
  }
}

/**
 * Update a stream.
 * 
 * @param token - JWT authentication token
 * @param streamId - Stream ID
 * @param data - Stream update data
 * @returns Promise resolving to updated stream
 * @throws StreamApiError if request fails
 */
export async function updateStream(
  token: string,
  streamId: number,
  data: StreamUpdateData
): Promise<StreamResponse> {
  try {
    const response = await axios.put<StreamResponse>(
      `${API_BASE_URL}/api/v1/streams/${streamId}`,
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
        throw new StreamApiError(
          'Authentication required. Please log in and try again.',
          statusCode
        );
      }

      if (statusCode === 404) {
        throw new StreamApiError('Stream not found', statusCode);
      }

      if (statusCode === 409) {
        const message = typeof errorData?.detail === 'string'
          ? errorData.detail
          : 'Stream name already exists for this class';
        throw new StreamApiError(message, statusCode);
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
        throw new StreamApiError(
          'Validation failed. Please check your input.',
          statusCode,
          fieldErrors
        );
      }

      const message = typeof errorData?.detail === 'string'
        ? errorData.detail
        : `Failed to update stream (${statusCode})`;
      throw new StreamApiError(message, statusCode);
    }

    return response.data;
  } catch (error) {
    if (error instanceof StreamApiError) {
      throw error;
    }
    if (axios.isAxiosError(error)) {
      throw new StreamApiError(
        error.message || 'Failed to update stream',
        error.response?.status || 500
      );
    }
    throw new StreamApiError('An unexpected error occurred', 500);
  }
}

/**
 * Delete a stream (soft delete).
 * 
 * @param token - JWT authentication token
 * @param streamId - Stream ID
 * @throws StreamApiError if request fails
 */
export async function deleteStream(
  token: string,
  streamId: number
): Promise<void> {
  try {
    const response = await axios.delete(
      `${API_BASE_URL}/api/v1/streams/${streamId}`,
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
        throw new StreamApiError(
          'Authentication required. Please log in and try again.',
          statusCode
        );
      }

      if (statusCode === 404) {
        throw new StreamApiError('Stream not found', statusCode);
      }

      const message = typeof errorData?.detail === 'string'
        ? errorData.detail
        : `Failed to delete stream (${statusCode})`;
      throw new StreamApiError(message, statusCode);
    }
  } catch (error) {
    if (error instanceof StreamApiError) {
      throw error;
    }
    if (axios.isAxiosError(error)) {
      throw new StreamApiError(
        error.message || 'Failed to delete stream',
        error.response?.status || 500
      );
    }
    throw new StreamApiError('An unexpected error occurred', 500);
  }
}


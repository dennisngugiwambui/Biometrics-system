/**
 * Sync API client.
 *
 * Handles student-device sync operations: check sync status, sync student to device.
 */

import axios from "axios";
import { useAuthStore } from "../store/authStore";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface SyncStatusResponse {
  device_id: number;
  student_id: number;
  synced: boolean;
}

/**
 * Check if a teacher is synced to a device.
 */
export async function getTeacherSyncStatus(
  deviceId: number,
  teacherId: number
): Promise<SyncStatusResponse> {
  const authStore = useAuthStore.getState();
  const token = authStore.token;
  if (!token) throw new Error("Not authenticated");

  const response = await axios.get<SyncStatusResponse>(
    `${API_BASE_URL}/api/v1/sync/devices/${deviceId}/teachers/${teacherId}/status`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return response.data;
}

export interface SyncSuccessResponse {
  message: string;
  device_id: number;
  student_id: number;
}

export class SyncApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message);
    this.name = "SyncApiError";
  }
}

/**
 * Sync a teacher to a device.
 */
export async function syncTeacherToDevice(
  teacherId: number,
  deviceId: number
): Promise<SyncSuccessResponse> {
  const authStore = useAuthStore.getState();
  const token = authStore.token;
  if (!token) throw new Error("Not authenticated");

  try {
    const response = await axios.post<SyncSuccessResponse>(
      `${API_BASE_URL}/api/v1/sync/teachers/${teacherId}/devices/${deviceId}`,
      {},
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      const detail = err.response.data?.detail;
      const message =
        typeof detail === "string" ? detail : detail?.message || err.message;
      throw new SyncApiError(
        message,
        err.response.status,
        detail?.code
      );
    }
    throw err;
  }
}

/**
 * Check if a student is synced to a device.
 */
export async function getSyncStatus(
  deviceId: number,
  studentId: number
): Promise<SyncStatusResponse> {
  const authStore = useAuthStore.getState();
  const token = authStore.token;
  if (!token) throw new Error("Not authenticated");

  const response = await axios.get<SyncStatusResponse>(
    `${API_BASE_URL}/api/v1/sync/devices/${deviceId}/students/${studentId}/status`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return response.data;
}

/**
 * Sync a student to a device.
 */
export async function syncStudentToDevice(
  studentId: number,
  deviceId: number
): Promise<SyncSuccessResponse> {
  const authStore = useAuthStore.getState();
  const token = authStore.token;
  if (!token) throw new Error("Not authenticated");

  try {
    const response = await axios.post<SyncSuccessResponse>(
      `${API_BASE_URL}/api/v1/sync/students/${studentId}/devices/${deviceId}`,
      {},
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      const detail = err.response.data?.detail;
      const message =
        typeof detail === "string" ? detail : detail?.message || err.message;
      throw new SyncApiError(
        message,
        err.response.status,
        detail?.code
      );
    }
    throw err;
  }
}

export interface UnsyncedStudentItem {
  id: number;
  admission_number: string;
  first_name: string;
  last_name: string;
  full_name: string;
  class_name: string | null;
}

export interface UnsyncedTeacherItem {
  id: number;
  employee_id: string;
  full_name: string;
}

export interface BulkSyncResult {
  synced: number;
  attempted: number;
  failed: { student_id?: number; teacher_id?: number; detail: string }[];
}

export async function listUnsyncedStudents(
  deviceId: number,
  token: string,
  params?: { class_id?: number; stream_id?: number }
): Promise<UnsyncedStudentItem[]> {
  const q = new URLSearchParams();
  if (params?.class_id != null) q.set("class_id", String(params.class_id));
  if (params?.stream_id != null) q.set("stream_id", String(params.stream_id));
  const qs = q.toString();
  const { data } = await axios.get<UnsyncedStudentItem[]>(
    `${API_BASE_URL}/api/v1/sync/devices/${deviceId}/unsynced-students${qs ? `?${qs}` : ""}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
}

export async function listUnsyncedTeachers(
  deviceId: number,
  token: string
): Promise<UnsyncedTeacherItem[]> {
  const { data } = await axios.get<UnsyncedTeacherItem[]>(
    `${API_BASE_URL}/api/v1/sync/devices/${deviceId}/unsynced-teachers`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
}

export async function bulkSyncStudentsToDevice(
  deviceId: number,
  token: string,
  body?: { student_ids?: number[]; class_id?: number; stream_id?: number }
): Promise<BulkSyncResult> {
  try {
    const { data } = await axios.post<BulkSyncResult>(
      `${API_BASE_URL}/api/v1/sync/devices/${deviceId}/bulk-sync-students`,
      body ?? {},
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      const detail = err.response.data?.detail;
      const message =
        typeof detail === "string" ? detail : detail?.message || err.message;
      throw new SyncApiError(message, err.response.status, detail?.code);
    }
    throw err;
  }
}

export async function bulkSyncTeachersToDevice(
  deviceId: number,
  token: string,
  body?: { teacher_ids?: number[] }
): Promise<BulkSyncResult> {
  try {
    const { data } = await axios.post<BulkSyncResult>(
      `${API_BASE_URL}/api/v1/sync/devices/${deviceId}/bulk-sync-teachers`,
      body ?? {},
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      const detail = err.response.data?.detail;
      const message =
        typeof detail === "string" ? detail : detail?.message || err.message;
      throw new SyncApiError(message, err.response.status, detail?.code);
    }
    throw err;
  }
}

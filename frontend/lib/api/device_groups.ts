/**
 * API client functions for Device Group management.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export interface DeviceGroupResponse {
  id: number
  school_id: number
  name: string
  description: string | null
  device_count: number
  created_at: string
  updated_at: string | null
}

export interface DeviceGroupListResponse {
  items: DeviceGroupResponse[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface DeviceGroupCreateData {
  name: string
  description?: string | null
}

export interface DeviceGroupUpdateData {
  name?: string
  description?: string | null
}

export class DeviceGroupApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message)
    this.name = "DeviceGroupApiError"
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `HTTP error! status: ${response.status}`
    let errorCode: string | undefined

    try {
      const errorData = await response.json()
      errorMessage = errorData.detail || errorData.message || errorMessage
      errorCode = errorData.code
    } catch {
      // If response is not JSON, use status text
      errorMessage = response.statusText || errorMessage
    }

    throw new DeviceGroupApiError(errorMessage, response.status, errorCode)
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}

/**
 * List device groups with pagination.
 */
export async function listDeviceGroups(
  token: string,
  params?: {
    page?: number
    page_size?: number
  }
): Promise<DeviceGroupListResponse> {
  const queryParams = new URLSearchParams()
  if (params?.page) queryParams.set("page", params.page.toString())
  if (params?.page_size) queryParams.set("page_size", params.page_size.toString())

  const url = `${API_BASE_URL}/api/v1/device-groups${queryParams.toString() ? `?${queryParams.toString()}` : ""}`

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  })

  return handleResponse<DeviceGroupListResponse>(response)
}

/**
 * Get a device group by ID.
 */
export async function getDeviceGroup(
  token: string,
  groupId: number
): Promise<DeviceGroupResponse> {
  const url = `${API_BASE_URL}/api/v1/device-groups/${groupId}`

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  })

  return handleResponse<DeviceGroupResponse>(response)
}

/**
 * Create a new device group.
 */
export async function createDeviceGroup(
  token: string,
  data: DeviceGroupCreateData
): Promise<DeviceGroupResponse> {
  const url = `${API_BASE_URL}/api/v1/device-groups`

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })

  return handleResponse<DeviceGroupResponse>(response)
}

/**
 * Update a device group.
 */
export async function updateDeviceGroup(
  token: string,
  groupId: number,
  data: DeviceGroupUpdateData
): Promise<DeviceGroupResponse> {
  const url = `${API_BASE_URL}/api/v1/device-groups/${groupId}`

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })

  return handleResponse<DeviceGroupResponse>(response)
}

/**
 * Delete a device group (soft delete).
 */
export async function deleteDeviceGroup(
  token: string,
  groupId: number
): Promise<void> {
  const url = `${API_BASE_URL}/api/v1/device-groups/${groupId}`

  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  })

  return handleResponse<void>(response)
}


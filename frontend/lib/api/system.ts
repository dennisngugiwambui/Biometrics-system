import axiosInstance from "./axios-instance"

export interface SystemInfo {
    status: string
    internal_ip: string
}

export async function getSystemInfo(token: string): Promise<SystemInfo> {
    const response = await axiosInstance.get("/api/v1/system/info", {
        headers: { Authorization: `Bearer ${token}` },
    })
    return response.data
}

export type SystemResetScope = "system" | "devices" | "both"

export interface SystemResetSummary {
    status: string
    message: string
    school_id: number
    scope: SystemResetScope
    devices: {
        total: number
        cleared: number[]
        failed: { device_id: number; name?: string; reason?: string }[]
        details?: { device_id: number; name?: string; ok: boolean; users_removed?: number; errors?: string[] }[]
    } | null
    deleted: Record<string, number>
}

/**
 * Reset the system: wipe the database, clear physical devices, or both.
 * Keeps the admin account and device records (IPs unchanged). Requires the literal
 * confirm string "RESET" and the current admin password.
 */
export async function resetSystem(
    token: string,
    params: { password: string; scope: SystemResetScope }
): Promise<SystemResetSummary> {
    const response = await axiosInstance.post(
        "/api/v1/system/reset",
        {
            confirm: "RESET",
            password: params.password,
            scope: params.scope,
        },
        { headers: { Authorization: `Bearer ${token}` } }
    )
    return response.data
}

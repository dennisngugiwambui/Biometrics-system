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

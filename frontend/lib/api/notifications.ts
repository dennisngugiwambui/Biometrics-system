/**
 * API client functions for in-app Notifications.
 * 
 * Base URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
 */

import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Notification {
    id: number;
    school_id: number;
    user_id: number | null;
    title: string;
    message: string;
    type: "system" | "attendance" | "enrollment";
    link: string | null;
    is_read: boolean;
    created_at: string;
}

export interface PaginatedNotificationResponse {
    items: Notification[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

export interface UnreadCountResponse {
    count: number;
}

/**
 * List notifications for the current user.
 */
export async function listNotifications(
    token: string,
    params: { page?: number; page_size?: number; is_read?: boolean } = {}
): Promise<PaginatedNotificationResponse> {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page", params.page.toString());
    if (params.page_size) queryParams.append("page_size", params.page_size.toString());
    if (params.is_read !== undefined) queryParams.append("is_read", params.is_read.toString());

    const { data } = await axios.get<PaginatedNotificationResponse>(
        `${API_BASE_URL}/api/v1/notifications?${queryParams.toString()}`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );
    return data;
}

/**
 * Get the count of unread notifications.
 */
export async function getUnreadCount(token: string): Promise<number> {
    console.log(`[NotificationAPI] getUnreadCount calling: ${API_BASE_URL}/api/v1/notifications/unread-count`);
    console.log(`[NotificationAPI] Token present: ${!!token}, length: ${token?.length}, prefix: ${token?.substring(0, 10)}...`);

    const { data } = await axios.get<UnreadCountResponse>(
        `${API_BASE_URL}/api/v1/notifications/unread-count`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );
    return data.count;
}

/**
 * Mark a single notification as read.
 */
export async function markAsRead(token: string, notificationId: number): Promise<void> {
    await axios.put(
        `${API_BASE_URL}/api/v1/notifications/${notificationId}/read`,
        {},
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );
}

/**
 * Mark all notifications as read.
 */
export async function markAllAsRead(token: string): Promise<void> {
    await axios.post(
        `${API_BASE_URL}/api/v1/notifications/mark-all-read`,
        {},
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );
}

/** Response from test SMS endpoint (uses school's notification settings). */
export interface TestSmsResponse {
    success: boolean;
    detail: string;
}

/**
 * Send a test message using the current school's notification settings.
 * Optionally specify channel: sms, whatsapp, or both. Defaults to school's parent_delivery.
 */
export async function sendTestSms(
    token: string,
    to: string,
    channel?: "sms" | "whatsapp" | "both"
): Promise<TestSmsResponse> {
    const body: { to: string; channel?: string } = { to };
    if (channel) body.channel = channel;
    const { data } = await axios.post<TestSmsResponse>(
        `${API_BASE_URL}/api/v1/notifications/test-sms`,
        body,
        {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        }
    );
    return data;
}

export interface SendWeeklyRemindersResponse {
    sent: number;
    failed: number;
    detail: string;
}

/**
 * Send weekly attendance reminders to all teachers (present X/5 days, percentage).
 */
export async function sendWeeklyReminders(token: string): Promise<SendWeeklyRemindersResponse> {
    const { data } = await axios.post<SendWeeklyRemindersResponse>(
        `${API_BASE_URL}/api/v1/notifications/send-weekly-reminders`,
        {},
        {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        }
    );
    return data;
}

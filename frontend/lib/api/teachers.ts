/**
 * API client functions for Teacher management.
 *
 * Base URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
 * Endpoints:
 * - GET    /api/v1/teachers               — List teachers (paginated, search)
 * - GET    /api/v1/teachers/:id           — Get single teacher
 * - POST   /api/v1/teachers               — Create teacher
 * - PUT    /api/v1/teachers/:id           — Update teacher
 * - DELETE /api/v1/teachers/:id           — Soft-delete teacher
 * - POST   /api/v1/teachers/import/json  — Bulk import (JSON)
 * - POST   /api/v1/teachers/import/file  — Bulk import (CSV/TSV)
 */

import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------

export interface TeacherResponse {
    id: number;
    school_id: number;
    employee_id: string | null;
    first_name: string;
    last_name: string;
    phone: string;
    email: string | null;
    subject: string[] | null;
    department: string | null;
    is_active: boolean;
    is_deleted: boolean;
    created_at: string;
    updated_at: string | null;
}

export interface PaginatedTeacherResponse {
    items: TeacherResponse[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

export interface TeacherCreateData {
    first_name: string;
    last_name: string;
    phone: string;
    email?: string | null;
    subject?: string[] | null;
    department?: string | null;
}

export interface TeacherUpdateData {
    first_name?: string;
    last_name?: string;
    phone?: string;
    email?: string | null;
    subject?: string[] | null;
    department?: string | null;
    is_active?: boolean;
}

export interface ListTeachersParams {
    search?: string;
    department?: string;
    is_active?: boolean;
    page?: number;
    page_size?: number;
}

export interface TeacherBulkImportResult {
    inserted: number;
    updated: number;
    skipped: number;
    errors: string[];
    total: number;
}

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function authHeaders(token: string) {
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
    };
}

// -------------------------------------------------------------------------
// API functions
// -------------------------------------------------------------------------

/** List teachers with optional search/filter. */
export async function listTeachers(
    token: string,
    params: ListTeachersParams = {}
): Promise<PaginatedTeacherResponse> {
    const q = new URLSearchParams();
    if (params.search) q.append("search", params.search);
    if (params.department) q.append("department", params.department);
    if (params.is_active !== undefined) q.append("is_active", String(params.is_active));
    if (params.page) q.append("page", String(params.page));
    if (params.page_size) q.append("page_size", String(params.page_size));

    const { data } = await axios.get<PaginatedTeacherResponse>(
        `${API_BASE_URL}/api/v1/teachers?${q.toString()}`,
        { headers: authHeaders(token) }
    );
    return data;
}

/** Get a single teacher by ID. */
export async function getTeacher(token: string, teacherId: number): Promise<TeacherResponse> {
    const { data } = await axios.get<TeacherResponse>(
        `${API_BASE_URL}/api/v1/teachers/${teacherId}`,
        { headers: authHeaders(token) }
    );
    return data;
}

/** Create a new teacher. */
export async function createTeacher(
    token: string,
    teacherData: TeacherCreateData
): Promise<TeacherResponse> {
    const { data } = await axios.post<TeacherResponse>(
        `${API_BASE_URL}/api/v1/teachers`,
        teacherData,
        { headers: authHeaders(token) }
    );
    return data;
}

/** Update an existing teacher. */
export async function updateTeacher(
    token: string,
    teacherId: number,
    teacherData: TeacherUpdateData
): Promise<TeacherResponse> {
    const { data } = await axios.put<TeacherResponse>(
        `${API_BASE_URL}/api/v1/teachers/${teacherId}`,
        teacherData,
        { headers: authHeaders(token) }
    );
    return data;
}

/** Soft-delete a teacher. */
export async function deleteTeacher(token: string, teacherId: number): Promise<void> {
    await axios.delete(`${API_BASE_URL}/api/v1/teachers/${teacherId}`, {
        headers: authHeaders(token),
    });
}

/** Timeout for bulk file import (10 min) - backend streams NDJSON progress. */
const BULK_IMPORT_TIMEOUT_MS = 600_000;

/**
 * Bulk import teachers from a File object (CSV, TSV).
 * Consumes NDJSON stream from backend for real-time progress updates.
 */
export async function bulkImportTeachersFile(
    token: string,
    file: File,
    onProgress?: (percent: number) => void
): Promise<TeacherBulkImportResult> {
    const formData = new FormData();
    formData.append("file", file);

    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), BULK_IMPORT_TIMEOUT_MS);

    try {
        const res = await fetch(`${API_BASE_URL}/api/v1/teachers/import/file`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
            signal: ac.signal,
        });

        if (!res.ok && res.headers.get("content-type")?.includes("application/json")) {
            const j = await res.json();
            throw new Error(j?.detail ?? "Import failed");
        }
        if (!res.ok) throw new Error(`Import failed: ${res.statusText}`);

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                try {
                    const msg = JSON.parse(trimmed) as {
                        type?: string;
                        pct?: number;
                        detail?: string;
                        inserted?: number;
                        updated?: number;
                        skipped?: number;
                        errors?: string[];
                        total?: number;
                    };
                    if (msg.type === "progress" && typeof msg.pct === "number" && onProgress) {
                        onProgress(Math.min(100, Math.max(0, msg.pct)));
                    } else if (msg.type === "result") {
                        return {
                            inserted: msg.inserted ?? 0,
                            updated: msg.updated ?? 0,
                            skipped: msg.skipped ?? 0,
                            errors: msg.errors ?? [],
                            total: msg.total ?? 0,
                        };
                    } else if (msg.type === "error") {
                        throw new Error(msg.detail ?? "Import failed");
                    }
                } catch (e) {
                    // Ignore JSON parse errors for malformed chunks; rethrow our errors
                    if (!(e instanceof SyntaxError)) throw e;
                }
            }
        }

        if (buffer.trim()) {
            const msg = JSON.parse(buffer.trim()) as {
                type?: string;
                detail?: string;
                inserted?: number;
                updated?: number;
                skipped?: number;
                errors?: string[];
                total?: number;
            };
            if (msg.type === "result")
                return {
                    inserted: msg.inserted ?? 0,
                    updated: msg.updated ?? 0,
                    skipped: msg.skipped ?? 0,
                    errors: msg.errors ?? [],
                    total: msg.total ?? 0,
                };
            if (msg.type === "error") throw new Error(msg.detail ?? "Import failed");
        }

        throw new Error("Import completed with no result");
    } catch (err: unknown) {
        if (err instanceof Error) {
            if (err.name === "AbortError") throw new Error("Upload timed out. Try a smaller file.");
            throw err;
        }
        throw new Error("Import failed");
    } finally {
        clearTimeout(to);
    }
}

/**
 * Bulk import from JSON rows (used when frontend parses XLSX/Access and sends JSON).
 */
export async function bulkImportTeachersJson(
    token: string,
    rows: TeacherCreateData[]
): Promise<TeacherBulkImportResult> {
    const { data } = await axios.post<TeacherBulkImportResult>(
        `${API_BASE_URL}/api/v1/teachers/import/json`,
        { teachers: rows },
        { headers: authHeaders(token) }
    );
    return data;
}

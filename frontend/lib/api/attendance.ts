/**
 * API client functions for Attendance records.
 *
 * Base URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8003'
 */

import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

export type EventType = "IN" | "OUT" | "UNKNOWN" | "DUPLICATE";

export interface AttendanceEvent {
  id: string | number;
  student_id: number | null;
  student_name: string | null;
  admission_number: string | null;
  teacher_id: number | null;
  teacher_name: string | null;
  employee_id: string | null;
  /** Set for teacher events */
  department?: string | null;
  class_name: string | null;
  is_boarding: boolean;
  device_id: number;
  device_name: string;
  event_type: EventType;
  occurred_at: string; // ISO datetime
}

export interface PaginatedAttendanceResponse {
  items: AttendanceEvent[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AttendanceStats {
  date: string; // YYYY-MM-DD
  total_events: number;
  checked_in: number;
  checked_out: number;
  total_users: number;
  present_rate: number;
}

// -------------------------------------------------------------------
// Filter params
// -------------------------------------------------------------------

export interface AttendanceListParams {
  target_date?: string; // YYYY-MM-DD
  user_type?: "student" | "teacher";
  student_id?: number;
  teacher_id?: number;
  class_id?: number;
  stream_id?: number;
  device_id?: number;
  event_type?: EventType;
  search?: string;
  date_from?: string;
  date_to?: string;
  is_boarding?: boolean;
  page?: number;
  page_size?: number;
}

// -------------------------------------------------------------------
// API functions
// -------------------------------------------------------------------

/**
 * List attendance records with filters and pagination.
 */
export async function listAttendance(
  token: string,
  params: AttendanceListParams = {}
): Promise<PaginatedAttendanceResponse> {
  const queryParams = new URLSearchParams();
  if (params.target_date) queryParams.append("target_date", params.target_date);
  if (params.user_type) queryParams.append("user_type", params.user_type);
  if (params.student_id) queryParams.append("student_id", params.student_id.toString());
  if (params.teacher_id) queryParams.append("teacher_id", params.teacher_id.toString());
  if (params.class_id) queryParams.append("class_id", params.class_id.toString());
  if (params.stream_id) queryParams.append("stream_id", params.stream_id.toString());
  if (params.device_id) queryParams.append("device_id", params.device_id.toString());
  if (params.event_type) queryParams.append("event_type", params.event_type);
  if (params.search) queryParams.append("search", params.search);
  if (params.date_from) queryParams.append("date_from", params.date_from);
  if (params.date_to) queryParams.append("date_to", params.date_to);
  if (params.is_boarding !== undefined) queryParams.append("is_boarding", params.is_boarding.toString());
  if (params.page) queryParams.append("page", params.page.toString());
  if (params.page_size) queryParams.append("page_size", params.page_size.toString());

  const { data } = await axios.get<PaginatedAttendanceResponse>(
    `${API_BASE_URL}/api/v1/attendance?${queryParams.toString()}`,
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return data;
}

/**
 * Get attendance summary stats for a date.
 */
export async function getAttendanceStats(
  token: string,
  targetDate?: string,
  userType: "student" | "teacher" = "student"
): Promise<AttendanceStats> {
  const queryParams = new URLSearchParams();
  if (targetDate) queryParams.append("target_date", targetDate);
  queryParams.append("user_type", userType);

  const { data } = await axios.get<AttendanceStats>(
    `${API_BASE_URL}/api/v1/attendance/stats?${queryParams.toString()}`,
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return data;
}

/**
 * Get attendance records for a specific student (chronological).
 */
export async function getStudentAttendance(
  token: string,
  studentId: number,
  targetDate?: string
): Promise<AttendanceEvent[]> {
  const queryParams = new URLSearchParams();
  if (targetDate) queryParams.append("target_date", targetDate);

  const { data } = await axios.get<AttendanceEvent[]>(
    `${API_BASE_URL}/api/v1/attendance/students/${studentId}?${queryParams.toString()}`,
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return data;
}

/**
 * Get historical attendance summary stats for a date range.
 */
export async function getAttendanceHistory(
  token: string,
  dateFrom: string,
  dateTo: string,
  userType: "student" | "teacher" = "student"
): Promise<AttendanceStats[]> {
  const queryParams = new URLSearchParams();
  queryParams.append("date_from", dateFrom);
  queryParams.append("date_to", dateTo);
  queryParams.append("user_type", userType);

  const { data } = await axios.get<AttendanceStats[]>(
    `${API_BASE_URL}/api/v1/attendance/history?${queryParams.toString()}`,
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return data;
}

// -------------------------------------------------------------------
// Roster (today’s presence / absence lists)
// -------------------------------------------------------------------

export type PresenceBasis = "daily" | "session";

export interface RosterSummary {
  target_date: string;
  total_students: number;
  with_check_in_today: number;
  currently_in_school: number;
  absent_no_check_in: number;
}

export interface RosterStudentItem {
  student_id: number;
  full_name: string;
  admission_number: string;
  class_name: string | null;
  last_event_at: string;
  device_name: string;
}

export interface RosterAbsentItem {
  student_id: number;
  full_name: string;
  admission_number: string;
  class_name: string | null;
}

export interface RosterQueryParams {
  target_date?: string;
  class_id?: number;
  stream_id?: number;
  /** session = last IN until OUT (boarding); daily = last tap on calendar day only */
  presence_basis?: PresenceBasis;
}

function appendRosterQuery(q: URLSearchParams, params: RosterQueryParams) {
  if (params.target_date) q.append("target_date", params.target_date);
  if (params.class_id != null) q.append("class_id", String(params.class_id));
  if (params.stream_id != null) q.append("stream_id", String(params.stream_id));
  if (params.presence_basis) q.append("presence_basis", params.presence_basis);
}

export async function getRosterSummary(
  token: string,
  params: RosterQueryParams = {}
): Promise<RosterSummary> {
  const queryParams = new URLSearchParams();
  appendRosterQuery(queryParams, params);
  const { data } = await axios.get<RosterSummary>(
    `${API_BASE_URL}/api/v1/attendance/roster/summary?${queryParams.toString()}`,
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return data;
}

export async function listRosterCurrentlyIn(
  token: string,
  params: RosterQueryParams = {}
): Promise<RosterStudentItem[]> {
  const queryParams = new URLSearchParams();
  appendRosterQuery(queryParams, params);
  const { data } = await axios.get<RosterStudentItem[]>(
    `${API_BASE_URL}/api/v1/attendance/roster/currently-in?${queryParams.toString()}`,
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return data;
}

export async function listRosterAbsent(
  token: string,
  params: RosterQueryParams = {}
): Promise<RosterAbsentItem[]> {
  const queryParams = new URLSearchParams();
  if (params.target_date) queryParams.append("target_date", params.target_date);
  if (params.class_id != null) queryParams.append("class_id", String(params.class_id));
  if (params.stream_id != null) queryParams.append("stream_id", String(params.stream_id));
  const { data } = await axios.get<RosterAbsentItem[]>(
    `${API_BASE_URL}/api/v1/attendance/roster/absent?${queryParams.toString()}`,
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return data;
}

export interface StudentOffPremisesItem {
  student_id: number;
  full_name: string;
  admission_number: string;
  class_name: string | null;
  last_event_type: string | null;
  last_event_at: string | null;
  device_name: string;
}

export interface TeacherPresenceRow {
  id: number;
  first_name: string;
  last_name: string;
  employee_id: string | null;
  phone: string;
  email: string | null;
  subject: string[] | null;
  department: string | null;
  is_active: boolean;
  last_event_type: string | null;
  last_event_at: string | null;
  device_name: string | null;
}

export interface PaginatedTeacherRoster {
  items: TeacherPresenceRow[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface PresenceOverview {
  target_date: string;
  students_on_premises: number;
  students_off_premises: number;
  teachers_on_premises: number;
  teachers_off_premises: number;
  total_students: number;
  total_teachers: number;
}

export async function listStudentsOffPremises(
  token: string,
  params: RosterQueryParams = {}
): Promise<StudentOffPremisesItem[]> {
  const queryParams = new URLSearchParams();
  appendRosterQuery(queryParams, params);
  const { data } = await axios.get<StudentOffPremisesItem[]>(
    `${API_BASE_URL}/api/v1/attendance/roster/students/off-premises?${queryParams.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
}

export async function listTeachersCurrentlyIn(
  token: string,
  params: { target_date?: string; presence_basis?: PresenceBasis } = {}
): Promise<TeacherPresenceRow[]> {
  const q = new URLSearchParams();
  appendRosterQuery(q, params);
  const { data } = await axios.get<TeacherPresenceRow[]>(
    `${API_BASE_URL}/api/v1/attendance/roster/teachers/currently-in?${q.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
}

export async function listTeachersOffPremises(
  token: string,
  params: { target_date?: string; presence_basis?: PresenceBasis } = {}
): Promise<TeacherPresenceRow[]> {
  const q = new URLSearchParams();
  appendRosterQuery(q, params);
  const { data } = await axios.get<TeacherPresenceRow[]>(
    `${API_BASE_URL}/api/v1/attendance/roster/teachers/off-premises?${q.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
}

export async function listTeachersRoster(
  token: string,
  params: {
    target_date?: string;
    presence?: "all" | "in" | "out";
    search?: string;
    page?: number;
    page_size?: number;
    presence_basis?: PresenceBasis;
  } = {}
): Promise<PaginatedTeacherRoster> {
  const q = new URLSearchParams();
  if (params.target_date) q.set("target_date", params.target_date);
  if (params.presence) q.set("presence", params.presence);
  if (params.search) q.set("search", params.search);
  if (params.page) q.set("page", String(params.page));
  if (params.page_size) q.set("page_size", String(params.page_size));
  if (params.presence_basis) q.set("presence_basis", params.presence_basis);
  const { data } = await axios.get<PaginatedTeacherRoster>(
    `${API_BASE_URL}/api/v1/attendance/roster/teachers?${q.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
}

export async function getPresenceOverview(
  token: string,
  params: RosterQueryParams = {}
): Promise<PresenceOverview> {
  const queryParams = new URLSearchParams();
  appendRosterQuery(queryParams, params);
  const { data } = await axios.get<PresenceOverview>(
    `${API_BASE_URL}/api/v1/attendance/roster/presence-overview?${queryParams.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
}

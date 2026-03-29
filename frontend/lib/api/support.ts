/**
 * API client for Support Ticketing System.
 *
 * Endpoints:
 * - POST /api/v1/support/tickets          – Create a ticket (auth)
 * - GET  /api/v1/support/tickets          – List my tickets  (auth)
 * - POST /api/v1/support/tickets/:id/reply– Reply to a ticket (auth)
 * - GET  /api/v1/support/guest/:token     – Get ticket by token (no auth)
 * - POST /api/v1/support/guest/:token/reply – Admin reply (no auth)
 * - PATCH /api/v1/support/guest/:token/status – Change status (no auth)
 *
 * Legacy:
 * - POST /api/v1/support/contact          – Legacy contact form (kept for compat)
 */

import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const axiosInst = axios.create({ baseURL: API_BASE_URL });

export type SupportCategory = 'technical' | 'billing' | 'general' | 'bug' | 'feature';
export type SupportPriority = 'low' | 'medium' | 'high';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface TicketMessage {
  id: number;
  sender_name: string;
  sender_email: string;
  is_admin_reply: boolean;
  body: string;
  created_at: string;
}

export interface Ticket {
  id: number;
  subject: string;
  category: SupportCategory;
  priority: SupportPriority;
  status: TicketStatus;
  reporter_name: string | null;
  reporter_email: string;
  access_token: string;
  created_at: string;
  updated_at: string | null;
  messages: TicketMessage[];
}

export interface CreateTicketPayload {
  subject: string;
  category: SupportCategory;
  message: string;
  priority?: SupportPriority;
  user_email?: string;
  user_name?: string;
  school_id?: number;
}

export interface ReplyPayload {
  body: string;
  sender_name: string;
  sender_email: string;
}

export class SupportApiError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = 'SupportApiError';
  }
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function handleResponse<T>(promise: Promise<{ data: T; status: number }>): Promise<T> {
  try {
    const res = await promise;
    return res.data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status ?? 0;
      const detail = (err.response?.data as { detail?: string })?.detail ?? err.message;
      throw new SupportApiError(detail, status);
    }
    throw new SupportApiError('Unexpected error', 500);
  }
}

/** Create a new support ticket (requires auth). */
export async function createTicket(token: string, payload: CreateTicketPayload): Promise<Ticket> {
  return handleResponse(
    axiosInst.post<Ticket>('/api/v1/support/tickets', payload, { headers: authHeaders(token) })
  );
}

/** List all tickets filed by the current user. */
export async function listMyTickets(token: string): Promise<Ticket[]> {
  return handleResponse(
    axiosInst.get<Ticket[]>('/api/v1/support/tickets', { headers: authHeaders(token) })
  );
}

/** Add a reply to a ticket (authenticated user). */
export async function replyToTicket(
  token: string,
  ticketId: number,
  payload: ReplyPayload
): Promise<TicketMessage> {
  return handleResponse(
    axiosInst.post<TicketMessage>(`/api/v1/support/tickets/${ticketId}/reply`, payload, {
      headers: authHeaders(token),
    })
  );
}

/** Guest: fetch ticket by access token (no login required). */
export async function getTicketByToken(accessToken: string): Promise<Ticket> {
  return handleResponse(axiosInst.get<Ticket>(`/api/v1/support/guest/${accessToken}`));
}

/** Guest: admin replies using access token (no login required). */
export async function adminReplyByToken(
  accessToken: string,
  payload: ReplyPayload
): Promise<TicketMessage> {
  return handleResponse(
    axiosInst.post<TicketMessage>(`/api/v1/support/guest/${accessToken}/reply`, payload)
  );
}

/** Guest: update ticket status (no login required). */
export async function updateTicketStatus(
  accessToken: string,
  status: TicketStatus
): Promise<Ticket> {
  return handleResponse(
    axiosInst.patch<Ticket>(`/api/v1/support/guest/${accessToken}/status`, { status })
  );
}

/** Legacy send support request – kept for backward compat. */
export async function sendSupportRequest(
  token: string,
  request: CreateTicketPayload & { user_email?: string; user_name?: string }
): Promise<{ id: string; message: string; status: string }> {
  return handleResponse(
    axiosInst.post('/api/v1/support/contact', request, { headers: authHeaders(token) })
  );
}

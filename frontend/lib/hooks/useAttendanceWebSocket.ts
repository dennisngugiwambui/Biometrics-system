/**
 * React hook for WebSocket connection to real-time attendance events.
 *
 * Connects to /ws/attendance?token=<jwt> and provides live attendance
 * events as they are ingested from devices.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuthStore } from "@/lib/store/authStore";
import type { AttendanceEvent } from "@/lib/api/attendance";
import { getWsBaseUrl } from "@/lib/env";

export interface AttendanceWsMessage {
  type: "attendance_events" | "connected" | "pong";
  events?: AttendanceEvent[];
  count?: number;
  timestamp?: string;
  message?: string;
  school_id?: number;
}

export interface UseAttendanceWebSocketOptions {
  /** Callback when new events arrive */
  onEvents?: (events: AttendanceEvent[]) => void;
  /** Callback when WS connects */
  onConnect?: () => void;
  /** Callback when WS disconnects */
  onDisconnect?: () => void;
  /** Whether the hook is enabled (default true) */
  enabled?: boolean;
  /** Max reconnect attempts */
  maxReconnectAttempts?: number;
}

export interface UseAttendanceWebSocketReturn {
  isConnected: boolean;
  lastMessage: AttendanceWsMessage | null;
}

const RECONNECT_BASE_DELAY = 2000;
const PING_INTERVAL = 25000;

export function useAttendanceWebSocket(
  options: UseAttendanceWebSocketOptions = {}
): UseAttendanceWebSocketReturn {
  const {
    onEvents,
    onConnect,
    onDisconnect,
    enabled = true,
    maxReconnectAttempts = 10,
  } = options;

  const { token } = useAuthStore();
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<AttendanceWsMessage | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stable refs for callbacks
  const onEventsRef = useRef(onEvents);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  onEventsRef.current = onEvents;
  onConnectRef.current = onConnect;
  onDisconnectRef.current = onDisconnect;

  const cleanup = useCallback(() => {
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!token || !enabled) return;

    cleanup();

    const wsBase = getWsBaseUrl();
    const wsUrl = `${wsBase}/ws/attendance?token=${encodeURIComponent(token)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;

      // Start ping interval
      pingTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send("ping");
        }
      }, PING_INTERVAL);
    };

    ws.onmessage = (event) => {
      try {
        const msg: AttendanceWsMessage = JSON.parse(event.data);
        setLastMessage(msg);

        if (msg.type === "connected") {
          onConnectRef.current?.();
        } else if (msg.type === "attendance_events" && msg.events) {
          onEventsRef.current?.(msg.events);
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      onDisconnectRef.current?.();

      if (pingTimerRef.current) {
        clearInterval(pingTimerRef.current);
        pingTimerRef.current = null;
      }

      // Reconnect with exponential backoff
      if (enabled && reconnectAttemptsRef.current < maxReconnectAttempts) {
        const delay = Math.min(
          RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttemptsRef.current),
          30000
        );
        reconnectAttemptsRef.current++;
        reconnectTimerRef.current = setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      // onclose will fire after onerror
    };
  }, [token, enabled, cleanup, maxReconnectAttempts]);

  useEffect(() => {
    if (enabled && token) {
      connect();
    }
    return cleanup;
  }, [enabled, token, connect, cleanup]);

  return { isConnected, lastMessage };
}

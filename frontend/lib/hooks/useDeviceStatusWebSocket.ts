/**
 * React hook for WebSocket connection to device status updates.
 * 
 * Connects to the backend WebSocket endpoint and provides real-time
 * device status updates. Automatically handles reconnection on disconnect.
 */

import { useEffect, useState, useCallback, useRef } from "react"
import { useAuthStore } from "@/lib/store/authStore"
import { type DeviceStatus } from "@/lib/api/devices"
import { getWsBaseUrl } from "@/lib/env"

export interface DeviceStatusUpdate {
  type: "device_status_update" | "device_info_update" | "connected" | "pong"
  device_id?: number
  status?: DeviceStatus
  last_seen?: string | null
  timestamp?: string
  message?: string
  school_id?: number
  info?: {
    serial_number?: string | null
    device_name?: string | null
    firmware_version?: string | null
    device_time?: string | null
    capacity?: {
      users?: number
      fingers?: number
      records?: number
      cards?: number
      faces?: number
      users_cap?: number
      fingers_cap?: number
      rec_cap?: number
      faces_cap?: number
      users_av?: number
      fingers_av?: number
      rec_av?: number
    } | null
  }
}

export interface UseDeviceStatusWebSocketOptions {
  /** Callback when device status updates are received */
  onStatusUpdate?: (update: DeviceStatusUpdate) => void
  /** Callback when device info updates are received */
  onInfoUpdate?: (update: DeviceStatusUpdate) => void
  /** Callback when connection is established */
  onConnect?: () => void
  /** Callback when connection is lost */
  onDisconnect?: () => void
  /** Callback when connection error occurs */
  onError?: (error: Event) => void
  /** Reconnection delay in milliseconds (default: 3000) */
  reconnectDelay?: number
  /** Maximum reconnection attempts (default: Infinity) */
  maxReconnectAttempts?: number
  /** Whether to automatically connect (default: true) */
  autoConnect?: boolean
}

export interface UseDeviceStatusWebSocketReturn {
  /** Whether WebSocket is currently connected */
  isConnected: boolean
  /** Whether WebSocket is currently connecting */
  isConnecting: boolean
  /** Current connection error, if any */
  error: string | null
  /** Manually connect to WebSocket */
  connect: () => void
  /** Manually disconnect from WebSocket */
  disconnect: () => void
  /** Send a message to the WebSocket server */
  sendMessage: (message: string) => void
}

/**
 * Hook for connecting to device status WebSocket updates.
 * 
 * @param options Configuration options
 * @returns WebSocket connection state and controls
 */
export function useDeviceStatusWebSocket(
  options: UseDeviceStatusWebSocketOptions = {}
): UseDeviceStatusWebSocketReturn {
  const {
    onStatusUpdate,
    onInfoUpdate,
    onConnect,
    onDisconnect,
    onError,
    reconnectDelay = 3000,
    maxReconnectAttempts = Infinity,
    autoConnect = true,
  } = options

  const { token } = useAuthStore()
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const shouldReconnectRef = useRef(true)
  
  // Store callbacks in refs to avoid recreating connect function
  const onStatusUpdateRef = useRef(onStatusUpdate)
  const onInfoUpdateRef = useRef(onInfoUpdate)
  const onConnectRef = useRef(onConnect)
  const onDisconnectRef = useRef(onDisconnect)
  const onErrorRef = useRef(onError)
  
  // Store options in refs for stable connect function
  const reconnectDelayRef = useRef(reconnectDelay)
  const maxReconnectAttemptsRef = useRef(maxReconnectAttempts)
  
  // Update refs when callbacks/options change
  useEffect(() => {
    onStatusUpdateRef.current = onStatusUpdate
    onInfoUpdateRef.current = onInfoUpdate
    onConnectRef.current = onConnect
    onDisconnectRef.current = onDisconnect
    onErrorRef.current = onError
    reconnectDelayRef.current = reconnectDelay
    maxReconnectAttemptsRef.current = maxReconnectAttempts
  }, [onStatusUpdate, onInfoUpdate, onConnect, onDisconnect, onError, reconnectDelay, maxReconnectAttempts])

  // Handle incoming messages - use ref to avoid recreating
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const data: DeviceStatusUpdate = JSON.parse(event.data)

        if (data.type === "connected") {
          setIsConnected(true)
          setIsConnecting(false)
          setError(null)
          reconnectAttemptsRef.current = 0
          onConnectRef.current?.()
        } else if (data.type === "device_status_update") {
          onStatusUpdateRef.current?.(data)
        } else if (data.type === "device_info_update") {
          // Handle device info updates (serial, capacity, firmware, etc.)
          onInfoUpdateRef.current?.(data)
          // Also call onStatusUpdate for backward compatibility
          onStatusUpdateRef.current?.(data)
        } else if (data.type === "pong") {
          // Ping/pong handling if needed
        }
      } catch (err) {
        console.error("Error parsing WebSocket message:", err)
      }
    },
    [] // No dependencies - use refs for callbacks
  )

  // Connect to WebSocket - use refs to keep function stable
  const connect = useCallback(() => {
    // Check if already connected or connecting
    if (wsRef.current) {
      const state = wsRef.current.readyState
      if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
        // Already connected or connecting
        return
      }
    }

    if (!token) {
      setError("Authentication token required")
      return
    }

    // WebSocket URL: same host as API (gateway) when hosted; env drives per-deployment
    const wsBase = getWsBaseUrl()
    const wsUrl = `${wsBase}/ws/device-status?token=${encodeURIComponent(token)}`

    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    // Close existing connection if any (but not if connecting)
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CONNECTING) {
      try {
        wsRef.current.close()
        wsRef.current = null
      } catch (e) {
        // Ignore errors
      }
    }

    setIsConnecting(true)
    setError(null)
    shouldReconnectRef.current = true

    try {
      const websocket = new WebSocket(wsUrl)

      websocket.onopen = () => {
        // Connection confirmation will come via message
        setIsConnecting(false)
      }

      websocket.onmessage = handleMessage

      websocket.onerror = (event) => {
        // WebSocket error events don't always have detailed error information
        // Only log if we have meaningful error data
        const errorMessage = (event as any).message || (event as any).error?.message
        if (errorMessage) {
          console.error("WebSocket error:", errorMessage)
        } else {
          // Silently handle connection errors - onclose will handle reconnection
          // Only log in development mode
          if (process.env.NODE_ENV === 'development') {
            console.warn("WebSocket connection error (will attempt to reconnect)")
          }
        }
        setIsConnecting(false)
        setError("Connection error")
        onErrorRef.current?.(event)
      }

      websocket.onclose = (event) => {
        setIsConnected(false)
        setIsConnecting(false)
        
        // Only clear wsRef if it's still this websocket
        if (wsRef.current === websocket) {
          wsRef.current = null
        }
        
        onDisconnectRef.current?.()

        // Reconnect if needed (and not manually disconnected)
        if (
          shouldReconnectRef.current &&
          reconnectAttemptsRef.current < maxReconnectAttemptsRef.current
        ) {
          reconnectAttemptsRef.current += 1
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, reconnectDelayRef.current)
        } else if (reconnectAttemptsRef.current >= maxReconnectAttemptsRef.current) {
          setError("Max reconnection attempts reached")
        }
      }

      wsRef.current = websocket
    } catch (err) {
      console.error("Error creating WebSocket:", err)
      setIsConnecting(false)
      setError("Failed to create WebSocket connection")
      wsRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]) // Only depend on token - everything else uses refs

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    setIsConnected(false)
    setIsConnecting(false)
    reconnectAttemptsRef.current = 0
  }, [])

  // Send message to WebSocket
  const sendMessage = useCallback(
    (message: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(message)
      } else {
        console.warn("WebSocket is not connected. Cannot send message.")
      }
    },
    []
  )

  // Auto-connect on mount or when token changes
  useEffect(() => {
    if (!autoConnect || !token) {
      // If autoConnect is false or no token, ensure we're disconnected
      shouldReconnectRef.current = false
      if (wsRef.current) {
        try {
          wsRef.current.close()
        } catch (e) {
          // Ignore errors when closing
        }
        wsRef.current = null
      }
      return
    }

    // Small delay to ensure cleanup from previous effect has completed
    const timeoutId = setTimeout(() => {
      connect()
    }, 0)

    return () => {
      clearTimeout(timeoutId)
      shouldReconnectRef.current = false
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      if (wsRef.current) {
        const ws = wsRef.current
        wsRef.current = null // Clear ref first to prevent reconnect
        try {
          // Only close if not already closed
          if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close()
          }
        } catch (e) {
          // Ignore errors when closing
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnect, token]) // Only depend on autoConnect and token - connect is stable

  return {
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    sendMessage,
  }
}


/**
 * React hook for WebSocket connection to enrollment progress updates.
 * 
 * Connects to the backend WebSocket endpoint and provides real-time
 * enrollment progress updates. Automatically handles reconnection on disconnect.
 */

import { useEffect, useState, useCallback, useRef } from "react"
import { useAuthStore } from "@/lib/store/authStore"
import { getWsBaseUrl } from "@/lib/env"

export type EnrollmentProgressStatus = "ready" | "placing" | "capturing" | "processing" | "complete" | "error"

export interface EnrollmentProgressUpdate {
  type: "enrollment_progress" | "enrollment_complete" | "enrollment_error" | "enrollment_cancelled" | "connected" | "pong"
  session_id?: string
  progress?: number // 0, 33, 66, 100
  status?: EnrollmentProgressStatus
  message?: string
  error?: string
  quality_score?: number
  timestamp?: string
}

export interface UseEnrollmentProgressOptions {
  /** Enrollment session ID */
  sessionId: string
  /** Callback when enrollment completes */
  onComplete?: (update: EnrollmentProgressUpdate) => void
  /** Callback when enrollment errors */
  onError?: (error: string) => void
  /** Callback when connection is established */
  onConnect?: () => void
  /** Callback when connection is lost */
  onDisconnect?: () => void
  /** Callback when connection error occurs */
  onConnectionError?: (error: Event) => void
  /** Reconnection delay in milliseconds (default: 3000) */
  reconnectDelay?: number
  /** Maximum reconnection attempts (default: Infinity) */
  maxReconnectAttempts?: number
  /** Whether to automatically connect (default: true) */
  autoConnect?: boolean
}

export interface UseEnrollmentProgressReturn {
  /** Current progress percentage (0-100) */
  progress: number
  /** Current enrollment status */
  status: EnrollmentProgressStatus
  /** Current status message */
  message: string
  /** Quality score if available (0-100) */
  qualityScore: number | null
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
 * Hook for connecting to enrollment progress WebSocket updates.
 * 
 * @param options Configuration options
 * @returns Enrollment progress state and controls
 */
export function useEnrollmentProgress(
  options: UseEnrollmentProgressOptions
): UseEnrollmentProgressReturn {
  const {
    sessionId,
    onComplete,
    onError,
    onConnect,
    onDisconnect,
    onConnectionError,
    reconnectDelay = 3000,
    maxReconnectAttempts = Infinity,
    autoConnect = true,
  } = options

  const { token } = useAuthStore()
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<EnrollmentProgressStatus>("ready")
  const [message, setMessage] = useState("Ready to start enrollment...")
  const [qualityScore, setQualityScore] = useState<number | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const shouldReconnectRef = useRef(true)
  
  // Store callbacks in refs to avoid recreating connect function
  const onCompleteRef = useRef(onComplete)
  const onErrorRef = useRef(onError)
  const onConnectRef = useRef(onConnect)
  const onDisconnectRef = useRef(onDisconnect)
  const onConnectionErrorRef = useRef(onConnectionError)
  
  // Store options in refs for stable connect function
  const reconnectDelayRef = useRef(reconnectDelay)
  const maxReconnectAttemptsRef = useRef(maxReconnectAttempts)
  
  // Update refs when callbacks/options change
  useEffect(() => {
    onCompleteRef.current = onComplete
    onErrorRef.current = onError
    onConnectRef.current = onConnect
    onDisconnectRef.current = onDisconnect
    onConnectionErrorRef.current = onConnectionError
    reconnectDelayRef.current = reconnectDelay
    maxReconnectAttemptsRef.current = maxReconnectAttempts
  }, [onComplete, onError, onConnect, onDisconnect, onConnectionError, reconnectDelay, maxReconnectAttempts])

  // Handle incoming messages - use ref to avoid recreating
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const data: EnrollmentProgressUpdate = JSON.parse(event.data)

        if (data.type === "connected") {
          console.log('[EnrollmentProgress] WebSocket connected, session_id:', data.session_id)
          setIsConnected(true)
          setIsConnecting(false)
          setError(null)
          reconnectAttemptsRef.current = 0
          onConnectRef.current?.()
        } else if (data.type === "enrollment_progress") {
          // Update progress state
          if (data.progress !== undefined) {
            setProgress(data.progress)
          }
          if (data.status) {
            setStatus(data.status)
          }
          if (data.message) {
            setMessage(data.message)
          }
        } else if (data.type === "enrollment_complete") {
          // Enrollment completed
          setProgress(100)
          setStatus("complete")
          if (data.message) {
            setMessage(data.message)
          }
          if (data.quality_score !== undefined) {
            setQualityScore(data.quality_score)
          }
          onCompleteRef.current?.(data)
        } else if (data.type === "enrollment_error") {
          // Enrollment error
          setStatus("error")
          const errorMsg = data.error || "Enrollment failed"
          setMessage(errorMsg)
          onErrorRef.current?.(errorMsg)
        } else if (data.type === "enrollment_cancelled") {
          // Enrollment cancelled by user
          setStatus("error")
          setMessage(data.message || "Enrollment cancelled")
          onErrorRef.current?.(data.message || "Enrollment cancelled")
        } else if (data.type === "pong") {
          // Ping/pong handling if needed
        }
      } catch (err) {
        console.error("Error parsing Enrollment WebSocket message:", err)
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

    if (!sessionId) {
      setError("Session ID required")
      return
    }

    // WebSocket URL: same host as API when hosted; env drives per-deployment
    const wsBase = getWsBaseUrl()
    const wsUrl = `${wsBase}/ws/enrollment?token=${encodeURIComponent(token)}&session_id=${encodeURIComponent(sessionId)}`

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
      console.log(`[EnrollmentProgress] Connecting to WebSocket: ${wsUrl.replace(/token=[^&]*/, 'token=***')}`)
      const websocket = new WebSocket(wsUrl)

      websocket.onopen = () => {
        // Connection confirmation will come via message
        console.log('[EnrollmentProgress] WebSocket connection opened')
        setIsConnecting(false)
      }

      websocket.onmessage = handleMessage

      websocket.onerror = (event) => {
        console.error("Enrollment WebSocket error:", event)
        setIsConnecting(false)
        setError("Connection error")
        onConnectionErrorRef.current?.(event)
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
      console.error("Error creating Enrollment WebSocket:", err)
      setIsConnecting(false)
      setError("Failed to create WebSocket connection")
      wsRef.current = null
    }
  }, [token, sessionId, handleMessage])

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    
    if (wsRef.current) {
      const ws = wsRef.current
      wsRef.current = null
      try {
        // Avoid "WebSocket is closed before the connection is established" in React Strict Mode.
        // When CONNECTING, closing synchronously throws. Instead, close when it opens.
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.onopen = () => {
            try {
              ws.close()
            } catch {
              // Ignore
            }
          }
        } else if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CLOSING) {
          ws.close()
        }
      } catch (e) {
        // Ignore errors
      }
    }
    
    setIsConnected(false)
    setIsConnecting(false)
    reconnectAttemptsRef.current = 0
  }, [])

  // Send message to WebSocket
  const sendMessage = useCallback((message: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(message)
    }
  }, [])

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect && token && sessionId) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [autoConnect, token, sessionId, connect, disconnect])

  return {
    progress,
    status,
    message,
    qualityScore,
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    sendMessage,
  }
}

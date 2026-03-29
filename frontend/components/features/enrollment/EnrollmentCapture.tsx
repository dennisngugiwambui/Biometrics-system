"use client"

import { useState } from "react"
import { Fingerprint, CheckCircle2, AlertCircle, RefreshCw, Wifi, WifiOff, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import type { StudentResponse } from "@/lib/api/students"
import type { TeacherResponse } from "@/lib/api/teachers"
import type { DeviceResponse } from "@/lib/api/devices"
import { DeviceStatusBadge } from "@/components/features/devices/DeviceStatusBadge"
import { FINGERS } from "@/lib/utils/fingers"
import { useEnrollmentProgress } from "@/lib/hooks/useEnrollmentProgress"
import { cancelEnrollment } from "@/lib/api/enrollment"

interface EnrollmentCaptureProps {
  student?: StudentResponse | null
  teacher?: TeacherResponse | null
  device: DeviceResponse
  fingerId: number
  sessionId?: string
  onComplete: () => void
  onRetry: () => void
  onCancel: () => void
}

type CaptureStatus = "waiting" | "scanning" | "processing" | "success" | "error"

const STATUS_MESSAGES: Record<CaptureStatus, string> = {
  waiting: "Place your finger on the scanner",
  scanning: "Scanning fingerprint...",
  processing: "Processing fingerprint data...",
  success: "Fingerprint enrolled successfully!",
  error: "Failed to capture fingerprint",
}

export function EnrollmentCapture({
  student,
  teacher,
  device,
  fingerId,
  sessionId,
  onComplete,
  onRetry,
  onCancel,
}: EnrollmentCaptureProps) {
  const personName =
    teacher != null
      ? `${teacher.first_name} ${teacher.last_name}`
      : student != null
        ? `${student.first_name} ${student.last_name}`
        : "Person"
  const fingerInfo = FINGERS.find((f) => f.id === fingerId)

  // Connect to enrollment progress WebSocket
  const {
    progress,
    status: wsStatus,
    message: wsMessage,
    qualityScore,
    isConnected,
    isConnecting,
    error: wsError,
  } = useEnrollmentProgress({
    sessionId: sessionId || "",
    autoConnect: !!sessionId,
    onComplete: () => {
      // Enrollment completed successfully
      setTimeout(() => {
        onComplete?.()
      }, 2000) // Wait 2 seconds to show success message
    },
    onError: (error) => {
      console.error("Enrollment error:", error)
    },
  })

  // Map WebSocket status to component status
  const status: CaptureStatus = 
    !sessionId || isConnecting
      ? "waiting"
      : wsStatus === "complete"
        ? "success"
        : wsStatus === "error"
          ? "error"
          : wsStatus === "capturing" || wsStatus === "processing"
            ? "processing"
            : wsStatus === "placing"
              ? "scanning"
              : "waiting"

  const displayMessage = sessionId ? wsMessage : "Preparing enrollment..."
  const captureAttempt = 1 // Will be handled by WebSocket events
  const maxAttempts = 3
  const [isCancelling, setIsCancelling] = useState(false)

  const handleCancel = async () => {
    if (sessionId && (status === "waiting" || status === "scanning" || status === "processing")) {
      setIsCancelling(true)
      try {
        await cancelEnrollment(sessionId)
      } catch (err) {
        console.error("Failed to cancel enrollment:", err)
      } finally {
        setIsCancelling(false)
      }
    }
    onCancel?.()
  }

  const handleRetry = () => {
    // Retry logic will be handled by parent component
    onRetry?.()
  }

  return (
    <div className="flex flex-col items-center text-center space-y-8">
      {/* Fingerprint Animation */}
      <div className="relative">
        <div
          className={cn(
            "flex items-center justify-center size-40 rounded-full transition-all duration-500",
            status === "waiting" && "bg-gray-100 dark:bg-gray-800",
            status === "scanning" && "bg-blue-100 dark:bg-blue-900/30 animate-pulse",
            status === "processing" && "bg-blue-200 dark:bg-blue-800/40",
            status === "success" && "bg-green-100 dark:bg-green-900/30",
            status === "error" && "bg-red-100 dark:bg-red-900/30",
          )}
        >
          {status === "success" ? (
            <CheckCircle2 className="size-20 text-green-600 dark:text-green-400" />
          ) : status === "error" ? (
            <AlertCircle className="size-20 text-red-600 dark:text-red-400" />
          ) : (
            <Fingerprint
              className={cn(
                "size-20 transition-colors",
                status === "waiting" && "text-gray-400 dark:text-gray-500",
                (status === "scanning" || status === "processing") && "text-blue-600 dark:text-blue-400 animate-pulse",
              )}
            />
          )}
        </div>

        {/* Scanning ring animation */}
        {(status === "scanning" || status === "processing") && (
          <div className="absolute inset-0 rounded-full border-4 border-blue-600/30 animate-ping" />
        )}
      </div>

      {/* Status Message */}
      <div className="space-y-2">
        <h3
          className={cn(
            "text-xl font-semibold",
            status === "success" && "text-green-600 dark:text-green-400",
            status === "error" && "text-red-600 dark:text-red-400",
          )}
        >
          {STATUS_MESSAGES[status]}
        </h3>
        <p className="text-muted-foreground">
          {displayMessage}
          {sessionId && (
            <span className="block mt-1 text-xs text-gray-500 dark:text-gray-400">
              Session: {sessionId.substring(0, 8)}...
            </span>
          )}
          {qualityScore !== null && status === "success" && (
            <span className="block mt-1 text-xs text-green-600 dark:text-green-400">
              Quality Score: {qualityScore}/100
            </span>
          )}
        </p>
      </div>

      {/* WebSocket Connection Status */}
      {sessionId && (
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          {isConnected ? (
            <>
              <Wifi className="size-3 text-green-600 dark:text-green-400" />
              <span>Connected</span>
            </>
          ) : isConnecting ? (
            <>
              <WifiOff className="size-3 text-yellow-600 dark:text-yellow-400 animate-pulse" />
              <span>Connecting...</span>
            </>
          ) : (
            <>
              <WifiOff className="size-3 text-red-600 dark:text-red-400" />
              <span>{wsError || "Disconnected"}</span>
            </>
          )}
        </div>
      )}

      {/* Progress Bar */}
      {status !== "success" && status !== "error" && (
        <div className="w-full max-w-xs">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {status === "waiting"
              ? "Waiting for fingerprint..."
              : status === "scanning"
                ? "Capturing image..."
                : "Analyzing quality..."}
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        {status === "success" && (
          <>
            <Button variant="outline" onClick={onRetry}>
              Enroll Another Finger
            </Button>
            <Button onClick={onComplete} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white">Done</Button>
          </>
        )}

        {status === "error" && (
          <>
            {captureAttempt < maxAttempts ? (
              <>
                <Button variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
                <Button onClick={handleRetry} className="bg-blue-600 hover:bg-blue-700 text-white">
                  <RefreshCw className="size-4 mr-2" />
                  Try Again ({maxAttempts - captureAttempt} left)
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={onCancel}>
                  Go Back
                </Button>
                <Button variant="destructive" onClick={onRetry}>
                  Select Different Finger
                </Button>
              </>
            )}
          </>
        )}

        {(status === "waiting" || status === "scanning" || status === "processing") && (
          <Button variant="outline" onClick={handleCancel} disabled={isCancelling}>
            {isCancelling ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Cancelling...
              </>
            ) : (
              "Cancel"
            )}
          </Button>
        )}
      </div>

      {/* Enrollment Info Card */}
      <div className="w-full max-w-md p-4 rounded-xl bg-gradient-to-r from-blue-50/50 via-indigo-50/50 to-purple-50/50 dark:from-gray-800/50 dark:via-gray-800/50 dark:to-gray-800/50 border border-gray-200/50 dark:border-gray-700/50">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-600 dark:text-gray-400">Student</p>
            <p className="font-medium truncate text-gray-900 dark:text-gray-100">
              {personName}
            </p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400">Device</p>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium truncate text-gray-900 dark:text-gray-100">{device.name}</p>
              <DeviceStatusBadge status={device.status} />
            </div>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400">Finger</p>
            <p className="font-medium text-gray-900 dark:text-gray-100">{fingerInfo?.name}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

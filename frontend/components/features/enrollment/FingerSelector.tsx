"use client"

import { useEffect, useState } from "react"
import { Check, Star, Trash2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { FINGERS, type FingerInfo } from "@/lib/utils/fingers"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { StudentResponse } from "@/lib/api/students"
import { getEnrolledFingers, deleteFingerprint } from "@/lib/api/enrollment"

interface FingerSelectorProps {
  selectedFinger: number | null
  onSelect: (fingerId: number | null) => void
  student?: StudentResponse | null
  /** When set with student, enrolled fingers are fetched and disabled for selection; delete is shown for enrolled. */
  deviceId?: number | null
}

// SVG paths for realistic hand illustration
const LEFT_HAND_PATHS = {
  palm: "M 75 170 Q 60 200 60 240 Q 60 290 80 320 Q 100 350 140 350 Q 180 350 200 320 Q 220 290 220 240 Q 220 200 205 170 L 75 170",
  fingers: [
    // Pinky (leftmost on left hand palm view)
    { id: 9, path: "M 45 170 L 25 130 Q 16 115 18 95 Q 20 75 35 75 Q 50 75 55 100 L 75 170", cx: 35, cy: 90 },
    // Ring
    { id: 8, path: "M 80 170 L 60 95 Q 55 75 60 55 Q 65 35 80 40 Q 95 45 100 70 L 115 170", cx: 80, cy: 55 },
    // Middle
    { id: 7, path: "M 120 170 L 105 75 Q 100 55 105 35 Q 110 15 125 20 Q 140 25 145 55 L 155 170", cx: 125, cy: 40 },
    // Index
    { id: 6, path: "M 160 170 L 150 85 Q 145 70 150 55 Q 155 40 170 45 Q 185 50 185 80 L 190 170", cx: 170, cy: 60 },
    // Thumb (rightmost on left hand palm view)
    {
      id: 5,
      path: "M 215 180 Q 210 170 205 155 Q 195 130 200 110 Q 205 90 220 85 Q 235 80 245 95 Q 255 110 250 130 Q 240 160 215 180",
      cx: 230,
      cy: 100,
    },
  ],
}

const RIGHT_HAND_PATHS = {
  palm: "M 95 170 Q 80 200 80 240 Q 80 290 100 320 Q 120 350 160 350 Q 200 350 220 320 Q 240 290 240 240 Q 240 200 225 170 L 95 170",
  fingers: [
    // Thumb (leftmost on right hand palm view)
  {
      id: 0,
      path: "M 85 180 Q 60 160 50 130 Q 45 110 55 95 Q 65 80 80 85 Q 95 90 100 110 Q 105 130 95 155 Q 90 170 85 180",
      cx: 70,
      cy: 100,
    },
    // Index
    { id: 1, path: "M 110 170 L 115 80 Q 115 50 130 45 Q 145 40 150 55 Q 155 70 150 85 L 140 170", cx: 130, cy: 60 },
    // Middle
    { id: 2, path: "M 145 170 L 155 55 Q 160 25 175 20 Q 190 15 195 35 Q 200 55 195 75 L 180 170", cx: 175, cy: 40 },
    // Ring
    { id: 3, path: "M 185 170 L 200 70 Q 205 45 220 40 Q 235 35 240 55 Q 245 75 240 95 L 220 170", cx: 220, cy: 55 },
    // Pinky (rightmost on right hand palm view)
    { id: 4, path: "M 225 170 L 245 100 Q 250 75 265 75 Q 280 75 282 95 Q 284 115 275 130 L 255 170", cx: 265, cy: 90 },
  ],
}

interface HandIllustrationProps {
  hand: "left" | "right"
  selectedFinger: number | null
  enrolledFingers: number[]
  onFingerClick: (id: number) => void
  onDeleteFinger?: (id: number) => void
}

function HandIllustration({ hand, selectedFinger, enrolledFingers, onFingerClick, onDeleteFinger }: HandIllustrationProps) {
  const paths = hand === "left" ? LEFT_HAND_PATHS : RIGHT_HAND_PATHS

  return (
    <div className="flex flex-col items-center">
      <span className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 capitalize">{hand} Hand</span>
      <svg viewBox="0 0 300 380" className="w-full max-w-[200px] h-auto">
        {/* Palm */}
        <path d={paths.palm} className="fill-gray-300 dark:fill-gray-600 transition-colors" />
        
        {/* Fingers */}
        <TooltipProvider delayDuration={0}>
          {paths.fingers.map((finger) => {
            const fingerInfo = FINGERS.find((f) => f.id === finger.id)
            const isSelected = selectedFinger === finger.id
            const isEnrolled = enrolledFingers.includes(finger.id)
            const isRecommended = fingerInfo?.recommended
            const canSelect = !isEnrolled

            return (
              <Tooltip key={finger.id}>
                <TooltipTrigger asChild>
                  <g
                    onClick={() => canSelect && onFingerClick(finger.id)}
                    className={cn(canSelect ? "cursor-pointer" : "cursor-default")}
                  >
                    <path
                      d={finger.path}
                      className={cn(
                        "transition-all duration-200",
                        isSelected
                          ? "fill-blue-600 stroke-blue-600 stroke-[3]"
                          : isEnrolled
                            ? "fill-green-500/40 stroke-green-600 stroke-2"
                            : "fill-gray-300/60 dark:fill-gray-600/60 hover:fill-gray-400 dark:hover:fill-gray-500 stroke-transparent",
                      )}
                    />

                    {/* Selection/Enrolled indicator */}
                    {(isSelected || isEnrolled) && (
                      <g transform={`translate(${finger.cx - 10}, ${finger.cy - 10})`}>
                        <circle cx="10" cy="10" r="10" className={isSelected ? "fill-blue-600" : "fill-green-600"} />
                        <Check className="text-white" x="3" y="3" width="14" height="14" />
                      </g>
                    )}

                    {/* Recommended indicator */}
                    {isRecommended && !isSelected && !isEnrolled && (
                      <g transform={`translate(${finger.cx - 8}, ${finger.cy - 8})`}>
                        <circle cx="8" cy="8" r="8" className="fill-yellow-500" />
                        <Star
                          className="text-warning-foreground"
                          x="2"
                          y="2"
                          width="12"
                          height="12"
                          fill="currentColor"
                        />
                      </g>
                    )}
                  </g>
                </TooltipTrigger>
                <TooltipContent side="top" className="font-medium">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      {fingerInfo?.name}
                      {isRecommended && (
                        <Badge variant="secondary" className="text-xs">
                          Recommended
                        </Badge>
                      )}
                      {isEnrolled && (
                        <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-0 text-xs">
                          Enrolled
                        </Badge>
                      )}
                    </div>
                    {isEnrolled && onDeleteFinger && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/50"
                        onClick={(e) => {
                          e.preventDefault()
                          onDeleteFinger(finger.id)
                        }}
                      >
                        <Trash2 className="size-3.5 mr-1" />
                        Remove fingerprint
                      </Button>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </TooltipProvider>
      </svg>
    </div>
  )
}

export function FingerSelector({ selectedFinger, onSelect, student, deviceId }: FingerSelectorProps) {
  const [enrolledFingers, setEnrolledFingers] = useState<number[]>([])
  const [loadingFingers, setLoadingFingers] = useState(false)
  const [deletingFingerId, setDeletingFingerId] = useState<number | null>(null)

  useEffect(() => {
    if (!student?.id || deviceId == null) {
      setEnrolledFingers([])
      return
    }
    let cancelled = false
    setLoadingFingers(true)
    getEnrolledFingers(deviceId, student.id)
      .then((res) => {
        if (!cancelled) setEnrolledFingers(res.finger_ids ?? [])
      })
      .catch(() => {
        if (!cancelled) setEnrolledFingers([])
      })
      .finally(() => {
        if (!cancelled) setLoadingFingers(false)
      })
    return () => {
      cancelled = true
    }
  }, [student?.id, deviceId])

  const handleDeleteFinger = async (fingerId: number) => {
    if (!student?.id || deviceId == null) return
    setDeletingFingerId(fingerId)
    try {
      await deleteFingerprint(deviceId, student.id, fingerId)
      setEnrolledFingers((prev) => prev.filter((id) => id !== fingerId))
      if (selectedFinger === fingerId) {
        onSelect(null)
      }
    } catch (e) {
      console.error("Failed to delete fingerprint:", e)
    } finally {
      setDeletingFingerId(null)
    }
  }

  const selectedFingerInfo = FINGERS.find((f) => f.id === selectedFinger)

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Click on a finger to select it for enrollment. Enrolled fingers are disabled; use Remove to delete first.
          <span className="inline-flex items-center gap-1 ml-1">
            <Star className="size-3 text-yellow-500" fill="currentColor" />
            indicates recommended finger.
          </span>
        </p>
        {loadingFingers && (
          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1 mt-1">
            <Loader2 className="size-3 animate-spin" />
            Loading enrolled fingers…
          </p>
        )}
      </div>

      {/* Hand Illustrations */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12 p-6  rounded-2xl border border-gray-200/50 dark:border-gray-700/50">
        <HandIllustration
          hand="left"
          selectedFinger={selectedFinger}
          enrolledFingers={enrolledFingers}
          onFingerClick={(id) => !enrolledFingers.includes(id) && onSelect(id)}
          onDeleteFinger={deviceId && student ? handleDeleteFinger : undefined}
        />
        <div className="hidden sm:block w-px h-48 bg-gray-300 dark:bg-gray-700" />
        <HandIllustration
          hand="right"
          selectedFinger={selectedFinger}
          enrolledFingers={enrolledFingers}
          onFingerClick={(id) => !enrolledFingers.includes(id) && onSelect(id)}
          onDeleteFinger={deviceId && student ? handleDeleteFinger : undefined}
        />
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {FINGERS.map((finger) => {
          const isSelected = selectedFinger === finger.id
          const isEnrolled = enrolledFingers.includes(finger.id)
          const isDeleting = deletingFingerId === finger.id

          return (
            <div key={finger.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => !isEnrolled && onSelect(finger.id)}
                disabled={isEnrolled}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                  isSelected
                    ? "border-blue-600 bg-blue-600 text-white shadow-md scale-105"
                    : isEnrolled
                      ? "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400 cursor-not-allowed opacity-90"
                      : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-blue-500/50 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100",
                )}
              >
                {finger.name}
                {isEnrolled && !isSelected && " ✓"}
              </button>
              {isEnrolled && deviceId && student && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50"
                  onClick={() => handleDeleteFinger(finger.id)}
                  disabled={isDeleting}
                  aria-label={`Remove ${finger.name} fingerprint`}
                >
                  {isDeleting ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

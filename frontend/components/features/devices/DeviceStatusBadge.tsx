"use client"

import { StatusPill } from "@/components/shared/DataCard"
import { type DeviceStatus } from "@/lib/api/devices"

export interface DeviceStatusBadgeProps {
  status: DeviceStatus
}

/**
 * Status badge component for devices.
 * 
 * Shows status with appropriate colors:
 * - Green for online
 * - Red for offline
 * - Gray for unknown
 */
export function DeviceStatusBadge({ status }: DeviceStatusBadgeProps) {
  const config = {
    online: { label: "Online", tone: "success" as const },
    offline: { label: "Offline", tone: "danger" as const },
    unknown: { label: "Unknown", tone: "neutral" as const },
  }[status]

  return <StatusPill tone={config.tone}>{config.label}</StatusPill>
}

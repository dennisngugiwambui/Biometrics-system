"use client"

import { motion } from "framer-motion"
import { TableCell, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { DeviceStatusBadge } from "./DeviceStatusBadge"
import { DeviceCapacityIndicator } from "./DeviceCapacityIndicator"
import { staggerItem } from "@/lib/animations/framer-motion"
import { type DeviceResponse, type DeviceStatus, deviceAddress } from "@/lib/api/devices"
import { Wifi, WifiOff, Clock } from "lucide-react"

export interface DeviceTableRowProps {
  device: DeviceResponse
  onDeviceClick: (id: number) => void
  onTestConnection: (id: number) => void
  isTestingConnection?: boolean
  /** Optional override for device status (for real-time updates) */
  status?: DeviceStatus
  /** Optional override for last_seen (for real-time updates) */
  lastSeen?: string | null
}

/**
 * Format a date string to relative time (e.g., "2 minutes ago").
 */
function formatLastSeen(dateString: string | null): string {
  if (!dateString) return "Never"
  
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSeconds = Math.floor(diffMs / 1000)
    const diffMinutes = Math.floor(diffSeconds / 60)
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffSeconds < 60) {
      return "Just now"
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes !== 1 ? "s" : ""} ago`
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`
    } else {
      // Format as date for older entries
      return date.toLocaleDateString()
    }
  } catch {
    return "Invalid date"
  }
}

/**
 * Device table row component.
 */
export function DeviceTableRow({
  device,
  onDeviceClick,
  onTestConnection,
  isTestingConnection = false,
  status: statusOverride,
  lastSeen: lastSeenOverride,
}: DeviceTableRowProps) {
  // Use override values if provided, otherwise fall back to device values
  const currentStatus = statusOverride ?? device.status
  const currentLastSeen = lastSeenOverride ?? device.last_seen

  return (
    <motion.tr
      variants={staggerItem}
      initial="hidden"
      animate="visible"
      className="border-gray-200/50 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors"
    >
      <TableCell className="font-medium cursor-pointer" onClick={() => onDeviceClick(device.id)}>
        {device.name}
      </TableCell>
      <TableCell className="cursor-pointer" onClick={() => onDeviceClick(device.id)}>
        <div className="font-mono text-sm">
          {deviceAddress(device)}
        </div>
      </TableCell>
      <TableCell className="cursor-pointer" onClick={() => onDeviceClick(device.id)}>
        <DeviceStatusBadge status={currentStatus} />
      </TableCell>
      <TableCell className="text-muted-foreground cursor-pointer" onClick={() => onDeviceClick(device.id)}>
        {device.location || "—"}
      </TableCell>
      <TableCell className="text-muted-foreground cursor-pointer" onClick={() => onDeviceClick(device.id)}>
        <div className="flex items-center gap-2">
          <Clock className="h-3 w-3" />
          {formatLastSeen(currentLastSeen)}
        </div>
      </TableCell>
      <TableCell className="cursor-pointer" onClick={() => onDeviceClick(device.id)}>
        {device.serial_number ? (
          <span className="font-mono text-sm">{device.serial_number}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="cursor-pointer" onClick={() => onDeviceClick(device.id)}>
        <DeviceCapacityIndicator
          maxUsers={device.max_users}
          enrolledUsers={device.enrolled_users}
          compact={true}
        />
      </TableCell>
      <TableCell>
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            onTestConnection(device.id)
          }}
          disabled={isTestingConnection}
          className="border-blue-300 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20"
        >
          {isTestingConnection ? (
            <>
              <WifiOff className="mr-2 h-3 w-3 animate-spin" />
              Testing...
            </>
          ) : currentStatus === "online" ? (
            <>
              <Wifi className="mr-2 h-3 w-3" />
              Test
            </>
          ) : (
            <>
              <WifiOff className="mr-2 h-3 w-3" />
              Test
            </>
          )}
        </Button>
      </TableCell>
    </motion.tr>
  )
}


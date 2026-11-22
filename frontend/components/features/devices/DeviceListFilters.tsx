"use client"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { X } from "lucide-react"
import { type DeviceStatus } from "@/lib/api/devices"

export interface DeviceListFiltersProps {
  statusFilter: DeviceStatus | null
  onStatusFilterChange: (value: DeviceStatus | null) => void
  deviceGroupFilter: number | null
  onDeviceGroupFilterChange: (value: number | null) => void
  deviceGroups?: Array<{ id: number; name: string }>
}

export function DeviceListFilters({
  statusFilter,
  onStatusFilterChange,
  deviceGroupFilter,
  onDeviceGroupFilterChange,
  deviceGroups = [],
}: DeviceListFiltersProps) {
  const hasFilters = statusFilter || deviceGroupFilter

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* Status Filter */}
        <Select
          value={statusFilter || "all"}
          onValueChange={(value) =>
            onStatusFilterChange(value === "all" ? null : (value as DeviceStatus))
          }
        >
          <SelectTrigger className="min-w-[140px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
            <SelectItem value="unknown">Unknown</SelectItem>
          </SelectContent>
        </Select>

        {/* Device Group Filter */}
        <Select
          value={deviceGroupFilter?.toString() || "all"}
          onValueChange={(value) =>
            onDeviceGroupFilterChange(value === "all" ? null : parseInt(value))
          }
          disabled={deviceGroups.length === 0}
        >
          <SelectTrigger className="min-w-[140px]">
            <SelectValue placeholder="All Groups" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All groups</SelectItem>
            {deviceGroups.map((group) => (
              <SelectItem key={group.id} value={group.id.toString()}>
                {group.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Clear Filters Button */}
      {hasFilters && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            onStatusFilterChange(null)
            onDeviceGroupFilterChange(null)
          }}
        >
          <X className="h-3.5 w-3.5" />
          Clear filters
        </Button>
      )}
    </div>
  )
}


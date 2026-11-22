"use client"

import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Search, Plus, AlertCircle, Inbox, FolderOpen, Smartphone } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { DataCard, DataToolbar, DataScroll } from "@/components/shared/DataCard"
import { PanelEmpty } from "@/components/shared/KpiCard"
import { PremiumPagination } from "@/components/shared/PremiumPagination"
import { DeviceTableRow } from "./DeviceTableRow"
import { DeviceListFilters } from "./DeviceListFilters"
import { useDeviceStatusWebSocket, type DeviceStatusUpdate } from "@/lib/hooks/useDeviceStatusWebSocket"
import { type DeviceResponse, type DeviceStatus } from "@/lib/api/devices"

export interface DeviceListProps {
  devices: DeviceResponse[]
  isLoading: boolean
  error: string | null
  search: string
  onSearchChange: (value: string) => void
  statusFilter: DeviceStatus | null
  onStatusFilterChange: (value: DeviceStatus | null) => void
  deviceGroupFilter: number | null
  onDeviceGroupFilterChange: (value: number | null) => void
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
  onAddDevice: () => void
  onManageGroups?: () => void
  onDeviceClick: (id: number) => void
  onTestConnection: (id: number) => void
  isTestingConnection?: boolean
  deviceGroups?: Array<{ id: number; name: string }>
}

export function DeviceList({
  devices,
  isLoading,
  error,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  deviceGroupFilter,
  onDeviceGroupFilterChange,
  page,
  totalPages,
  total,
  onPageChange,
  onAddDevice,
  onManageGroups,
  onDeviceClick,
  onTestConnection,
  isTestingConnection = false,
  deviceGroups = [],
}: DeviceListProps) {
  const hasFilters = search || statusFilter || deviceGroupFilter
  const showEmptyState = !isLoading && devices.length === 0 && !hasFilters
  const showNoResults = !isLoading && devices.length === 0 && hasFilters

  // Track device statuses and last_seen for real-time updates
  const [deviceStatuses, setDeviceStatuses] = useState<Map<number, DeviceStatus>>(
    new Map(devices.map((d) => [d.id, d.status]))
  )
  const [deviceLastSeen, setDeviceLastSeen] = useState<Map<number, string | null>>(
    new Map(devices.map((d) => [d.id, d.last_seen]))
  )

  // Update local state when devices prop changes (e.g., after fetching)
  // Only update if device doesn't exist in state (preserve real-time updates)
  useEffect(() => {
    setDeviceStatuses((prev) => {
      const newMap = new Map(prev)
      devices.forEach((device) => {
        // Only add if not already present (preserve WebSocket updates)
        if (!newMap.has(device.id)) {
          newMap.set(device.id, device.status)
        }
      })
      return newMap
    })

    setDeviceLastSeen((prev) => {
      const newMap = new Map(prev)
      devices.forEach((device) => {
        // Only add if not already present (preserve WebSocket updates)
        if (!newMap.has(device.id)) {
          newMap.set(device.id, device.last_seen)
        }
      })
      return newMap
    })
  }, [devices])

  // Handle WebSocket status updates - use useCallback with empty deps to keep stable
  const handleStatusUpdate = useCallback((update: DeviceStatusUpdate) => {
    if (update.type === "device_status_update" && update.device_id !== undefined) {
      setDeviceStatuses((prev) => {
        const newMap = new Map(prev)
        if (update.status) {
          newMap.set(update.device_id!, update.status)
        }
        return newMap
      })

      setDeviceLastSeen((prev) => {
        const newMap = new Map(prev)
        newMap.set(update.device_id!, update.last_seen ?? null)
        return newMap
      })
    }
  }, [])

  // Connect to WebSocket for real-time updates
  const { isConnected, isConnecting, error: wsError } = useDeviceStatusWebSocket({
    onStatusUpdate: handleStatusUpdate,
    autoConnect: true,
  })

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Smartphone}
        title="Devices"
        subtitle="Manage and monitor the biometric devices in your school"
        actions={
          <>
            {onManageGroups && (
              <Button onClick={onManageGroups} variant="outline">
                <FolderOpen className="h-4 w-4" />
                Manage groups
              </Button>
            )}
            <Button onClick={onAddDevice}>
              <Plus className="h-4 w-4" />
              Add device
            </Button>
          </>
        }
      />

      {error && (
        <Alert variant="destructive" className="rounded-xl border-rose-200 bg-rose-50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <DataCard>
        <DataToolbar
          search={search}
          onSearch={onSearchChange}
          placeholder="Search by name, IP address or serial number…"
          filters={
            <DeviceListFilters
              statusFilter={statusFilter}
              onStatusFilterChange={onStatusFilterChange}
              deviceGroupFilter={deviceGroupFilter}
              onDeviceGroupFilterChange={onDeviceGroupFilterChange}
              deviceGroups={deviceGroups}
            />
          }
          right={<span className="tabular-nums">{total.toLocaleString()} {total === 1 ? "device" : "devices"}</span>}
        />

        {isLoading && (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full rounded-lg" />
            ))}
          </div>
        )}

        {showEmptyState && (
          <PanelEmpty
            icon={Inbox}
            title="No devices registered"
            hint="Register your first biometric device to start capturing attendance."
            action={
              <Button onClick={onAddDevice}>
                <Plus className="h-4 w-4" />
                Add device
              </Button>
            }
          />
        )}

        {showNoResults && (
          <PanelEmpty icon={Search} title="No devices found" hint="Try adjusting your search or filters." />
        )}

        {!isLoading && devices.length > 0 && (
          <DataScroll>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>IP address</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead>Serial number</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((device) => (
                  <DeviceTableRow
                    key={device.id}
                    device={device}
                    onDeviceClick={onDeviceClick}
                    onTestConnection={onTestConnection}
                    isTestingConnection={isTestingConnection}
                    status={deviceStatuses.get(device.id)}
                    lastSeen={deviceLastSeen.get(device.id)}
                  />
                ))}
              </TableBody>
            </Table>
          </DataScroll>
        )}

        {!isLoading && devices.length > 0 && (
          <PremiumPagination page={page} totalPages={totalPages} total={total} onPageChange={onPageChange} label="devices" />
        )}
      </DataCard>
    </div>
  )
}

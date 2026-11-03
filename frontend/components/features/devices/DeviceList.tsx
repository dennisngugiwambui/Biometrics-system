"use client"

import { useState, useCallback, useEffect } from "react"
import { motion } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Search, Plus, AlertCircle, Inbox, Loader2, FolderOpen } from "lucide-react"
import { fadeInUp, staggerContainer } from "@/lib/animations/framer-motion"
import { DeviceTableRow } from "./DeviceTableRow"
import { DeviceListFilters } from "./DeviceListFilters"
import { DeviceListPagination } from "./DeviceListPagination"
import { DeviceStatusIndicator } from "./DeviceStatusIndicator"
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
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-primary">
            Devices
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage and monitor biometric devices in your school
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          {onManageGroups && (
            <Button
              onClick={onManageGroups}
              variant="outline"
              className="border-purple-300 text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20"
              size="lg"
            >
              <FolderOpen className="mr-2 h-4 w-4" />
              Manage Groups
            </Button>
          )}
          <Button
            onClick={onAddDevice}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            size="lg"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Device
          </Button>
        </div>
      </motion.div>

      {/* Filters and Search */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.1 }}
      >
        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50">
          <div className="p-4 space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search devices by name, IP address, or serial number..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            {/* Filters */}
            <DeviceListFilters
              statusFilter={statusFilter}
              onStatusFilterChange={onStatusFilterChange}
              deviceGroupFilter={deviceGroupFilter}
              onDeviceGroupFilterChange={onDeviceGroupFilterChange}
              deviceGroups={deviceGroups}
            />
          </div>
        </Card>
      </motion.div>

      {/* Error State */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Alert variant="destructive" className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* Loading State */}
      {isLoading && (
        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50">
          <div className="p-6">
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Empty State */}
      {showEmptyState && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50">
            <div className="p-12 text-center">
              <Inbox className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No devices registered</h3>
              <p className="text-muted-foreground mb-6">
                Get started by registering your first biometric device.
              </p>
              <Button
                onClick={onAddDevice}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Device
              </Button>
            </div>
          </Card>
        </motion.div>
      )}

      {/* No Results State */}
      {showNoResults && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50">
            <div className="p-12 text-center">
              <Search className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No devices found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search or filters to find what you're looking for.
              </p>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Device Table */}
      {!isLoading && devices.length > 0 && (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-200/50 dark:border-gray-700/50">
                    <TableHead>Name</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Last Seen</TableHead>
                    <TableHead>Serial Number</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>Actions</TableHead>
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
            </div>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.2 }}
              className="mt-6"
            >
              <DeviceListPagination
                page={page}
                totalPages={totalPages}
                total={total}
                onPageChange={onPageChange}
              />
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  )
}


"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { fadeInUp } from "@/lib/animations/framer-motion"
import { DeviceList } from "@/components/features/devices/DeviceList"
import { useAuthStore } from "@/lib/store/authStore"
import {
  listDevices,
  testDeviceConnection,
  type DeviceStatus,
  DeviceApiError,
} from "@/lib/api/devices"
import { listDeviceGroups } from "@/lib/api/device_groups"
import { useDebounce } from "@/lib/hooks/useDebounce"

export default function DevicesPage() {
  const router = useRouter()
  const { token } = useAuthStore()
  const [devices, setDevices] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<DeviceStatus | null>(null)
  const [deviceGroupFilter, setDeviceGroupFilter] = useState<number | null>(null)
  const [deviceGroups, setDeviceGroups] = useState<Array<{ id: number; name: string }>>([])
  const [isTestingConnection, setIsTestingConnection] = useState(false)

  // Debounce search to avoid too many API calls
  const debouncedSearch = useDebounce(search, 300)

  // Load device groups
  useEffect(() => {
    const loadDeviceGroups = async () => {
      if (!token) return

      try {
        const result = await listDeviceGroups(token, { page: 1, page_size: 100 })
        setDeviceGroups(result.items.map((g) => ({ id: g.id, name: g.name })))
      } catch (err) {
        console.error("Failed to load device groups", err)
        // Continue with empty list on error
      }
    }

    loadDeviceGroups()
  }, [token])

  const fetchDevices = useCallback(async () => {
    if (!token) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const result = await listDevices(token, {
        page,
        page_size: pageSize,
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        device_group_id: deviceGroupFilter || undefined,
      })

      setDevices(result.items)
      setTotal(result.total)
      setTotalPages(result.pages)
    } catch (err) {
      if (err instanceof DeviceApiError) {
        setError(err.message)
      } else {
        setError("Failed to load devices. Please try again.")
      }
    } finally {
      setIsLoading(false)
    }
  }, [token, page, pageSize, debouncedSearch, statusFilter, deviceGroupFilter])

  useEffect(() => {
    fetchDevices()
  }, [fetchDevices])

  const handleTestConnection = async (deviceId: number) => {
    if (!token) return

    setIsTestingConnection(true)
    try {
      await testDeviceConnection(token, deviceId)
      // Refresh devices to show updated status
      await fetchDevices()
    } catch (err) {
      if (err instanceof DeviceApiError) {
        setError(err.message)
      } else {
        setError("Connection test failed. Please try again.")
      }
    } finally {
      setIsTestingConnection(false)
    }
  }

  return (
    <div className="flex-1 ">
      {/* Animated background shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-8">
        

        <motion.main
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          transition={{ delay: 0.2 }}
        >
          <DeviceList
            devices={devices}
            isLoading={isLoading}
            error={error}
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            deviceGroupFilter={deviceGroupFilter}
            onDeviceGroupFilterChange={setDeviceGroupFilter}
            page={page}
            totalPages={totalPages}
            total={total}
            onPageChange={setPage}
            onAddDevice={() => router.push("/dashboard/devices/new")}
            onManageGroups={() => router.push("/dashboard/device-groups")}
            onDeviceClick={(id) => router.push(`/dashboard/devices/${id}`)}
            onTestConnection={handleTestConnection}
            isTestingConnection={isTestingConnection}
            deviceGroups={deviceGroups}
          />
        </motion.main>
      </div>
    </div>
  )
}


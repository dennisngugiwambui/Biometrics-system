"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ArrowLeft,
  Edit,
  Trash2,
  RefreshCw,
  Loader2,
  AlertCircle,
  Clock,
  Wifi,
  WifiOff,
  Server,
  HardDrive,
  Cpu,
  Calendar,
  MapPin,
  Hash,
  Info,
  Eraser,
  RotateCcw,
  UserX,
  Database,
} from "lucide-react"
import { fadeInUp, pageTransition } from "@/lib/animations/framer-motion"
import { useAuthStore } from "@/lib/store/authStore"
import {
  getDevice,
  deleteDevice,
  testDeviceConnection,
  getDeviceInfo,
  refreshDeviceInfo,
  getDeviceTime,
  clearDeviceAttendanceLogs,
  clearAllDeviceData,
  restartDeviceRemote,
  deleteUserFromDevice,
  DEVICE_CONFIRM_CLEAR_ATTENDANCE,
  DEVICE_CONFIRM_CLEAR_ALL_DATA,
  DEVICE_CONFIRM_RESTART,
  DEVICE_CONFIRM_DELETE_USER,
  type DeviceResponse,
  type DeviceInfoResponse,
  type DeviceTimeResponse,
  type DeviceConnectionTestResponse,
  DeviceApiError,
} from "@/lib/api/devices"
import { DeviceStatusBadge } from "@/components/features/devices/DeviceStatusBadge"
import { DeviceCapacityIndicator } from "@/components/features/devices/DeviceCapacityIndicator"
import { toast } from "sonner"
import { formatDateTime } from "@/lib/utils"
import { useDeviceStatusWebSocket, type DeviceStatusUpdate } from "@/lib/hooks/useDeviceStatusWebSocket"

export default function DeviceDetailPage() {
  const router = useRouter()
  const params = useParams()
  const deviceId = params.id ? parseInt(params.id as string, 10) : undefined
  const { token } = useAuthStore()
  
  const [device, setDevice] = useState<DeviceResponse | null>(null)
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfoResponse | null>(null)
  const [deviceTime, setDeviceTime] = useState<DeviceTimeResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshingInfo, setIsRefreshingInfo] = useState(false)
  const [isFetchingTime, setIsFetchingTime] = useState(false)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const hasAutoFetchedRef = useRef<number | null>(null)

  type MaintKind = "clear_attendance" | "clear_all" | "restart" | "delete_user" | null
  const [maintKind, setMaintKind] = useState<MaintKind>(null)
  const [maintConfirm, setMaintConfirm] = useState("")
  const [maintBusy, setMaintBusy] = useState(false)
  const [deleteUid, setDeleteUid] = useState("")
  const [deleteUserIdStr, setDeleteUserIdStr] = useState("")

  const openMaint = (k: Exclude<MaintKind, null>) => {
    setMaintConfirm("")
    setDeleteUid("")
    setDeleteUserIdStr("")
    setMaintKind(k)
  }

  const runMaintenance = async () => {
    if (!token || !deviceId || !maintKind) return
    setMaintBusy(true)
    try {
      if (maintKind === "clear_attendance") {
        const r = await clearDeviceAttendanceLogs(token, deviceId, maintConfirm.trim())
        toast.success(r.message || "Attendance cleared on device")
      } else if (maintKind === "clear_all") {
        const r = await clearAllDeviceData(token, deviceId, maintConfirm.trim())
        toast.success(r.message || "Device data cleared")
      } else if (maintKind === "restart") {
        const r = await restartDeviceRemote(token, deviceId, maintConfirm.trim())
        toast.success(r.message || "Restart sent")
      } else {
        const uid = parseInt(deleteUid, 10)
        if (Number.isNaN(uid) || uid < 0) {
          toast.error("Enter a valid numeric device UID")
          setMaintBusy(false)
          return
        }
        const r = await deleteUserFromDevice(token, deviceId, uid, deleteUserIdStr.trim(), maintConfirm.trim())
        toast.success(r.message || "User removed from device")
      }
      setMaintKind(null)
      setMaintConfirm("")
    } catch (err) {
      if (err instanceof DeviceApiError) {
        toast.error(err.message)
      } else {
        toast.error("Maintenance action failed")
      }
    } finally {
      setMaintBusy(false)
    }
  }

  // WebSocket for real-time device status updates
  const handleStatusUpdate = useCallback((update: DeviceStatusUpdate) => {
    if (update.device_id === deviceId) {
      if (update.type === "device_status_update") {
        // Update device status and last_seen in real-time
        if (device) {
          setDevice({
            ...device,
            status: update.status ?? device.status,
            last_seen: update.last_seen ?? device.last_seen,
          })
        }
      }
    }
  }, [device, deviceId])

  // WebSocket handler for device info updates (capacity, serial, firmware, etc.)
  const handleInfoUpdate = useCallback((update: DeviceStatusUpdate) => {
    if (update.type === "device_info_update" && update.device_id === deviceId && update.info && deviceId) {
      // Update device info in real-time
      setDeviceInfo({
        device_id: deviceId,
        serial_number: update.info.serial_number ?? null,
        device_name: update.info.device_name ?? null,
        firmware_version: update.info.firmware_version ?? null,
        device_time: update.info.device_time ?? null,
        capacity: update.info.capacity ?? null,
      })
      
      // Also update device record if capacity changed (to update max_users)
      if (update.info.capacity?.users_cap && device) {
        setDevice({
          ...device,
          max_users: update.info.capacity.users_cap,
          serial_number: update.info.serial_number ?? device.serial_number,
        })
      }
      
      // Show toast notification for real-time updates
      toast.success("Device information updated", {
        description: "Device information was refreshed automatically.",
        duration: 3000,
      })
    }
  }, [device, deviceId])

  const { isConnected: wsConnected } = useDeviceStatusWebSocket({
    onStatusUpdate: handleStatusUpdate,
    onInfoUpdate: handleInfoUpdate,
    autoConnect: true,
  })

  useEffect(() => {
    if (!token || !deviceId) return

    // Reset auto-fetch tracking when device ID changes
    if (hasAutoFetchedRef.current !== deviceId) {
      hasAutoFetchedRef.current = null
      setDeviceInfo(null)
      setDeviceTime(null)
    }

    const fetchDevice = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const data = await getDevice(token, deviceId)
        setDevice(data)
      } catch (err) {
        if (err instanceof DeviceApiError) {
          setError(err.message)
        } else {
          setError("Failed to load device")
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchDevice()
  }, [token, deviceId])

  // Auto-fetch device info and time when device is loaded (only once per device)
  useEffect(() => {
    if (!token || !deviceId || !device || isLoading) return
    
    // Skip if we've already auto-fetched for this device
    if (hasAutoFetchedRef.current === deviceId) return

    let mounted = true

    const fetchDeviceData = async () => {
      try {
        // Fetch device info (serial, model, firmware, capacity) and time in parallel
        const [infoResult, timeResult] = await Promise.allSettled([
          getDeviceInfo(token, deviceId).catch(() => null),
          getDeviceTime(token, deviceId).catch(() => null),
        ])

        if (!mounted) return

        // Mark as fetched for this device
        hasAutoFetchedRef.current = deviceId

        if (infoResult.status === 'fulfilled' && infoResult.value) {
          setDeviceInfo(infoResult.value)
          // Update device with capacity if available (this will update max_users)
          if (infoResult.value.capacity?.users_cap) {
            try {
              const updatedDevice = await getDevice(token, deviceId)
              if (mounted) {
                setDevice(updatedDevice)
              }
            } catch (err) {
              // Ignore errors - device info is still useful
              console.error("Failed to update device after fetching info:", err)
            }
          }
        }

        if (timeResult.status === 'fulfilled' && timeResult.value && mounted) {
          setDeviceTime(timeResult.value)
        }
      } catch (err) {
        // Silently fail - user can manually refresh if needed
        console.error("Failed to auto-fetch device data:", err)
      }
    }

    fetchDeviceData()

    return () => {
      mounted = false
    }
  }, [token, deviceId, device?.id, isLoading]) // Run when device loads

  const handleRefreshInfo = async () => {
    if (!token || !deviceId) return

    try {
      setIsRefreshingInfo(true)
      const refreshedInfo = await refreshDeviceInfo(token, deviceId)
      setDeviceInfo(refreshedInfo)
      
      // Refresh device data to get updated serial_number and max_users
      const updatedDevice = await getDevice(token, deviceId)
      setDevice(updatedDevice)
      
      // Also refresh time
      try {
        const timeData = await getDeviceTime(token, deviceId)
        setDeviceTime(timeData)
      } catch (err) {
        // Time fetch is optional - don't fail the whole refresh
        console.error("Failed to refresh device time:", err)
      }
      
      toast.success("Device information refreshed successfully", {
        description: "Serial number, capacity, and device info have been updated.",
      })
    } catch (err) {
      if (err instanceof DeviceApiError) {
        toast.error("Failed to refresh device information", {
          description: err.message,
        })
      } else {
        toast.error("Failed to refresh device information")
      }
    } finally {
      setIsRefreshingInfo(false)
    }
  }

  const handleFetchInfo = async () => {
    if (!token || !deviceId) return

    try {
      setIsRefreshingInfo(true)
      const info = await getDeviceInfo(token, deviceId)
      setDeviceInfo(info)
      toast.success("Device information fetched successfully")
    } catch (err) {
      if (err instanceof DeviceApiError) {
        toast.error("Failed to fetch device information", {
          description: err.message,
        })
      } else {
        toast.error("Failed to fetch device information")
      }
    } finally {
      setIsRefreshingInfo(false)
    }
  }

  const handleFetchTime = async () => {
    if (!token || !deviceId) return

    try {
      setIsFetchingTime(true)
      const timeData = await getDeviceTime(token, deviceId)
      setDeviceTime(timeData)
      toast.success("Device time fetched successfully")
    } catch (err) {
      if (err instanceof DeviceApiError) {
        toast.error("Failed to fetch device time", {
          description: err.message,
        })
      } else {
        toast.error("Failed to fetch device time")
      }
    } finally {
      setIsFetchingTime(false)
    }
  }

  const handleTestConnection = async () => {
    if (!token || !deviceId) return

    try {
      setIsTestingConnection(true)
      const result: DeviceConnectionTestResponse = await testDeviceConnection(
        token,
        deviceId
      )

      if (result.success) {
        toast.success("Connection test successful", {
          description: result.message || "Device is online and responding",
        })
        // Refresh device to get updated status
        const updatedDevice = await getDevice(token, deviceId)
        setDevice(updatedDevice)
      } else {
        toast.error("Connection test failed", {
          description: result.message || "Could not connect to device",
        })
      }
    } catch (err) {
      if (err instanceof DeviceApiError) {
        toast.error("Connection test failed", {
          description: err.message,
        })
      } else {
        toast.error("Connection test failed")
      }
    } finally {
      setIsTestingConnection(false)
    }
  }

  const handleEdit = () => {
    router.push(`/dashboard/devices/${deviceId}/edit`)
  }

  const handleDelete = async () => {
    if (!token || !deviceId) return

    try {
      setIsDeleting(true)
      await deleteDevice(token, deviceId)
      toast.success("Device deleted successfully")
      router.push("/dashboard/devices")
    } catch (err) {
      if (err instanceof DeviceApiError) {
        toast.error("Failed to delete device", {
          description: err.message,
        })
      } else {
        toast.error("Failed to delete device")
      }
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  if (isLoading) {
    return (
      <motion.main
        variants={pageTransition}
        initial="initial"
        animate="animate"
        className="flex-1 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900"
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400/20 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>

        <div className="relative z-10 container mx-auto px-4 py-8 max-w-5xl">
          <div className="space-y-6">
            <Skeleton className="h-10 w-32" />
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.main>
    )
  }

  if (error || !device) {
    return (
      <motion.main
        variants={pageTransition}
        initial="initial"
        animate="animate"
        className="flex-1 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900"
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400/20 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>

        <div className="relative z-10 container mx-auto px-4 py-8 max-w-5xl">
          <Button
            variant="ghost"
            onClick={() => router.push("/dashboard/devices")}
            className="mb-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Devices
          </Button>

          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error || "Device not found"}
            </AlertDescription>
          </Alert>
        </div>
      </motion.main>
    )
  }

  return (
    <motion.main
      variants={pageTransition}
      initial="initial"
      animate="animate"
      className="flex-1 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900"
    >
      {/* Animated background shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-8 max-w-5xl">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          className="mb-6"
        >
          <Button
            variant="ghost"
            onClick={() => router.push("/dashboard/devices")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Devices
          </Button>

          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                  {device.name}
                </h1>
                {wsConnected && (
                  <Badge variant="outline" className="border-green-500 text-green-600">
                    <div className="h-2 w-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                    Live
                  </Badge>
                )}
                {!deviceInfo && !isLoading && (
                  <Badge variant="outline" className="border-blue-500 text-blue-600">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Loading info...
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground">
                Device Details & Information
                {wsConnected && (
                  <span className="ml-2 text-xs text-green-600">• Real-time updates enabled</span>
                )}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={isTestingConnection}
                className="border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20"
              >
                {isTestingConnection ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : device.status === "online" ? (
                  <>
                    <Wifi className="mr-2 h-4 w-4" />
                    Test Connection
                  </>
                ) : (
                  <>
                    <WifiOff className="mr-2 h-4 w-4" />
                    Test Connection
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={handleEdit}
                className="border-indigo-600 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/20"
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>

              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                className="bg-red-600 hover:bg-red-700"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Basic Information */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50">
              <CardHeader>
                <CardTitle className="text-blue-700 dark:text-blue-400 flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Status</p>
                  <DeviceStatusBadge status={device.status} />
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                    <Server className="h-4 w-4" />
                    IP Address & Port
                  </p>
                  <p className="font-mono font-medium">
                    {device.ip_address}:{device.port}
                  </p>
                </div>

                {device.serial_number && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                      <Hash className="h-4 w-4" />
                      Serial Number
                    </p>
                    <p className="font-mono font-medium">{device.serial_number}</p>
                  </div>
                )}

                {device.location && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      Location
                    </p>
                    <p className="font-medium">{device.location}</p>
                  </div>
                )}

                {device.description && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Description</p>
                    <p className="font-medium">{device.description}</p>
                  </div>
                )}

                <div>
                  <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Last Seen
                  </p>
                  <p className="font-medium">
                    {device.last_seen
                      ? formatDateTime(device.last_seen)
                      : "Never"}
                  </p>
                </div>

                {device.last_sync && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Last Sync
                    </p>
                    <p className="font-medium">
                      {formatDateTime(device.last_sync)}
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                    <HardDrive className="h-4 w-4" />
                    Capacity
                  </p>
                  <DeviceCapacityIndicator
                    maxUsers={
                      deviceInfo?.capacity?.users_cap ?? device.max_users
                    }
                    enrolledUsers={
                      deviceInfo?.capacity?.users ?? device.enrolled_users
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Device Information from Real Device */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-purple-700 dark:text-purple-400 flex items-center gap-2">
                    <Cpu className="h-5 w-5" />
                    Device Information
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleFetchInfo}
                      disabled={isRefreshingInfo}
                      className="border-purple-600 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/20"
                    >
                      {isRefreshingInfo ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Info className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRefreshInfo}
                      disabled={isRefreshingInfo}
                      className="border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                    >
                      {isRefreshingInfo ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {deviceInfo ? (
                  <>
                    {deviceInfo.serial_number && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">
                          Serial Number
                        </p>
                        <p className="font-mono font-medium">
                          {deviceInfo.serial_number}
                        </p>
                      </div>
                    )}

                    {deviceInfo.device_name && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">
                          Device Model
                        </p>
                        <p className="font-medium">{deviceInfo.device_name}</p>
                      </div>
                    )}

                    {deviceInfo.firmware_version && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">
                          Firmware Version
                        </p>
                        <p className="font-medium">
                          {deviceInfo.firmware_version}
                        </p>
                      </div>
                    )}

                    {deviceInfo.device_time && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          Device Time
                        </p>
                        <p className="font-medium">
                          {formatDateTime(deviceInfo.device_time)}
                        </p>
                      </div>
                    )}

                    {deviceInfo.capacity && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">
                          Capacity Details
                        </p>
                        <div className="space-y-2 text-sm">
                          {deviceInfo.capacity.users_cap !== undefined && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Max Users:
                              </span>
                              <span className="font-medium">
                                {deviceInfo.capacity.users_cap}
                              </span>
                            </div>
                          )}
                          {deviceInfo.capacity.users !== undefined && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Current Users:
                              </span>
                              <span className="font-medium">
                                {deviceInfo.capacity.users}
                              </span>
                            </div>
                          )}
                          {deviceInfo.capacity.users_av !== undefined && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Available:
                              </span>
                              <span className="font-medium">
                                {deviceInfo.capacity.users_av}
                              </span>
                            </div>
                          )}
                          {deviceInfo.capacity.fingers_cap !== undefined && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Max Fingerprints:
                              </span>
                              <span className="font-medium">
                                {deviceInfo.capacity.fingers_cap}
                              </span>
                            </div>
                          )}
                          {deviceInfo.capacity.fingers !== undefined && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Current Fingerprints:
                              </span>
                              <span className="font-medium">
                                {deviceInfo.capacity.fingers}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8">
                    <Info className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-4">
                      Click the refresh button to fetch device information
                      from the real device.
                    </p>
                    <Button
                      variant="outline"
                      onClick={handleRefreshInfo}
                      disabled={isRefreshingInfo}
                      className="border-blue-600 text-blue-600 hover:bg-blue-50"
                    >
                      {isRefreshingInfo ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Refreshing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Refresh Device Info
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Device Time Comparison */}
          {deviceTime && (
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              transition={{ delay: 0.3 }}
              className="md:col-span-2"
            >
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-indigo-700 dark:text-indigo-400 flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Time Synchronization
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleFetchTime}
                      disabled={isFetchingTime}
                      className="border-indigo-600 text-indigo-600 hover:bg-indigo-50"
                    >
                      {isFetchingTime ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Fetching...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Refresh Time
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Device Time
                      </p>
                      <p className="font-medium font-mono">
                        {formatDateTime(deviceTime.device_time)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Server Time
                      </p>
                      <p className="font-medium font-mono">
                        {formatDateTime(deviceTime.server_time)}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Time Difference
                    </p>
                    <Badge
                      variant={
                        Math.abs(deviceTime.time_difference_seconds) > 60
                          ? "destructive"
                          : Math.abs(deviceTime.time_difference_seconds) > 30
                          ? "default"
                          : "secondary"
                      }
                    >
                      {deviceTime.time_difference_seconds > 0
                        ? `+${deviceTime.time_difference_seconds.toFixed(1)}s`
                        : `${deviceTime.time_difference_seconds.toFixed(1)}s`}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* K40 / ZK maintenance — affects hardware only; portal DB unchanged except you re-sync after wipe */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ delay: 0.35 }}
            className="md:col-span-2"
          >
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-red-200/40 dark:border-red-900/40 shadow-lg">
              <CardHeader>
                <CardTitle className="text-red-600 dark:text-red-400 flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Device maintenance (K40 / ZKTeco)
                </CardTitle>
                <CardDescription>
                  These commands run on the physical device over the network. Clearing all data removes users and
                  templates from the device — use <strong>Sync</strong> from the dashboard afterward. Type the exact
                  confirmation phrase in each dialog.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert className="mb-4 border-yellow-500/50 bg-yellow-500/10">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-sm text-gray-800 dark:text-gray-200">
                    Ensure no enrollment is in progress. The device must be online.
                  </AlertDescription>
                </Alert>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-blue-600 text-blue-600"
                    onClick={() => openMaint("clear_attendance")}
                  >
                    <Eraser className="mr-2 h-4 w-4" />
                    Clear attendance logs
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                    onClick={() => openMaint("clear_all")}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Wipe device (users + logs)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-indigo-600 text-indigo-600"
                    onClick={() => openMaint("restart")}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Restart device
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-purple-600 text-purple-600"
                    onClick={() => openMaint("delete_user")}
                  >
                    <UserX className="mr-2 h-4 w-4" />
                    Delete one user
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      <Dialog
        open={maintKind !== null}
        onOpenChange={(o) => {
          if (!o) {
            setMaintKind(null)
            setMaintConfirm("")
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {maintKind === "clear_attendance" && "Clear attendance on device"}
              {maintKind === "clear_all" && "Wipe all device data"}
              {maintKind === "restart" && "Restart device"}
              {maintKind === "delete_user" && "Delete user from device"}
            </DialogTitle>
            <DialogDescription className="space-y-2">
              {maintKind === "clear_attendance" && (
                <>
                  Removes attendance transactions stored on the device only. Server records are not deleted.
                  <span className="block font-mono text-xs mt-2 text-foreground">
                    Type: {DEVICE_CONFIRM_CLEAR_ATTENDANCE}
                  </span>
                </>
              )}
              {maintKind === "clear_all" && (
                <>
                  <strong className="text-red-600">Factory-style data wipe:</strong> users, fingerprints, and logs on
                  the device. You must re-enroll or sync from the portal again.
                  <span className="block font-mono text-xs mt-2 text-foreground">
                    Type: {DEVICE_CONFIRM_CLEAR_ALL_DATA}
                  </span>
                </>
              )}
              {maintKind === "restart" && (
                <>
                  Sends a restart command. The device may be unreachable for a short time.
                  <span className="block font-mono text-xs mt-2 text-foreground">
                    Type: {DEVICE_CONFIRM_RESTART}
                  </span>
                </>
              )}
              {maintKind === "delete_user" && (
                <>
                  Remove a single user by device UID (numeric) and optional user ID string as shown on the terminal.
                  <span className="block font-mono text-xs mt-2 text-foreground">
                    Type: {DEVICE_CONFIRM_DELETE_USER}
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {maintKind === "delete_user" && (
            <div className="grid gap-3 py-2">
              <div>
                <Label className="text-blue-700 dark:text-blue-400">Device UID (number)</Label>
                <Input
                  value={deleteUid}
                  onChange={(e) => setDeleteUid(e.target.value)}
                  placeholder="e.g. 42"
                  className="border-blue-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <Label className="text-gray-700 dark:text-gray-300">User ID on device (optional)</Label>
                <Input
                  value={deleteUserIdStr}
                  onChange={(e) => setDeleteUserIdStr(e.target.value)}
                  placeholder="e.g. admission or employee code"
                  className="border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                />
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-blue-700 dark:text-blue-400">Confirmation</Label>
            <Input
              value={maintConfirm}
              onChange={(e) => setMaintConfirm(e.target.value)}
              placeholder="Exact phrase above"
              className="border-blue-300 focus:border-blue-500 focus:ring-blue-500"
              autoComplete="off"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setMaintKind(null)
                setMaintConfirm("")
              }}
              disabled={maintBusy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className={
                maintKind === "clear_all"
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }
              disabled={maintBusy}
              onClick={() => runMaintenance()}
            >
              {maintBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Device</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{device.name}"? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.main>
  )
}

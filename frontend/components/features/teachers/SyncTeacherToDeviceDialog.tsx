"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Server, MapPin, Loader2, AlertCircle, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { listDevices, type DeviceResponse, DeviceApiError } from "@/lib/api/devices"
import { getTeacherSyncStatus, syncTeacherToDevice, SyncApiError } from "@/lib/api/sync"
import { DeviceStatusBadge } from "@/components/features/devices/DeviceStatusBadge"
import { useAuthStore } from "@/lib/store/authStore"
import { toast } from "sonner"

interface SyncTeacherToDeviceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  teacherId: number
  teacherName: string
}

export function SyncTeacherToDeviceDialog({
  open,
  onOpenChange,
  teacherId,
  teacherName,
}: SyncTeacherToDeviceDialogProps) {
  const { token } = useAuthStore()
  const [devices, setDevices] = useState<DeviceResponse[]>([])
  const [syncedDeviceIds, setSyncedDeviceIds] = useState<Set<number>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDevice, setSelectedDevice] = useState<DeviceResponse | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    if (!open || !token) return

    setIsLoading(true)
    setError(null)
    setSelectedDevice(null)
    setSyncedDeviceIds(new Set())

    listDevices(token, { page_size: 100 })
      .then((result) => setDevices(result.items))
      .catch((err) => {
        if (err instanceof DeviceApiError) setError(err.message)
        else setError("Failed to load devices")
        setDevices([])
      })
      .finally(() => setIsLoading(false))
  }, [open, token])

  useEffect(() => {
    if (!open || !teacherId || devices.length === 0) return

    const check = async () => {
      const online = devices.filter((d) => d.status === "online")
      const results = await Promise.allSettled(
        online.map((d) => getTeacherSyncStatus(d.id, teacherId))
      )
      const alreadySynced = new Set<number>()
      results.forEach((r, i) => {
        if (r.status === "fulfilled" && r.value.synced && online[i]) {
          alreadySynced.add(online[i].id)
        }
      })
      setSyncedDeviceIds(alreadySynced)
    }

    check()
  }, [open, teacherId, devices])

  const onlineDevices = devices.filter((d) => d.status === "online")

  const handleSync = async () => {
    if (!selectedDevice) return
    setIsSyncing(true)
    setError(null)

    try {
      await syncTeacherToDevice(teacherId, selectedDevice.id)
      setSyncedDeviceIds((prev) => new Set(prev).add(selectedDevice.id))
      toast.success("Teacher synced", {
        description: `${teacherName} has been synced to ${selectedDevice.name}.`,
      })
      onOpenChange(false)
    } catch (err) {
      if (err instanceof SyncApiError) {
        setError(err.message)
        if (err.statusCode === 503) {
          toast.error("Device offline", { description: err.message })
        } else {
          toast.error("Sync failed", { description: err.message })
        }
      } else {
        setError("Failed to sync teacher")
        toast.error("Sync failed", { description: "An unexpected error occurred" })
      }
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sync Teacher to Device</DialogTitle>
          <DialogDescription>
            Select an online device to sync {teacherName} to. Devices already synced show a checkmark.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-gray-600 dark:text-gray-400">
              <Loader2 className="size-4 animate-spin" />
              Loading devices...
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : devices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No devices registered. Add a device first.
            </p>
          ) : (
            <div className="grid gap-2 max-h-64 overflow-y-auto">
              {devices.map((device) => {
                const isSelected = selectedDevice?.id === device.id
                const isOnline = device.status === "online"
                const isSynced = syncedDeviceIds.has(device.id)
                return (
                  <button
                    key={device.id}
                    onClick={() => isOnline && setSelectedDevice(device)}
                    disabled={!isOnline}
                    className={cn(
                      "w-full p-3 rounded-lg border-2 text-left transition-all",
                      !isOnline && "opacity-60 cursor-not-allowed",
                      isOnline && "hover:border-violet-500/50 hover:bg-violet-50/50 dark:hover:bg-gray-700/30",
                      isSelected
                        ? "border-violet-600 bg-violet-50 dark:bg-violet-900/20 dark:border-violet-500"
                        : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex items-center justify-center size-10 rounded-lg shrink-0",
                          isOnline ? "bg-green-600/10 text-green-600" : "bg-gray-200 dark:bg-gray-700 text-gray-500"
                        )}
                      >
                        <Server className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{device.name}</span>
                          <DeviceStatusBadge status={device.status} />
                          {isSynced && (
                            <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-500 font-medium">
                              <Check className="size-3" />
                              Synced
                            </span>
                          )}
                        </div>
                        {device.location && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <MapPin className="size-3" />
                            {device.location}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                          {device.ip_address}:{device.port}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSync}
            disabled={!selectedDevice || isSyncing || onlineDevices.length === 0}
            className="bg-violet-600 hover:bg-violet-700"
          >
            {isSyncing ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Syncing...
              </>
            ) : (
              "Sync Teacher"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

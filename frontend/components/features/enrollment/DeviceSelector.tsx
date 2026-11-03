"use client"

import { useState, useEffect } from "react"
import { Wifi, WifiOff, CheckCircle2, MapPin, Server } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { listDevices, type DeviceResponse, DeviceApiError, deviceAddress } from "@/lib/api/devices"
import { useAuthStore } from "@/lib/store/authStore"

interface DeviceSelectorProps {
  selectedDevice: DeviceResponse | null
  onSelect: (device: DeviceResponse) => void
}

export function DeviceSelector({ selectedDevice, onSelect }: DeviceSelectorProps) {
  const { token } = useAuthStore()
  const [devices, setDevices] = useState<DeviceResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return

    setIsLoading(true)
    setError(null)
    listDevices(token, {
      page_size: 100,
    })
      .then((result) => {
        setDevices(result.items)
      })
      .catch((err) => {
        if (err instanceof DeviceApiError) {
          setError(err.message)
        } else {
          setError("Failed to load devices")
        }
        setDevices([])
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [token])

  const onlineDevices = devices.filter((d) => d.status === "online")
  const offlineDevices = devices.filter((d) => d.status === "offline")

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-600 dark:text-gray-400 text-sm">Loading devices...</div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-destructive text-sm">{error}</div>
        </div>
      ) : (
        <>
          {/* Online Devices */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="size-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Available Devices ({onlineDevices.length})</span>
            </div>

            <div className="grid gap-3">
              {onlineDevices.map((device) => {
                const isSelected = selectedDevice?.id === device.id
            
            return (
                  <button
                key={device.id}
                    onClick={() => onSelect(device)}
                    className={cn(
                      "w-full p-4 rounded-xl border-2 text-left transition-all",
                      "hover:border-blue-500/50 hover:bg-blue-50/50 dark:hover:bg-gray-700/30",
                      isSelected ? "border-blue-600 bg-blue-50 ring-2 ring-blue-600/20 dark:bg-blue-900/20 dark:border-blue-500" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800",
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "relative flex items-center justify-center size-12 rounded-xl shrink-0 transition-all",
                            isSelected ? "bg-blue-600 text-white scale-105" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400",
                          )}
              >
                          <Server className="size-5" />
                          {isSelected && (
                            <div className="absolute -bottom-1 -right-1 size-5 rounded-full bg-background flex items-center justify-center">
                              <CheckCircle2 className="size-4 text-blue-600" />
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={cn(
                                "font-medium transition-colors",
                                isSelected ? "text-blue-600 dark:text-blue-400" : "text-gray-900 dark:text-gray-100",
                              )}
                            >
                      {device.name}
                            </span>
                        <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-0 text-xs">
                          <Wifi className="size-3 mr-1" />
                          Online
                        </Badge>
                          </div>
                          {device.location && (
                            <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 mt-1">
                              <MapPin className="size-3" />
                              {device.location}
                            </div>
                          )}
                          <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                            {deviceAddress(device)}
                          </div>
                        </div>
                      </div>

                      <div
                          className={cn(
                            "flex items-center justify-center size-6 rounded-full border-2 transition-all shrink-0 mt-1",
                            isSelected ? "border-blue-600 bg-blue-600" : "border-gray-300 dark:border-gray-600",
                          )}
                        >
                          {isSelected && <div className="size-2.5 rounded-full bg-white" />}
                      </div>
                    </div>
                  </button>
                )
              })}
                    </div>
                  </div>

          {/* Offline Devices */}
          {offlineDevices.length > 0 && (
            <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="size-2 rounded-full bg-gray-500" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Unavailable ({offlineDevices.length})</span>
            </div>

              <div className="grid gap-3 opacity-60">
                {offlineDevices.map((device) => (
                  <div key={device.id} className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 cursor-not-allowed">
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center size-12 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 shrink-0">
                        <Server className="size-5" />
                      </div>

                      <div>
                  <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-600 dark:text-gray-400">{device.name}</span>
                      <Badge variant="secondary" className="text-xs bg-gray-500/10 text-gray-700 dark:text-gray-400">
                        <WifiOff className="size-3 mr-1" />
                        Offline
                      </Badge>
                    </div>
                    {device.location && (
                      <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 mt-1">
                            <MapPin className="size-3" />
                            {device.location}
                          </div>
                    )}
                  </div>
                </div>
              </div>
                ))}
              </div>
            </div>
            )}
        </>
      )}
    </div>
  )
}

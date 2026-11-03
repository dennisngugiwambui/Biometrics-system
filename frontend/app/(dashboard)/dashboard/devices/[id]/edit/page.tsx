"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { motion } from "framer-motion"
import { fadeInUp } from "@/lib/animations/framer-motion"
import { DeviceForm } from "@/components/features/devices/DeviceForm"
import { useAuthStore } from "@/lib/store/authStore"
import { getDevice, updateDevice, DeviceApiError } from "@/lib/api/devices"
import { type DeviceUpdateFormData } from "@/lib/validations/device"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

export default function EditDevicePage() {
  const router = useRouter()
  const params = useParams()
  const { token } = useAuthStore()
  const deviceId = params?.id ? parseInt(params.id as string, 10) : null

  const [device, setDevice] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDevice = async () => {
      if (!token || !deviceId || isNaN(deviceId)) {
        setError("Invalid device ID")
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        setError(null)
        const deviceData = await getDevice(token, deviceId)
        setDevice(deviceData)
      } catch (err) {
        if (err instanceof DeviceApiError) {
          if (err.statusCode === 404) {
            setError("Device not found")
          } else {
            setError(err.message)
          }
        } else {
          setError("Failed to load device. Please try again.")
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchDevice()
  }, [token, deviceId])

  const handleSubmit = async (data: DeviceUpdateFormData) => {
    if (!token || !deviceId) {
      throw new Error("Authentication required or invalid device ID")
    }

    await updateDevice(token, deviceId, data)
    router.push("/dashboard/devices")
  }

  const handleCancel = () => {
    router.push("/dashboard/devices")
  }

  if (!token) {
    return (
      <div className="flex-1 ">
        <div className="relative z-10 container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Please log in to continue.</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex-1 ">
        <div className="relative z-10 container mx-auto px-4 py-8 max-w-3xl">
          <Skeleton className="h-10 w-64 mb-8" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    )
  }

  if (error || !device) {
    return (
      <div className="flex-1 ">
        <div className="relative z-10 container mx-auto px-4 py-8 max-w-3xl">
          <Alert variant="destructive" className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error || "Device not found"}</AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 ">
      {/* Animated background shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-8 max-w-3xl">
        <motion.header
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          className="mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-bold mb-2 text-primary">
            Edit Device
          </h1>
          <p className="text-muted-foreground">
            Update device information and settings.
          </p>
        </motion.header>

        <motion.main
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          transition={{ delay: 0.2 }}
        >
          <DeviceForm
            deviceId={deviceId ?? undefined}
            initialData={{
              name: device.name,
              connection_mode: device.connection_mode ?? "direct",
              ip_address: device.ip_address,
              port: device.port,
              com_password: device.com_password,
              serial_number: device.serial_number,
              location: device.location,
              description: device.description,
              device_group_id: device.device_group_id,
            }}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            token={token}
          />
        </motion.main>
      </div>
    </div>
  )
}


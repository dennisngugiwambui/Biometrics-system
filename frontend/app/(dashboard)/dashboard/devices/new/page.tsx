"use client"

import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { fadeInUp } from "@/lib/animations/framer-motion"
import { DeviceForm } from "@/components/features/devices/DeviceForm"
import { useAuthStore } from "@/lib/store/authStore"
import { createDevice, DeviceApiError } from "@/lib/api/devices"
import { type DeviceFormData, type DeviceUpdateFormData } from "@/lib/validations/device"

export default function NewDevicePage() {
  const router = useRouter()
  const { token } = useAuthStore()

  const handleSubmit = async (data: DeviceFormData | DeviceUpdateFormData) => {
    if (!token) {
      throw new Error("Authentication required")
    }

    const cloud = data.connection_mode === "cloud"
    // For create, we need all required fields (a cloud device needs no IP — it calls us)
    if (!data.name || (!cloud && (!data.ip_address || !data.port))) {
      throw new Error("Name, IP address, and port are required")
    }

    await createDevice(token, {
      name: data.name,
      connection_mode: cloud ? "cloud" : "direct",
      ip_address: cloud ? null : data.ip_address ?? null,
      port: data.port ?? 4370,
      com_password: data.com_password ?? null,
      serial_number: data.serial_number ?? null,
      location: data.location ?? null,
      description: data.description ?? null,
      device_group_id: data.device_group_id,
    })
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
            Register New Device
          </h1>
          <p className="text-muted-foreground">
            Add a new biometric device to your school.
          </p>
        </motion.header>

        <motion.main
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          transition={{ delay: 0.2 }}
        >
          <DeviceForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            token={token}
          />
        </motion.main>
      </div>
    </div>
  )
}


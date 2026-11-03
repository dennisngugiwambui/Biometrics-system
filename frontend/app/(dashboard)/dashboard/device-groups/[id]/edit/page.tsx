"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { motion } from "framer-motion"
import { fadeInUp } from "@/lib/animations/framer-motion"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { DeviceGroupForm } from "@/components/features/devices/DeviceGroupForm"
import { useAuthStore } from "@/lib/store/authStore"
import { getDeviceGroup, updateDeviceGroup, DeviceGroupApiError } from "@/lib/api/device_groups"
import { type DeviceGroupUpdateFormData } from "@/lib/validations/device_group"
import { Loader2 } from "lucide-react"

export default function EditDeviceGroupPage() {
  const router = useRouter()
  const params = useParams()
  const { token } = useAuthStore()
  const groupId = parseInt(params.id as string, 10)
  const [group, setGroup] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchGroup = async () => {
      if (!token || isNaN(groupId)) {
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        setError(null)
        const data = await getDeviceGroup(token, groupId)
        setGroup(data)
      } catch (err) {
        if (err instanceof DeviceGroupApiError) {
          setError(err.message)
        } else {
          setError("Failed to load device group")
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchGroup()
  }, [token, groupId])

  const handleSubmit = async (data: DeviceGroupUpdateFormData) => {
    if (!token) {
      throw new Error("Authentication required")
    }

    try {
      await updateDeviceGroup(token, groupId, data)
      router.push("/dashboard/device-groups")
    } catch (error) {
      if (error instanceof DeviceGroupApiError) {
        throw error
      }
      throw new Error("Failed to update device group")
    }
  }

  const handleCancel = () => {
    router.push("/dashboard/device-groups")
  }

  if (!token) {
    return (
      <div className="min-h-screen ">
        <div className="relative z-10 container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Please log in to continue.</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen ">
        <div className="relative z-10 container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !group) {
    return (
      <div className="flex-1 ">
        <div className="relative z-10 container mx-auto px-4 py-8">
          <p className="text-muted-foreground">
            {error || "Device group not found"}
          </p>
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
        {/* Back Button */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          className="mb-4"
        >
          <Button
            variant="ghost"
            onClick={() => router.push("/dashboard/device-groups")}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Groups
          </Button>
        </motion.div>

        <motion.header
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          className="mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-bold mb-2 text-primary">
            Edit Device Group
          </h1>
          <p className="text-muted-foreground">
            Update device group information.
          </p>
        </motion.header>

        <motion.main
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          transition={{ delay: 0.2 }}
        >
          <DeviceGroupForm
            groupId={groupId}
            initialData={{
              name: group.name,
              description: group.description,
            }}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        </motion.main>
      </div>
    </div>
  )
}


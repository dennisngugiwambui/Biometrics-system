"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { fadeInUp } from "@/lib/animations/framer-motion"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { DeviceGroupForm } from "@/components/features/devices/DeviceGroupForm"
import { useAuthStore } from "@/lib/store/authStore"
import { createDeviceGroup, DeviceGroupApiError } from "@/lib/api/device_groups"
import { type DeviceGroupFormData, type DeviceGroupUpdateFormData } from "@/lib/validations/device_group"

export default function NewDeviceGroupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { token } = useAuthStore()

  const handleSubmit = async (data: DeviceGroupFormData | DeviceGroupUpdateFormData) => {
    if (!token) {
      throw new Error("Authentication required")
    }

    // For create, we need DeviceGroupFormData with required name
    if (!data.name) {
      throw new Error("Group name is required")
    }

    try {
      const result = await createDeviceGroup(token, {
        name: data.name,
        description: data.description ?? null,
      })
      
      // Check if we should return to a previous page (e.g., from device form)
      const returnTo = searchParams?.get("returnTo")
      
      if (returnTo) {
        // Return to the previous page with the new group ID
        const returnUrl = new URL(returnTo, window.location.origin)
        returnUrl.searchParams.set("newGroupId", result.id.toString())
        router.push(returnUrl.pathname + returnUrl.search)
      } else {
        router.push("/dashboard/device-groups")
      }
    } catch (error) {
      if (error instanceof DeviceGroupApiError) {
        throw error
      }
      throw new Error("Failed to create device group")
    }
  }

  const handleCancel = () => {
    const returnTo = searchParams?.get("returnTo")
    if (returnTo) {
      router.push(returnTo)
    } else {
      router.push("/dashboard/device-groups")
    }
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
        {/* Back Button */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          className="mb-4"
        >
          <Button
            variant="ghost"
            onClick={() => {
              const returnTo = searchParams?.get("returnTo")
              if (returnTo) {
                router.push(returnTo)
              } else {
                router.push("/dashboard/device-groups")
              }
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {searchParams?.get("returnTo") ? "Back" : "Back to Groups"}
          </Button>
        </motion.div>

        <motion.header
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          className="mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-bold mb-2 text-primary">
            Create Device Group
          </h1>
          <p className="text-muted-foreground">
            Create a new group to organize your biometric devices.
          </p>
        </motion.header>

        <motion.main
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          transition={{ delay: 0.2 }}
        >
          <DeviceGroupForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        </motion.main>
      </div>
    </div>
  )
}


"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import { fadeInUp } from "@/lib/animations/framer-motion"
import {
  deviceGroupFormSchema,
  deviceGroupUpdateSchema,
  type DeviceGroupFormData,
  type DeviceGroupUpdateFormData,
} from "@/lib/validations/device_group"

export interface DeviceGroupFormProps {
  groupId?: number
  initialData?: Partial<DeviceGroupFormData | DeviceGroupUpdateFormData>
  onSubmit: (data: DeviceGroupFormData | DeviceGroupUpdateFormData) => Promise<void>
  onCancel: () => void
}

/**
 * Device group form component for creating and editing groups.
 */
export function DeviceGroupForm({
  groupId,
  initialData,
  onSubmit,
  onCancel,
}: DeviceGroupFormProps) {
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isUpdate = !!groupId
  const schema = isUpdate ? deviceGroupUpdateSchema : deviceGroupFormSchema

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DeviceGroupFormData | DeviceGroupUpdateFormData>({
    resolver: zodResolver(schema),
    defaultValues: initialData || {},
  })

  const onFormSubmit = async (data: DeviceGroupFormData | DeviceGroupUpdateFormData) => {
    try {
      setIsSubmitting(true)
      setSubmitError(null)
      await onSubmit(data)
    } catch (error) {
      if (error instanceof Error) {
        setSubmitError(error.message)
      } else {
        setSubmitError("An error occurred. Please try again.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
    >
      <Card className="bg-white border border-gray-200/50 dark:border-gray-700/50">
        <div className="p-6">
          <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
            {/* Error Alert */}
            {submitError && (
              <Alert variant="destructive" className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            {/* Group Name */}
            <div>
              <Label htmlFor="name" className="text-blue-700 dark:text-blue-400">
                Group Name *
              </Label>
              <Input
                id="name"
                {...register("name")}
                placeholder="e.g., Main Gate, Library, Dormitories"
                className="mt-1 border-blue-300 focus:border-blue-500 focus:ring-blue-500"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description" className="text-gray-700 dark:text-gray-300">
                Description
              </Label>
              <Textarea
                id="description"
                {...register("description")}
                placeholder="Optional description for this device group"
                rows={4}
                className="mt-1 border-gray-300 focus:border-purple-500 focus:ring-purple-500"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Optional description to help identify the purpose or location of this group
              </p>
              {errors.description && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.description.message}
                </p>
              )}
            </div>

            {/* Form Actions */}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
                className="sm:min-w-[100px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700 text-white sm:min-w-[100px]"
              >
                {isSubmitting ? (
                  <>
                    <span className="mr-2">Saving...</span>
                  </>
                ) : isUpdate ? (
                  "Update Group"
                ) : (
                  "Create Group"
                )}
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </motion.div>
  )
}


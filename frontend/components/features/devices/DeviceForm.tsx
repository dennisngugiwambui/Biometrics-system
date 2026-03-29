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
import { Loader2, Wifi, AlertCircle } from "lucide-react"
import { fadeInUp } from "@/lib/animations/framer-motion"
import { deviceFormSchema, deviceUpdateSchema, type DeviceFormData, type DeviceUpdateFormData } from "@/lib/validations/device"
import { testDeviceConnection, testDeviceConnectionByAddress } from "@/lib/api/devices"
import { DeviceGroupSelector } from "./DeviceGroupSelector"
import { DeviceNetworkSetupCard } from "./DeviceNetworkSetupCard"

export interface DeviceFormProps {
  deviceId?: number
  initialData?: Partial<DeviceFormData | DeviceUpdateFormData>
  onSubmit: (data: DeviceFormData | DeviceUpdateFormData) => Promise<void>
  onCancel: () => void
  token: string
}

/**
 * Device form component for creating and editing devices.
 */
export function DeviceForm({
  deviceId,
  initialData,
  onSubmit,
  onCancel,
  token,
}: DeviceFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [testTroubleshootingTips, setTestTroubleshootingTips] = useState<string[] | null>(null)

  const isUpdate = !!deviceId
  const schema = isUpdate ? deviceUpdateSchema : deviceFormSchema

  // Use conditional types based on update vs create mode
  const form = useForm<DeviceFormData | DeviceUpdateFormData>({
    resolver: zodResolver(schema) as any, // Type assertion needed due to union type complexity
    defaultValues: initialData || {
      port: 4370,
    },
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setError,
    setValue,
  } = form

  const ipAddress = watch("ip_address")
  const port = watch("port")
  const comPassword = watch("com_password")

  /**
   * Test device connection before saving.
   */
  const handleTestConnection = async () => {
    if (!ipAddress || !port) {
      setTestResult("Please enter IP address and port first")
      return
    }

    // Validate IP address format first
    try {
      deviceFormSchema.shape.ip_address.parse(ipAddress)
    } catch {
      setTestResult("Please enter a valid IP address")
      return
    }

    setIsTestingConnection(true)
    setTestResult(null)
    setTestTroubleshootingTips(null)

    try {
      // If device exists, test using device ID
      if (deviceId) {
        const result = await testDeviceConnection(token, deviceId)
        if (result.success) {
          setTestResult(
            `✅ Connection successful${result.response_time_ms ? ` (${result.response_time_ms}ms)` : ""}`
          )
        } else {
          setTestResult(`❌ Connection failed: ${result.message}`)
          setTestTroubleshootingTips(result.troubleshooting_tips ?? null)
        }
      } else {
        // For new devices, test connection by IP address and port
        const result = await testDeviceConnectionByAddress(token, {
          ip_address: ipAddress,
          port: port || 4370,
          com_password: comPassword || undefined,
          timeout: 5,
        })
        
        if (result.success) {
          setTestResult(
            `✅ Connection successful${result.response_time_ms ? ` (${result.response_time_ms}ms)` : ""}`
          )
        } else {
          setTestResult(`❌ Connection failed: ${result.message}`)
          setTestTroubleshootingTips(result.troubleshooting_tips ?? null)
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        setTestResult(`❌ Connection test failed: ${error.message}`)
      } else {
        setTestResult("❌ Connection test failed. Please try again.")
      }
    } finally {
      setIsTestingConnection(false)
    }
  }

  /**
   * Handle form submission.
   */
  const onFormSubmit = async (data: DeviceFormData | DeviceUpdateFormData) => {
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      await onSubmit(data)
    } catch (error) {
      if (error instanceof Error) {
        setSubmitError(error.message)
        
        // Try to extract field errors if available
        if (error.name === 'DeviceApiError' && 'fieldErrors' in error) {
          const fieldErrors = (error as { fieldErrors?: Record<string, string> }).fieldErrors
          if (fieldErrors) {
            Object.entries(fieldErrors).forEach(([field, message]) => {
              setError(field as keyof DeviceFormData, {
                type: 'server',
                message,
              })
            })
          }
        }
      } else {
        setSubmitError("An unexpected error occurred. Please try again.")
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
      <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50">
        <div className="p-6">
          <form onSubmit={handleSubmit(onFormSubmit as any)} className="space-y-6">
            {/* Error Alert */}
            {submitError && (
              <Alert variant="destructive" className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            {/* Device Name */}
            <div>
              <Label htmlFor="name" className="text-blue-700 dark:text-blue-400">
                Device Name *
              </Label>
              <Input
                id="name"
                {...register("name")}
                placeholder="e.g., Main Gate Scanner"
                className="mt-1 border-blue-300 focus:border-blue-500 focus:ring-blue-500"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* IP Address and Port */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="ip_address" className="text-blue-700 dark:text-blue-400">
                  IP Address *
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Enter the <span className="font-medium text-gray-700 dark:text-gray-300">K40&apos;s</span> IP — not your PC&apos;s IP from ipconfig.
                </p>
                <Input
                  id="ip_address"
                  {...register("ip_address")}
                  placeholder="192.168.1.200"
                  className="mt-1 border-blue-300 focus:border-blue-500 focus:ring-blue-500 font-mono"
                />
                {errors.ip_address && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.ip_address.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="port" className="text-blue-700 dark:text-blue-400">
                  Port *
                </Label>
                <Input
                  id="port"
                  type="number"
                  {...register("port", { valueAsNumber: true })}
                  placeholder="4370"
                  className="mt-1 border-blue-300 focus:border-blue-500 focus:ring-blue-500"
                />
                {errors.port && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.port.message}
                  </p>
                )}
              </div>
            </div>

            <DeviceNetworkSetupCard token={token} setValue={setValue} />

            {/* Communication Password */}
            <div>
              <Label htmlFor="com_password" className="text-gray-700 dark:text-gray-300">
                Communication Password
              </Label>
              <Input
                id="com_password"
                type="password"
                {...register("com_password")}
                placeholder="Optional - Device communication password"
                className="mt-1 border-gray-300 focus:border-purple-500 focus:ring-purple-500 font-mono"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Optional password for device authentication (if required by device)
              </p>
              {errors.com_password && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.com_password.message}
                </p>
              )}
            </div>

            {/* Connection Test Button */}
            <div>
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={isTestingConnection || !ipAddress || !port}
                className="border-blue-300 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20"
              >
                {isTestingConnection ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Wifi className="mr-2 h-4 w-4" />
                    Test Connection
                  </>
                )}
              </Button>
              {testResult && (
                <p className={`mt-2 text-sm ${testResult.includes("✅") ? "text-green-600 dark:text-green-400" : testResult.includes("💡") ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400"}`}>
                  {testResult}
                </p>
              )}
              {testTroubleshootingTips && testTroubleshootingTips.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-sm text-blue-700 dark:text-blue-400 space-y-1">
                  {testTroubleshootingTips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* Serial Number */}
            <div>
              <Label htmlFor="serial_number" className="text-gray-700 dark:text-gray-300">
                Serial Number
              </Label>
              <Input
                id="serial_number"
                {...register("serial_number")}
                placeholder="Optional - Device serial number"
                className="mt-1 border-gray-300 focus:border-purple-500 focus:ring-purple-500 font-mono"
              />
              {errors.serial_number && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.serial_number.message}
                </p>
              )}
            </div>

            {/* Location */}
            <div>
              <Label htmlFor="location" className="text-gray-700 dark:text-gray-300">
                Location
              </Label>
              <Input
                id="location"
                {...register("location")}
                placeholder="e.g., Main Gate, Library, Dormitory A"
                className="mt-1 border-gray-300 focus:border-purple-500 focus:ring-purple-500"
              />
              {errors.location && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.location.message}
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
                placeholder="Optional description or notes about this device"
                rows={3}
                className="mt-1 border-gray-300 focus:border-purple-500 focus:ring-purple-500"
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.description?.message}
                </p>
              )}
            </div>

            {/* Device Group */}
            <div>
              <Label className="text-gray-700 dark:text-gray-300">
                Device Group
              </Label>
              <div className="mt-1">
                <DeviceGroupSelector
                  value={watch("device_group_id")}
                  onValueChange={(value) => setValue("device_group_id", value, { shouldValidate: true })}
                  placeholder="Select a device group (optional)"
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Optional - Assign this device to a group for better organization
              </p>
              {errors.device_group_id && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.device_group_id.message}
                </p>
              )}
            </div>

            {/* Form Actions */}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isUpdate ? "Updating..." : "Creating..."}
                  </>
                ) : (
                  isUpdate ? "Update Device" : "Create Device"
                )}
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </motion.div>
  )
}


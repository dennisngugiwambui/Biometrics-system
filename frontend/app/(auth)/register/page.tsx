"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { School, User, ArrowLeft, Home } from "lucide-react"
import Link from "next/link"
import { registerSchool, SchoolRegistrationError } from "@/lib/api/schools"
import type { SchoolRegistrationWithAdminFormData } from "@/lib/validations/school"
import { AdminAccountFormSimple, type AdminAccountFormData, type AdminAccountFormErrors } from "@/components/features/auth/AdminAccountFormSimple"
import { SchoolRegistrationFormSimple, type SchoolRegistrationFormData, type SchoolRegistrationFormErrors } from "@/components/features/school/SchoolRegistrationFormSimple"
import { RegistrationSuccessScreen } from "@/components/features/auth/RegistrationSuccessScreen"
import { StepProgressIndicator } from "@/components/features/auth/StepProgressIndicator"
import { StepHeader } from "@/components/features/auth/StepHeader"

type Step = 1 | 2

export default function RegistrationPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [isComplete, setIsComplete] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [schoolErrors, setSchoolErrors] = useState<SchoolRegistrationFormErrors>({})
  const [adminErrors, setAdminErrors] = useState<AdminAccountFormErrors>({})
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [registeredData, setRegisteredData] = useState<{
    school: { id: number; name: string; code: string }
    admin: { email: string; first_name: string; last_name: string }
  } | null>(null)

  const [schoolData, setSchoolData] = useState<SchoolRegistrationFormData>({
    schoolName: "",
    schoolCode: "",
    address: "",
    phone: "",
    schoolEmail: "",
  })

  const [adminData, setAdminData] = useState<AdminAccountFormData>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  })

  // Render icons client-side only to avoid hydration mismatches from browser extensions
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Prevent double submission
  const isSubmittingRef = useRef(false)

  const updateSchoolField = (field: keyof SchoolRegistrationFormData, value: string) => {
    setSchoolData((prev) => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (schoolErrors[field]) {
      setSchoolErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const updateAdminField = (field: keyof AdminAccountFormData, value: string) => {
    setAdminData((prev) => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (adminErrors[field]) {
      setAdminErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const validateStep1 = () => {
    const newErrors: SchoolRegistrationFormErrors = {}

    if (!schoolData.schoolName.trim()) {
      newErrors.schoolName = "School name is required"
    }
    if (!schoolData.schoolCode.trim()) {
      newErrors.schoolCode = "School code is required"
    } else if (schoolData.schoolCode.length < 3) {
      newErrors.schoolCode = "School code must be at least 3 characters"
    } else if (!/^[A-Za-z0-9-]+$/.test(schoolData.schoolCode)) {
      newErrors.schoolCode = "School code can only contain letters, numbers, and hyphens"
    }

    setSchoolErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validateStep2 = () => {
    const newErrors: AdminAccountFormErrors = {}

    if (!adminData.firstName.trim()) {
      newErrors.firstName = "First name is required"
    }
    if (!adminData.lastName.trim()) {
      newErrors.lastName = "Last name is required"
    }
    if (!adminData.email.trim()) {
      newErrors.email = "Email is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminData.email)) {
      newErrors.email = "Please enter a valid email"
    }
    if (!adminData.password) {
      newErrors.password = "Password is required"
    } else if (adminData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters"
    } else {
      // Check password requirements
      if (!/[A-Z]/.test(adminData.password)) {
        newErrors.password = "Password must contain an uppercase letter"
      } else if (!/[a-z]/.test(adminData.password)) {
        newErrors.password = "Password must contain a lowercase letter"
      } else if (!/[0-9]/.test(adminData.password)) {
        newErrors.password = "Password must contain a number"
      } else if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(adminData.password)) {
        newErrors.password = "Password must contain a special character (!@#$%^&*)"
      }
    }
    if (adminData.password !== adminData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match"
    }

    setAdminErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateStep1()) {
      setCurrentStep(2)
    }
  }

  const handleBack = () => {
    setCurrentStep(1)
    setAdminErrors({})
    setGeneralError(null)
  }

  const handleSubmit = async () => {
    // Prevent double submission
    if (isSubmittingRef.current || isLoading) {
      return
    }

    if (!validateStep2()) {
      return
    }

    isSubmittingRef.current = true
    setIsLoading(true)
    setAdminErrors({})
    setGeneralError(null)

    try {
      // Map form data to API format
      const apiData: SchoolRegistrationWithAdminFormData = {
        name: schoolData.schoolName,
        code: schoolData.schoolCode.toUpperCase(),
        address: schoolData.address || undefined,
        phone: schoolData.phone || undefined,
        email: schoolData.schoolEmail || undefined,
        admin: {
          first_name: adminData.firstName,
          last_name: adminData.lastName,
          email: adminData.email,
          password: adminData.password,
          confirmPassword: adminData.confirmPassword,
        },
      }

      const response = await registerSchool(apiData)

      // Store registered data for success message
      if (response.admin_user) {
        setRegisteredData({
          school: {
            id: response.id,
            name: response.name,
            code: response.code,
          },
          admin: {
            email: response.admin_user.email,
            first_name: response.admin_user.first_name,
            last_name: response.admin_user.last_name,
          },
        })
      }

      setIsComplete(true)

      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push("/login")
      }, 3000)
    } catch (err: unknown) {
      // Handle SchoolRegistrationError with comprehensive error handling
      if (err instanceof SchoolRegistrationError) {
        const newSchoolErrors: SchoolRegistrationFormErrors = {}
        const newAdminErrors: AdminAccountFormErrors = {}

        // Map backend field errors to frontend fields
        if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
          Object.entries(err.fieldErrors).forEach(([field, message]) => {
            // Check if field is an admin field (starts with "admin." or contains "password")
            const isAdminField = field.startsWith("admin.") || 
                                 field === "password" || 
                                 message.toLowerCase().includes("password") ||
                                 message.toLowerCase().includes("admin")
            
            if (isAdminField) {
              // Map admin fields
              const adminField = field.replace("admin.", "").replace("admin_", "")
              const fieldMap: Record<string, keyof AdminAccountFormData> = {
                first_name: "firstName",
                last_name: "lastName",
                email: "email",
                password: "password",
              }
              const frontendField = fieldMap[adminField] || fieldMap[field]
              if (frontendField) {
                newAdminErrors[frontendField] = message
                setCurrentStep(2) // Switch to step 2 for admin errors
              }
            } else if (field === "name" || field === "code" || field === "address" || field === "phone" || field === "email") {
              // Map school fields
              const fieldMap: Record<string, keyof SchoolRegistrationFormData> = {
                name: "schoolName",
                code: "schoolCode",
                address: "address",
                phone: "phone",
                email: "schoolEmail",
              }
              const frontendField = fieldMap[field]
              if (frontendField) {
                newSchoolErrors[frontendField] = message
                setCurrentStep(1) // Switch to step 1 for school errors
              }
            }
          })
        }

        // For 409 (duplicate code, email, or validation errors), set appropriate field errors
        if (err.statusCode === 409) {
          const errorMsg = err.message.toLowerCase()
          // Check for password-related errors first
          if (errorMsg.includes("password")) {
            newAdminErrors.password = err.message
            setCurrentStep(2) // Switch to step 2 to show password error
          } else if (errorMsg.includes("code")) {
            newSchoolErrors.schoolCode = err.message
            setCurrentStep(1) // Switch to step 1 to show code error
          } else if (errorMsg.includes("email")) {
            newAdminErrors.email = err.message
            setCurrentStep(2) // Switch to step 2 to show email error
          } else if (errorMsg.includes("admin")) {
            // Admin-related errors (but not password/email specifically)
            setCurrentStep(2)
          }
        }

        // If no field-specific errors, show general error
        if (Object.keys(newSchoolErrors).length === 0 && Object.keys(newAdminErrors).length === 0) {
          setGeneralError(err.message)
        } else {
          setSchoolErrors(newSchoolErrors)
          setAdminErrors(newAdminErrors)
        }
      } else if (err instanceof Error) {
        setGeneralError(err.message)
      } else {
        setGeneralError("An error occurred while registering. Please try again.")
      }


    } finally {
      setIsLoading(false)
      isSubmittingRef.current = false

      
    }
  }

  if (isComplete && registeredData) {
    return <RegistrationSuccessScreen school={registeredData.school} admin={registeredData.admin} />
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl">
        <Card className="border-none shadow-2xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
          <CardHeader className="space-y-6 pb-8">
            {/* Progress Indicator */}
            <StepProgressIndicator
              currentStep={currentStep}
              totalSteps={2}
              stepLabels={["School Info", "Admin Account"]}
            />

            {/* Step Header */}
            <AnimatePresence mode="wait">
              {currentStep === 1 && (
                <StepHeader
                  step={1}
                  title="Register Your School"
                  description="Enter your school details to get started"
                  icon={School}
                  iconBgColor="bg-blue-100"
                  iconColor="text-blue-600"
                />
              )}
              {currentStep === 2 && (
                <StepHeader
                  step={2}
                  title="Create Admin Account"
                  description="Set up your administrator credentials"
                  icon={User}
                  iconBgColor="bg-indigo-100"
                  iconColor="text-indigo-600"
                />
              )}
            </AnimatePresence>
          </CardHeader>

          <CardContent className="pb-8">
            {(Object.keys(schoolErrors).length > 0 || Object.keys(adminErrors).length > 0 || generalError) && (
              <Alert variant="destructive" className="mb-6">
                <AlertDescription>
                  {generalError || "Please fix the errors below before continuing."}
                </AlertDescription>
              </Alert>
            )}

            <AnimatePresence mode="wait">
              {/* Step 1: School Information */}
              {currentStep === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 30 }}
                  transition={{ duration: 0.3 }}
                >
                  <SchoolRegistrationFormSimple
                    data={schoolData}
                    onChange={updateSchoolField}
                    errors={schoolErrors}
                    isLoading={isLoading}
                  />
                  <div className="flex justify-end pt-4">
                    <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700 text-white px-8 w-full sm:w-auto" size="lg">
                      Next: Admin Account
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Admin Account */}
              {currentStep === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 30 }}
                  transition={{ duration: 0.3 }}
                >
                  <AdminAccountFormSimple
                    data={adminData}
                    onChange={updateAdminField}
                    errors={adminErrors}
                    generalError={generalError}
                    isLoading={isLoading}
                    showPasswordStrength={true}
                  />
                  <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between pt-4 gap-4">
                    <Button onClick={handleBack} variant="outline" size="lg" className="px-6 bg-transparent w-full sm:w-auto">
                      {isMounted ? (
                        <ArrowLeft className="w-4 h-4 mr-2" />
                      ) : (
                        <span className="w-4 h-4 mr-2" aria-hidden="true" />
                      )}
                      Back
                    </Button>
                    <Button
                      onClick={(e) => {e.preventDefault(); handleSubmit()}}
                      disabled={isLoading}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 w-full sm:w-auto"
                      size="lg"
                    >
                      {isLoading ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                            className="w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"
                          />
                          Processing...
                        </>
                      ) : (
                        "Complete Registration"
                      )}
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Secondary Links */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700"
            >
              <div className="flex flex-col gap-2">
                <Link href="/login" className="w-full">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-700 dark:hover:text-blue-300 transition-colors bg-transparent"
                  >
                    Already have an account? Sign in
                  </Button>
                </Link>
                <Link href="/" className="w-full">
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    {isMounted ? (
                      <Home className="w-4 h-4 mr-2" />
                    ) : (
                      <span className="w-4 h-4 mr-2" aria-hidden="true" />
                    )}
                    Back to home
                  </Button>
                </Link>
              </div>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}


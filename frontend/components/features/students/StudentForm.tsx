"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react"
import { fadeInUp, messageSlide } from "@/lib/animations/framer-motion"
import { useAuthStore } from "@/lib/store/authStore"
import {
  createStudent,
  updateStudent,
  getStudent,
  type StudentResponse,
  StudentApiError,
} from "@/lib/api/students"
import { listClasses, type ClassResponse } from "@/lib/api/classes"
import { listStreams, type StreamResponse } from "@/lib/api/streams"
import { studentFormSchema, type StudentFormData } from "@/lib/validations/student"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

export interface StudentFormProps {
  studentId?: number
  onSuccess?: () => void
}

export function StudentForm({ studentId, onSuccess }: StudentFormProps) {
  const router = useRouter()
  const { token } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(!!studentId)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [classes, setClasses] = useState<ClassResponse[]>([])
  const [streams, setStreams] = useState<StreamResponse[]>([])
  const [isLoadingClasses, setIsLoadingClasses] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<StudentFormData>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: {
      admission_number: "",
      first_name: "",
      last_name: "",
      date_of_birth: null,
      gender: null,
      class_id: null,
      stream_id: null,
      parent_phone: null,
      parent_email: null,
    },
  })

  const formValues = watch()
  const selectedClassId = formValues.class_id

  // Fetch classes
  useEffect(() => {
    if (token) {
      const fetchClasses = async () => {
        try {
          setIsLoadingClasses(true)
          const data = await listClasses(token)
          setClasses(data)
        } catch (err) {
          console.error("Failed to load classes:", err)
        } finally {
          setIsLoadingClasses(false)
        }
      }
      fetchClasses()
    }
  }, [token])

  // Fetch streams when class changes
  useEffect(() => {
    if (token && selectedClassId) {
      const fetchStreams = async () => {
        try {
          const data = await listStreams(token, selectedClassId)
          setStreams(data)
          // Clear stream selection if current stream doesn't belong to selected class
          if (formValues.stream_id) {
            const currentStream = data.find((s) => s.id === formValues.stream_id)
            if (!currentStream) {
              setValue("stream_id", null)
            }
          }
        } catch (err) {
          console.error("Failed to load streams:", err)
          setStreams([])
        }
      }
      fetchStreams()
    } else {
      setStreams([])
      setValue("stream_id", null)
    }
  }, [token, selectedClassId, setValue, formValues.stream_id])

  // Fetch student data if editing
  useEffect(() => {
    if (studentId && token) {
      const fetchStudent = async () => {
        try {
          setIsFetching(true)
          const student = await getStudent(token, studentId)
          reset({
            admission_number: student.admission_number,
            first_name: student.first_name,
            last_name: student.last_name,
            date_of_birth: student.date_of_birth
              ? student.date_of_birth.split("T")[0]
              : null,
            gender: student.gender || null,
            class_id: student.class_id || null,
            stream_id: student.stream_id || null,
            parent_phone: student.parent_phone || null,
            parent_email: student.parent_email || null,
          })
        } catch (err) {
          if (err instanceof StudentApiError) {
            setError(err.message)
          } else {
            setError("Failed to load student data")
          }
        } finally {
          setIsFetching(false)
        }
      }
      fetchStudent()
    }
  }, [studentId, token, reset])

  const onSubmit = async (data: StudentFormData) => {
    if (!token) return

    setIsLoading(true)
    setError(null)
    setSuccess(false)
    setFieldErrors({})

    try {
      // Prepare data for API
      const apiData = {
        ...data,
        date_of_birth: data.date_of_birth || null,
        gender: data.gender || null,
        class_id: data.class_id || null,
        stream_id: data.stream_id || null,
        parent_phone: data.parent_phone || null,
        parent_email: data.parent_email || null,
      }

      if (studentId) {
        // Update student (exclude admission_number)
        const { admission_number, ...updateData } = apiData
        await updateStudent(token, studentId, updateData)
      } else {
        // Create student
        await createStudent(token, apiData)
      }

      setSuccess(true)
      setTimeout(() => {
        if (onSuccess) {
          onSuccess()
        } else if (studentId) {
          router.push(`/dashboard/students/${studentId}`)
        } else {
          router.push("/dashboard/students")
        }
      }, 1000)
    } catch (err) {
      if (err instanceof StudentApiError) {
        setError(err.message)
        if (err.fieldErrors) {
          setFieldErrors(err.fieldErrors)
        }
      } else {
        setError("Failed to save student. Please try again.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (isFetching) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <motion.div variants={fadeInUp} initial="hidden" animate="visible">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </motion.div>

      {/* Form Card */}
      <motion.div variants={fadeInUp} initial="hidden" animate="visible" transition={{ delay: 0.1 }}>
        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-primary">
              {studentId ? "Edit Student" : "Add New Student"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Success Message */}
              <AnimatePresence>
                {success && (
                  <motion.div
                    variants={messageSlide}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                  >
                    <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800 dark:text-green-200">
                        Student {studentId ? "updated" : "created"} successfully!
                      </AlertDescription>
                    </Alert>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error Message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    variants={messageSlide}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                  >
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Personal Information Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-blue-700 dark:text-blue-400">
                  Personal Information
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Admission Number */}
                  <div className="space-y-2">
                    <Label htmlFor="admission_number" className="text-blue-700 dark:text-blue-400">
                      Admission Number <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="admission_number"
                      {...register("admission_number")}
                      disabled={!!studentId}
                      className="border-blue-300 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="STD-001"
                    />
                    {errors.admission_number && (
                      <p className="text-sm text-red-600">{errors.admission_number.message}</p>
                    )}
                    {fieldErrors.admission_number && (
                      <p className="text-sm text-red-600">{fieldErrors.admission_number}</p>
                    )}
                  </div>

                  {/* First Name */}
                  <div className="space-y-2">
                    <Label htmlFor="first_name" className="text-blue-700 dark:text-blue-400">
                      First Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="first_name"
                      {...register("first_name")}
                      className="border-blue-300 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="John"
                    />
                    {errors.first_name && (
                      <p className="text-sm text-red-600">{errors.first_name.message}</p>
                    )}
                    {fieldErrors.first_name && (
                      <p className="text-sm text-red-600">{fieldErrors.first_name}</p>
                    )}
                  </div>

                  {/* Last Name */}
                  <div className="space-y-2">
                    <Label htmlFor="last_name" className="text-blue-700 dark:text-blue-400">
                      Last Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="last_name"
                      {...register("last_name")}
                      className="border-blue-300 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Doe"
                    />
                    {errors.last_name && (
                      <p className="text-sm text-red-600">{errors.last_name.message}</p>
                    )}
                    {fieldErrors.last_name && (
                      <p className="text-sm text-red-600">{fieldErrors.last_name}</p>
                    )}
                  </div>

                  {/* Date of Birth */}
                  <div className="space-y-2">
                    <Label htmlFor="date_of_birth" className="text-gray-700 dark:text-gray-300">
                      Date of Birth
                    </Label>
                    <Input
                      id="date_of_birth"
                      type="date"
                      value={
                        formValues.date_of_birth
                          ? new Date(formValues.date_of_birth).toISOString().split("T")[0]
                          : ""
                      }
                      onChange={(e) => {
                        const value = e.target.value || null
                        setValue("date_of_birth", value)
                      }}
                      max={new Date().toISOString().split("T")[0]}
                      className="border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                    />
                    {errors.date_of_birth && (
                      <p className="text-sm text-red-600">{errors.date_of_birth.message}</p>
                    )}
                  </div>

                  {/* Gender */}
                  <div className="space-y-2">
                    <Label htmlFor="gender" className="text-gray-700 dark:text-gray-300">
                      Gender
                    </Label>
                    <Select
                      value={formValues.gender || "none"}
                      onValueChange={(value) =>
                        setValue("gender", value === "none" ? null : (value as "male" | "female" | "other"))
                      }
                    >
                      <SelectTrigger className="border-gray-300 focus:border-purple-500 focus:ring-purple-500">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not specified</SelectItem>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.gender && (
                      <p className="text-sm text-red-600">{errors.gender.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Academic Information Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-indigo-700 dark:text-indigo-400">
                  Academic Information
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Class */}
                  <div className="space-y-2">
                    <Label htmlFor="class_id" className="text-gray-700 dark:text-gray-300">
                      Class
                    </Label>
                    <Select
                      value={formValues.class_id?.toString() || "none"}
                      onValueChange={(value) =>
                        setValue("class_id", value === "none" ? null : parseInt(value))
                      }
                    >
                      <SelectTrigger className="border-gray-300 focus:border-purple-500 focus:ring-purple-500">
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not assigned</SelectItem>
                        {classes.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id.toString()}>
                            {cls.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.class_id && (
                      <p className="text-sm text-red-600">{errors.class_id.message}</p>
                    )}
                  </div>

                  {/* Stream */}
                  <div className="space-y-2">
                    <Label htmlFor="stream_id" className="text-gray-700 dark:text-gray-300">
                      Stream
                    </Label>
                    <Select
                      value={formValues.stream_id?.toString() || "none"}
                      onValueChange={(value) =>
                        setValue("stream_id", value === "none" ? null : parseInt(value))
                      }
                      disabled={!formValues.class_id}
                    >
                      <SelectTrigger className="border-gray-300 focus:border-purple-500 focus:ring-purple-500">
                        <SelectValue placeholder="Select stream" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not assigned</SelectItem>
                        {streams.map((stream) => (
                          <SelectItem key={stream.id} value={stream.id.toString()}>
                            {stream.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.stream_id && (
                      <p className="text-sm text-red-600">{errors.stream_id.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Parent/Guardian Contact Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-purple-700 dark:text-purple-400">
                  Parent/Guardian Contact
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Parent Phone */}
                  <div className="space-y-2">
                    <Label htmlFor="parent_phone" className="text-gray-700 dark:text-gray-300">
                      Phone Number <span className="text-muted-foreground text-sm font-normal">(Optional)</span>
                    </Label>
                    <Input
                      id="parent_phone"
                      type="tel"
                      {...register("parent_phone")}
                      className="border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                      placeholder="+254712345678"
                    />
                    {errors.parent_phone && (
                      <p className="text-sm text-red-600">{errors.parent_phone.message}</p>
                    )}
                    {fieldErrors.parent_phone && (
                      <p className="text-sm text-red-600">{fieldErrors.parent_phone}</p>
                    )}
                  </div>

                  {/* Parent Email */}
                  <div className="space-y-2">
                    <Label htmlFor="parent_email" className="text-gray-700 dark:text-gray-300">
                      Email Address <span className="text-muted-foreground text-sm font-normal">(Optional)</span>
                    </Label>
                    <Input
                      id="parent_email"
                      type="email"
                      {...register("parent_email")}
                      className="border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                      placeholder="parent@example.com"
                    />
                    {errors.parent_email && (
                      <p className="text-sm text-red-600">{errors.parent_email.message}</p>
                    )}
                    {fieldErrors.parent_email && (
                      <p className="text-sm text-red-600">{fieldErrors.parent_email}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : studentId ? (
                    "Update Student"
                  ) : (
                    "Create Student"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}


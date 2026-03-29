"use client"

import { useState, useEffect } from "react"
import {
  User,
  Server,
  Fingerprint,
  Play,
  ChevronRight,
  ChevronLeft,
  Check,
  X,
  MapPin,
  Wifi,
  GraduationCap,
  Hash,
  Hand,
  Loader2,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { StudentSelector } from "./StudentSelector"
import { TeacherSelector } from "./TeacherSelector"
import { DeviceSelector } from "./DeviceSelector"
import { FingerSelector } from "./FingerSelector"
import { EnrollmentCapture } from "./EnrollmentCapture"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { getSyncStatus, syncStudentToDevice, getTeacherSyncStatus, syncTeacherToDevice, SyncApiError } from "@/lib/api/sync"
import type { StudentResponse } from "@/lib/api/students"
import type { TeacherResponse } from "@/lib/api/teachers"
import type { DeviceResponse } from "@/lib/api/devices"
import { DeviceStatusBadge } from "@/components/features/devices/DeviceStatusBadge"
import { getFingerInfo, FINGERS } from "@/lib/utils/fingers"

const STEPS_STUDENT = [
  { id: 1, name: "Select Student", icon: User, description: "Choose a student to enroll" },
  { id: 2, name: "Choose Device", icon: Server, description: "Select biometric scanner" },
  { id: 3, name: "Select Finger", icon: Fingerprint, description: "Pick finger to enroll" },
  { id: 4, name: "Capture", icon: Play, description: "Complete enrollment" },
]

const STEPS_TEACHER = [
  { id: 1, name: "Select Teacher", icon: User, description: "Choose a teacher to enroll" },
  { id: 2, name: "Choose Device", icon: Server, description: "Select biometric scanner" },
  { id: 3, name: "Select Finger", icon: Fingerprint, description: "Pick finger to enroll" },
  { id: 4, name: "Capture", icon: Play, description: "Complete enrollment" },
]

interface EnrollmentWizardProps {
  mode?: "student" | "teacher"
  onStartEnrollment?: (data: {
    studentId?: number
    teacherId?: number
    deviceId: number
    fingerId: number
  }) => Promise<{ session_id: string; status: string; started_at: string } | undefined>
}

export function EnrollmentWizard({ mode = "student", onStartEnrollment }: EnrollmentWizardProps = {}) {
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedStudent, setSelectedStudent] = useState<StudentResponse | null>(null)
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherResponse | null>(null)
  const [selectedDevice, setSelectedDevice] = useState<DeviceResponse | null>(null)
  const [selectedFinger, setSelectedFinger] = useState<number | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [enrollmentSession, setEnrollmentSession] = useState<{ session_id: string; status: string; started_at: string } | null>(null)
  const [isStartingEnrollment, setIsStartingEnrollment] = useState(false)

  const STEPS = mode === "teacher" ? STEPS_TEACHER : STEPS_STUDENT
  const isTeacherMode = mode === "teacher"
  const selectedPersonId = isTeacherMode ? selectedTeacher?.id : selectedStudent?.id

  // Sync status for step 2: null = not checked, { synced } = checked
  const [syncStatus, setSyncStatus] = useState<{ synced: boolean } | null>(null)
  const [isCheckingSync, setIsCheckingSync] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  useEffect(() => {
    if (isTeacherMode) {
      if (!selectedTeacher || !selectedDevice || selectedDevice.status !== "online") {
        setSyncStatus(null)
        setSyncError(null)
        return
      }
      let cancelled = false
      setIsCheckingSync(true)
      setSyncError(null)
      getTeacherSyncStatus(selectedDevice.id, selectedTeacher.id)
        .then((res) => {
          if (!cancelled) setSyncStatus({ synced: res.synced })
        })
        .catch((err) => {
          if (!cancelled) {
            setSyncStatus(null)
            setSyncError(err instanceof SyncApiError ? err.message : "Failed to check sync status")
          }
        })
        .finally(() => {
          if (!cancelled) setIsCheckingSync(false)
        })
      return () => {
        cancelled = true
      }
    }
    if (!selectedStudent || !selectedDevice || selectedDevice.status !== "online") {
      setSyncStatus(null)
      setSyncError(null)
      return
    }
    let cancelled = false
    setIsCheckingSync(true)
    setSyncError(null)
    getSyncStatus(selectedDevice.id, selectedStudent.id)
      .then((res) => {
        if (!cancelled) setSyncStatus({ synced: res.synced })
      })
      .catch((err) => {
        if (!cancelled) {
          setSyncStatus(null)
          setSyncError(err instanceof SyncApiError ? err.message : "Failed to check sync status")
        }
      })
      .finally(() => {
        if (!cancelled) setIsCheckingSync(false)
      })
    return () => {
      cancelled = true
    }
  }, [isTeacherMode, selectedStudent?.id, selectedTeacher?.id, selectedDevice?.id])

  const handleSyncStudent = async () => {
    if (!selectedStudent || !selectedDevice) return
    setIsSyncing(true)
    setSyncError(null)
    try {
      await syncStudentToDevice(selectedStudent.id, selectedDevice.id)
      setSyncStatus({ synced: true })
      setSyncError(null)
    } catch (err) {
      const msg = err instanceof SyncApiError ? err.message : "Sync failed"
      setSyncError(msg)
    } finally {
      setIsSyncing(false)
    }
  }

  const handleSyncTeacher = async () => {
    if (!selectedTeacher || !selectedDevice) return
    setIsSyncing(true)
    setSyncError(null)
    try {
      await syncTeacherToDevice(selectedTeacher.id, selectedDevice.id)
      setSyncStatus({ synced: true })
      setSyncError(null)
    } catch (err) {
      const msg = err instanceof SyncApiError ? err.message : "Sync failed"
      setSyncError(msg)
    } finally {
      setIsSyncing(false)
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return isTeacherMode ? selectedTeacher !== null : selectedStudent !== null
      case 2:
        return (
          selectedDevice !== null &&
          selectedDevice.status === "online" &&
          (syncStatus === null ? false : syncStatus.synced)
        )
      case 3:
        return selectedFinger !== null
      default:
        return false
    }
  }

  const handleNext = async () => {
    if (canProceed() && currentStep < 4) {
      if (currentStep === 3) {
        const personId = isTeacherMode ? selectedTeacher?.id : selectedStudent?.id
        if (onStartEnrollment && personId != null && selectedDevice && selectedFinger !== null) {
          setIsStartingEnrollment(true)
          try {
            const payload = isTeacherMode
              ? { teacherId: selectedTeacher!.id, deviceId: selectedDevice.id, fingerId: selectedFinger }
              : { studentId: selectedStudent!.id, deviceId: selectedDevice.id, fingerId: selectedFinger }
            const response = await onStartEnrollment(payload)
            if (response) {
              setEnrollmentSession(response)
              setIsCapturing(true)
              setCurrentStep(currentStep + 1)
            }
          } catch (error) {
            console.error("Failed to start enrollment:", error)
          } finally {
            setIsStartingEnrollment(false)
          }
        } else {
          setIsCapturing(true)
          setCurrentStep(currentStep + 1)
        }
      } else {
        setCurrentStep(currentStep + 1)
      }
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
      setIsCapturing(false)
      setEnrollmentSession(null)
    }
  }

  const handleEnrollmentComplete = () => {
    setCurrentStep(1)
    setSelectedStudent(null)
    setSelectedTeacher(null)
    setSelectedDevice(null)
    setSelectedFinger(null)
    setIsCapturing(false)
    setEnrollmentSession(null)
  }

  const handleEnrollAnother = () => {
    setCurrentStep(3)
    setSelectedFinger(null)
    setIsCapturing(false)
  }

  const getStepStatus = (stepId: number) => {
    if (stepId < currentStep) return "completed"
    if (stepId === currentStep) return "active"
    return "pending"
  }

  const fingerInfo = selectedFinger !== null ? FINGERS.find((f) => f.id === selectedFinger) : null

  const clearStudent = () => {
    setSelectedStudent(null)
    setSelectedDevice(null)
    setSelectedFinger(null)
    setCurrentStep(1)
  }

  const clearTeacher = () => {
    setSelectedTeacher(null)
    setSelectedDevice(null)
    setSelectedFinger(null)
    setCurrentStep(1)
  }

  const clearDevice = () => {
    setSelectedDevice(null)
    setSelectedFinger(null)
    setSyncStatus(null)
    setSyncError(null)
    if (currentStep > 2) setCurrentStep(2)
  }

  const clearFinger = () => {
    setSelectedFinger(null)
    if (currentStep > 3) setCurrentStep(3)
  }

  return (
    <div className="w-full">
      {/* Step Indicator */}
      <nav aria-label="Enrollment progress" className="mb-6">
        <ol className="flex items-center">
          {STEPS.map((step, index) => {
            const status = getStepStatus(step.id);
            const isLast = index === STEPS.length - 1;

            return (
              <li key={step.id} className={cn('flex items-center', !isLast && 'flex-1')}>
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "flex items-center justify-center size-10 sm:size-12 rounded-full border-2 transition-all",
                      status === "completed" && "bg-blue-600 border-blue-600 text-white",
                      status === "active" && "bg-blue-50 border-blue-600 text-blue-600 ring-4 ring-blue-600/20 dark:bg-blue-900/30",
                      status === "pending" && "bg-gray-100 border-gray-300 text-gray-400 dark:bg-gray-800 dark:border-gray-700",
                    )}
                  >
                    {status === "completed" ? <Check className="size-5" /> : <step.icon className="size-5" />}
                  </div>
                  <span
                    className={cn(
                      "mt-1.5 text-[10px] sm:text-xs font-bold text-center hidden sm:block uppercase tracking-wider",
                      status === "active" && "text-blue-600 dark:text-blue-400",
                      status === "completed" && "text-gray-900 dark:text-gray-100",
                      status === "pending" && "text-gray-500 dark:text-gray-400",
                    )}
                  >
                    {step.name}
                  </span>
                </div>

                {!isLast && (
                  <div
                    className={cn(
                      "flex-1 h-0.5 mx-2 sm:mx-4 transition-colors",
                      status === "completed" ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-700",
                    )}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Selected Items Display */}
      {currentStep > 1 && (
        <div className="mb-4 p-3 bg-gradient-to-r from-blue-50/50 via-indigo-50/50 to-purple-50/50 dark:from-gray-800/50 dark:via-gray-800/50 dark:to-gray-800/50 rounded-xl border border-blue-200/50 dark:border-gray-700">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mr-1">Selected:</span>

            {/* Student chip with popover */}
            {selectedStudent && !isTeacherMode && (
              <Popover>
                <PopoverTrigger asChild>
                  <div
                    className={cn(
                      'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer group',
                      'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 hover:border-blue-500/50 hover:bg-blue-50 dark:hover:bg-blue-900/20',
                    )}
                  >
                    <div className="flex items-center justify-center size-5 rounded-full bg-blue-600/20 text-blue-600 text-xs font-bold">
                      {selectedStudent.first_name[0]}
                    </div>
                    <span className="max-w-[120px] truncate">
                      {selectedStudent.first_name} {selectedStudent.last_name}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        clearStudent()
                      }}
                      className="hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full p-0.5 transition-colors"
                      aria-label="Clear student selection"
                    >
                      <X className="size-3.5 text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100" />
                    </button>
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0" align="start">
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center size-10 rounded-full bg-blue-600/10 text-blue-600 font-bold">
                        {selectedStudent.first_name[0]}
                        {selectedStudent.last_name[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">
                          {selectedStudent.first_name} {selectedStudent.last_name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Student</p>
                      </div>
                    </div>
                    <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2 text-sm">
                        <Hash className="size-4 text-gray-500 dark:text-gray-400" />
                        <span className="text-gray-500 dark:text-gray-400">ID:</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">{selectedStudent.admission_number}</span>
                      </div>
                      {selectedStudent.class_id && (
                        <div className="flex items-center gap-2 text-sm">
                          <GraduationCap className="size-4 text-gray-500 dark:text-gray-400" />
                          <span className="text-gray-500 dark:text-gray-400">Class:</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">Class {selectedStudent.class_id}</span>
                        </div>
                      )}
                      {/* TODO: Add enrolled fingers count when API is ready */}
                    </div>
                  </div>
                  <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={clearStudent}
                      className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    >
                      Change student
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* Teacher chip with popover */}
            {selectedTeacher && isTeacherMode && (
              <Popover>
                <PopoverTrigger asChild>
                  <div
                    className={cn(
                      'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer group',
                      'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 hover:border-indigo-500/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20',
                    )}
                  >
                    <div className="flex items-center justify-center size-5 rounded-full bg-indigo-600/20 text-indigo-600 text-xs font-bold">
                      {selectedTeacher.first_name[0]}
                    </div>
                    <span className="max-w-[120px] truncate">
                      {selectedTeacher.first_name} {selectedTeacher.last_name}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        clearTeacher()
                      }}
                      className="hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full p-0.5 transition-colors"
                      aria-label="Clear teacher selection"
                    >
                      <X className="size-3.5 text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100" />
                    </button>
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0" align="start">
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center size-10 rounded-full bg-indigo-600/10 text-indigo-600 font-bold">
                        {selectedTeacher.first_name[0]}
                        {selectedTeacher.last_name[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">
                          {selectedTeacher.first_name} {selectedTeacher.last_name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Teacher</p>
                      </div>
                    </div>
                    <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                      {selectedTeacher.employee_id && (
                        <div className="flex items-center gap-2 text-sm">
                          <Hash className="size-4 text-gray-500 dark:text-gray-400" />
                          <span className="text-gray-500 dark:text-gray-400">ID:</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">{selectedTeacher.employee_id}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={clearTeacher}
                      className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    >
                      Change teacher
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* Device chip with popover */}
            {selectedDevice && currentStep > 2 && (
              <Popover>
                <PopoverTrigger asChild>
                  <div
                    className={cn(
                      'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer group',
                      'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 hover:border-blue-500/50 hover:bg-blue-50 dark:hover:bg-blue-900/20',
                    )}
                  >
                    <Server className="size-4 text-green-600 dark:text-green-400" />
                    <span className="max-w-[100px] truncate">{selectedDevice.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        clearDevice()
                      }}
                      className="hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full p-0.5 transition-colors"
                      aria-label="Clear device selection"
                    >
                      <X className="size-3.5 text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100" />
                    </button>
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0" align="start">
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center size-10 rounded-lg bg-green-600/10 text-green-600">
                        <Server className="size-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{selectedDevice.name}</p>
                          <DeviceStatusBadge status={selectedDevice.status} />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                      {selectedDevice.location && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="size-4 text-gray-500 dark:text-gray-400" />
                          <span className="text-gray-500 dark:text-gray-400">Location:</span>
                          <span className="font-medium text-xs text-gray-900 dark:text-gray-100">{selectedDevice.location}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm">
                        <Wifi className="size-4 text-gray-500 dark:text-gray-400" />
                        <span className="text-gray-500 dark:text-gray-400">IP:</span>
                        <span className="font-medium font-mono text-xs text-gray-900 dark:text-gray-100">
                          {selectedDevice.ip_address}:{selectedDevice.port}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={clearDevice}
                      className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    >
                      Change device
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* Finger chip with popover */}
            {fingerInfo && currentStep > 3 && (
              <Popover>
                <PopoverTrigger asChild>
                  <div
                    className={cn(
                      'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer group',
                      'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 hover:border-blue-500/50 hover:bg-blue-50 dark:hover:bg-blue-900/20',
                    )}
                  >
                    <Fingerprint className="size-4 text-blue-600 dark:text-blue-400" />
                    <span>{fingerInfo.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        clearFinger()
                      }}
                      className="hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full p-0.5 transition-colors"
                      aria-label="Clear finger selection"
                    >
                      <X className="size-3.5 text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100" />
                    </button>
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-0" align="start">
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center size-10 rounded-lg bg-blue-600/10 text-blue-600">
                        <Fingerprint className="size-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">{fingerInfo.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Selected for enrollment</p>
                      </div>
                    </div>
                    <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2 text-sm">
                        <Hand className="size-4 text-gray-500 dark:text-gray-400" />
                        <span className="text-gray-500 dark:text-gray-400">Hand:</span>
                        <span className="font-medium capitalize text-gray-900 dark:text-gray-100">{fingerInfo.hand}</span>
                      </div>
                      {fingerInfo.recommended && (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                            Recommended
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={clearFinger}
                      className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    >
                      Change finger
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
      )}

      {/* Step Content */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-lg overflow-hidden">
        <div className="p-6 sm:p-8">
          {/* Step Header */}
          {currentStep < 4 && (
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">{STEPS[currentStep - 1].name}</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">{STEPS[currentStep - 1].description}</p>
            </div>
          )}

          {/* Step 1: Student or Teacher Selection */}
          {currentStep === 1 && (
            isTeacherMode ? (
              <TeacherSelector selectedTeacher={selectedTeacher} onSelect={setSelectedTeacher} />
            ) : (
              <StudentSelector selectedStudent={selectedStudent} onSelect={setSelectedStudent} />
            )
          )}

          {/* Step 2: Device Selection */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <DeviceSelector selectedDevice={selectedDevice} onSelect={setSelectedDevice} />
              {((isTeacherMode && selectedTeacher) || (!isTeacherMode && selectedStudent)) && selectedDevice && selectedDevice.status === "online" && (
                <>
                  {isCheckingSync && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                      <Loader2 className="size-4 animate-spin" />
                      {isTeacherMode ? "Checking if teacher is synced..." : "Checking if student is synced..."}
                    </div>
                  )}
                  {!isCheckingSync && syncStatus && !syncStatus.synced && (
                    <Alert
                      variant="default"
                      className="border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-900/20 dark:border-yellow-500/50"
                    >
                      <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                      <AlertDescription>
                        <div className="space-y-3">
                          <p className="font-medium text-yellow-800 dark:text-yellow-200">
                            {isTeacherMode
                              ? "Teacher is not synced to this device. Would you like to sync now?"
                              : "Student is not synced to this device. Would you like to sync now?"}
                          </p>
                          {syncError && (
                            <p className="text-sm text-red-600 dark:text-red-400">{syncError}</p>
                          )}
                          <div className="flex gap-3 mt-2">
                            <Button
                              size="sm"
                              onClick={isTeacherMode ? handleSyncTeacher : handleSyncStudent}
                              disabled={isSyncing}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              {isSyncing ? (
                                <>
                                  <Loader2 className="mr-2 size-4 animate-spin" />
                                  Syncing...
                                </>
                              ) : isTeacherMode ? (
                                "Sync Teacher"
                              ) : (
                                "Sync Student"
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={clearDevice}
                              disabled={isSyncing}
                            >
                              Choose Different Device
                            </Button>
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}
            </div>
          )}

          {/* Step 3: Finger Selection */}
          {currentStep === 3 && (
            <FingerSelector
              selectedFinger={selectedFinger}
              onSelect={setSelectedFinger}
              student={isTeacherMode ? undefined : selectedStudent}
              deviceId={selectedDevice?.id}
            />
          )}

          {/* Step 4: Capture */}
          {currentStep === 4 && selectedDevice && selectedFinger !== null && (isTeacherMode ? selectedTeacher : selectedStudent) && (
            <EnrollmentCapture
              student={isTeacherMode ? undefined : selectedStudent ?? undefined}
              teacher={isTeacherMode ? selectedTeacher ?? undefined : undefined}
              device={selectedDevice}
              fingerId={selectedFinger}
              sessionId={enrollmentSession?.session_id}
              onComplete={handleEnrollmentComplete}
              onRetry={handleEnrollAnother}
              onCancel={handlePrevious}
            />
          )}
        </div>

        {/* Navigation Footer */}
        {currentStep < 4 && (
          <div className="flex items-center justify-between px-6 sm:px-8 py-4 bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-gray-800/30 dark:to-gray-800/30 border-t border-gray-200 dark:border-gray-700">
            <Button variant="ghost" onClick={handlePrevious} disabled={currentStep === 1} className="gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
              <ChevronLeft className="size-4" />
              Back
            </Button>

            <Button onClick={handleNext} disabled={!canProceed() || isStartingEnrollment} className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all">
              {isStartingEnrollment ? (
                <>
                  Starting Enrollment...
                  <Loader2 className="size-4 animate-spin" />
                </>
              ) : currentStep === 3 ? (
                <>
                  Start Capture
                  <Play className="size-4" />
                </>
              ) : (
                <>
                  Continue
                  <ChevronRight className="size-4" />
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

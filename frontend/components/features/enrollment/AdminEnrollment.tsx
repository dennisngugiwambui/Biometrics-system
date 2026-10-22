"use client"

import { useState, useEffect, useMemo } from "react"
import {
  ShieldCheck,
  Server,
  Fingerprint,
  CreditCard,
  Play,
  ChevronRight,
  ChevronLeft,
  Check,
  Search,
  UserPlus,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { DeviceSelector } from "./DeviceSelector"
import { FingerSelector } from "./FingerSelector"
import { EnrollmentCapture } from "./EnrollmentCapture"
import { listUsers, createAdminUser, type UserResponse } from "@/lib/api/auth"
import { startAdminEnrollment, EnrollmentApiError } from "@/lib/api/enrollment"
import type { DeviceResponse } from "@/lib/api/devices"

const STEPS = [
  { id: 1, name: "Select Admin", icon: ShieldCheck, description: "Choose or add a device administrator" },
  { id: 2, name: "Choose Device", icon: Server, description: "Select biometric scanner" },
  { id: 3, name: "Credential", icon: Fingerprint, description: "Enroll by fingerprint or card" },
  { id: 4, name: "Capture", icon: Play, description: "Complete enrollment" },
]

type CredentialMode = "fingerprint" | "card"

export function AdminEnrollment() {
  const [currentStep, setCurrentStep] = useState(1)
  const [admins, setAdmins] = useState<UserResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selectedAdmin, setSelectedAdmin] = useState<UserResponse | null>(null)
  const [selectedDevice, setSelectedDevice] = useState<DeviceResponse | null>(null)
  const [credentialMode, setCredentialMode] = useState<CredentialMode>("fingerprint")
  const [selectedFinger, setSelectedFinger] = useState<number | null>(null)
  const [cardNumber, setCardNumber] = useState("")
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Add-admin inline form
  const [showAddForm, setShowAddForm] = useState(false)
  const [newAdmin, setNewAdmin] = useState({ first_name: "", last_name: "", email: "", password: "" })
  const [isCreating, setIsCreating] = useState(false)

  const loadAdmins = () => {
    setIsLoading(true)
    listUsers()
      .then(setAdmins)
      .catch(() => setAdmins([]))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    loadAdmins()
  }, [])

  const filteredAdmins = useMemo(() => {
    if (!search.trim()) return admins
    const q = search.toLowerCase()
    return admins.filter(
      (a) =>
        a.first_name.toLowerCase().includes(q) ||
        a.last_name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q)
    )
  }, [admins, search])

  const handleCreateAdmin = async () => {
    if (!newAdmin.first_name || !newAdmin.last_name || !newAdmin.email || !newAdmin.password) {
      toast.error("Please fill in all fields")
      return
    }
    setIsCreating(true)
    try {
      const created = await createAdminUser(newAdmin)
      toast.success("Admin created")
      setAdmins((prev) => [created, ...prev])
      setSelectedAdmin(created)
      setShowAddForm(false)
      setNewAdmin({ first_name: "", last_name: "", email: "", password: "" })
    } catch (err) {
      toast.error("Failed to create admin", {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setIsCreating(false)
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return selectedAdmin !== null
      case 2:
        return selectedDevice !== null && selectedDevice.status === "online"
      case 3:
        return credentialMode === "fingerprint" ? selectedFinger !== null : cardNumber.trim().length > 0
      default:
        return false
    }
  }

  const resetAll = () => {
    setCurrentStep(1)
    setSelectedAdmin(null)
    setSelectedDevice(null)
    setCredentialMode("fingerprint")
    setSelectedFinger(null)
    setCardNumber("")
    setSessionId(null)
  }

  const handleNext = async () => {
    if (!canProceed()) return
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1)
      return
    }
    // Step 3 -> start enrollment
    if (!selectedAdmin || !selectedDevice) return
    setIsSubmitting(true)
    try {
      const response = await startAdminEnrollment({
        admin_user_id: selectedAdmin.id,
        device_id: selectedDevice.id,
        credential_mode: credentialMode,
        finger_id: credentialMode === "fingerprint" ? selectedFinger : null,
        card_number: credentialMode === "card" ? cardNumber.trim() : null,
      })

      if (credentialMode === "card") {
        toast.success("Admin card enrolled", {
          description: "The admin card is programmed on the device with admin privileges.",
        })
        resetAll()
      } else {
        setSessionId(response.session_id)
        setCurrentStep(4)
        toast.success("Admin enrollment started", {
          description: "The device is waiting for the admin to place their finger.",
        })
      }
    } catch (err) {
      const message =
        err instanceof EnrollmentApiError ? err.message : "Failed to start admin enrollment"
      toast.error("Enrollment Failed", { description: message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
      setSessionId(null)
    }
  }

  const getStepStatus = (stepId: number) => {
    if (stepId < currentStep) return "completed"
    if (stepId === currentStep) return "active"
    return "pending"
  }

  return (
    <div className="w-full">
      {/* Step Indicator */}
      <nav aria-label="Admin enrollment progress" className="mb-6">
        <ol className="flex items-center">
          {STEPS.map((step, index) => {
            const status = getStepStatus(step.id)
            const isLast = index === STEPS.length - 1
            return (
              <li key={step.id} className={cn("flex items-center", !isLast && "flex-1")}>
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "flex items-center justify-center size-10 sm:size-12 rounded-full border-2 transition-all",
                      status === "completed" && "bg-amber-600 border-amber-600 text-white",
                      status === "active" && "bg-amber-50 border-amber-600 text-amber-600 ring-4 ring-amber-600/20 dark:bg-amber-900/30",
                      status === "pending" && "bg-gray-100 border-gray-300 text-gray-400 dark:bg-gray-800 dark:border-gray-700"
                    )}
                  >
                    {status === "completed" ? <Check className="size-5" /> : <step.icon className="size-5" />}
                  </div>
                  <span
                    className={cn(
                      "mt-1.5 text-[10px] sm:text-xs font-bold text-center hidden sm:block uppercase tracking-wider",
                      status === "active" && "text-amber-600 dark:text-amber-400",
                      status === "completed" && "text-gray-900 dark:text-gray-100",
                      status === "pending" && "text-gray-500 dark:text-gray-400"
                    )}
                  >
                    {step.name}
                  </span>
                </div>
                {!isLast && (
                  <div
                    className={cn(
                      "flex-1 h-0.5 mx-2 sm:mx-4 transition-colors",
                      status === "completed" ? "bg-amber-600" : "bg-gray-300 dark:bg-gray-700"
                    )}
                  />
                )}
              </li>
            )
          })}
        </ol>
      </nav>

      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-lg overflow-hidden">
        <div className="p-6 sm:p-8">
          {currentStep < 4 && (
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-600">
                {STEPS[currentStep - 1].name}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">{STEPS[currentStep - 1].description}</p>
            </div>
          )}

          {/* Step 1: Select / Add admin */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-500 dark:text-gray-400" />
                  <Input
                    placeholder="Search by name or email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 bg-white dark:bg-gray-800"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddForm((v) => !v)}
                  className="gap-2 shrink-0"
                >
                  <UserPlus className="size-4" />
                  Add Admin
                </Button>
              </div>

              {showAddForm && (
                <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      placeholder="First name"
                      value={newAdmin.first_name}
                      onChange={(e) => setNewAdmin({ ...newAdmin, first_name: e.target.value })}
                    />
                    <Input
                      placeholder="Last name"
                      value={newAdmin.last_name}
                      onChange={(e) => setNewAdmin({ ...newAdmin, last_name: e.target.value })}
                    />
                    <Input
                      type="email"
                      placeholder="Email"
                      value={newAdmin.email}
                      onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                    />
                    <Input
                      type="password"
                      placeholder="Password"
                      value={newAdmin.password}
                      onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleCreateAdmin}
                      disabled={isCreating}
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      {isCreating ? <Loader2 className="size-4 animate-spin" /> : "Create Admin"}
                    </Button>
                  </div>
                </div>
              )}

              <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800">
                <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                      <Loader2 className="size-8 mb-3 animate-spin opacity-50" />
                      <p className="text-sm">Loading admins...</p>
                    </div>
                  ) : filteredAdmins.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                      <ShieldCheck className="size-10 mb-3 opacity-40" />
                      <p className="text-sm">No admins found. Add one above.</p>
                    </div>
                  ) : (
                    filteredAdmins.map((admin) => {
                      const isSelected = selectedAdmin?.id === admin.id
                      return (
                        <button
                          key={admin.id}
                          onClick={() => setSelectedAdmin(admin)}
                          className={cn(
                            "w-full flex items-center gap-4 p-4 text-left transition-all",
                            isSelected
                              ? "bg-amber-50 ring-2 ring-inset ring-amber-600 dark:bg-amber-900/30 dark:ring-amber-500"
                              : "hover:bg-amber-50/50 dark:hover:bg-gray-700/50"
                          )}
                        >
                          <div
                            className={cn(
                              "flex items-center justify-center size-12 rounded-full font-semibold text-sm shrink-0",
                              isSelected ? "bg-amber-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                            )}
                          >
                            {admin.first_name[0]}
                            {admin.last_name[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={cn(
                                "font-medium truncate",
                                isSelected ? "text-amber-700 dark:text-amber-400" : "text-gray-900 dark:text-gray-100"
                              )}
                            >
                              {admin.first_name} {admin.last_name}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">{admin.email}</p>
                          </div>
                          {isSelected && <Check className="size-5 text-amber-600 shrink-0" />}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Device */}
          {currentStep === 2 && (
            <DeviceSelector selectedDevice={selectedDevice} onSelect={setSelectedDevice} />
          )}

          {/* Step 3: Credential */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 max-w-md">
                <button
                  type="button"
                  onClick={() => setCredentialMode("fingerprint")}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                    credentialMode === "fingerprint"
                      ? "border-amber-600 bg-amber-50 dark:bg-amber-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-amber-300"
                  )}
                >
                  <Fingerprint className="size-6 text-amber-600" />
                  <span className="text-sm font-semibold">Fingerprint</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCredentialMode("card")}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                    credentialMode === "card"
                      ? "border-amber-600 bg-amber-50 dark:bg-amber-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-amber-300"
                  )}
                >
                  <CreditCard className="size-6 text-amber-600" />
                  <span className="text-sm font-semibold">Access Card</span>
                </button>
              </div>

              {credentialMode === "fingerprint" ? (
                <FingerSelector selectedFinger={selectedFinger} onSelect={setSelectedFinger} />
              ) : (
                <div className="space-y-2 max-w-md">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Card number</label>
                  <Input
                    placeholder="Tap card or enter card UID"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="bg-white dark:bg-gray-800"
                  />
                  <p className="text-xs text-muted-foreground">
                    The card is programmed on the device with admin privileges.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Capture (fingerprint only) */}
          {currentStep === 4 && selectedDevice && selectedAdmin && selectedFinger !== null && (
            <EnrollmentCapture
              device={selectedDevice}
              fingerId={selectedFinger}
              sessionId={sessionId ?? undefined}
              personName={`${selectedAdmin.first_name} ${selectedAdmin.last_name}`}
              personLabel="Admin"
              onComplete={resetAll}
              onRetry={() => {
                setSelectedFinger(null)
                setSessionId(null)
                setCurrentStep(3)
              }}
              onCancel={handlePrevious}
            />
          )}
        </div>

        {/* Footer */}
        {currentStep < 4 && (
          <div className="flex items-center justify-between px-6 sm:px-8 py-4 bg-gradient-to-r from-amber-50/50 to-orange-50/50 dark:from-gray-800/30 dark:to-gray-800/30 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="ghost"
              onClick={handlePrevious}
              disabled={currentStep === 1}
              className="gap-2 text-gray-600 dark:text-gray-400"
            >
              <ChevronLeft className="size-4" />
              Back
            </Button>
            <Button
              onClick={handleNext}
              disabled={!canProceed() || isSubmitting}
              className="gap-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white shadow-lg"
            >
              {isSubmitting ? (
                <>
                  Starting...
                  <Loader2 className="size-4 animate-spin" />
                </>
              ) : currentStep === 3 ? (
                <>
                  {credentialMode === "card" ? "Enroll Card" : "Start Capture"}
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

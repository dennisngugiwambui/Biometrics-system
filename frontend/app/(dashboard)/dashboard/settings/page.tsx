"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Lock,
  School,
  Palette,
  ImageIcon,
  RotateCcw,
  Upload,
  Trash2,
  Eye,
  MessageSquare,
  ArrowRight,
  MapPin,
  Smartphone,
  Download,
  Copy,
} from "lucide-react"
import { useAuthStore } from "@/lib/store/authStore"
import { getApiBaseUrlOrFallback } from "@/lib/env"
import {
  getMySchool,
  updateMySchool,
  parseMapsUrl,
  type SchoolResponse,
  type SchoolUpdateData,
  type NotificationSettingsApi,
  SchoolRegistrationError,
} from "@/lib/api/schools"
import { fadeInUp, staggerContainer } from "@/lib/animations/framer-motion"
import { useSchoolBrandingStore, DEFAULT_SCHOOL_COLORS } from "@/lib/store/schoolBrandingStore"

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
}

const alertVariants = {
  initial: { opacity: 0, y: -10, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: "easeOut" } },
  exit: { opacity: 0, y: -10, scale: 0.95, transition: { duration: 0.2 } },
}

function FormField({ children, index }: { children: React.ReactNode; index: number }) {
  return (
    <motion.div variants={fadeInUp} initial="initial" animate="animate" transition={{ delay: index * 0.06 }}>
      {children}
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Color names for the 5 slots
// ---------------------------------------------------------------------------

const COLOR_LABELS = [
  { label: "Primary", description: "Main brand color – used for buttons, active items" },
  { label: "Secondary", description: "Supporting color – used for secondary elements" },
  { label: "Accent", description: "Highlight color – used for focus rings, accents" },
  { label: "Success", description: "Positive state color" },
  { label: "Warning / Highlight", description: "Warning or highlight color" },
]

// ---------------------------------------------------------------------------
// Main settings page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const { token } = useAuthStore()
  const [isLoading, setIsLoading] = useState(true)
  const [school, setSchool] = useState<SchoolResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  // School info form
  const [formData, setFormData] = useState<SchoolUpdateData>({
    name: "",
    address: null,
    phone: null,
    email: null,
    school_type: "mixed",
    geofence_lat: null,
    geofence_lng: null,
    geofence_radius_m: 150,
  })
  const [originalData, setOriginalData] = useState<SchoolUpdateData>(formData)
  const [isSaving, setIsSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [showError, setShowError] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [mapsUrlInput, setMapsUrlInput] = useState("")
  const [mapsUrlError, setMapsUrlError] = useState<string | null>(null)
  const [isResolvingMapsUrl, setIsResolvingMapsUrl] = useState(false)
  const [serverIp, setServerIp] = useState<string | null>(null)
  const [loadingServerIp, setLoadingServerIp] = useState(false)

  // Branding store (synced from API so same on any device/IP)
  const { colors, logoDataUrl, loginBgDataUrl, setColors, setLogo, setLoginBg, setSchoolName, resetColors } = useSchoolBrandingStore()
  const [draftColors, setDraftColors] = useState<string[]>(colors)
  const [brandingSaved, setBrandingSaved] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const loginBgInputRef = useRef<HTMLInputElement>(null)

  // Sync draft colors when store changes externally
  useEffect(() => {
    setDraftColors(colors)
  }, [colors])

  // Fetch school data
  useEffect(() => {
    if (!token) return

    const fetchSchool = async () => {
      try {
        setIsLoading(true)
        const schoolData = await getMySchool(token)
        setSchool(schoolData)
        if (schoolData.branding) {
          if (schoolData.branding.logoDataUrl != null) setLogo(schoolData.branding.logoDataUrl)
          if (schoolData.branding.loginBgDataUrl != null) setLoginBg(schoolData.branding.loginBgDataUrl)
          if (schoolData.branding.colors?.length) setColors(schoolData.branding.colors)
        }
        const ns = schoolData.notification_settings
        const initialData: SchoolUpdateData = {
          name: schoolData.name,
          address: schoolData.address || null,
          phone: schoolData.phone || null,
          email: schoolData.email || null,
          school_type: schoolData.school_type || "mixed",
          geofence_lat: schoolData.geofence_lat ?? null,
          geofence_lng: schoolData.geofence_lng ?? null,
          geofence_radius_m: schoolData.geofence_radius_m ?? 150,
          notification_settings: ns
            ? {
              provider: ns.provider ?? "africas_talking",
              api_key: ns.api_key ?? null,
              sender_id: ns.sender_id ?? null,
              username: ns.username ?? null,
              templates: ns.templates ?? {
                student_checkin: "{{student_name}} checked IN at {{time}}. - {{school_name}}",
                student_checkout: "{{student_name}} checked OUT at {{time}}. - {{school_name}}",
                teacher_weekly_reminder:
                  "Weekly attendance: You were present {{present_days}}/{{total_days}} days ({{percentage}}%). - {{school_name}}",
              },
            }
            : undefined,
        }
        setFormData(initialData)
        setOriginalData(initialData)
      } catch (err) {
        console.error("Failed to fetch school data:", err)
        setError("Failed to load school information")
      } finally {
        setIsLoading(false)
      }
    }

    fetchSchool()
  }, [token])

  // -------------------------------------------------------------------------
  // School info handlers
  // -------------------------------------------------------------------------

  const handleInputChange = (field: keyof SchoolUpdateData, value: string | null) => {
    setFormData((prev) => ({ ...prev, [field]: value || null }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }))
    setShowSuccess(false)
    setShowError(false)
  }

  const handleNotificationSettingsChange = (
    key: keyof NotificationSettingsApi,
    value: string | Record<string, string> | null
  ) => {
    setFormData((prev) => ({
      ...prev,
      notification_settings: {
        ...(prev.notification_settings || {}),
        [key]: value ?? undefined,
      },
    }))
    setShowSuccess(false)
    setShowError(false)
  }

  const handleSchoolTypeChange = (val: "day" | "boarding" | "mixed") => {
    setFormData((prev) => ({ ...prev, school_type: val }))
    setShowSuccess(false)
    setShowError(false)
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.name?.trim()) newErrors.name = "School name is required"
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      newErrors.email = "Please enter a valid email address"
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm() || !token || !school) return
    setIsSaving(true)
    setShowSuccess(false)
    setShowError(false)
    setErrors({})

    try {
      const updateData: SchoolUpdateData = {
        name: formData.name,
        address: formData.address || null,
        phone: formData.phone || null,
        email: formData.email || null,
        school_type: formData.school_type || "mixed",
        geofence_lat: formData.geofence_lat ?? null,
        geofence_lng: formData.geofence_lng ?? null,
        geofence_radius_m: formData.geofence_radius_m ?? 150,
        notification_settings: formData.notification_settings ?? undefined,
      }
      const updatedSchool = await updateMySchool(token, updateData)
      setSchool(updatedSchool)
      setOriginalData({
        name: updatedSchool.name,
        address: updatedSchool.address || null,
        phone: updatedSchool.phone || null,
        email: updatedSchool.email || null,
        school_type: updatedSchool.school_type || "mixed",
        geofence_lat: updatedSchool.geofence_lat ?? null,
        geofence_lng: updatedSchool.geofence_lng ?? null,
        geofence_radius_m: updatedSchool.geofence_radius_m ?? 150,
        notification_settings: updatedSchool.notification_settings ?? undefined,
      })
      // Sync name to branding store
      if (updatedSchool.name) setSchoolName(updatedSchool.name)
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 5000)
    } catch (err) {
      console.error("Failed to update school:", err)
      if (err instanceof SchoolRegistrationError) {
        if (err.fieldErrors) setErrors(err.fieldErrors)
        setShowError(true)
        setError(err.message)
      } else {
        setShowError(true)
        setError("Failed to update school information. Please try again.")
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setFormData(originalData)
    setErrors({})
    setShowSuccess(false)
    setShowError(false)
  }

  const hasChanges = JSON.stringify(formData) !== JSON.stringify(originalData)

  const applyLocation = (lat: number, lng: number, address?: string | null) => {
    setFormData((prev) => ({
      ...prev,
      geofence_lat: lat,
      geofence_lng: lng,
      geofence_radius_m: 150,
      ...(address ? { address: address } : {}),
    }))
  }

  const handleUseMapsLocation = async () => {
    const url = mapsUrlInput.trim()
    if (!url || !token) return
    setMapsUrlError(null)
    setIsResolvingMapsUrl(true)
    try {
      const result = await parseMapsUrl(token, url)
      applyLocation(result.lat, result.lng, result.formatted_address)
      setMapsUrlInput("")
    } catch (err) {
      setMapsUrlError(err instanceof SchoolRegistrationError ? err.message : "Could not resolve map URL")
    } finally {
      setIsResolvingMapsUrl(false)
    }
  }

  // -------------------------------------------------------------------------
  // Branding handlers
  // -------------------------------------------------------------------------

  const handleColorChange = (index: number, value: string) => {
    const next = [...draftColors]
    next[index] = value
    setDraftColors(next)
  }

  const handleSaveBranding = async () => {
    setColors(draftColors)
    setBrandingSaved(true)
    setTimeout(() => setBrandingSaved(false), 3000)
    if (!token) return
    try {
      const state = useSchoolBrandingStore.getState()
      await updateMySchool(token, {
        branding: {
          logoDataUrl: state.logoDataUrl ?? null,
          loginBgDataUrl: state.loginBgDataUrl ?? null,
          colors: draftColors,
        },
      })
    } catch {
      // Non-blocking: store is updated; server sync failed
    }
  }

  const handleResetColors = () => {
    setDraftColors(DEFAULT_SCHOOL_COLORS)
    resetColors()
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file.")
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      alert("Image must be smaller than 2 MB.")
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      setLogo(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveLogo = () => {
    setLogo(null)
    if (logoInputRef.current) logoInputRef.current.value = ""
  }

  const handleLoginBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file.")
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      alert("Image must be smaller than 4 MB.")
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      setLoginBg(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveLoginBg = () => {
    setLoginBg(null)
    if (loginBgInputRef.current) loginBgInputRef.current.value = ""
  }

  // Persist branding to server when logo or login bg changes (debounced) so it syncs across devices
  useEffect(() => {
    if (!token) return
    const t = setTimeout(() => {
      const state = useSchoolBrandingStore.getState()
      updateMySchool(token, {
        branding: {
          logoDataUrl: state.logoDataUrl ?? null,
          loginBgDataUrl: state.loginBgDataUrl ?? null,
          colors: state.colors,
        },
      }).catch(() => { })
    }, 1500)
    return () => clearTimeout(t)
  }, [token, logoDataUrl, loginBgDataUrl])

  // -------------------------------------------------------------------------
  // Preview strip
  // -------------------------------------------------------------------------

  const PreviewStrip = () => (
    <div className="flex items-center gap-2 flex-wrap">
      {draftColors.map((c, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <div
            className="h-8 w-8 rounded-lg border-2 border-white shadow-md transition-transform hover:scale-110"
            style={{ backgroundColor: c }}
            title={COLOR_LABELS[i]?.label}
          />
          <span className="text-[10px] text-muted-foreground">{COLOR_LABELS[i]?.label}</span>
        </div>
      ))}
      {/* Gradient preview */}
      <div
        className="ml-2 h-8 w-24 rounded-lg border-2 border-white shadow-md"
        style={{
          background: `linear-gradient(135deg, ${draftColors[0]}, ${draftColors[1] || draftColors[0]}, ${draftColors[2] || draftColors[0]})`,
        }}
        title="Gradient preview"
      />
    </div>
  )

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full"
          />
          <p className="text-sm text-muted-foreground">Loading school information...</p>
        </motion.div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <motion.main
      variants={pageVariants}
      initial="initial"
      animate="animate"
      className="flex-1 p-4 sm:p-6 lg:p-8"
    >
      <div className="w-full space-y-8">
        {/* Page Header */}
        <motion.div variants={fadeInUp} className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">School Settings</h2>
          <p className="text-muted-foreground">Manage your school's information, colours, and branding</p>
        </motion.div>

        {/* Alerts */}
        <AnimatePresence mode="wait">
          {showSuccess && (
            <motion.div key="success" variants={alertVariants} initial="initial" animate="animate" exit="exit">
              <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <AlertTitle className="text-emerald-800 dark:text-emerald-200">Success</AlertTitle>
                <AlertDescription className="text-emerald-700 dark:text-emerald-300">
                  School information updated successfully.
                </AlertDescription>
              </Alert>
            </motion.div>
          )}
          {showError && (
            <motion.div key="error" variants={alertVariants} initial="initial" animate="animate" exit="exit">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Something went wrong</AlertTitle>
                <AlertDescription>{error || "We couldn't save your changes. Please try again."}</AlertDescription>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ------------------------------------------------------------------ */}
        {/* School Information Card                                             */}
        {/* ------------------------------------------------------------------ */}
        {school && (
          <motion.div variants={staggerContainer} initial="initial" animate="animate">
            <Card className="glass-panel shadow-premium bevel-card border-white/10 overflow-hidden">
              <div className="h-1.5 w-full bg-gradient-to-r from-primary/40 via-primary to-primary/40" />
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg font-bold">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-inner-bevel">
                    <School className="h-5 w-5" />
                  </div>
                  <span className="bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/70">
                    School Information
                  </span>
                </CardTitle>
                <CardDescription className="text-muted-foreground/80">Update your school's profile details and core identity.</CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* School Name */}
                <FormField index={0}>
                  <div className="space-y-2">
                    <Label htmlFor="school-name" className="text-sm font-medium">
                      School Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="school-name"
                      value={formData.name || ""}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      disabled={isSaving}
                      placeholder="Enter school name"
                      className={errors.name ? "border-destructive focus-visible:ring-destructive" : ""}
                    />
                    {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                  </div>
                </FormField>

                {/* School Code (Read-only) */}
                <FormField index={1}>
                  <div className="space-y-2">
                    <Label htmlFor="school-code" className="flex items-center gap-2 text-sm font-medium">
                      School Code
                      <Badge variant="secondary" className="text-xs font-normal">
                        <Lock className="mr-1 h-3 w-3" />
                        Read-only
                      </Badge>
                    </Label>
                    <Input
                      id="school-code"
                      value={school.code}
                      disabled
                      className="bg-muted/50 text-muted-foreground"
                    />
                    <p className="text-xs text-muted-foreground">
                      School code is assigned during registration and cannot be changed.
                    </p>
                  </div>
                </FormField>

                <Separator />

                {/* Two-column contact info */}
                <div className="grid gap-6 sm:grid-cols-2">
                  <FormField index={2}>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-sm font-medium">
                        Phone Number
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone || ""}
                        onChange={(e) => handleInputChange("phone", e.target.value || null)}
                        disabled={isSaving}
                        placeholder="+254712345678"
                      />
                    </div>
                  </FormField>

                  <FormField index={3}>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium">
                        Email Address
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email || ""}
                        onChange={(e) => handleInputChange("email", e.target.value || null)}
                        disabled={isSaving}
                        placeholder="contact@school.edu"
                        className={errors.email ? "border-destructive focus-visible:ring-destructive" : ""}
                      />
                      {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                    </div>
                  </FormField>
                </div>

                {/* School Type */}
                <FormField index={4}>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">School Type</Label>
                    <Select
                      value={(formData.school_type || "mixed") as string}
                      onValueChange={(v) => handleSchoolTypeChange(v as any)}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select school type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">Day School</SelectItem>
                        <SelectItem value="boarding">Boarding School</SelectItem>
                        <SelectItem value="mixed">Mixed (Day + Boarding)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      This controls how attendance filters and term events are displayed.
                    </p>
                  </div>
                </FormField>

                {/* Address */}
                <FormField index={5}>
                  <div className="space-y-2">
                    <Label htmlFor="address" className="text-sm font-medium">
                      Address
                    </Label>
                    <Textarea
                      id="address"
                      value={formData.address || ""}
                      onChange={(e) => handleInputChange("address", e.target.value || null)}
                      disabled={isSaving}
                      placeholder="Enter school address (or set from map below)"
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                </FormField>

                <Separator />

                {/* School location: embedded map + paste link */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    <h3 className="text-sm font-semibold">School location (mobile check-in)</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Set your school’s location so teachers can check in/out via the mobile app when they’re on site.
                    Paste a Google Maps link (e.g. from Share on Google Maps) below.
                  </p>

                  {/* Paste Google Maps link */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Input
                      type="url"
                      value={mapsUrlInput}
                      onChange={(e) => {
                        setMapsUrlInput(e.target.value)
                        setMapsUrlError(null)
                      }}
                      disabled={isSaving || isResolvingMapsUrl}
                      placeholder="Paste Google Maps link (e.g. https://maps.app.goo.gl/...)"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleUseMapsLocation}
                      disabled={!mapsUrlInput.trim() || isSaving || isResolvingMapsUrl}
                      className="shrink-0 gap-2"
                    >
                      {isResolvingMapsUrl ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Resolving…
                        </>
                      ) : (
                        <>
                          <MapPin className="h-4 w-4" />
                          Use this location
                        </>
                      )}
                    </Button>
                  </div>
                  {mapsUrlError && (
                    <p className="text-sm text-red-600 dark:text-red-400">{mapsUrlError}</p>
                  )}

                  {formData.geofence_lat != null && formData.geofence_lng != null && (
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-muted/30 p-3 space-y-1">
                      <p className="text-sm font-medium text-foreground">Location set</p>
                      <p className="text-xs text-muted-foreground">
                        {formData.geofence_lat.toFixed(6)}, {formData.geofence_lng.toFixed(6)} (150 m radius)
                      </p>
                      <a
                        href={`https://www.google.com/maps?q=${formData.geofence_lat},${formData.geofence_lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                      >
                        Open in Google Maps
                      </a>
                    </div>
                  )}

                  <Alert className="bg-primary/5 border-primary/20">
                    <AlertCircle className="h-4 w-4 text-primary" />
                    <AlertDescription className="text-xs">
                      Search for your school (e.g. “Bridge International Academy Ol Kalou”) and click the map or “Use this location”. You can also paste a link from Google Maps (e.g. https://maps.app.goo.gl/...).
                    </AlertDescription>
                  </Alert>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col-reverse gap-3 border-t bg-muted/20 px-6 py-4 sm:flex-row sm:justify-end">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isSaving || !hasChanges}
                    className="w-full sm:w-auto bg-transparent"
                  >
                    Cancel
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button onClick={handleSave} disabled={isSaving || !hasChanges} className="w-full sm:w-auto">
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </motion.div>
              </CardFooter>
            </Card>
          </motion.div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Notifications – link to dedicated subpage                            */}
        {/* ------------------------------------------------------------------ */}
        {school && (
          <motion.div variants={staggerContainer} initial="initial" animate="animate">
            <Card className="glass-panel shadow-premium bevel-card border-none overflow-hidden group">
              <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 opacity-80 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-500/20 shadow-inner-bevel">
                    <MessageSquare className="h-8 w-8" />
                  </div>

                  <div className="flex-1 text-center md:text-left space-y-2">
                    <h3 className="text-xl font-bold tracking-tight">
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
                        Notifications (SMS / WhatsApp)
                      </span>
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
                      Configure delivery channels and message templates for parents and teachers.
                      Ensure timely alerts with a 10/10 communication experience.
                    </p>
                  </div>

                  <div className="flex flex-col w-full md:w-auto gap-3 shrink-0">
                    <Button asChild className="rounded-xl px-8 h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]">
                      <Link href="/dashboard/settings/notifications" className="inline-flex items-center gap-2">
                        Configure Now
                        <ArrowRight className="h-5 w-5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
        {/* ------------------------------------------------------------------ */}
        {/* Mobile App Distribution                                             */}
        {/* ------------------------------------------------------------------ */}
        {school && (
          <motion.div variants={fadeInUp} initial="initial" animate="animate" transition={{ delay: 0.1 }}>
            <Card className="glass-panel shadow-premium bevel-card border-white/10 overflow-hidden">
              <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500/40 via-emerald-500 to-emerald-500/40" />
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg font-bold">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 shadow-inner-bevel">
                    <Smartphone className="h-5 w-5" />
                  </div>
                  Mobile App Distribution
                </CardTitle>
                <CardDescription className="text-muted-foreground/80">
                  Enable teachers to track attendance and geofence their check-ins using the mobile app.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Step 1: Server address – connect app to this backend */}
                <div className="space-y-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center border-amber-500/50 text-amber-600 dark:text-amber-400">1</Badge>
                    <h4 className="font-semibold text-sm">Server address (connect app to backend)</h4>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The mobile app must use this URL to reach your school&apos;s server. Share it with teachers or enter it in the app when prompted. On the same Wi‑Fi, use the server&apos;s IP address (e.g. 192.168.1.x).
                  </p>
                  <div className="flex gap-2 flex-wrap items-center">
                    <Input
                      readOnly
                      value={getApiBaseUrlOrFallback()}
                      className="font-mono text-sm bg-muted/50 max-w-full"
                    />
                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(getApiBaseUrlOrFallback());
                        alert("Server address copied. Paste it in the mobile app under \"Server Address\" when connecting.");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="pt-2 border-t border-amber-500/10 mt-3">
                    <p className="text-xs text-muted-foreground mb-2">
                      If the address above is localhost, find this machine&apos;s IP on your Wi‑Fi so the mobile app can connect:
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                        onClick={async () => {
                          setLoadingServerIp(true)
                          setServerIp(null)
                          try {
                            const base = getApiBaseUrlOrFallback()
                            const res = await fetch(`${base}/api/v1/system/info`)
                            const data = await res.json().catch(() => ({}))
                            const ip = data?.internal_ip
                            if (ip && ip !== "127.0.0.1") {
                              setServerIp(ip)
                            } else {
                              setServerIp(ip || "Could not detect")
                            }
                          } catch {
                            setServerIp("Unavailable")
                          } finally {
                            setLoadingServerIp(false)
                          }
                        }}
                        disabled={loadingServerIp}
                      >
                        {loadingServerIp ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Finding…
                          </>
                        ) : (
                          <>
                            <MapPin className="h-4 w-4" />
                            Find server IP on Wi‑Fi
                          </>
                        )}
                      </Button>
                      {serverIp != null && (
                        <span className="inline-flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-medium text-foreground">{serverIp}</span>
                          {serverIp !== "127.0.0.1" && serverIp !== "Could not detect" && serverIp !== "Unavailable" && (() => {
                            try {
                              const base = getApiBaseUrlOrFallback()
                              const port = new URL(base).port || "8000"
                              const url = `http://${serverIp}:${port}`
                              return (
                                <>
                                  <span className="text-muted-foreground text-xs">→</span>
                                  <span className="font-mono text-sm text-muted-foreground">{url}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => {
                                      navigator.clipboard.writeText(url)
                                      alert("Copied! Paste this in the mobile app as Server Address.")
                                    }}
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                </>
                              )
                            } catch {
                              return null
                            }
                          })()}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      If the app still can&apos;t connect on the same Wi‑Fi: (1) Ensure the backend is running on this computer. (2) Allow port 8000 in your computer&apos;s firewall (Windows: Windows Defender Firewall → Allow an app → add Python or allow port 8000).
                    </p>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  {/* Step 2: Download */}
                  <div className="space-y-3 p-4 rounded-xl bg-muted/30 border border-white/5">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center border-emerald-500/50 text-emerald-600">2</Badge>
                      <h4 className="font-semibold text-sm">Download APK</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Share this direct download link with your teachers. They can install the app on any Android device.
                    </p>
                    <Button
                      variant="outline"
                      className="w-full gap-2 border-emerald-500/20 hover:bg-emerald-500/10"
                      onClick={async () => {
                        const url = `${getApiBaseUrlOrFallback()}/api/v1/mobile/download/app.apk`
                        try {
                          const res = await fetch(url)
                          // Only treat 200 as the actual APK file; 202/503 return JSON messages
                          if (res.status === 200) {
                            const blob = await res.blob()
                            if (blob.size < 1000) {
                              alert("Downloaded file is too small and may be invalid. The app may still be building or the build failed. Try again in a few minutes.")
                              return
                            }
                            const u = URL.createObjectURL(blob)
                            const a = document.createElement("a")
                            a.href = u
                            a.download = "SchoolAttendance.apk"
                            a.click()
                            URL.revokeObjectURL(u)
                            return
                          }
                          const data = await res.json().catch(() => ({}))
                          const msg = data?.detail ?? (res.status === 202 ? "App is being built. Try again in a few minutes." : "Download unavailable.")
                          alert(msg)
                        } catch {
                          alert("Could not reach the server. Try again later.")
                        }
                      }}
                    >
                      <Download className="h-4 w-4" />
                      Download Teacher App
                    </Button>
                  </div>

                  {/* Step 3: School code */}
                  <div className="space-y-3 p-4 rounded-xl bg-muted/30 border border-white/5">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center border-primary/50 text-primary">3</Badge>
                      <h4 className="font-semibold text-sm">School Activation</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Teachers will need this unique code to activate the app for your school on first launch.
                    </p>
                    <div className="flex gap-2">
                      <Input value={school.code} readOnly className="font-mono bg-muted/50" />
                      <Button
                        variant="secondary"
                        size="icon"
                        onClick={() => {
                          navigator.clipboard.writeText(school.code);
                          alert("School code copied to clipboard!");
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 shrink-0 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                      <Smartphone className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold">Teacher Login</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Once the app is activated, teachers log in using their registered phone number.
                        Ensure their phone numbers are correctly set in the <Link href="/dashboard/teachers" className="text-primary hover:underline font-medium">Teachers</Link> section.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* School Branding – Logo & Favicon                                   */}
        {/* ------------------------------------------------------------------ */}
        <motion.div variants={fadeInUp} initial="initial" animate="animate" transition={{ delay: 0.1 }}>
          <Card className="glass-panel shadow-premium bevel-card border-white/10 overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-blue-500/40 via-blue-500 to-blue-500/40" />
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-lg font-bold">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 shadow-inner-bevel">
                  <ImageIcon className="h-5 w-5" />
                </div>
                School Logo & Favicon
              </CardTitle>
              <CardDescription className="text-muted-foreground/80">
                Upload your school logo for use in the sidebar, reports, and browser tab.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                {/* Logo preview */}
                <div className="flex flex-col items-center gap-3">
                  <div className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/30 overflow-hidden">
                    {logoDataUrl ? (
                      <>
                        <img src={logoDataUrl} alt="School logo" className="h-full w-full object-contain p-2" />
                        <button
                          onClick={handleRemoveLogo}
                          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow hover:bg-destructive/80 transition-colors"
                          title="Remove logo"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </>
                    ) : (
                      <School className="h-10 w-10 text-muted-foreground/40" />
                    )}
                  </div>
                  {/* Favicon size preview */}
                  <div className="flex items-center gap-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded border border-border bg-muted/30 overflow-hidden">
                      {logoDataUrl ? (
                        <img src={logoDataUrl} alt="Favicon preview" className="h-full w-full object-contain" />
                      ) : (
                        <div className="h-2 w-2 rounded-sm bg-muted-foreground/30" />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">Favicon preview</span>
                  </div>
                </div>

                {/* Upload controls */}
                <div className="flex-1 space-y-3">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                    id="logo-upload"
                  />
                  <label htmlFor="logo-upload">
                    <Button
                      variant="outline"
                      className="w-full cursor-pointer gap-2"
                      asChild
                    >
                      <span>
                        <Upload className="h-4 w-4" />
                        {logoDataUrl ? "Replace Logo" : "Upload Logo"}
                      </span>
                    </Button>
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Supported formats: PNG, JPG, SVG, WebP. Max size: 2 MB.
                    <br />
                    Recommended: square image, at least 256×256 px.
                  </p>
                  {logoDataUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 text-destructive hover:text-destructive"
                      onClick={handleRemoveLogo}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove Logo
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ------------------------------------------------------------------ */}
        {/* Login Page Background                                               */}
        {/* ------------------------------------------------------------------ */}
        <motion.div variants={fadeInUp} initial="initial" animate="animate" transition={{ delay: 0.15 }}>
          <Card className="glass-panel shadow-premium bevel-card border-white/10 overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-purple-500/40 via-purple-500 to-purple-500/40" />
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-lg font-bold">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500 shadow-inner-bevel">
                  <ImageIcon className="h-5 w-5" />
                </div>
                Login Background
              </CardTitle>
              <CardDescription className="text-muted-foreground/80">
                Customize the first impression with a premium background image for the login page.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                {/* Background preview */}
                <div
                  className="relative flex h-28 w-full sm:w-48 shrink-0 items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/30 overflow-hidden"
                >
                  {loginBgDataUrl ? (
                    <>
                      <img src={loginBgDataUrl} alt="Login background" className="h-full w-full object-cover" />
                      <button
                        onClick={handleRemoveLoginBg}
                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow hover:bg-destructive/80 transition-colors"
                        title="Remove background"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground text-center px-2">No background set</span>
                  )}
                </div>

                {/* Upload controls */}
                <div className="flex-1 space-y-3">
                  <input
                    ref={loginBgInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLoginBgUpload}
                    id="login-bg-upload"
                  />
                  <label htmlFor="login-bg-upload">
                    <Button variant="outline" className="w-full cursor-pointer gap-2" asChild>
                      <span>
                        <Upload className="h-4 w-4" />
                        {loginBgDataUrl ? "Replace Background" : "Upload Background"}
                      </span>
                    </Button>
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Supported: PNG, JPG, WebP, SVG. Max size: 4 MB.
                    <br />
                    Tip: landscape images work best (1920×1080 or wider).
                  </p>
                  {loginBgDataUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 text-destructive hover:text-destructive"
                      onClick={handleRemoveLoginBg}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove Background
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ------------------------------------------------------------------ */}
        {/* School Color Theme                                                  */}
        {/* ------------------------------------------------------------------ */}
        <motion.div variants={fadeInUp} initial="initial" animate="animate" transition={{ delay: 0.2 }}>
          <Card className="glass-panel shadow-premium bevel-card border-white/10 overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-amber-500/40 via-amber-500 to-amber-500/40" />
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-lg font-bold">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 shadow-inner-bevel">
                  <Palette className="h-5 w-5" />
                </div>
                School Colour Theme
              </CardTitle>
              <CardDescription className="text-muted-foreground/80">
                Choose 3–5 brand colours. The system will blend them and apply them across the entire UI instantly.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Live preview strip */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Live Preview</span>
                </div>
                <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
                  <PreviewStrip />
                </div>
              </div>

              {/* Color pickers grid */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {COLOR_LABELS.map((slot, i) => (
                  <div key={i} className="space-y-2">
                    <Label htmlFor={`color-${i}`} className="text-sm font-medium">
                      {slot.label}
                    </Label>
                    <div className="flex items-center gap-3">
                      {/* Color swatch button linked to the hidden input */}
                      <div
                        className="relative h-10 w-10 shrink-0 rounded-lg border-2 border-white shadow-md cursor-pointer overflow-hidden transition-transform hover:scale-105"
                        style={{ backgroundColor: draftColors[i] || "#cccccc" }}
                        onClick={() => document.getElementById(`color-${i}`)?.click()}
                        title={`Pick ${slot.label} color`}
                      >
                        <input
                          id={`color-${i}`}
                          type="color"
                          value={draftColors[i] || "#cccccc"}
                          onChange={(e) => handleColorChange(i, e.target.value)}
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        />
                      </div>
                      {/* Hex input */}
                      <Input
                        value={draftColors[i] || ""}
                        onChange={(e) => {
                          const val = e.target.value
                          if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) handleColorChange(i, val)
                        }}
                        placeholder="#000000"
                        className="font-mono text-sm uppercase h-10"
                        maxLength={7}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{slot.description}</p>
                  </div>
                ))}
              </div>

              {/* Sidebar accent preview */}
              <div className="rounded-xl overflow-hidden border border-border/50">
                <div
                  className="flex items-center gap-3 p-3 text-sm font-medium text-white"
                  style={{ background: `linear-gradient(135deg, ${draftColors[0]}, ${draftColors[1] || draftColors[0]})` }}
                >
                  <div className="h-7 w-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                    <School className="h-4 w-4" />
                  </div>
                  <span className="truncate">{useSchoolBrandingStore.getState().schoolName || "Your School"}</span>
                </div>
                <div className="flex gap-1 px-3 py-2 bg-muted/30">
                  {["Dashboard", "Students", "Devices"].map((item) => (
                    <span
                      key={item}
                      className="rounded-md px-2 py-1 text-xs font-medium"
                      style={{
                        backgroundColor: item === "Dashboard" ? `${draftColors[0]}22` : "transparent",
                        color: item === "Dashboard" ? draftColors[0] : undefined,
                      }}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col-reverse gap-3 border-t bg-muted/20 px-6 py-4 sm:flex-row sm:justify-end">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  variant="outline"
                  onClick={handleResetColors}
                  className="w-full sm:w-auto gap-2 bg-transparent"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset to Defaults
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button onClick={handleSaveBranding} className="w-full sm:w-auto gap-2">
                  {brandingSaved ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Applied!
                    </>
                  ) : (
                    <>
                      <Palette className="h-4 w-4" />
                      Apply Colours
                    </>
                  )}
                </Button>
              </motion.div>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    </motion.main>
  )
}

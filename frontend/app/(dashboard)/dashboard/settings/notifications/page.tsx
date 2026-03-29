"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, MessageSquare, Send, Loader2, CheckCircle2, Eye, EyeOff, Save, RotateCcw, Smartphone, Settings2, Zap, ShieldCheck } from "lucide-react"
import { useAuthStore } from "@/lib/store/authStore"
import {
  getMySchool,
  updateMySchool,
  type SchoolResponse,
  type NotificationSettingsApi,
  type SchoolUpdateData,
  DEFAULT_NOTIFICATION_TEMPLATES,
} from "@/lib/api/schools"
import { sendTestSms, sendWeeklyReminders } from "@/lib/api/notifications"
import { fadeInUp, staggerContainer, staggerItem } from "@/lib/animations/framer-motion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const PLACEHOLDERS = {
  student_checkin: "Dear parent, {{student_name}} has checked in at {{time}} on {{date}}. - {{school_name}}",
  student_checkout: "Dear parent, {{student_name}} has checked out at {{time}} on {{date}}. - {{school_name}}",
  teacher_weekly_reminder:
    "Dear {{teacher_name}}, Your attendance summary for the week: {{present_days}}/{{total_days}} days ({{percentage}}%). - {{school_name}}",
}

// ---------------------------------------------------------------------------
// Live Phone Mockup Component
// ---------------------------------------------------------------------------
function PhonePreview({ content, title, schoolName }: { content: string; title: string; schoolName: string }) {
  // Replace placeholders for the preview
  const previewText = content
    .replace(/{{student_name}}/g, "John Doe")
    .replace(/{{teacher_name}}/g, "Jane Smith")
    .replace(/{{time}}/g, "08:30 AM")
    .replace(/{{date}}/g, "Feb 26, 2025")
    .replace(/{{school_name}}/g, schoolName)
    .replace(/{{present_days}}/g, "5")
    .replace(/{{total_days}}/g, "5")
    .replace(/{{percentage}}/g, "100")

  return (
    <div className="relative mx-auto h-[440px] w-[220px] rounded-[2.5rem] border-[6px] border-gray-900 bg-gray-900 shadow-xl overflow-hidden ring-4 ring-offset-2 ring-blue-500/10">
      {/* Notch */}
      <div className="absolute top-0 left-1/2 h-5 w-24 -translate-x-1/2 rounded-b-xl bg-gray-900 z-20" />

      {/* Screen Content */}
      <div className="h-full w-full bg-[#f0f0f7] p-4 pt-10 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold">
            {schoolName.substring(0, 2).toUpperCase()}
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-gray-800 leading-none">{schoolName}</span>
            <span className="text-[8px] text-gray-500">Official Alert</span>
          </div>
        </div>

        <motion.div
          key={content}
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="relative max-w-[85%] rounded-2xl rounded-tl-none bg-white p-3 shadow-sm border border-gray-100"
        >
          <div className="absolute -left-2 top-0 h-4 w-4 bg-white clip-triangle" style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }} />
          <p className="text-[11px] leading-relaxed text-gray-700 whitespace-pre-wrap">
            {previewText || "Start typing your template to see a preview..."}
          </p>
          <div className="mt-1 flex justify-end">
            <span className="text-[8px] text-gray-400">8:30 AM</span>
          </div>
        </motion.div>

        <div className="mt-auto pb-4">
          <div className="h-0.5 w-1/3 mx-auto bg-gray-300 rounded-full" />
        </div>
      </div>
    </div>
  )
}

export default function SettingsNotificationsPage() {
  const { token } = useAuthStore()
  const [school, setSchool] = useState<SchoolResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ns, setNs] = useState<NotificationSettingsApi>({
    provider: "africas_talking",
    parent_delivery: "sms",
    channel: "sms",
    api_key: null,
    sender_id: null,
    username: null,
    whatsapp_phone_number_id: null,
    whatsapp_api_key: null,
    sandbox: true,
    templates: {
      student_checkin: "",
      student_checkout: "",
      teacher_weekly_reminder: "",
    },
  })
  const [showApiKey, setShowApiKey] = useState(false)
  const [showWhatsappApiKey, setShowWhatsappApiKey] = useState(false)
  const [activeTemplate, setActiveTemplate] = useState<keyof typeof PLACEHOLDERS>("student_checkin")
  const [testSmsTo, setTestSmsTo] = useState("")
  const [testSmsLoading, setTestSmsLoading] = useState(false)
  const [testSmsResult, setTestSmsResult] = useState<{ success: boolean; detail: string } | null>(null)
  const [weeklyLoading, setWeeklyLoading] = useState(false)
  const [weeklyResult, setWeeklyResult] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    const fetchSchool = async () => {
      try {
        setLoading(true)
        const data = await getMySchool(token)
        setSchool(data)
        const notification_settings = data.notification_settings
        const delivery =
          (notification_settings?.parent_delivery as "sms" | "whatsapp" | "both") ??
          (notification_settings?.channel as "sms" | "whatsapp") ??
          "sms"
        setNs({
          provider: notification_settings?.provider ?? "africas_talking",
          parent_delivery: delivery,
          channel: delivery === "both" ? "sms" : delivery,
          api_key: notification_settings?.api_key ?? null,
          sender_id: notification_settings?.sender_id ?? null,
          username: notification_settings?.username ?? null,
          whatsapp_phone_number_id: notification_settings?.whatsapp_phone_number_id ?? null,
          whatsapp_api_key: notification_settings?.whatsapp_api_key ?? null,
          sandbox: notification_settings?.sandbox ?? true,
          templates: {
            student_checkin:
              notification_settings?.templates?.student_checkin ?? DEFAULT_NOTIFICATION_TEMPLATES.student_checkin,
            student_checkout:
              notification_settings?.templates?.student_checkout ?? DEFAULT_NOTIFICATION_TEMPLATES.student_checkout,
            teacher_weekly_reminder:
              notification_settings?.templates?.teacher_weekly_reminder ??
              DEFAULT_NOTIFICATION_TEMPLATES.teacher_weekly_reminder,
          },
        })
      } catch {
        setError("Failed to load school settings")
      } finally {
        setLoading(false)
      }
    }
    fetchSchool()
  }, [token])

  const updateNs = (key: keyof NotificationSettingsApi, value: any) => {
    setNs((prev) => ({
      ...prev,
      [key]: value ?? undefined,
    }))
    setSuccess(false)
    setError(null)
  }

  const handleSave = async () => {
    if (!token || !school) return
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const notification_settings = {
        ...ns,
        parent_delivery: ns.parent_delivery ?? ns.channel ?? "sms",
        channel: ns.parent_delivery === "both" ? "sms" : (ns.parent_delivery ?? ns.channel ?? "sms"),
      }
      const updateData: SchoolUpdateData = { notification_settings }
      const updated = await updateMySchool(token, updateData)
      setSchool(updated)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 4000)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const handleTestSms = async (channel: "sms" | "whatsapp") => {
    if (!token || !testSmsTo.trim()) return
    setTestSmsResult(null)
    setTestSmsLoading(true)
    try {
      const res = await sendTestSms(token, testSmsTo.trim(), channel)
      setTestSmsResult({ success: res.success, detail: res.detail })
    } catch (err: any) {
      setTestSmsResult({ success: false, detail: err.response?.data?.detail ?? "Request failed" })
    } finally {
      setTestSmsLoading(false)
    }
  }

  const handleSendWeeklyReminders = async () => {
    if (!token) return
    setWeeklyResult(null)
    setWeeklyLoading(true)
    try {
      const res = await sendWeeklyReminders(token)
      setWeeklyResult(res.detail)
    } catch (err: any) {
      setWeeklyResult(`Error: ${err.response?.data?.detail ?? "Request failed"}`)
    } finally {
      setWeeklyLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <div className="relative h-16 w-16">
          <div className="absolute inset-0 rounded-full border-4 border-indigo-100 dark:border-indigo-900/30" />
          <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
        </div>
        <p className="text-sm font-medium text-muted-foreground animate-pulse">Initializing communication engine...</p>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen pb-20">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50/50 via-white to-purple-50/50 dark:from-slate-900 dark:via-slate-950 dark:to-indigo-950/20" />
      <div className="fixed top-0 right-0 -translate-y-1/2 translate-x-1/2 w-[800px] h-[800px] rounded-full bg-gradient-to-br from-blue-500/10 to-transparent blur-[120px] pointer-events-none -z-10" />

      <motion.div
        className="space-y-8"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {/* Header Section */}
        <motion.div variants={fadeInUp} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/settings"
              className="group flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/40 shadow-sm backdrop-blur-md transition-all hover:bg-white/60 hover:scale-105 active:scale-95 dark:bg-slate-800/40"
            >
              <ArrowLeft className="h-4 w-4 text-indigo-600" />
            </Link>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                <span className="text-slate-900 dark:text-white">
                  Communication Settings
                </span>
              </h1>
              <p className="text-muted-foreground text-xs font-medium">
                Manage automated SMS and WhatsApp alerts for your institution.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Save Button relocated to bottom of config column */}
          </div>
        </motion.div>

        {/* Global Alerts */}
        <AnimatePresence>
          {(error || success) && (
            <motion.div
              initial={{ opacity: 0, y: -20, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -20, height: 0 }}
              className="overflow-hidden"
            >
              {error && (
                <div className="flex items-center gap-3 rounded-2xl border border-red-200/50 bg-red-50/50 p-4 text-sm text-red-700 backdrop-blur-sm dark:border-red-800/50 dark:bg-red-950/20 dark:text-red-300 mb-4">
                  <ShieldCheck className="h-5 w-5 text-red-500" />
                  {error}
                </div>
              )}
              {success && (
                <div className="flex items-center gap-3 rounded-2xl border border-emerald-200/50 bg-emerald-50/50 p-4 text-sm text-emerald-700 backdrop-blur-sm dark:border-emerald-800/50 dark:bg-emerald-950/20 dark:text-emerald-300 mb-4 font-semibold">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  Configurations pushed successfully!
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Left Column: Config (Api & environment) - span 4 / 5 */}
          <div className="lg:col-span-5 space-y-8">
            <motion.div variants={staggerItem}>
              <Card className="glass-panel overflow-hidden border-white/10 shadow-sm transition-shadow hover:shadow-md">
                <CardHeader className="p-5">
                  <CardTitle className="flex items-center gap-3 text-base font-bold">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 dark:bg-slate-900 text-indigo-600">
                      <Settings2 className="h-5 w-5" />
                    </div>
                    Engine Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 pt-0 space-y-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Primary Channel</Label>
                    <Select
                      value={(ns.parent_delivery as string) || "sms"}
                      onValueChange={(v) => updateNs("parent_delivery", v as "sms" | "whatsapp" | "both")}
                    >
                      <SelectTrigger className="h-10 rounded-xl border-slate-200/60 bg-white/50 dark:bg-slate-900/50 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-200/60">
                        <SelectItem value="sms" className="text-xs">SMS Gateway</SelectItem>
                        <SelectItem value="whatsapp" className="text-xs">WhatsApp Cloud</SelectItem>
                        <SelectItem value="both" className="text-xs">Omnichannel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* SMS Section */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/50 dark:border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">SMS Gateway</h4>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase">API Key</Label>
                        <div className="relative">
                          <Input
                            type={showApiKey ? "text" : "password"}
                            value={ns.api_key ?? ""}
                            onChange={(e) => updateNs("api_key", e.target.value || null)}
                            className="h-10 rounded-xl bg-white dark:bg-slate-950 border-slate-200/60 pr-10 font-mono text-[11px]"
                            placeholder="Africa's Talking Key"
                          />
                          <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute right-3 top-0 h-full flex items-center text-muted-foreground hover:text-indigo-600 transition-colors"
                          >
                            {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase">
                          App username
                          {ns.sandbox === false && <span className="text-red-500 ml-0.5">*</span>}
                        </Label>
                        <Input
                          value={ns.username ?? ""}
                          onChange={(e) => updateNs("username", e.target.value || null)}
                          className="h-10 rounded-xl border-slate-200/60 bg-white dark:bg-slate-950 text-xs"
                          placeholder={ns.sandbox === false ? "e.g. myapp (from Africa's Talking dashboard)" : "sandbox (default)"}
                        />
                        {ns.sandbox === false && (
                          <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">
                            Required for Live. Use the username of your <strong>live</strong> app from Africa's Talking dashboard.
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold text-muted-foreground uppercase">Sender ID</Label>
                          <Input
                            value={ns.sender_id ?? ""}
                            onChange={(e) => updateNs("sender_id", e.target.value || null)}
                            className="h-10 rounded-xl border-slate-200/60 text-xs"
                            placeholder="e.g. INFOSMS"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold text-muted-foreground uppercase">Env</Label>
                          <Select
                            value={ns.sandbox === false ? "production" : "sandbox"}
                            onValueChange={(v) => updateNs("sandbox", v === "sandbox")}
                          >
                            <SelectTrigger className="h-10 rounded-xl border-slate-200/60 bg-white dark:bg-slate-950 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              <SelectItem value="sandbox" className="text-xs">Sandbox</SelectItem>
                              <SelectItem value="production" className="text-xs">Live</SelectItem>
                            </SelectContent>
                          </Select>
                          {ns.sandbox !== false && (
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/50 px-2.5 py-1.5">
                              Sandbox does not deliver SMS to real phone numbers. Use <strong>Live</strong> to send real messages to your inbox.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* WhatsApp Section */}
                  <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-purple-900 dark:text-purple-300">WhatsApp Cloud</h4>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase">Phone ID</Label>
                        <Input
                          value={ns.whatsapp_phone_number_id ?? ""}
                          onChange={(e) => updateNs("whatsapp_phone_number_id", e.target.value || null)}
                          className="h-10 rounded-xl bg-white dark:bg-slate-950 border-slate-200/60 text-xs"
                          placeholder="Meta Phone ID"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase">Access Token</Label>
                        <div className="relative">
                          <Input
                            type={showWhatsappApiKey ? "text" : "password"}
                            value={ns.whatsapp_api_key ?? ""}
                            onChange={(e) => updateNs("whatsapp_api_key", e.target.value || null)}
                            className="h-10 rounded-xl bg-white dark:bg-slate-950 border-slate-200/60 pr-10 font-mono text-[11px]"
                            placeholder="Bearer Token"
                          />
                          <button
                            type="button"
                            onClick={() => setShowWhatsappApiKey(!showWhatsappApiKey)}
                            className="absolute right-3 top-0 h-full flex items-center text-muted-foreground hover:text-purple-600 transition-colors"
                          >
                            {showWhatsappApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Test Actions Card */}
            <motion.div variants={staggerItem}>
              <Card className="glass-panel overflow-hidden border-white/10 shadow-sm p-4">
                <CardHeader className="p-0 mb-4">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Diagnostics
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 space-y-5">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">Send test via SMS</Label>
                    {ns.sandbox === false && (
                      <p className="text-[10px] text-blue-600 dark:text-blue-400">
                        Using Live. Ensure you clicked <strong>Save All Settings</strong> above, and that App username and API key are from your <strong>live</strong> app.
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Input
                        type="tel"
                        value={testSmsTo}
                        onChange={(e) => setTestSmsTo(e.target.value)}
                        placeholder="+2547..."
                        className="h-9 rounded-lg border-slate-200/60 text-xs"
                      />
                      <Button
                        variant="ghost"
                        onClick={() => handleTestSms("sms")}
                        disabled={testSmsLoading || !testSmsTo.trim()}
                        className="rounded-lg h-9 bg-slate-100 text-slate-700 hover:bg-slate-200 px-3 transition-colors"
                      >
                        {testSmsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Smartphone className="h-4 w-4" />}
                      </Button>
                    </div>
                    {testSmsResult && (
                      <div
                        className={`rounded-lg border px-3 py-2 text-xs ${
                          testSmsResult.success
                            ? "border-blue-200/60 bg-blue-50/80 dark:bg-blue-950/30 dark:border-blue-800/50 text-blue-800 dark:text-blue-200"
                            : "border-red-200/60 bg-red-50/80 dark:bg-red-950/30 dark:border-red-800/50 text-red-800 dark:text-red-200"
                        }`}
                      >
                        {testSmsResult.detail}
                      </div>
                    )}
                  </div>

                  <Separator className="bg-slate-100 dark:bg-white/5" />

                  <div className="space-y-2">
                    <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200">Bulk Actions</h5>
                    <Button
                      onClick={handleSendWeeklyReminders}
                      disabled={weeklyLoading}
                      variant="outline"
                      className="w-full rounded-lg h-9 border-slate-200 text-xs font-bold"
                    >
                      {weeklyLoading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Send className="mr-2 h-3 w-3" />}
                      Weekly Summaries
                    </Button>
                  </div>

                  <Separator className="bg-slate-100 dark:bg-white/5" />

                  {/* Relocated Save Button */}
                  <div className="pt-2">
                    <Button
                      onClick={handleSave}
                      disabled={saving}
                      className="w-full rounded-xl h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-xl shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Save All Settings
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Right Column: Templates & Live Preview - span 7 / 8 */}
          <div className="lg:col-span-7 space-y-8">
            <motion.div variants={staggerItem} className="h-full">
              <Card className="glass-panel h-full border-white/20 shadow-premium flex flex-col overflow-hidden">
                <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 to-purple-500" />
                <CardHeader className="flex flex-row items-center justify-between p-5 pb-2">
                  <div className="space-y-0.5">
                    <CardTitle className="text-base font-bold">Content Architect</CardTitle>
                    <CardDescription className="text-[10px]">Draft automated messages.</CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-lg text-[10px] hover:bg-red-50 hover:text-red-500 transition-colors"
                    onClick={() =>
                      updateNs("templates", DEFAULT_NOTIFICATION_TEMPLATES)
                    }
                  >
                    <RotateCcw className="h-3 w-3 mr-1.5" />
                    Reset
                  </Button>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col lg:flex-row gap-6 p-5">
                  <div className="flex-1 space-y-6">
                    <div className="flex flex-wrap gap-1.5">
                      {([
                        { id: 'student_checkin', label: 'Arrival' },
                        { id: 'student_checkout', label: 'Departure' },
                        { id: 'teacher_weekly_reminder', label: 'Weekly' }
                      ] as const).map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTemplate(tab.id)}
                          className={`px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all ${activeTemplate === tab.id
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                            : "bg-slate-100/50 hover:bg-slate-200/50 text-slate-600 border border-slate-200/50 dark:bg-slate-900/40 dark:text-slate-300 dark:border-white/5"
                            }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-3">
                      <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        {activeTemplate === 'student_checkin' ? 'Check-in Template' :
                          activeTemplate === 'student_checkout' ? 'Check-out Template' : 'Staff Template'}
                      </Label>
                      <Textarea
                        value={ns.templates?.[activeTemplate] ?? ""}
                        onChange={(e) =>
                          updateNs("templates", {
                            ...(ns.templates || {}),
                            [activeTemplate]: e.target.value,
                          })
                        }
                        placeholder={PLACEHOLDERS[activeTemplate]}
                        className="min-h-[160px] rounded-2xl border-slate-200/60 bg-white/50 dark:bg-slate-950/50 p-5 text-xs leading-relaxed focus:bg-white dark:focus:bg-slate-950 resize-none shadow-sm"
                      />

                      <div className="flex flex-wrap gap-1.5">
                        {([
                          '{{student_name}}', '{{time}}', '{{date}}', '{{school_name}}', '{{present_days}}', '{{percentage}}', '{{teacher_name}}'
                        ]).map(tag => (
                          <button
                            key={tag}
                            onClick={() => {
                              const ta = document.getElementById('template-editor') as HTMLTextAreaElement;
                              if (ta) {
                                const start = ta.selectionStart;
                                const end = ta.selectionEnd;
                                const val = ns.templates?.[activeTemplate] ?? "";
                                const newVal = val.slice(0, start) + tag + val.slice(end);
                                updateNs("templates", { ...ns.templates, [activeTemplate]: newVal });
                                ta.focus();
                              }
                            }}
                            className="px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-900/20 text-[9px] text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40 font-mono"
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Visual Preview Side */}
                  <div className="shrink-0 flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-900/20 rounded-[2rem] border border-slate-100 dark:border-white/5">
                    <span className="text-[9px] uppercase tracking-wider font-bold text-indigo-400 mb-4 opacity-70">Live View</span>
                    <PhonePreview
                      content={ns.templates?.[activeTemplate] ?? ""}
                      title={activeTemplate}
                      schoolName={school?.name ?? "Institution"}
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

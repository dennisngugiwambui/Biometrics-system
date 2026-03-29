"use client"

import axios from "axios"
import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ArrowLeft,
  AlertCircle,
  Edit,
  Trash2,
  Phone,
  Mail,
  BookOpen,
  Building2,
  BadgeCheck,
  User,
  Loader2,
  Calendar,
  BarChart3,
  CheckCircle2,
  XCircle,
  Server,
} from "lucide-react"
import { fadeInUp, pageTransition } from "@/lib/animations/framer-motion"
import { useAuthStore } from "@/lib/store/authStore"
import { deleteTeacher, getTeacher, type TeacherResponse } from "@/lib/api/teachers"
import { listAttendance, type AttendanceEvent } from "@/lib/api/attendance"
import { listDevices, type DeviceResponse } from "@/lib/api/devices"
import { getTeacherSyncStatus } from "@/lib/api/sync"
import { getRoleFromToken } from "@/lib/utils/jwt"
import { cn, formatDateTime } from "@/lib/utils"
import { SyncTeacherToDeviceDialog } from "@/components/features/teachers/SyncTeacherToDeviceDialog"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

export default function TeacherDetailPage() {
  const router = useRouter()
  const params = useParams()
  const teacherId = useMemo(() => {
    const raw = params.id
    const value = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined
    const parsed = value ? Number(value) : NaN
    return Number.isFinite(parsed) ? parsed : undefined
  }, [params.id])

  const { token, user } = useAuthStore()
  const role = (user?.role || (token ? getRoleFromToken(token) : "") || "").toLowerCase()
  const canManage = role === "admin" || role === "school_admin" || role === "super_admin" || role === "superadmin"
  const [teacher, setTeacher] = useState<TeacherResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [showSyncDialog, setShowSyncDialog] = useState(false)

  const [devices, setDevices] = useState<DeviceResponse[]>([])
  const [syncedDeviceIds, setSyncedDeviceIds] = useState<Set<number>>(new Set())
  const [syncSummaryLoading, setSyncSummaryLoading] = useState(false)

  // Attendance history
  type Preset = "today" | "this_week" | "this_month" | "custom"
  const [preset, setPreset] = useState<Preset>("this_week")
  const [customFrom, setCustomFrom] = useState<string>("")
  const [customTo, setCustomTo] = useState<string>("")
  const [events, setEvents] = useState<AttendanceEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [eventsError, setEventsError] = useState<string | null>(null)

  const summary = useMemo(() => {
    // The system stores IN/OUT taps. For a high-level "present" indicator per day,
    // we count distinct days with any non-UNKNOWN tap.
    const dayKey = (iso: string) => iso.split("T")[0]
    const daysWithAny = new Set<string>()
    const inCount = events.filter((e) => e.event_type === "IN").length
    const outCount = events.filter((e) => e.event_type === "OUT").length
    const unknownCount = events.filter((e) => e.event_type === "UNKNOWN").length
    for (const e of events) {
      if (e.event_type !== "UNKNOWN") daysWithAny.add(dayKey(e.occurred_at))
    }
    return {
      daysPresent: daysWithAny.size,
      inCount,
      outCount,
      unknownCount,
    }
  }, [events])

  useEffect(() => {
    if (!token || !teacherId) return

    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const data = await getTeacher(token, teacherId)
        setTeacher(data)
      } catch {
        setError("Failed to load teacher")
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [token, teacherId])

  useEffect(() => {
    if (!token || !teacherId) return
    let cancelled = false

    const loadSyncSummary = async () => {
      setSyncSummaryLoading(true)
      try {
        const res = await listDevices(token, { page_size: 100 })
        if (cancelled) return
        setDevices(res.items)

        const online = res.items.filter((d) => d.status === "online")
        if (online.length === 0) {
          setSyncedDeviceIds(new Set())
          return
        }

        const results = await Promise.allSettled(
          online.map((d) => getTeacherSyncStatus(d.id, teacherId))
        )
        if (cancelled) return
        const synced = new Set<number>()
        results.forEach((r, idx) => {
          if (r.status === "fulfilled" && r.value.synced && online[idx]) {
            synced.add(online[idx].id)
          }
        })
        setSyncedDeviceIds(synced)
      } catch {
        if (!cancelled) {
          setDevices([])
          setSyncedDeviceIds(new Set())
        }
      } finally {
        if (!cancelled) setSyncSummaryLoading(false)
      }
    }

    loadSyncSummary()
    return () => {
      cancelled = true
    }
  }, [token, teacherId])

  const resolveRange = useMemo(() => {
    const today = new Date()
    const yyyyMmDd = (d: Date) => d.toISOString().split("T")[0]

    if (preset === "today") {
      const d = yyyyMmDd(today)
      return { from: d, to: d, mode: "target" as const }
    }

    if (preset === "this_week") {
      const d = new Date(today)
      const day = d.getDay() // 0=Sun
      const diffToMon = (day + 6) % 7
      d.setDate(d.getDate() - diffToMon)
      return { from: yyyyMmDd(d), to: yyyyMmDd(today), mode: "range" as const }
    }

    if (preset === "this_month") {
      const d = new Date(today.getFullYear(), today.getMonth(), 1)
      return { from: yyyyMmDd(d), to: yyyyMmDd(today), mode: "range" as const }
    }

    if (!customFrom || !customTo) return null
    return { from: customFrom, to: customTo, mode: "range" as const }
  }, [preset, customFrom, customTo])

  const rangeSummary = useMemo(() => {
    if (!resolveRange) return null

    const start = new Date(resolveRange.from + "T00:00:00")
    const end = new Date(resolveRange.to + "T00:00:00")
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null

    const dayKey = (iso: string) => iso.split("T")[0]
    const presentDays = new Set<string>()
    for (const e of events) {
      if (e.event_type !== "UNKNOWN") presentDays.add(dayKey(e.occurred_at))
    }

    let expected = 0
    const cursor = new Date(start)
    while (cursor <= end) {
      const dow = cursor.getDay()
      const isWeekday = dow !== 0 && dow !== 6
      if (isWeekday) expected += 1
      cursor.setDate(cursor.getDate() + 1)
    }

    const absent = Math.max(0, expected - presentDays.size)
    return {
      expectedDays: expected,
      presentDays: presentDays.size,
      absentDays: absent,
    }
  }, [events, resolveRange])

  const trendData = useMemo(() => {
    if (!resolveRange) return []

    const start = new Date(resolveRange.from + "T00:00:00")
    const end = new Date(resolveRange.to + "T00:00:00")
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return []

    const dayKey = (iso: string) => iso.split("T")[0]
    const presentDays = new Set<string>()
    const inByDay = new Map<string, number>()
    const outByDay = new Map<string, number>()

    for (const e of events) {
      const key = dayKey(e.occurred_at)
      if (e.event_type !== "UNKNOWN") presentDays.add(key)
      if (e.event_type === "IN") inByDay.set(key, (inByDay.get(key) ?? 0) + 1)
      if (e.event_type === "OUT") outByDay.set(key, (outByDay.get(key) ?? 0) + 1)
    }

    const data: Array<{ date: string; label: string; present: number; in: number; out: number }> = []
    const cursor = new Date(start)
    const fmt = (d: Date) => d.toISOString().split("T")[0]
    while (cursor <= end) {
      const key = fmt(cursor)
      data.push({
        date: key,
        label: cursor.toLocaleDateString("en-KE", { month: "short", day: "2-digit" }),
        present: presentDays.has(key) ? 1 : 0,
        in: inByDay.get(key) ?? 0,
        out: outByDay.get(key) ?? 0,
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    return data
  }, [events, resolveRange])

  useEffect(() => {
    if (!token || !teacherId) return
    if (!resolveRange) {
      setEvents([])
      return
    }

    const fetchEvents = async () => {
      setEventsLoading(true)
      setEventsError(null)
      try {
        if (resolveRange.mode === "target") {
          const res = await listAttendance(token, {
            user_type: "teacher",
            teacher_id: teacherId,
            target_date: resolveRange.from,
            page: 1,
            page_size: 200,
          })
          setEvents(res.items)
        } else {
          const res = await listAttendance(token, {
            user_type: "teacher",
            teacher_id: teacherId,
            date_from: resolveRange.from,
            date_to: resolveRange.to,
            page: 1,
            page_size: 200,
          })
          setEvents(res.items)
        }
      } catch (err: unknown) {
        if (axios.isAxiosError(err)) {
          const status = err.response?.status
          const detail = (err.response?.data as { detail?: unknown } | undefined)?.detail
          const detailText =
            typeof detail === "string"
              ? detail
              : typeof (detail as { message?: unknown } | undefined)?.message === "string"
                ? (detail as { message: string }).message
                : undefined

          if (status === 503) {
            setEventsError("Attendance service is unavailable (503). Please start the Attendance Service and try again.")
          } else if (status === 401) {
            setEventsError("Authentication required (401). Please log in again.")
          } else {
            setEventsError(
              `${detailText || "Failed to load attendance history"}${status ? ` (${status})` : ""}`
            )
          }
        } else {
          setEventsError("Failed to load attendance history")
        }
        setEvents([])
      } finally {
        setEventsLoading(false)
      }
    }

    fetchEvents()
  }, [token, teacherId, resolveRange])

  const handleDelete = async () => {
    if (!token || !teacherId) return
    try {
      setIsDeleting(true)
      await deleteTeacher(token, teacherId)
      router.push("/dashboard/teachers")
    } catch {
      setIsDeleting(false)
      setError("Failed to delete teacher")
    }
  }

  if (isLoading) {
    return (
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex-1 space-y-6 p-4 sm:p-8 lg:p-10 bg-gray-50/50 dark:bg-gray-950"
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-2">
          <Card>
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        </div>
      </motion.main>
    )
  }

  if (error || !teacher) {
    return (
      <motion.main
        variants={pageTransition}
        initial="initial"
        animate="animate"
        className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8"
      >
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => router.push("/dashboard/teachers")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Teachers
          </Button>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error || "Teacher not found"}</AlertDescription>
          </Alert>
        </div>
      </motion.main>
    )
  }

  const initials = `${teacher.first_name?.[0] ?? ""}${teacher.last_name?.[0] ?? ""}`.toUpperCase()

  return (
    <motion.main
      variants={pageTransition}
      initial="initial"
      animate="animate"
      className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8"
    >
      <div className="space-y-6">
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between"
        >
          <Button
            variant="ghost"
            onClick={() => router.push("/dashboard/teachers")}
            className="text-muted-foreground hover:text-foreground font-extrabold uppercase text-[10px] tracking-widest gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Teachers
          </Button>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => setShowSyncDialog(true)}
              className="w-full sm:w-auto border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 font-bold uppercase text-[10px] tracking-widest h-11 px-6 rounded-xl transition-all active:scale-95"
            >
              <Server className="mr-2 h-4 w-4" />
              Sync to Device
            </Button>
            {canManage && (
              <>
                <Button
                  variant="outline"
                  onClick={() => router.push(`/dashboard/teachers/${teacher.id}/edit`)}
                  className="w-full sm:w-auto border-blue-200 text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 font-bold uppercase text-[10px] tracking-widest h-11 px-6 rounded-xl transition-all active:scale-95"
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Modify Record
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 font-bold uppercase text-[10px] tracking-widest h-11 px-6 rounded-xl shadow-lg shadow-rose-600/20 transition-all active:scale-95"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Faculty
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </motion.div>

        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border-white/50 dark:border-gray-700/50 shadow-2xl rounded-[2.5rem] overflow-hidden">
            <CardHeader className="p-6 sm:p-10 border-b border-gray-100/50 dark:border-gray-800/50 relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl -mr-32 -mt-32" />
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 relative">
                <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-600 to-purple-600 text-white text-3xl font-bold shadow-xl shadow-violet-600/20 shrink-0 transform -rotate-3">
                  {initials || "T"}
                </div>
                <div className="text-center sm:text-left pt-2">
                  <Badge variant="outline" className="mb-3 font-bold uppercase text-[9px] tracking-[0.2em] px-3 py-1 border-violet-200 text-violet-600 bg-violet-50/50">
                    Faculty Personnel ID: {teacher.employee_id || "TID-NEW"}
                  </Badge>
                  <CardTitle className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
                    {teacher.first_name} {teacher.last_name}
                  </CardTitle>
                  <div className="flex flex-wrap justify-center sm:justify-start items-center gap-3 mt-4">
                    <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-xl border border-emerald-100 dark:border-emerald-800/50">
                      <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">
                        {teacher.is_active ? "Active Duty" : "On Leave"}
                      </span>
                    </div>
                    {teacher.department && (
                       <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-bold uppercase text-[9px] tracking-widest px-3 py-1.5 rounded-xl border-none">
                         Dept: {teacher.department}
                       </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-8 sm:p-10 space-y-10">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="rounded-[2rem] border border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/20 p-6">
                  <div className="flex items-center gap-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
                    <User className="h-4 w-4 text-violet-600" />
                    Personnel Identity
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Full Legal Name</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{teacher.first_name} {teacher.last_name}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Employee Serial</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{teacher.employee_id || "—"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">System Status</p>
                      <span className="inline-flex items-center gap-2 text-sm font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-full">
                        <BadgeCheck className="h-4 w-4" />
                        Verified Active
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-[2rem] border border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/20 p-6">
                  <div className="flex items-center gap-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
                    <Phone className="h-4 w-4 text-indigo-600" />
                    Communication Vector
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Voice Terminal</p>
                      <a className="text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors block" href={`tel:${teacher.phone}`}>{teacher.phone}</a>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Digital Correspondence</p>
                      {teacher.email ? (
                        <a className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors block break-all" href={`mailto:${teacher.email}`}>{teacher.email}</a>
                      ) : (
                        <span className="text-sm font-bold text-muted-foreground italic">—</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-[2rem] border border-violet-100 dark:border-violet-900/30 bg-gradient-to-br from-violet-50/50 to-white dark:from-violet-900/10 dark:to-gray-900/10 p-6 shadow-sm">
                  <div className="flex items-center gap-3 text-[10px] font-bold text-violet-700 dark:text-violet-400 uppercase tracking-widest mb-4">
                    <BookOpen className="h-4 w-4" />
                    Academic Portfolio
                  </div>
                  <div className="space-y-5">
                    <div className="space-y-3">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Specializations</p>
                      <div className="flex flex-wrap gap-2">
                        {teacher.subject && teacher.subject.length > 0 ? (
                          teacher.subject.map((s, idx) => (
                            <Badge
                              key={idx}
                              variant="secondary"
                              className="bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800 px-3 py-1 rounded-xl text-[10px] font-bold uppercase tracking-widest"
                            >
                              {s}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs font-bold text-muted-foreground italic">No domains assigned</span>
                        )}
                      </div>
                    </div>
                    <div className="pt-4 border-t border-violet-100 dark:border-violet-900/20">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Institutional Dept.</p>
                      <Badge variant="outline" className="border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 bg-white/50 dark:bg-gray-950 font-bold uppercase text-[10px] tracking-widest px-4 py-1.5 rounded-xl">
                        {teacher.department || "Lead Faculty"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <span>Created: {formatDateTime(teacher.created_at)}</span>
                  </div>
                  {teacher.updated_at && (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      <span>Last Updated: {formatDateTime(teacher.updated_at)}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Sync Status */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.15 }}
        >
          <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border-white/50 dark:border-gray-700/50 shadow-2xl rounded-[2.5rem] overflow-hidden">
            <CardHeader className="p-8 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold tracking-tight flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/20">
                      <Server className="h-5 w-5 text-white" />
                    </div>
                    Device Synchronization
                  </CardTitle>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-2 ml-13"> Biometric reconciliation vector</p>
                </div>
                {syncSummaryLoading ? (
                   <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                ) : (
                  <Badge variant={syncedDeviceIds.size > 0 ? "secondary" : "outline"} className={`h-8 px-4 rounded-xl font-bold uppercase text-[9px] tracking-widest ${syncedDeviceIds.size > 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'text-amber-600 border-amber-100'}`}>
                    {syncedDeviceIds.size > 0 ? "Reconciled" : "Pending Sync"}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-8 pt-4 space-y-6">
               <div className="p-6 rounded-[2rem] bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100/50 dark:border-indigo-800/50">
                  <p className="text-xs font-medium text-indigo-800/90 dark:text-indigo-200/90 leading-relaxed">
                    Sync this teacher to devices so they can clock in and out at the gate terminals.
                  </p>
                  <div className="flex flex-wrap items-center gap-3 mt-4">
                    <div className="flex items-center gap-2 bg-white/80 dark:bg-gray-900/80 px-3 py-1.5 rounded-lg border border-indigo-200/50 dark:border-indigo-800/50">
                       <div className={`h-2 w-2 rounded-full ${syncedDeviceIds.size > 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                       <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">
                         {syncedDeviceIds.size} Node{syncedDeviceIds.size !== 1 ? 's' : ''} Synced
                       </span>
                    </div>
                    <div className="flex items-center gap-2 bg-white/80 dark:bg-gray-900/80 px-3 py-1.5 rounded-lg border border-indigo-200/50 dark:border-indigo-800/50">
                       <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                         Nodes Online: {devices.filter((d) => d.status === "online").length}
                       </span>
                    </div>
                  </div>
               </div>

              <Button
                variant="outline"
                onClick={() => setShowSyncDialog(true)}
                className="w-full sm:w-auto h-12 px-8 border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 font-bold uppercase text-[10px] tracking-widest rounded-xl transition-all active:scale-95"
              >
                <Server className="mr-3 h-4 w-4" />
                Initiate Node Sync
              </Button>
            </CardContent>
          </Card>
        </motion.div>


        {/* Attendance History */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border-white/50 dark:border-gray-700/50 shadow-2xl rounded-[2.5rem] overflow-hidden">
            <CardHeader className="p-8 border-b border-gray-100/50 dark:border-gray-800/50">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-2xl font-bold tracking-tight flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-600/20">
                      <BarChart3 className="h-5 w-5 text-white" />
                    </div>
                    Faculty Attendance Analytics
                  </CardTitle>
                  <p className="mt-2 text-xs text-muted-foreground">Presence, entries, and exits for the range you select.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <div className="flex items-center bg-gray-100/80 dark:bg-gray-900/80 rounded-2xl p-1.5 border border-white/10">
                    {([
                      { id: "today" as const, label: "Today" },
                      { id: "this_week" as const, label: "Week" },
                      { id: "this_month" as const, label: "Month" },
                      { id: "custom" as const, label: "Custom" },
                    ] as const).map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setPreset(t.id)}
                        className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all ${preset === t.id
                          ? "bg-white dark:bg-gray-800 text-violet-600 shadow-xl scale-105"
                          : "text-muted-foreground hover:text-foreground dark:hover:text-white"}`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-8 space-y-8">
              {preset === "custom" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                  <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 p-4">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Calendar className="h-3 w-3 text-violet-500" />
                      From
                    </p>
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="w-full h-11 rounded-xl border border-gray-100 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 px-4 text-xs font-bold focus:ring-4 focus:ring-violet-600/10 outline-none transition-all"
                    />
                  </div>
                  <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 p-4">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Calendar className="h-3 w-3 text-violet-500" />
                      To
                    </p>
                    <input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="w-full h-11 rounded-xl border border-gray-100 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 px-4 text-xs font-bold focus:ring-4 focus:ring-violet-600/10 outline-none transition-all"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
                {(
                  [
                    {
                      label: "Days present",
                      value: summary.daysPresent,
                      sub: rangeSummary
                        ? `${rangeSummary.presentDays} / ${rangeSummary.expectedDays} weekdays`
                        : "In selected range",
                      icon: CheckCircle2,
                      iconWrap: "bg-green-50 dark:bg-green-900/25 text-green-600 dark:text-green-400",
                      glow: "bg-green-500/10",
                    },
                    {
                      label: "Weekdays absent",
                      value: rangeSummary?.absentDays ?? 0,
                      sub: "Expected weekdays minus days seen",
                      icon: XCircle,
                      iconWrap: "bg-red-50 dark:bg-red-900/25 text-red-600 dark:text-red-400",
                      glow: "bg-red-500/10",
                    },
                    {
                      label: "Entry taps",
                      value: summary.inCount,
                      sub: "IN events in range",
                      icon: Server,
                      iconWrap: "bg-indigo-50 dark:bg-indigo-900/25 text-indigo-600 dark:text-indigo-400",
                      glow: "bg-indigo-500/10",
                    },
                    {
                      label: "Exit taps",
                      value: summary.outCount,
                      sub: "OUT events in range",
                      icon: Server,
                      iconWrap: "bg-purple-50 dark:bg-purple-900/25 text-purple-600 dark:text-purple-400",
                      glow: "bg-purple-500/10",
                    },
                  ] as const
                ).map((item, i) => {
                  const Icon = item.icon
                  const display =
                    typeof item.value === "number" ? item.value.toLocaleString() : String(item.value)
                  return (
                    <div
                      key={i}
                      className="group relative overflow-hidden rounded-2xl border border-gray-200/50 bg-white/80 p-4 shadow-sm backdrop-blur-sm transition-all hover:border-indigo-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-950/80 dark:hover:border-indigo-800 sm:p-5"
                    >
                      <div
                        className={cn(
                          "pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl transition-transform group-hover:scale-125",
                          item.glow
                        )}
                      />
                      <div className="relative flex items-start gap-3">
                        <div
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                            item.iconWrap
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                            {item.label}
                          </p>
                          <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100 sm:text-3xl">
                            {display}
                          </p>
                          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{item.sub}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="rounded-2xl border border-gray-200/50 bg-white/80 p-5 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/40 sm:rounded-[2rem] sm:p-8">
                <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">Presence by day</p>
                    <p className="mt-1 text-xs text-muted-foreground">Tall bar = at least one check-in or out that day.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-violet-600 shadow-md shadow-violet-600/30" />
                      <span className="text-xs font-semibold text-muted-foreground">Present</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600" />
                      <span className="text-xs font-semibold text-muted-foreground">Absent</span>
                    </div>
                  </div>
                </div>
                <div className="h-52 sm:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                      <defs>
                        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1}/>
                          <stop offset="100%" stopColor="#6366f1" stopOpacity={0.8}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#000" opacity={0.05} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: 800 }} axisLine={false} tickLine={false} dy={10} />
                      <YAxis ticks={[0, 1]} domain={[0, 1]} tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: 800 }} axisLine={false} tickLine={false} dx={-5} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                             const isPresent = payload[0].value === 1
                             return (
                                <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl p-4 rounded-2xl border border-white/20 shadow-2xl">
                                   <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2">{label}</p>
                                   <div className="flex items-center gap-2">
                                      <div className={`h-2 w-2 rounded-full ${isPresent ? 'bg-violet-600' : 'bg-gray-300'}`} />
                                      <span className="text-xs font-bold">{isPresent ? 'Verified Present' : 'Absent'}</span>
                                   </div>
                                </div>
                             )
                          }
                          return null
                        }}
                      />
                      <Bar dataKey="present" fill="url(#barGradient)" radius={[8, 8, 4, 4]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
                  <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-gray-100">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Activity log
                  </h4>
                  <Badge
                    variant="outline"
                    className="w-fit border-gray-200 bg-white/80 px-3 py-1 text-xs font-semibold dark:border-gray-700 dark:bg-gray-950"
                  >
                    {events.length} event{events.length !== 1 ? "s" : ""}
                  </Badge>
                </div>

                <div className="overflow-hidden rounded-2xl border border-gray-200/50 bg-white/80 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/30">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-gray-200/50 bg-gray-50/80 dark:border-gray-800 dark:bg-gray-900/50">
                          <th className="px-4 py-4 text-xs font-bold uppercase tracking-wide text-muted-foreground sm:px-6">
                            Time
                          </th>
                          <th className="px-4 py-4 text-xs font-bold uppercase tracking-wide text-muted-foreground sm:px-6">
                            Type
                          </th>
                          <th className="hidden px-6 py-4 text-xs font-bold uppercase tracking-wide text-muted-foreground sm:table-cell">
                            Device
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {eventsLoading ? (
                          Array.from({ length: 5 }).map((_, i) => (
                            <tr key={i} className="animate-pulse">
                              <td className="px-4 py-4 sm:px-6">
                                <div className="h-4 w-36 rounded-lg bg-gray-100 dark:bg-gray-800" />
                              </td>
                              <td className="px-4 py-4 sm:px-6">
                                <div className="h-6 w-20 rounded-full bg-gray-100 dark:bg-gray-800" />
                              </td>
                              <td className="hidden px-6 py-4 sm:table-cell">
                                <div className="h-4 w-28 rounded-lg bg-gray-100 dark:bg-gray-800" />
                              </td>
                            </tr>
                          ))
                        ) : events.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-6 py-14 text-center">
                              <p className="text-sm text-muted-foreground">No attendance in this range yet.</p>
                            </td>
                          </tr>
                        ) : (
                          events.map((evt) => {
                            const time = formatDateTime(evt.occurred_at)
                            const isEntry = evt.event_type === "IN"
                            return (
                              <tr
                                key={evt.id}
                                className="transition-colors hover:bg-blue-50/40 dark:hover:bg-gray-800/50"
                              >
                                <td className="px-4 py-4 text-sm font-semibold text-gray-900 tabular-nums dark:text-gray-100 sm:px-6">
                                  {time}
                                </td>
                                <td className="px-4 py-4 sm:px-6">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "font-semibold",
                                      isEntry
                                        ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-400"
                                        : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                                    )}
                                  >
                                    {isEntry ? "Entry" : "Exit"}
                                  </Badge>
                                </td>
                                <td className="hidden px-6 py-4 text-sm text-muted-foreground sm:table-cell">
                                  {evt.device_name}
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <SyncTeacherToDeviceDialog
        open={showSyncDialog}
        onOpenChange={setShowSyncDialog}
        teacherId={teacher.id}
        teacherName={`${teacher.first_name} ${teacher.last_name}`}
      />
    </motion.main>
  )
}

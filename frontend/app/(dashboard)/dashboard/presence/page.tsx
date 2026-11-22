"use client"


import { OrbitLoader } from "@/components/shared/OrbitLoader"
import { useState, useEffect, useCallback, useMemo } from "react"
import { motion } from "framer-motion"
import { format } from "date-fns"
import {
  DoorOpen,
  Users,
  UserCheck,
  Loader2,
  FileDown,
  RefreshCw,
  LogIn,
  LogOut,
  Calendar,
  Search,
  Filter,
} from "lucide-react"
import { useAuthStore } from "@/lib/store/authStore"
import { getApiBaseUrlOrFallback } from "@/lib/env"
import { fadeInUp, staggerContainer } from "@/lib/animations/framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  getPresenceOverview,
  listRosterCurrentlyIn,
  listStudentsOffPremises,
  listTeachersCurrentlyIn,
  listTeachersOffPremises,
  listAttendance,
  type PresenceOverview,
  type RosterStudentItem,
  type StudentOffPremisesItem,
  type TeacherPresenceRow,
  type AttendanceEvent,
  type PresenceBasis,
} from "@/lib/api/attendance"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/shared/PageHeader"
import { KpiCard, type Tone } from "@/components/shared/KpiCard"
import { Skeleton } from "@/components/ui/skeleton"

function fmtTs(iso: string | null | undefined) {
  if (!iso) return "—"
  return iso.replace("T", " ").slice(0, 19)
}

export default function PresencePage() {
  const { token, hasHydrated } = useAuthStore()
  const [targetDate, setTargetDate] = useState(() => format(new Date(), "yyyy-MM-dd"))
  const [reportEndDate, setReportEndDate] = useState(() => format(new Date(), "yyyy-MM-dd"))
  const [overview, setOverview] = useState<PresenceOverview | null>(null)
  const [stuIn, setStuIn] = useState<RosterStudentItem[]>([])
  const [stuOut, setStuOut] = useState<StudentOffPremisesItem[]>([])
  const [tchIn, setTchIn] = useState<TeacherPresenceRow[]>([])
  const [tchOut, setTchOut] = useState<TeacherPresenceRow[]>([])
  const [loading, setLoading] = useState(true)

  // New states for Live Attendance Workspace
  const [liveType, setLiveType] = useState<"student" | "teacher">("student")
  const [liveFrom, setLiveFrom] = useState(() => format(new Date(), "yyyy-MM-dd"))
  const [liveTo, setLiveTo] = useState(() => format(new Date(), "yyyy-MM-dd"))
  const [liveList, setLiveList] = useState<AttendanceEvent[]>([])
  const [liveLoading, setLiveLoading] = useState(false)
  const [liveSearch, setLiveSearch] = useState("")
  const [livePage, setLivePage] = useState(1)
  const [liveTotal, setLiveTotal] = useState(0)

  const [studentLayout, setStudentLayout] = useState<"summary" | "timeline">("summary")
  const [studentScope, setStudentScope] = useState<"all" | "in" | "out">("all")
  const [studentGroupByClass, setStudentGroupByClass] = useState(false)
  const [teacherLayout, setTeacherLayout] = useState<"summary" | "timeline">("summary")
  const [teacherScope, setTeacherScope] = useState<"all" | "in" | "out">("all")
  const [pdfBusy, setPdfBusy] = useState(false)
  const [presenceBasis, setPresenceBasis] = useState<PresenceBasis>("session")
  const [presentStuSearch, setPresentStuSearch] = useState("")
  const [presentTchSearch, setPresentTchSearch] = useState("")
  const [rosterTab, setRosterTab] = useState("stu_in")

  const rosterParams = useMemo(
    () => ({ target_date: targetDate, presence_basis: presenceBasis }),
    [targetDate, presenceBasis]
  )

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const [ov, a, b, c, d] = await Promise.all([
        getPresenceOverview(token, rosterParams),
        listRosterCurrentlyIn(token, rosterParams),
        listStudentsOffPremises(token, rosterParams),
        listTeachersCurrentlyIn(token, rosterParams),
        listTeachersOffPremises(token, rosterParams),
      ])
      setOverview(ov)
      setStuIn(a)
      setStuOut(b)
      setTchIn(c)
      setTchOut(d)
    } catch {
      setOverview(null)
      setStuIn([])
      setStuOut([])
      setTchIn([])
      setTchOut([])
    } finally {
      setLoading(false)
    }
  }, [token, rosterParams])

  useEffect(() => {
    if (hasHydrated && token) load()
  }, [hasHydrated, token, load])

  const loadLive = useCallback(async () => {
    if (!token) return
    setLiveLoading(true)
    try {
      const res = await listAttendance(token, {
        date_from: liveFrom,
        date_to: liveTo,
        user_type: liveType,
        search: liveSearch || undefined,
        page: livePage,
        page_size: 15,
      })
      setLiveList(res.items)
      setLiveTotal(res.total)
    } catch {
      setLiveList([])
      setLiveTotal(0)
    } finally {
      setLiveLoading(false)
    }
  }, [token, liveFrom, liveTo, liveType, liveSearch, livePage])

  useEffect(() => {
    if (hasHydrated && token) loadLive()
  }, [hasHydrated, token, loadLive])

  useEffect(() => {
    setReportEndDate((prev) => (prev < targetDate ? targetDate : prev))
  }, [targetDate])

  const apiBase = getApiBaseUrlOrFallback()

  const stuInFiltered = useMemo(() => {
    const q = presentStuSearch.toLowerCase().trim()
    if (!q) return stuIn
    return stuIn.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        r.admission_number.toLowerCase().includes(q) ||
        (r.class_name ?? "").toLowerCase().includes(q)
    )
  }, [stuIn, presentStuSearch])

  const tchInFiltered = useMemo(() => {
    const q = presentTchSearch.toLowerCase().trim()
    if (!q) return tchIn
    return tchIn.filter(
      (r) =>
        `${r.first_name} ${r.last_name}`.toLowerCase().includes(q) ||
        (r.employee_id ?? "").toLowerCase().includes(q) ||
        (r.department ?? "").toLowerCase().includes(q)
    )
  }, [tchIn, presentTchSearch])

  const downloadPdf = async (url: string, filename: string) => {
    if (!token) return
    setPdfBusy(true)
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) {
        let msg = `Download failed (${res.status})`
        try {
          const j = await res.json()
          if (typeof j?.detail === "string") msg = j.detail
        } catch {
          /* ignore */
        }
        toast.error(msg)
        return
      }
      const blobData = await res.blob()
      const file = new File([blobData], filename, { type: "application/pdf" })
      const u = URL.createObjectURL(file)
      const a = document.createElement("a")
      a.href = u
      a.download = filename
      
      // Update document title temporarily
      const oldTitle = document.title
      document.title = filename
      
      a.click()
      
      setTimeout(() => {
        URL.revokeObjectURL(u)
        document.title = oldTitle
      }, 1000)
      toast.success("PDF downloaded")
    } finally {
      setPdfBusy(false)
    }
  }

  const studentRangePdf = () => {
    const q = new URLSearchParams({
      date_from: targetDate,
      date_to: reportEndDate,
      user_type: "student",
      report_layout: studentLayout,
      event_scope: studentScope,
      include_duplicates: "false",
    })
    if (studentGroupByClass && studentLayout === "summary") q.set("group_by_class", "true")
    downloadPdf(
      `${apiBase}/api/v1/reports/present-range?${q}`,
      `students-attendance-${targetDate}-${reportEndDate}.pdf`
    )
  }

  const teacherRangePdf = () => {
    const q = new URLSearchParams({
      date_from: targetDate,
      date_to: reportEndDate,
      user_type: "teacher",
      report_layout: teacherLayout,
      event_scope: teacherScope,
      include_duplicates: "false",
    })
    downloadPdf(
      `${apiBase}/api/v1/reports/present-range?${q}`,
      `teachers-attendance-${targetDate}-${reportEndDate}.pdf`
    )
  }

  if (!hasHydrated) return null

  return (
    <div className="page-shell">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="space-y-5"
      >
        {/* Header */}
        <PageHeader
          icon={DoorOpen}
          title="Presence"
          subtitle="Who is on site right now, with live logs and PDF registers"
          actions={
            <>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-44 pl-10"
                />
              </div>
              <Button type="button" onClick={() => load()} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Sync data
              </Button>
            </>
          }
        />

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {([
            { label: "Students on site", value: overview?.students_on_premises ?? 0, total: overview?.total_students ?? 1, icon: LogIn, tone: "success" },
            { label: "Students off site", value: overview?.students_off_premises ?? 0, total: overview?.total_students ?? 1, icon: LogOut, tone: "warning" },
            { label: "Teachers on site", value: overview?.teachers_on_premises ?? 0, total: overview?.total_teachers ?? 1, icon: UserCheck, tone: "info" },
            { label: "Teachers off site", value: overview?.teachers_off_premises ?? 0, total: overview?.total_teachers ?? 1, icon: Users, tone: "neutral" },
          ] as { label: string; value: number; total: number; icon: typeof LogIn; tone: Tone }[]).map((c) => {
            const pct = Number(c.total) ? Math.round((Number(c.value) / Number(c.total)) * 100) : 0
            return (
              <KpiCard
                key={c.label}
                label={c.label}
                value={overview ? c.value.toLocaleString() : "…"}
                icon={c.icon as never}
                tone={c.tone}
                bar={{ value: pct, label: `${pct}% of ${Number(c.total).toLocaleString()}` }}
              />
            )
          })}
        </div>

        {/* Live Attendance Workspace */}
        <motion.div variants={fadeInUp}>
          <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="border-b border-slate-100 bg-white py-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-[15px]">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                    Live attendance
                  </CardTitle>
                  <CardDescription>
                    Real-time attendance logs for the selected date range.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-0.5 rounded-xl border border-slate-200 bg-slate-100/80 p-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLiveType("student")}
                    className={`rounded-lg transition-all ${liveType === "student" ? "!bg-white !text-primary shadow-[var(--shadow-key-2)]" : "text-slate-500"}`}
                  >
                    Students
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLiveType("teacher")}
                    className={`rounded-lg transition-all ${liveType === "teacher" ? "!bg-white !text-primary shadow-[var(--shadow-key-2)]" : "text-slate-500"}`}
                  >
                    Teachers
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Workspace Controls */}
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-end gap-3 sm:gap-4">
                <div className="w-full space-y-2 sm:w-auto">
                  <Label className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Date range</Label>
                  <div className="flex items-center gap-2">
                    <div className="relative group min-w-0 flex-1 sm:flex-none">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-blue-500 transition-colors" />
                      <Input
                        type="date"
                        value={liveFrom}
                        onChange={(e) => setLiveFrom(e.target.value)}
                        className="w-full sm:w-[160px] pl-10 h-10 border-gray-200 dark:border-gray-700 focus:border-blue-500 rounded-xl bg-white dark:bg-gray-900"
                      />
                    </div>
                    <span className="text-muted-foreground font-bold">→</span>
                    <div className="relative group min-w-0 flex-1 sm:flex-none">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-blue-500 transition-colors" />
                      <Input
                        type="date"
                        value={liveTo}
                        onChange={(e) => setLiveTo(e.target.value)}
                        className="w-full sm:w-[160px] pl-10 h-10 border-gray-200 dark:border-gray-700 focus:border-blue-500 rounded-xl bg-white dark:bg-gray-900"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex-1 min-w-[200px] space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Search records</Label>
                  <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-blue-500 transition-colors" />
                    <Input
                      placeholder={liveType === "student" ? "Search by name, admission..." : "Search by name, employee #..."}
                      value={liveSearch}
                      onChange={(e) => setLiveSearch(e.target.value)}
                      className="pl-10 h-10 border-gray-200 dark:border-gray-700 focus:border-blue-500 rounded-xl bg-white dark:bg-gray-900"
                    />
                  </div>
                </div>

                <Button
                  onClick={loadLive}
                  disabled={liveLoading}
                  className="px-6"
                >
                  {liveLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4" />}
                  Apply filter
                </Button>
              </div>

              {/* Workspace Table */}
              <div className="relative overflow-x-auto min-h-[400px]">
                {liveLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-white z-20">
                    <div className="flex flex-col items-center gap-4">
                      <OrbitLoader size={56} />
                      <p className="text-sm font-bold text-blue-600 animate-pulse">Loading attendance…</p>
                    </div>
                  </div>
                ) : null}

                <Table>
                  <TableHeader>
                    <TableRow className="border-0 hover:bg-transparent bg-indigo-50/50 dark:bg-indigo-900/30">
                      <TableHead className="text-[10px] font-bold uppercase tracking-[0.08em] text-indigo-600 dark:text-indigo-300 h-14 px-6">User Details</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-[0.08em] text-indigo-600 dark:text-indigo-300 h-14">Identification</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-[0.08em] text-indigo-600 dark:text-indigo-300 h-14">Type</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-[0.08em] text-indigo-600 dark:text-indigo-300 h-14">Date & Time</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-[0.08em] text-indigo-600 dark:text-indigo-300 h-14 text-center">Device</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-[0.08em] text-indigo-600 dark:text-indigo-300 h-14 text-right px-6">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {liveList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-60 text-center">
                          <div className="flex flex-col items-center justify-center space-y-3 opacity-40">
                            <DoorOpen className="h-16 w-16 text-gray-300" />
                            <p className="text-lg font-bold text-gray-500 tracking-tight">No records found for this period</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      liveList.map((ev, i) => (
                        <motion.tr
                          key={ev.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="transition-colors"
                        >
                          <TableCell className="py-4">
                            <div className="flex items-center gap-3">
                              <div className={`h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold ${liveType === 'student' ? 'bg-blue-100 text-blue-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                {(ev.student_name || ev.teacher_name || "?")[0]}
                              </div>
                              <div>
                                <p className="font-bold text-sm text-gray-900 dark:text-gray-100 leading-none mb-1">
                                  {ev.student_name || ev.teacher_name || "Unknown"}
                                </p>
                                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">
                                  {ev.class_name || ev.department || "General"}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-[11px] bg-white">
                              {ev.admission_number || ev.employee_id || "—"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              {ev.event_type === "IN" ? (
                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-sm" />
                              ) : (
                                <div className="h-1.5 w-1.5 rounded-full bg-amber-500 shadow-sm" />
                              )}
                              <span className={`text-[10px] font-bold tracking-[0.08em] ${ev.event_type === "IN" ? "text-emerald-600" : "text-amber-600"}`}>
                                {ev.event_type}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-[11px] font-bold text-gray-900 dark:text-gray-200">{format(new Date(ev.occurred_at), "MMM d, yyyy")}</p>
                            <p className="text-[10px] font-medium text-muted-foreground">{format(new Date(ev.occurred_at), "h:mm a")}</p>
                          </TableCell>
                          <TableCell>
                            <p className="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-tight italic">
                              {ev.device_name}
                            </p>
                          </TableCell>
                          <TableCell className="text-right">
                             <div className="inline-flex h-2 w-2 rounded-full bg-blue-500/20 p-2 items-center justify-center">
                               <div className="h-1 w-1 rounded-full bg-blue-500" />
                             </div>
                          </TableCell>
                        </motion.tr>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {liveTotal > 15 && (
                <div className="data-footer">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.08em]">
                    Showing {liveList.length} of {liveTotal} records
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={livePage === 1 || liveLoading}
                      onClick={() => setLivePage(p => Math.max(1, p - 1))}
                      className="px-4"
                    >
                      Prev
                    </Button>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold h-8 w-8 flex items-center justify-center bg-primary text-white rounded-lg">
                        {livePage}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={livePage * 15 >= liveTotal || liveLoading}
                      onClick={() => setLivePage(p => p + 1)}
                      className="px-4"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* PDF Reports Workspace */}
        <motion.div variants={fadeInUp}>
          <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
            {/* Student Reports */}
            <Card className="gap-0 overflow-hidden py-0">
               <div className="p-6 pb-2">
                 <div className="flex items-center justify-between mb-2">
                   <div className="icon-tile h-10 w-10">
                     <FileDown className="h-5 w-5 text-white" />
                   </div>
                   <Badge variant="outline" className="border-blue-200 text-blue-600 uppercase font-bold text-[9px]">Students</Badge>
                 </div>
                 <h3 className="text-[15px] font-semibold text-slate-900">Student reports</h3>
                 <p className="text-xs text-muted-foreground mt-1">Export detailed attendance history to professional PDF documents.</p>
               </div>
               <CardContent className="p-6 space-y-8">
                  <div className="grid sm:grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">Layout Type</Label>
                        <div className="grid grid-cols-2 gap-2 bg-gray-100 dark:bg-gray-900 p-1 rounded-xl">
                          <button
                            onClick={() => setStudentLayout("summary")}
                            className={`py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] rounded-lg transition-all ${studentLayout === 'summary' ? 'bg-white dark:bg-gray-800 shadow-sm text-blue-600' : 'text-muted-foreground'}`}
                          >
                            Summary
                          </button>
                          <button
                            onClick={() => setStudentLayout("timeline")}
                            className={`py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] rounded-lg transition-all ${studentLayout === 'timeline' ? 'bg-white dark:bg-gray-800 shadow-sm text-blue-600' : 'text-muted-foreground'}`}
                          >
                            Timeline
                          </button>
                        </div>
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">Scope</Label>
                        <select
                          value={studentScope}
                          onChange={(e) => setStudentScope(e.target.value as any)}
                          className="w-full h-9 bg-gray-100 dark:bg-gray-900 border-0 rounded-xl px-3 text-[10px] font-bold uppercase tracking-[0.08em] focus:ring-2 focus:ring-blue-500"
                        >
                           <option value="all">Check IN & OUT</option>
                           <option value="in">Check-ins Only</option>
                           <option value="out">Check-outs Only</option>
                        </select>
                     </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-between">
                       <Label className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">Selected Range</Label>
                       <p className="text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-md">
                         {format(new Date(targetDate), "MMM d")} — {format(new Date(reportEndDate), "MMM d, yyyy")}
                       </p>
                    </div>
                    <Button
                      className="w-full h-11"
                      onClick={studentRangePdf}
                      disabled={pdfBusy}
                    >
                      {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                      Download student PDF
                    </Button>
                  </div>
               </CardContent>
            </Card>

            {/* Teacher Reports */}
            <Card className="gap-0 overflow-hidden py-0">
               <div className="p-6 pb-2">
                 <div className="flex items-center justify-between mb-2">
                   <div className="icon-tile h-10 w-10">
                     <FileDown className="h-5 w-5 text-white" />
                   </div>
                   <Badge variant="outline" className="border-indigo-200 text-indigo-600 uppercase font-bold text-[9px]">Teachers</Badge>
                 </div>
                 <h3 className="text-[15px] font-semibold text-slate-900">Staff reports</h3>
                 <p className="text-xs text-muted-foreground mt-1">Full professional audits for teachers and non-teaching staff.</p>
               </div>
               <CardContent className="p-6 space-y-8">
                  <div className="grid sm:grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">Audit Level</Label>
                        <div className="grid grid-cols-2 gap-2 bg-gray-100 dark:bg-gray-900 p-1 rounded-xl">
                          <button
                            onClick={() => setTeacherLayout("summary")}
                            className={`py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] rounded-lg transition-all ${teacherLayout === 'summary' ? 'bg-white dark:bg-gray-800 shadow-sm text-indigo-600' : 'text-muted-foreground'}`}
                          >
                            Summary
                          </button>
                          <button
                            onClick={() => setTeacherLayout("timeline")}
                            className={`py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] rounded-lg transition-all ${teacherLayout === 'timeline' ? 'bg-white dark:bg-gray-800 shadow-sm text-indigo-600' : 'text-muted-foreground'}`}
                          >
                            Timeline
                          </button>
                        </div>
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">Event Filter</Label>
                        <select
                          value={teacherScope}
                          onChange={(e) => setTeacherScope(e.target.value as any)}
                          className="w-full h-9 bg-gray-100 dark:bg-gray-900 border-0 rounded-xl px-3 text-[10px] font-bold uppercase tracking-[0.08em] focus:ring-2 focus:ring-indigo-500"
                        >
                           <option value="all">Audit All Events</option>
                           <option value="in">Inbound Only</option>
                           <option value="out">Outbound Only</option>
                        </select>
                     </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-between">
                       <Label className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">Selected Range</Label>
                       <p className="text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-md">
                         {format(new Date(targetDate), "MMM d")} — {format(new Date(reportEndDate), "MMM d, yyyy")}
                       </p>
                    </div>
                    <Button
                      className="w-full h-11"
                      onClick={teacherRangePdf}
                      disabled={pdfBusy}
                    >
                      {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                      Download staff PDF
                    </Button>
                  </div>
               </CardContent>
            </Card>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}

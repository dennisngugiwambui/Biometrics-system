"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  FileText, Download, Loader2, Calendar,
  ShieldCheck, TrendingUp, Clock,
  Users, UserCheck, RefreshCw,
  Search, Filter, Eye, Printer, X
} from "lucide-react"
import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts"
import { useAuthStore } from "@/lib/store/authStore"
import { getApiBaseUrlOrFallback } from "@/lib/env"
import {
  fadeInUp,
  staggerContainer,
} from "@/lib/animations/framer-motion"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/shared/PageHeader"
import { KpiCard, type Tone } from "@/components/shared/KpiCard"
import { StatusPill } from "@/components/shared/DataCard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { listAttendance, getAttendanceHistory, type AttendanceEvent, type AttendanceStats } from "@/lib/api/attendance"
import { listClasses, type ClassResponse } from "@/lib/api/classes"
import { listStreams, type StreamResponse } from "@/lib/api/streams"
import { format, subDays } from "date-fns"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function useReportDownload() {
  const { token } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generatePreview = async (url: string): Promise<{ blobUrl: string, filename: string } | null> => {
    if (!token) return null
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        let msg = `HTTP ${res.status}`
        try {
          const text = await res.text()
          const parsed = text.startsWith("{") ? JSON.parse(text) : null
          const detail = parsed?.detail
          msg = typeof detail === "string" ? detail : Array.isArray(detail) ? detail.map((d: { msg?: string }) => d?.msg).filter(Boolean).join("; ") || text.slice(0, 200) : text.slice(0, 300) || msg
        } catch {
          // use msg as-is
        }
        setError(msg)
        return null
      }
      const blob = await res.blob()

      // Try to get filename from Content-Disposition if present
      let filename = "report.pdf"
      const contentDisposition = res.headers.get("Content-Disposition")
      if (contentDisposition && contentDisposition.includes("filename=")) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition)
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '')
        }
      }

      const file = new File([blob], filename, { type: "application/pdf" })
      const blobUrl = URL.createObjectURL(file)
      return { blobUrl, filename }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Download failed"
      setError(message)
      return null
    } finally {
      setLoading(false)
    }
  }
  return { generatePreview, loading, error }
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ReportsPage() {
  const { token, hasHydrated } = useAuthStore()
  const { generatePreview, loading: downloadLoading, error: downloadError } = useReportDownload()

  // States for Parameters
  const [presentTodayType, setPresentTodayType] = useState<"student" | "teacher">("student")
  const [rangeFrom, setRangeFrom] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'))
  const [rangeTo, setRangeTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [rangeType, setRangeType] = useState<"student" | "teacher">("student")
  const [eventsFrom, setEventsFrom] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [eventsTo, setEventsTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [eventsType, setEventsType] = useState<"student" | "teacher">("student")
  const [groupByClassDaily, setGroupByClassDaily] = useState(false)
  const [groupByClassRange, setGroupByClassRange] = useState(false)
  const [groupByClassAudit, setGroupByClassAudit] = useState(false)

  const [pdfClassId, setPdfClassId] = useState<number | "">("")
  const [pdfStreamId, setPdfStreamId] = useState<number | "">("")
  const [pdfClasses, setPdfClasses] = useState<ClassResponse[]>([])
  const [pdfStreams, setPdfStreams] = useState<StreamResponse[]>([])

  const [layoutDaily, setLayoutDaily] = useState<"summary" | "timeline">("summary")
  const [dupDaily, setDupDaily] = useState(false)
  const [layoutRange, setLayoutRange] = useState<"summary" | "timeline">("summary")
  const [scopeRange, setScopeRange] = useState<"all" | "in" | "out">("all")
  const [dupRange, setDupRange] = useState(false)
  const [layoutAudit, setLayoutAudit] = useState<"summary" | "timeline">("timeline")
  const [scopeAudit, setScopeAudit] = useState<"all" | "in" | "out">("all")
  const [dupAudit, setDupAudit] = useState(false)

  // States for Dynamic Data
  const [historyData, setHistoryData] = useState<AttendanceStats[]>([])
  const [recentLogs, setRecentLogs] = useState<AttendanceEvent[]>([])
  const [isDataLoading, setIsDataLoading] = useState(false)

  // PDF Preview Modal States
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewFilename, setPreviewFilename] = useState<string>("")
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  const [activeTab, setActiveTab] = useState("daily")

  const apiBase = getApiBaseUrlOrFallback()

  // Fetch Analytical Data
  const fetchData = async () => {
    if (!token) return
    setIsDataLoading(true)
    try {
      const [hist, logs] = await Promise.all([
        getAttendanceHistory(
          token,
          format(subDays(new Date(), 14), 'yyyy-MM-dd'),
          format(new Date(), 'yyyy-MM-dd'),
          "student"
        ),
        listAttendance(token, { page: 1, page_size: 15 })
      ])
      setHistoryData(hist)
      setRecentLogs(logs.items)
    } catch (err) {
      console.error("Failed to fetch analytical data", err)
    } finally {
      setIsDataLoading(false)
    }
  }

  useEffect(() => {
    if (hasHydrated && token) {
      fetchData()
    }
  }, [token, hasHydrated])

  useEffect(() => {
    if (!token) return
    listClasses(token).then(setPdfClasses).catch(() => setPdfClasses([]))
  }, [token])

  useEffect(() => {
    if (!token || pdfClassId === "") {
      setPdfStreams([])
      setPdfStreamId("")
      return
    }
    listStreams(token, Number(pdfClassId)).then(setPdfStreams).catch(() => setPdfStreams([]))
  }, [token, pdfClassId])

  if (!hasHydrated) return null

  const appendPdfClassStream = (q: URLSearchParams, userType: "student" | "teacher") => {
    if (userType !== "student") return
    if (pdfClassId !== "" && pdfClassId != null) q.set("class_id", String(pdfClassId))
    if (pdfStreamId !== "" && pdfStreamId != null) q.set("stream_id", String(pdfStreamId))
  }

  // PDF Handlers
  const handlePreviewDownload = () => {
    if (previewUrl) {
      const a = document.createElement("a")
      a.href = previewUrl
      a.download = previewFilename
      a.click()
    }
  }

  const openPreview = async (url: string, defaultFilename: string) => {
    const result = await generatePreview(url)
    // Phones (Android Chrome, most in-app browsers) cannot show a PDF inside the
    // page — the preview would open blank — so hand them the file straight away.
    if (result && typeof navigator !== "undefined" && navigator.pdfViewerEnabled === false) {
      const a = document.createElement("a")
      a.href = result.blobUrl
      a.download = result.filename || defaultFilename
      a.click()
      return
    }
    if (result) {
      setPreviewUrl(result.blobUrl)
      setPreviewFilename(result.filename || defaultFilename)
      setIsPreviewOpen(true)
      
      // Update document title temporarily so if the user prints/saves from browser it has a name
      const oldTitle = document.title
      document.title = result.filename || defaultFilename
      setTimeout(() => { document.title = oldTitle }, 1000)
    }
  }

  const handlePresentToday = () => {
    const q = new URLSearchParams({
      user_type: presentTodayType,
      report_layout: layoutDaily,
      include_duplicates: String(dupDaily),
    })
    if (groupByClassDaily && presentTodayType === "student") q.set("group_by_class", "true")
    appendPdfClassStream(q, presentTodayType)
    const url = `${apiBase}/api/v1/reports/present-today?${q.toString()}`
    openPreview(url, `present-today-${presentTodayType}s.pdf`)
  }

  const handlePresentRange = () => {
    if (!rangeFrom || !rangeTo) return
    const q = new URLSearchParams({
      date_from: rangeFrom,
      date_to: rangeTo,
      user_type: rangeType,
      report_layout: layoutRange,
      event_scope: scopeRange,
      include_duplicates: String(dupRange),
    })
    if (groupByClassRange && rangeType === "student") q.set("group_by_class", "true")
    appendPdfClassStream(q, rangeType)
    const url = `${apiBase}/api/v1/reports/present-range?${q.toString()}`
    openPreview(url, `present-range-${rangeType}s.pdf`)
  }

  const handleEvents = () => {
    if (!eventsFrom || !eventsTo) return
    const q = new URLSearchParams({
      date_from: eventsFrom,
      date_to: eventsTo,
      user_type: eventsType,
      report_layout: layoutAudit,
      event_scope: scopeAudit,
      include_duplicates: String(dupAudit),
    })
    if (groupByClassAudit && eventsType === "student") q.set("group_by_class", "true")
    appendPdfClassStream(q, eventsType)
    const url = `${apiBase}/api/v1/reports/events?${q.toString()}`
    openPreview(url, `events-${eventsType}s.pdf`)
  }

  const chartData = useMemo(() => {
    return historyData.map(d => ({
      name: format(new Date(d.date), 'MMM dd'),
      fullDate: d.date,
      present: d.checked_in,
      absent: d.total_users - d.checked_in,
      rate: d.present_rate
    }))
  }, [historyData])

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="page-shell space-y-5"
    >
      {/* ── Page Header */}
      <PageHeader
        icon={FileText}
        title="Reports"
        subtitle="Attendance trends and PDF registers"
        actions={
          <>
            <Button variant="outline" onClick={fetchData} disabled={isDataLoading}>
              <RefreshCw className={`size-4 ${isDataLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="size-4" />
              Print page
            </Button>
          </>
        }
      />

      {downloadError && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <ShieldCheck className="h-5 w-5 text-rose-500" />
          <p className="text-sm font-semibold text-rose-800">{downloadError}</p>
        </div>
      )}

      {/* ── KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {([
          { label: "Today’s attendance", value: `${chartData[chartData.length - 1]?.rate ?? 0}%`, sub: "Attendance rate", icon: TrendingUp, tone: "success" },
          { label: "Check-ins", value: chartData[chartData.length - 1]?.present ?? 0, sub: "Present today", icon: UserCheck, tone: "primary" },
          { label: "Absent", value: chartData[chartData.length - 1]?.absent ?? 0, sub: "No check-in today", icon: X, tone: "danger" },
          { label: "14-day average", value: Math.round(chartData.reduce((acc, curr) => acc + curr.rate, 0) / (chartData.length || 1)) + "%", sub: "Average attendance rate", icon: Clock, tone: "info" },
        ] as { label: string; value: string | number; sub: string; icon: typeof X; tone: Tone }[]).map((item) => (
          <KpiCard key={item.label} label={item.label} value={item.value} icon={item.icon as never} tone={item.tone} hint={item.sub} />
        ))}
      </div>

      {/* ── Main Analytical Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
        
        {/* PDF Workspace */}
        <motion.div variants={fadeInUp} className="lg:col-span-4 space-y-4 sm:space-y-5">
          <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="border-b border-slate-100 py-4">
              <CardTitle className="flex items-center gap-2.5 text-[15px]">
                <span className="icon-tile h-8 w-8 rounded-lg">
                  <Download className="h-4 w-4 text-white" />
                </span>
                PDF registers
              </CardTitle>
              <CardDescription className="text-xs">Download attendance registers as PDF</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 p-4 sm:p-5">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[13px] font-semibold text-slate-700">Class</Label>
                  <select
                    className="field-select"
                    value={pdfClassId}
                    onChange={(e) => {
                      setPdfClassId(e.target.value ? Number(e.target.value) : "")
                      setPdfStreamId("")
                    }}
                  >
                    <option value="">Whole school</option>
                    {pdfClasses.map(c => <option key={c.id} value={c.id}>Class: {c.name}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="text-[13px] font-semibold text-slate-700">Stream</Label>
                  <select
                    className="field-select"
                    disabled={pdfClassId === ""}
                    value={pdfStreamId}
                    onChange={(e) => setPdfStreamId(e.target.value ? Number(e.target.value) : "")}
                  >
                    <option value="">All streams</option>
                    {pdfStreams.map(s => <option key={s.id} value={s.id}>{s.name} Stream</option>)}
                  </select>
                </div>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid h-10 w-full grid-cols-3">
                  <TabsTrigger value="daily" className="text-[13px]">Daily</TabsTrigger>
                  <TabsTrigger value="historical" className="text-[13px]">History</TabsTrigger>
                  <TabsTrigger value="audit" className="text-[13px]">Audit</TabsTrigger>
                </TabsList>

                <TabsContent value="daily" className="space-y-6 outline-none">
                  <div className="grid grid-cols-2 gap-3">
                    {(['student', 'teacher'] as const).map(type => (
                      <Button
                        key={type}
                        variant={presentTodayType === type ? "default" : "outline"}
                        onClick={() => setPresentTodayType(type)}
                        className="h-10 capitalize"
                      >
                        {type}s
                      </Button>
                    ))}
                  </div>
                  <Button
                    onClick={handlePresentToday}
                    disabled={downloadLoading}
                    className="w-full h-11"
                  >
                    {downloadLoading ? <Loader2 className="animate-spin size-4" /> : <Eye className="size-5 mr-3" />}
                    Preview today
                  </Button>
                </TabsContent>

                <TabsContent value="historical" className="space-y-6 outline-none">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="grid grid-cols-2 gap-3">
                       <Input type="date" value={rangeFrom} onChange={e => setRangeFrom(e.target.value)}  />
                       <Input type="date" value={rangeTo} onChange={e => setRangeTo(e.target.value)}  />
                    </div>
                    <Button
                      onClick={handlePresentRange}
                      disabled={downloadLoading}
                      className="w-full h-11"
                    >
                      {downloadLoading ? <Loader2 className="animate-spin size-4" /> : <Calendar className="size-5 mr-3" />}
                      Generate for date range
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="audit" className="space-y-6 outline-none">
                   <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-100">
                      <p className="text-xs font-medium text-amber-800 leading-relaxed text-center">
                        Full list of every in and out event, ready to file.
                      </p>
                   </div>
                   <Button
                    onClick={handleEvents}
                    disabled={downloadLoading}
                    className="w-full h-11"
                  >
                    Download event log
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>

        {/* Charts & Trends */}
        <motion.div variants={fadeInUp} className="lg:col-span-8 space-y-4 sm:space-y-5">
          <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-[15px]">Attendance trend</CardTitle>
                <CardDescription className="text-xs">Present and absent over the last 14 days</CardDescription>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-primary" /><span className="text-xs font-semibold text-slate-500">Present</span></div>
                <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-slate-300" /><span className="text-xs font-semibold text-slate-500">Absent</span></div>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0 sm:px-5 sm:pb-5">
              <div className="h-56 sm:h-72 lg:h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#15803d" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#15803d" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="#e6ebf1" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#7b889c' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#7b889c' }} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white px-3.5 py-3 rounded-xl border border-slate-200 shadow-[var(--shadow-card-md)]">
                              <p className="text-xs font-semibold text-slate-700 mb-1.5">{label}</p>
                              <div className="space-y-1">
                                <div className="flex justify-between gap-6"><span className="text-xs font-bold">Present</span><span className="text-xs font-bold text-primary">{payload[0].value}</span></div>
                                <div className="flex justify-between gap-6"><span className="text-xs font-bold text-muted-foreground">Absent</span><span className="text-xs font-bold text-gray-400">{payload[1].value}</span></div>
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Area type="monotone" dataKey="present" stroke="#15803d" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPresent)" />
                    <Area type="monotone" dataKey="absent" stroke="#cbd5e1" strokeWidth={2} strokeDasharray="5 5" fill="transparent" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          
          {/* Ledger Table */}
          <Card className="gap-0 overflow-hidden py-0">
             <CardHeader className="flex flex-col gap-3 border-b border-slate-100 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                   <CardTitle className="text-[15px]">Recent events</CardTitle>
                   <CardDescription className="text-xs">Latest taps from your devices</CardDescription>
                </div>
                <StatusPill tone="success">Live</StatusPill>
             </CardHeader>
             <CardContent className="p-0 overflow-x-auto">
                <Table className="min-w-135">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Event</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentLogs.slice(0, 5).map((log, i) => (
                      <TableRow key={log.id}>
                        <TableCell className="tabular-nums text-slate-500">{format(new Date(log.occurred_at), 'HH:mm:ss')}</TableCell>
                        <TableCell className="cell-strong">{log.student_name || log.teacher_name}</TableCell>
                        <TableCell>
                          <StatusPill tone={log.teacher_id ? "info" : "neutral"}>{log.teacher_id ? "Staff" : "Student"}</StatusPill>
                        </TableCell>
                        <TableCell>
                           <StatusPill tone={log.event_type === "IN" ? "success" : "warning"}>{log.event_type === "IN" ? "Checked in" : "Checked out"}</StatusPill>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
             </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* PDF Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[1700px] w-full h-[95vh] flex flex-col p-0 gap-0 overflow-hidden border-none bg-slate-100 dark:bg-slate-900 shadow-[var(--shadow-card-md)]">
          <DialogHeader className="p-6 border-b bg-white dark:bg-slate-950 flex flex-row justify-between items-center space-y-0">
            <div className="flex items-center gap-4">
              <div className="icon-tile h-10 w-10">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">PDF preview</DialogTitle>
                <p className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                  <ShieldCheck className="h-3 w-3" /> {previewFilename}
                </p>
              </div>
            </div>
            <Button size="icon" variant="ghost" onClick={() => setIsPreviewOpen(false)} className="rounded-full">
              <X className="h-5 w-5" />
            </Button>
          </DialogHeader>

          <div className="flex-1 bg-slate-200 dark:bg-slate-950/50 p-6 flex items-center justify-center relative overflow-hidden">
              {previewUrl ? (
                <iframe 
                  src={`${previewUrl}#toolbar=0&view=FitH`} 
                  title={previewFilename}
                  className="w-full h-full rounded-lg shadow-[var(--shadow-card-md)] z-10" 
                />
             ) : (
                <div className="flex flex-col items-center gap-4">
                   <Loader2 className="h-10 w-10 animate-spin text-primary" />
                   <p className="text-sm font-semibold text-slate-500">Preparing PDF…</p>
                </div>
             )}
          </div>

          <DialogFooter className="p-6 border-t bg-white dark:bg-slate-950 flex flex-row items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-2">
               <div className="h-2 w-2 rounded-full bg-emerald-500" /> Official attendance record
            </span>
            <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => previewUrl && window.open(previewUrl, "_blank")} >
              Open in new tab
            </Button>
            <Button onClick={handlePreviewDownload} className="gap-2">
              <Download className="h-5 w-5" /> Download PDF
            </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.main>
  )
}

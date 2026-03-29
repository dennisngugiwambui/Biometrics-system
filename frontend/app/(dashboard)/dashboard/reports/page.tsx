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
      className="flex-1 space-y-6 p-4 sm:p-8 lg:p-10 bg-background"
    >
      {/* ── Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                Analytics Hub
              </h1>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                Biometric Intelligence · <span className="text-indigo-600">Secure Audit Generation</span>
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="lg"
            onClick={fetchData}
            disabled={isDataLoading}
            className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-gray-200 dark:border-gray-700 rounded-2xl h-14 px-6 font-extrabold uppercase tracking-widest text-[11px] shadow-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 transition-all active:scale-95"
          >
            <RefreshCw className={`size-5 mr-3 text-indigo-500 ${isDataLoading ? 'animate-spin' : ''}`} />
            Sync Data
          </Button>
          <Button
            size="lg"
            onClick={() => window.print()}
            className="bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900 text-white rounded-2xl h-14 px-8 font-extrabold uppercase tracking-widest text-[11px] shadow-2xl transition-all active:scale-95"
          >
            <Printer className="size-5 mr-3" />
            Export Hub
          </Button>
        </div>
      </div>

      {downloadError && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="p-4 border-2 border-red-200 bg-red-50 dark:bg-red-950/20 rounded-2xl flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-red-500" />
          <p className="text-sm font-bold text-red-800 dark:text-red-200">{downloadError}</p>
        </motion.div>
      )}

      {/* ── Metric Highlights */}
      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Today's Yield", value: `${chartData[chartData.length - 1]?.rate ?? 0}%`, sub: "Attendance Rate", icon: TrendingUp, color: "emerald" },
          { label: "Check-Ins", value: chartData[chartData.length - 1]?.present ?? 0, sub: "Total Personnel", icon: UserCheck, color: "indigo" },
          { label: "Yield Gap", value: chartData[chartData.length - 1]?.absent ?? 0, sub: "Missing Subject Count", icon: X, color: "rose" },
          { label: "Avg Baseline", value: Math.round(chartData.reduce((acc, curr) => acc + curr.rate, 0) / (chartData.length || 1)) + "%", sub: "14-Day Performance", icon: Clock, color: "violet" },
        ].map((item, i) => (
          <motion.div key={item.label} variants={fadeInUp} className="group relative overflow-hidden rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/50 dark:border-gray-700/50 shadow-2xl p-6">
            <div className={`absolute top-0 right-0 w-32 h-32 bg-${item.color}-500 opacity-[0.03] -mr-12 -mt-12 rounded-full blur-3xl`} />
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground/60 mb-2">{item.label}</p>
                <h3 className="text-3xl font-extrabold text-gray-900 dark:text-white tabular-nums tracking-tight">{item.value}</h3>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-2 flex items-center gap-2">
                  <div className={`h-1.5 w-1.5 rounded-full bg-${item.color}-500`} />
                  {item.sub}
                </p>
              </div>
              <div className={`h-12 w-12 rounded-2xl bg-${item.color}-600/10 flex items-center justify-center text-${item.color}-600 group-hover:scale-110 transition-transform`}>
                <item.icon className="h-6 w-6" />
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Main Analytical Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* PDF Workspace */}
        <motion.div variants={fadeInUp} className="lg:col-span-4 space-y-8">
          <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border-white/50 dark:border-gray-700/50 shadow-2xl rounded-3xl overflow-hidden">
            <CardHeader className="p-8 border-b border-gray-100 dark:border-gray-800">
              <CardTitle className="text-xl font-extrabold flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-indigo-600 flex items-center justify-center">
                  <Download className="h-4 w-4 text-white" />
                </div>
                PDF Command Center
              </CardTitle>
              <CardDescription className="text-xs font-bold uppercase tracking-widest mt-1">Export Verified Documentation</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground ml-1">Academic Context</Label>
                  <select
                    className="w-full h-12 rounded-2xl bg-gray-50 dark:bg-gray-900 border-none px-4 text-sm font-bold focus:ring-4 focus:ring-indigo-600/10 transition-all outline-none"
                    value={pdfClassId}
                    onChange={(e) => {
                      setPdfClassId(e.target.value ? Number(e.target.value) : "")
                      setPdfStreamId("")
                    }}
                  >
                    <option value="">Global Institute View</option>
                    {pdfClasses.map(c => <option key={c.id} value={c.id}>Class: {c.name}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground ml-1">Section Stream</Label>
                  <select
                    className="w-full h-12 rounded-2xl bg-gray-50 dark:bg-gray-900 border-none px-4 text-sm font-bold focus:ring-4 focus:ring-indigo-600/10 transition-all outline-none disabled:opacity-30"
                    disabled={pdfClassId === ""}
                    value={pdfStreamId}
                    onChange={(e) => setPdfStreamId(e.target.value ? Number(e.target.value) : "")}
                  >
                    <option value="">Full Class Perspective</option>
                    {pdfStreams.map(s => <option key={s.id} value={s.id}>{s.name} Stream</option>)}
                  </select>
                </div>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid grid-cols-3 bg-gray-100 dark:bg-gray-900 rounded-xl p-1 h-12">
                  <TabsTrigger value="daily" className="rounded-lg text-[10px] font-extrabold uppercase tracking-tighter">Daily</TabsTrigger>
                  <TabsTrigger value="historical" className="rounded-lg text-[10px] font-extrabold uppercase tracking-tighter">History</TabsTrigger>
                  <TabsTrigger value="audit" className="rounded-lg text-[10px] font-extrabold uppercase tracking-tighter">Audit</TabsTrigger>
                </TabsList>

                <TabsContent value="daily" className="space-y-6 outline-none">
                  <div className="grid grid-cols-2 gap-3">
                    {(['student', 'teacher'] as const).map(type => (
                      <Button
                        key={type}
                        variant={presentTodayType === type ? "default" : "outline"}
                        onClick={() => setPresentTodayType(type)}
                        className={`h-11 rounded-xl font-extrabold uppercase text-[10px] tracking-widest ${presentTodayType === type ? "bg-indigo-600 shadow-lg shadow-indigo-600/20" : ""}`}
                      >
                        {type}s
                      </Button>
                    ))}
                  </div>
                  <Button
                    onClick={handlePresentToday}
                    disabled={downloadLoading}
                    className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-extrabold uppercase text-[11px] tracking-widest shadow-xl shadow-indigo-600/20 active:scale-95 transition-all"
                  >
                    {downloadLoading ? <Loader2 className="animate-spin mr-3 size-5" /> : <Eye className="size-5 mr-3" />}
                    Preview Today
                  </Button>
                </TabsContent>

                <TabsContent value="historical" className="space-y-6 outline-none">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="grid grid-cols-2 gap-3">
                       <Input type="date" value={rangeFrom} onChange={e => setRangeFrom(e.target.value)} className="h-12 rounded-xl bg-gray-50 dark:bg-gray-900 border-none font-bold text-xs" />
                       <Input type="date" value={rangeTo} onChange={e => setRangeTo(e.target.value)} className="h-12 rounded-xl bg-gray-50 dark:bg-gray-900 border-none font-bold text-xs" />
                    </div>
                    <Button
                      onClick={handlePresentRange}
                      disabled={downloadLoading}
                      className="w-full h-14 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl font-extrabold uppercase text-[11px] tracking-widest shadow-xl shadow-violet-600/20 active:scale-95 transition-all"
                    >
                      {downloadLoading ? <Loader2 className="animate-spin mr-3 size-5" /> : <Calendar className="size-5 mr-3" />}
                      Generate Historical
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="audit" className="space-y-6 outline-none">
                   <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                      <p className="text-[10px] font-extrabold text-amber-700 dark:text-amber-400 uppercase tracking-widest leading-relaxed text-center">
                        Sequential biometric audit form configured for comprehensive oversight.
                      </p>
                   </div>
                   <Button
                    onClick={handleEvents}
                    disabled={downloadLoading}
                    className="w-full h-14 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-2xl font-extrabold uppercase text-[11px] tracking-widest shadow-xl active:scale-95 transition-all"
                  >
                    Download Audit File
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>

        {/* Charts & Trends */}
        <motion.div variants={fadeInUp} className="lg:col-span-8 space-y-8">
          <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border-white/50 dark:border-gray-700/50 shadow-2xl rounded-3xl overflow-hidden h-[500px]">
            <CardHeader className="p-8 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-extrabold tracking-tight">Analytical Trends</CardTitle>
                <CardDescription className="text-xs font-bold uppercase tracking-widest mt-1">Personnel Volume Vectors (14-Day View)</CardDescription>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-indigo-600" /><span className="text-[10px] font-extrabold uppercase text-muted-foreground">Present</span></div>
                <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-gray-300" /><span className="text-[10px] font-extrabold uppercase text-muted-foreground">Absent</span></div>
              </div>
            </CardHeader>
            <CardContent className="p-8 pt-0">
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl p-4 rounded-2xl border border-white/20 shadow-2xl">
                              <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground mb-2">{label}</p>
                              <div className="space-y-1">
                                <div className="flex justify-between gap-6"><span className="text-xs font-bold">Present</span><span className="text-xs font-extrabold text-indigo-600">{payload[0].value}</span></div>
                                <div className="flex justify-between gap-6"><span className="text-xs font-bold text-muted-foreground">Absent</span><span className="text-xs font-extrabold text-gray-400">{payload[1].value}</span></div>
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Area type="monotone" dataKey="present" stroke="#4f46e5" strokeWidth={4} fillOpacity={1} fill="url(#colorPresent)" />
                    <Area type="monotone" dataKey="absent" stroke="#cbd5e1" strokeWidth={2} strokeDasharray="5 5" fill="transparent" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          
          {/* Ledger Table */}
          <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border-white/50 dark:border-gray-700/50 shadow-2xl rounded-3xl overflow-hidden">
             <CardHeader className="p-8 border-b border-gray-100 dark:border-gray-800 flex flex-row items-center justify-between">
                <div>
                   <CardTitle className="text-xl font-extrabold">Biometric Ledger</CardTitle>
                   <CardDescription className="text-[10px] font-extrabold uppercase tracking-widest mt-1 text-muted-foreground">Real-Time Event Sequential Feed</CardDescription>
                </div>
                <Badge variant="outline" className="rounded-lg h-8 px-3 font-extrabold uppercase text-[9px] tracking-widest text-indigo-600 border-indigo-100 bg-indigo-50/50">
                  Live Feed Status: Active
                </Badge>
             </CardHeader>
             <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-indigo-50/80 dark:bg-indigo-900/30 border-0">
                      <TableHead className="px-8 h-12 text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-300">Time</TableHead>
                      <TableHead className="h-12 text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-300">Identity</TableHead>
                      <TableHead className="h-12 text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-300">Role</TableHead>
                      <TableHead className="h-12 text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-300">Vector</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentLogs.slice(0, 5).map((log, i) => (
                      <TableRow key={log.id} className="border-gray-50 dark:border-gray-800/50 hover:bg-gray-50/80 dark:hover:bg-gray-900/50">
                        <TableCell className="px-8 py-5 text-[11px] font-bold text-muted-foreground">{format(new Date(log.occurred_at), 'HH:mm:ss')}</TableCell>
                        <TableCell className="text-sm font-extrabold text-gray-900 dark:text-white">{log.student_name || log.teacher_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md ${log.teacher_id ? "text-purple-600 border-purple-100" : "text-blue-600 border-blue-100"}`}>
                            {log.teacher_id ? "Faculty" : "Student"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                           <span className={`text-[10px] font-extrabold uppercase tracking-widest ${log.event_type === 'IN' ? 'text-emerald-600' : 'text-amber-600'}`}>
                             {log.event_type === 'IN' ? 'Entry Confirmed' : 'Exit Logged'}
                           </span>
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
        <DialogContent className="max-w-[95vw] sm:max-w-[1700px] w-full h-[95vh] flex flex-col p-0 gap-0 overflow-hidden border-none bg-slate-100 dark:bg-slate-900 shadow-2xl">
          <DialogHeader className="p-6 border-b bg-white dark:bg-slate-950 flex flex-row justify-between items-center space-y-0">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-indigo-600/10 flex items-center justify-center text-indigo-600">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">Institutional Document Preview</DialogTitle>
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
                  className="w-full h-full rounded-lg shadow-2xl z-10" 
                />
             ) : (
                <div className="flex flex-col items-center gap-4">
                   <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
                   <p className="text-sm font-extrabold uppercase tracking-widest text-muted-foreground">Rendering File...</p>
                </div>
             )}
          </div>

          <DialogFooter className="p-6 border-t bg-white dark:bg-slate-950 flex flex-row items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
               <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Digitally Signed Institutional Record
            </span>
            <Button onClick={handlePreviewDownload} className="h-12 px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl gap-3">
              <Download className="h-5 w-5" /> Download Full PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.main>
  )
}

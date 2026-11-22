"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
    Users, Search, Plus, Upload, ChevronLeft, ChevronRight,
    X, CheckCircle2, AlertCircle, Phone, Mail, BookOpen, RefreshCw,
    UserCheck, GraduationCap, TrendingUp, BarChart2, Eye,
    Users2, Trash2, Loader2
} from "lucide-react"
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { useAuthStore } from "@/lib/store/authStore"
import {
    listTeachers,
    bulkImportTeachersFile, bulkImportTeachersJson,
    type TeacherResponse, type TeacherBulkImportResult,
} from "@/lib/api/teachers"

type TeacherRow = TeacherResponse & {
    presenceLastType?: string | null
    presenceLastAt?: string | null
    presenceDevice?: string | null
}
import { format } from "date-fns"
import { getAttendanceStats, listTeachersRoster, getPresenceOverview, type TeacherPresenceRow, type PresenceOverview } from "@/lib/api/attendance"
import { staggerContainer, staggerItem, fadeInUp } from "@/lib/animations/framer-motion"
import { PremiumPagination } from "@/components/shared/PremiumPagination"
import { PageHeader } from "@/components/shared/PageHeader"
import { KpiCard, PanelEmpty } from "@/components/shared/KpiCard"
import { DataCard, DataToolbar, DataScroll, InitialsAvatar, StatusPill } from "@/components/shared/DataCard"
import { Skeleton } from "@/components/ui/skeleton"

// ─────────────────────────────────────────── hooks

function useDebounce<T>(value: T, ms: number): T {
    const [v, setV] = useState(value)
    useEffect(() => {
        const t = setTimeout(() => setV(value), ms)
        return () => clearTimeout(t)
    }, [value, ms])
    return v
}

// ─────────────────────────────────────────── file parser

async function parseFileToRows(
    file: File
): Promise<{ first_name: string; last_name: string; phone: string; email?: string; subject?: string; department?: string }[]> {
    const name = file.name.toLowerCase()
    if (name.endsWith(".csv") || name.endsWith(".tsv") || name.endsWith(".txt")) {
        const text = await file.text()
        const lines = text.split(/\r?\n/).filter((l) => l.trim())
        if (lines.length < 2) return []
        const delimiter = name.endsWith(".tsv") ? "\t" : text.includes("\t") ? "\t" : ","
        const headers = lines[0].split(delimiter).map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"))
        return lines.slice(1).map((line) => {
            const cols = line.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ""))
            const obj: Record<string, string> = {}
            headers.forEach((h, i) => { obj[h] = cols[i] ?? "" })
            return {
                first_name: obj.first_name || "",
                last_name: obj.last_name || "",
                phone: obj.phone || obj.phone_number || "",
                email: obj.email || undefined,
                subject: obj.subject ? obj.subject.split(",").map(s => s.trim()).filter(Boolean) : [],
                department: obj.department || undefined,
            }
        }).filter((r) => r.first_name && r.phone) as any[]
    }
    return []
}

// ─────────────────────────────────────────── helpers

function getLast7Days() {
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (6 - i))
        return d.toISOString().split("T")[0]
    })
}


// ─────────────────────────────────────────── Modals

function BulkUploadModal({ open, onClose, onImport, isImporting, importResult, uploadProgress }: {
    open: boolean; onClose: () => void; onImport: (f: File) => void
    isImporting: boolean; importResult: TeacherBulkImportResult | null
    uploadProgress: number
}) {
    const [dragOver, setDragOver] = useState(false)
    const [pickedFile, setPickedFile] = useState<File | null>(null)
    const resetFile = () => {
        setPickedFile(null)
        const input = document.getElementById("bulk-teacher-input") as HTMLInputElement | null
        if (input) input.value = ""
    }
    if (!open) return null
    return (
        <AnimatePresence>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white dark:bg-gray-800 rounded-2xl shadow-[var(--shadow-card-md)] w-full max-w-lg border border-gray-200/70 dark:border-gray-700/70"
                    onClick={(e) => e.stopPropagation()}>
                    <div className="h-1 rounded-t-2xl" />
                    <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Bulk Import Teachers</h3>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 transition-colors"><X className="size-5" /></button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 text-sm">
                            <p className="font-semibold text-blue-700 dark:text-blue-300 mb-2">Required columns (CSV/TSV):</p>
                            <code className="text-xs bg-blue-100 dark:bg-blue-900/40 px-2 py-1 rounded text-blue-700 dark:text-blue-300">first_name, last_name, phone</code>
                            <p className="mt-2 text-xs text-blue-600/80 dark:text-blue-400/80">Optional: email, subject, department</p>
                        </div>

                        {!isImporting && !importResult ? (
                            <div
                                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) setPickedFile(f) }}
                                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all group ${dragOver ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20 scale-[1.01]" : "border-gray-300 dark:border-gray-600 hover:border-violet-400 hover:bg-gray-50 dark:hover:bg-gray-700/30"}`}
                                onClick={() => document.getElementById("bulk-teacher-input")?.click()}
                            >
                                {pickedFile ? (
                                    <div className="space-y-3">
                                        <div className="size-16 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mx-auto shadow-sm">
                                            <CheckCircle2 className="size-8 text-violet-600 dark:text-violet-300" />
                                        </div>
                                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{pickedFile.name}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Ready to upload</p>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); resetFile() }}
                                            className="mt-2 inline-flex items-center gap-2 px-4 py-1.5 text-xs font-bold text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-900/20 rounded-full transition-all"
                                        >
                                            <Trash2 className="size-3.5" /> Remove File
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="size-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:bg-violet-100 dark:group-hover:bg-violet-900/30 transition-all">
                                            <Upload className="size-8 text-gray-400 group-hover:text-violet-600" />
                                        </div>
                                        <p className="font-bold text-gray-700 dark:text-gray-300">Click or drag CSV/TSV here</p>
                                        <p className="text-xs text-gray-400 mt-2">CSV, TSV supported · UTF-8 or Latin-1</p>
                                    </>
                                )}
                                <input
                                    id="bulk-teacher-input"
                                    type="file"
                                    accept=".csv,.tsv,.txt,.xlsx,.xls"
                                    className="hidden"
                                    onChange={(e) => e.target.files?.[0] && setPickedFile(e.target.files[0])}
                                />
                            </div>
                        ) : isImporting ? (
                            <div className="py-12 flex flex-col items-center justify-center text-center">
                                <div className="w-full mb-6">
                                    <div className="h-2 w-full bg-violet-100 dark:bg-violet-900/30 rounded-full overflow-hidden mb-2">
                                        <motion.div
                                            initial={false}
                                            animate={{ width: `${uploadProgress}%` }}
                                            transition={{ duration: 0.2 }}
                                            className="bg-primary h-full rounded-full"
                                        />
                                    </div>
                                    <span className="text-sm font-bold tabular-nums text-violet-700 dark:text-violet-300">{uploadProgress}%</span>
                                </div>
                                <h4 className="text-lg font-bold text-gray-900 dark:text-white">Uploading Teachers...</h4>
                                <p className="text-sm text-gray-500 mt-2">Please wait while we import your file.</p>
                            </div>
                        ) : importResult && (
                            <div className="space-y-4">
                                <div className={`rounded-2xl p-6 border-2 ${importResult.errors.length > 0 ? "bg-amber-50/50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-900/30" : "bg-green-50/50 border-green-200 dark:bg-green-900/10 dark:border-green-900/30"}`}>
                                    <div className="flex items-start gap-4">
                                        <div className={`p-3 rounded-2xl shadow-sm ${importResult.errors.length > 0 ? "bg-amber-500 text-white" : "bg-green-500 text-white"}`}>
                                            {importResult.errors.length > 0 ? <AlertCircle className="size-6" /> : <CheckCircle2 className="size-6" />}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-lg text-gray-900 dark:text-white">
                                                {importResult.errors.length > 0 && importResult.inserted === 0 && importResult.updated === 0 ? "Import Failed" : "Import Completed"}
                                            </h4>
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                                <div className="text-sm">
                                                    <span className="font-bold text-green-600 dark:text-green-500">{importResult.inserted}</span>
                                                    <span className="ml-1 text-gray-500">inserted</span>
                                                </div>
                                                <div className="text-sm">
                                                    <span className="font-bold text-blue-600 dark:text-blue-500">{importResult.updated}</span>
                                                    <span className="ml-1 text-gray-500">updated</span>
                                                </div>
                                                <div className="text-sm">
                                                    <span className="font-bold text-amber-600 dark:text-amber-500">{importResult.skipped}</span>
                                                    <span className="ml-1 text-gray-500">skipped</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {importResult.errors.length > 0 && (
                                        <div className="mt-5 bg-white dark:bg-black/20 rounded-2xl p-4 border border-black/5 dark:border-white/5">
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.08em] mb-2">Error Logs</p>
                                            <div className="max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                                {importResult.errors.map((err, i) => (
                                                    <div key={i} className="flex gap-2 py-1.5 border-b border-black/5 dark:border-white/5 last:border-0">
                                                        <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 rounded h-4 mt-0.5">ROW {i + 1}</span>
                                                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed font-medium">{err}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {importResult.errors.length > 0 && (
                                    <button
                                        onClick={() => { resetFile() }}
                                        className="w-full py-4 text-sm font-bold text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-2xl transition-all flex items-center justify-center gap-2"
                                    >
                                        <RefreshCw className="size-4" /> Try with a different file
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="p-6 bg-gray-50 dark:bg-gray-800/30 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row gap-3">
                        {!importResult && !isImporting && (
                            <button
                                disabled={!pickedFile}
                                onClick={() => pickedFile && onImport(pickedFile)}
                                className="flex-1 px-6 py-4 bg-primary text-white font-bold rounded-2xl shadow-[var(--shadow-card-md)] disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                            >
                                <Upload className="size-5" />
                                Upload Teachers
                            </button>
                        )}
                        <button
                            onClick={() => { resetFile(); onClose() }}
                            className={`px-6 py-4 font-bold rounded-2xl transition-all ${importResult ? "flex-1 bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-100"}`}
                        >
                            {importResult ? "Complete & Return" : "Cancel"}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}

// ─────────────────────────────────────────── Main Page

type Tab = "all" | "on_site" | "off_site"

function mapPresenceToTeacherRow(r: TeacherPresenceRow): TeacherRow {
    return {
        id: r.id,
        school_id: 0,
        employee_id: r.employee_id,
        first_name: r.first_name,
        last_name: r.last_name,
        phone: r.phone,
        email: r.email,
        subject: r.subject,
        department: r.department,
        is_active: r.is_active,
        is_deleted: false,
        created_at: "",
        updated_at: null,
        presenceLastType: r.last_event_type,
        presenceLastAt: r.last_event_at,
        presenceDevice: r.device_name,
    }
}

export default function TeachersPage() {
    const { token } = useAuthStore()
    const router = useRouter()

    const [teachers, setTeachers] = useState<TeacherRow[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(0)
    const [isLoading, setIsLoading] = useState(false)
    const [listError, setListError] = useState<string | null>(null)
    const [tab, setTab] = useState<Tab>("all")

    const [searchInput, setSearchInput] = useState("")
    const searchQuery = useDebounce(searchInput, 350)

    const [showBulk, setShowBulk] = useState(false)
    const [isImporting, setIsImporting] = useState(false)
    const [importResult, setImportResult] = useState<TeacherBulkImportResult | null>(null)
    const [uploadProgress, setUploadProgress] = useState(0)

    // Attendance stats for chart
    const [weeklyData, setWeeklyData] = useState<{ day: string; rate: number }[]>([])
    const [todayStats, setTodayStats] = useState<{ presentRate: number; checkedIn: number }>({ presentRate: 0, checkedIn: 0 })
    const [statsLoading, setStatsLoading] = useState(true)
    const [presenceOv, setPresenceOv] = useState<PresenceOverview | null>(null)

    // ── Fetch teachers
    const fetchTeachers = useCallback(async (pg: number, q: string, t: Tab) => {
        if (!token) return
        setListError(null)
        setIsLoading(true)
        try {
            if (t === "all") {
                const res = await listTeachers(token, { page: pg, page_size: 24, search: q || undefined })
                setTeachers(res.items.map((item) => ({ ...item, presenceLastType: null, presenceLastAt: null, presenceDevice: null })))
                setTotal(res.total)
                setPage(res.page)
                setTotalPages(res.total_pages)
            } else {
                const presence = t === "on_site" ? "in" : "out"
                const today = format(new Date(), "yyyy-MM-dd")
                const res = await listTeachersRoster(token, {
                    page: pg,
                    page_size: 24,
                    search: q || undefined,
                    presence,
                    target_date: today,
                })
                setTeachers(res.items.map(mapPresenceToTeacherRow))
                setTotal(res.total)
                setPage(res.page)
                setTotalPages(res.total_pages)
            }
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
            setListError(typeof msg === "string" && msg.trim() ? msg : "Failed to load teachers. Check your connection and try again.")
            setTeachers([])
            setTotal(0)
            setTotalPages(0)
        } finally {
            setIsLoading(false)
        }
    }, [token])

    useEffect(() => { fetchTeachers(1, searchQuery, tab) }, [searchQuery, tab, fetchTeachers])

    useEffect(() => {
        if (!token) return
        const today = format(new Date(), "yyyy-MM-dd")
        getPresenceOverview(token, { target_date: today }).then(setPresenceOv).catch(() => setPresenceOv(null))
    }, [token])

    // ── Fetch attendance stats
    useEffect(() => {
        if (!token) return
        const load = async () => {
            setStatsLoading(true)
            try {
                const dates = Array.from({ length: 7 }, (_, i) => {
                    const d = new Date(); d.setDate(d.getDate() - (6 - i))
                    return d.toISOString().split("T")[0]
                })
                const results = await Promise.allSettled(dates.map((d) => getAttendanceStats(token, d, "student")))
                const week = dates.map((d, i) => {
                    const r = results[i]
                    const rate = r.status === "fulfilled" ? Math.round(r.value.present_rate) : 0
                    return { day: new Date(d).toLocaleDateString("en-US", { weekday: "short" }), rate }
                })
                setWeeklyData(week)
                const todayR = results[results.length - 1]
                if (todayR.status === "fulfilled") {
                    setTodayStats({ presentRate: Math.round(todayR.value.present_rate), checkedIn: todayR.value.checked_in })
                }
            } finally { setStatsLoading(false) }
        }
        load()
    }, [token])

    // ── Handlers
    const handleImport = async (file: File) => {
        if (!token) return
        setIsImporting(true)
        setUploadProgress(0)
        try {
            const name = file.name.toLowerCase()
            let result: TeacherBulkImportResult
            if (name.endsWith(".csv") || name.endsWith(".tsv") || name.endsWith(".txt") || name.endsWith(".xlsx") || name.endsWith(".xls")) {
                result = await bulkImportTeachersFile(token, file, (pct) => setUploadProgress(pct))
                setUploadProgress(100)
            } else {
                const rows = await parseFileToRows(file)
                if (!rows.length) { setImportResult({ inserted: 0, updated: 0, skipped: 0, errors: ["Unsupported format. Use CSV, TSV, or XLSX."], total: 0 }); setIsImporting(false); return }
                result = await bulkImportTeachersJson(token, rows as any)
                setUploadProgress(100)
            }
            setImportResult(result); fetchTeachers(1, searchQuery, tab)
        } catch (err: unknown) {
            setUploadProgress(100)
            const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
            const message = typeof detail === "string" && detail.trim().length > 0
                ? detail
                : "Upload failed. Please try again."
            setImportResult({ inserted: 0, updated: 0, skipped: 0, errors: [message], total: 0 })
        }
        finally { setIsImporting(false) }
    }

    const tabs: { id: Tab; label: string; hint: string }[] = [
        { id: "all", label: "All staff", hint: "Roster & accounts" },
        { id: "on_site", label: "On premises", hint: "Last tap today = IN" },
        { id: "off_site", label: "Off premises", hint: "OUT, no tap, or not IN" },
    ]

    return (
        <main className="page-shell space-y-5">
            {/* ── Page header */}
            <PageHeader
                icon={Users}
                title="Staff"
                subtitle={`${total.toLocaleString()} ${total === 1 ? "member" : "members"} on the register`}
                actions={
                    <>
                        <Button variant="outline" onClick={() => { setShowBulk(true); setImportResult(null); setUploadProgress(0) }}>
                            <Upload className="size-4" />
                            Bulk import
                        </Button>
                        <Button onClick={() => router.push("/dashboard/teachers/new")}>
                            <Plus className="size-4" />
                            Enroll teacher
                        </Button>
                    </>
                }
            />

            {/* ── KPI cards */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                <KpiCard label="Faculty roster" value={presenceOv?.total_teachers ?? total} icon={Users} tone="primary" hint="Registered staff" />
                <KpiCard label="On site today" value={presenceOv?.teachers_on_premises ?? "—"} icon={UserCheck} tone="success" hint="Last tap today is IN" />
                <KpiCard
                    label="Attendance yield"
                    value={statsLoading ? "…" : `${todayStats.presentRate}%`}
                    icon={TrendingUp}
                    tone="info"
                    bar={{ value: todayStats.presentRate, label: "Daily capacity" }}
                />
                <KpiCard label="Away / off site" value={presenceOv?.teachers_off_premises ?? "—"} icon={AlertCircle} tone="warning" hint="Not checked in" />
            </div>

            {/* ── Staff register */}
            <DataCard>
                <DataToolbar
                    search={searchInput}
                    onSearch={setSearchInput}
                    placeholder="Search by name, department or employee ID…"
                    filters={
                        <div className="flex rounded-xl border border-slate-200 bg-slate-100/80 p-0.5">
                            {tabs.map((t) => (
                                <button
                                    key={t.id}
                                    type="button"
                                    title={t.hint}
                                    onClick={() => setTab(t.id)}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                                        tab === t.id ? "bg-white text-primary shadow-[var(--shadow-key-2)]" : "text-slate-500 hover:text-slate-800"
                                    }`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    }
                    right={<span className="tabular-nums">{total.toLocaleString()} records</span>}
                />

                {isLoading ? (
                    <div className="space-y-3 p-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <Skeleton className="h-8 w-8 rounded-full" />
                                <Skeleton className="h-4 flex-1 rounded" />
                                <Skeleton className="hidden h-4 w-40 rounded sm:block" />
                            </div>
                        ))}
                    </div>
                ) : listError ? (
                    <PanelEmpty
                        icon={AlertCircle}
                        title="Could not load staff"
                        hint={listError}
                        action={<Button variant="outline" onClick={() => fetchTeachers(1, searchQuery, tab)}>Try again</Button>}
                    />
                ) : teachers.length === 0 ? (
                    <PanelEmpty
                        icon={GraduationCap}
                        title="No staff found"
                        hint={searchInput ? "Nothing matches that search." : "Enroll your first teacher to get started."}
                    />
                ) : (
                    <>
                        {/* Desktop table */}
                        <div className="hidden lg:block">
                            <DataScroll>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Staff</TableHead>
                                            <TableHead>Employee ID</TableHead>
                                            <TableHead>Subject / dept</TableHead>
                                            <TableHead>Contact</TableHead>
                                            <TableHead>Last tap</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {teachers.map((t) => {
                                            const name = `${t.first_name} ${t.last_name}`
                                            return (
                                                <TableRow key={t.id} className="cursor-pointer" onClick={() => router.push(`/dashboard/teachers/${t.id}`)}>
                                                    <TableCell>
                                                        <div className="flex items-center gap-3">
                                                            <InitialsAvatar name={name} />
                                                            <div>
                                                                <span className="cell-strong">{name}</span>
                                                                {!t.is_active && <StatusPill tone="warning" className="ml-2">Restricted</StatusPill>}
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="font-mono text-[13px] text-slate-700">{t.employee_id || "—"}</TableCell>
                                                    <TableCell>{[t.subject, t.department].filter(Boolean).join(" · ") || "General faculty"}</TableCell>
                                                    <TableCell>
                                                        <span className="tabular-nums">{t.phone}</span>
                                                        <span className="cell-sub max-w-[180px] truncate">{t.email || "No email"}</span>
                                                    </TableCell>
                                                    <TableCell>
                                                        {t.presenceLastType ? (
                                                            <>
                                                                <StatusPill tone={t.presenceLastType === "IN" ? "success" : "warning"}>
                                                                    {t.presenceLastType === "IN" ? "In" : "Out"}
                                                                </StatusPill>
                                                                <span className="cell-sub">{t.presenceLastAt?.slice(11, 16)} · {t.presenceDevice}</span>
                                                            </>
                                                        ) : (
                                                            <StatusPill tone="neutral">No tap today</StatusPill>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            variant="outline"
                                                            size="icon-sm"
                                                            aria-label={`View ${name}`}
                                                            onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/teachers/${t.id}`) }}
                                                        >
                                                            <Eye className="size-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </DataScroll>
                        </div>

                        {/* Phones and tablets: one tappable row per teacher */}
                        <ul className="divide-y divide-slate-100 lg:hidden">
                            {teachers.map((t) => {
                                const name = `${t.first_name} ${t.last_name}`
                                return (
                                    <li key={t.id}>
                                        <button
                                            type="button"
                                            onClick={() => router.push(`/dashboard/teachers/${t.id}`)}
                                            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-primary/5 active:bg-primary/10"
                                        >
                                            <InitialsAvatar name={name} className="h-9 w-9" />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-semibold text-slate-900">{name}</span>
                                                <span className="block truncate text-xs text-slate-500">
                                                    {[t.subject, t.department].filter(Boolean).join(" · ") || "General faculty"} · {t.phone}
                                                </span>
                                            </span>
                                            {t.presenceLastType ? (
                                                <StatusPill tone={t.presenceLastType === "IN" ? "success" : "warning"}>{t.presenceLastType === "IN" ? "In" : "Out"}</StatusPill>
                                            ) : null}
                                            <ChevronRight className="size-4 shrink-0 text-slate-300" />
                                        </button>
                                    </li>
                                )
                            })}
                        </ul>
                    </>
                )}

                {total > 0 && (
                    <PremiumPagination
                        page={page}
                        totalPages={Math.max(1, totalPages)}
                        total={total}
                        onPageChange={(p) => { setPage(p); fetchTeachers(p, searchQuery, tab) }}
                        label="staff"
                        pageSize={24}
                    />
                )}
            </DataCard>

            {/* ── Modals */}
            <BulkUploadModal
                open={showBulk}
                onClose={() => { setShowBulk(false); setImportResult(null); setUploadProgress(0) }}
                onImport={handleImport}
                isImporting={isImporting}
                importResult={importResult}
                uploadProgress={uploadProgress}
            />
        </main>
    )
}

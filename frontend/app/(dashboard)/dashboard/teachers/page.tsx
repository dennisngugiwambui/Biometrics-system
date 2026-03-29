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

const AVATAR_GRADIENTS = [
    "from-blue-500 to-indigo-600",
    "from-emerald-500 to-teal-600",
    "from-violet-500 to-purple-600",
    "from-rose-500 to-pink-600",
    "from-amber-500 to-orange-600",
]

// ─────────────────────────────────────────── Teacher Card

function TeacherCard({ teacher }: { teacher: TeacherRow }) {
    const router = useRouter()
    const initials = `${teacher.first_name[0]}${teacher.last_name[0]}`.toUpperCase()
    const gradient = AVATAR_GRADIENTS[teacher.id % AVATAR_GRADIENTS.length]
    return (
        <motion.div
            variants={staggerItem}
            whileHover={{ y: -5 }}
            className="group bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-3xl border border-white/50 dark:border-gray-700/50 shadow-xl p-6 cursor-pointer relative overflow-hidden"
            onClick={() => router.push(`/dashboard/teachers/${teacher.id}`)}
        >
            <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${gradient} opacity-5 -mr-8 -mt-8 rounded-full blur-2xl group-hover:opacity-20 transition-opacity`} />
            
            <div className="flex items-start gap-4 mb-5">
                <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-lg font-extrabold shadow-lg shadow-blue-500/20 transform group-hover:scale-110 group-hover:rotate-3 transition-transform`}>
                    {initials}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-extrabold text-gray-900 dark:text-gray-100 text-lg leading-tight truncate group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                        {teacher.first_name} {teacher.last_name}
                    </h3>
                    <p className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-widest mt-1">
                        Emp ID: #{teacher.employee_id || "N/A"}
                    </p>
                </div>
            </div>

            <div className="space-y-3">
                <div className="flex items-center gap-2.5 text-xs font-bold text-gray-600 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-900/50 p-2 rounded-xl border border-gray-100 dark:border-gray-800">
                    <BookOpen className="size-3.5 text-violet-500" />
                    <span className="truncate">{[teacher.subject, teacher.department].filter(Boolean).join(" · ") || "General Staff"}</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs font-bold text-gray-600 dark:text-gray-400 px-2">
                    <Phone className="size-3.5 text-emerald-500" />
                    <span className="tabular-nums">{teacher.phone}</span>
                </div>
                {teacher.email && (
                    <div className="flex items-center gap-2.5 text-[11px] font-medium text-muted-foreground px-2 truncate">
                        <Mail className="size-3.5 text-blue-500" />
                        <span className="truncate">{teacher.email}</span>
                    </div>
                )}
            </div>

            <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-700/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${teacher.presenceLastType === 'IN' ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-gray-300 dark:bg-gray-600'}`} />
                    <span className="text-[10px] font-extrabold uppercase tracking-tighter text-muted-foreground">
                        {teacher.presenceLastType === 'IN' ? 'On Site' : 'Away'}
                    </span>
                </div>
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-xl bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 hover:bg-violet-600 hover:text-white transition-all shadow-sm">
                    <Eye className="size-5" />
                </Button>
            </div>
        </motion.div>
    )
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
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200/70 dark:border-gray-700/70"
                    onClick={(e) => e.stopPropagation()}>
                    <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-600 rounded-t-2xl" />
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
                                            className="h-full bg-gradient-to-r from-violet-500 to-purple-600 rounded-full"
                                        />
                                    </div>
                                    <span className="text-sm font-extrabold tabular-nums text-violet-700 dark:text-violet-300">{uploadProgress}%</span>
                                </div>
                                <h4 className="text-lg font-bold text-gray-900 dark:text-white">Uploading Teachers...</h4>
                                <p className="text-sm text-gray-500 mt-2">Please wait while we import your file.</p>
                            </div>
                        ) : importResult && (
                            <div className="space-y-4">
                                <div className={`rounded-3xl p-6 border-2 ${importResult.errors.length > 0 ? "bg-amber-50/50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-900/30" : "bg-green-50/50 border-green-200 dark:bg-green-900/10 dark:border-green-900/30"}`}>
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
                                        <div className="mt-5 bg-white/50 dark:bg-black/20 rounded-2xl p-4 border border-black/5 dark:border-white/5">
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Error Logs</p>
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
                                className="flex-1 px-6 py-4 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold rounded-2xl shadow-xl shadow-violet-500/20 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
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
        <motion.main
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 space-y-10 p-6 lg:p-10 bg-gray-50/50 dark:bg-gray-940"
        >
            {/* ── Page Header */}
            <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6 pb-2">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                            <Users className="h-5 w-5 text-white" />
                        </div>
                        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600 tracking-tight sm:text-4xl">
                            Staff Management
                        </h1>
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] pl-[52px]">
                        Personnel Repository · <span className="text-violet-600 font-extrabold">{total} Members</span>
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => window.location.assign("/dashboard/students")}
                      className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 rounded-2xl h-14 px-6 font-extrabold uppercase tracking-widest text-[11px] shadow-sm hover:bg-violet-50 hover:text-violet-600 transition-all active:scale-95"
                    >
                      <Users2 className="size-5 mr-3 text-violet-500" />
                      Switch to Students
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => { setShowBulk(true); setImportResult(null); setUploadProgress(0) }}
                      className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 rounded-2xl h-14 px-6 font-extrabold uppercase tracking-widest text-[11px] shadow-sm hover:shadow-md transition-all active:scale-95"
                    >
                      <Upload className="size-5 mr-3 text-gray-500" />
                      Bulk Import
                    </Button>
                    <Button
                      size="lg"
                      onClick={() => router.push("/dashboard/teachers/new")}
                      className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-2xl h-14 px-8 font-extrabold uppercase tracking-widest text-[11px] shadow-2xl shadow-violet-500/30 transition-all active:scale-95 border-0"
                    >
                      <Plus className="size-5 mr-3" />
                      Enroll Teacher
                    </Button>
                </div>
            </motion.div>

            {/* ── Stats Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: "Faculty Roster", value: presenceOv?.total_teachers ?? total, sub: "Registered Staff", icon: Users, gradient: "from-violet-500 to-indigo-600" },
                    { label: "Active Today", value: presenceOv?.teachers_on_premises ?? "—", sub: "Currently On Site", icon: UserCheck, gradient: "from-emerald-500 to-emerald-600" },
                    { label: "Attendance Yield", value: `${todayStats.presentRate}%`, sub: "Daily Capacity", icon: TrendingUp, gradient: "from-blue-500 to-blue-600" },
                    { label: "Away / Off Site", value: presenceOv?.teachers_off_premises ?? "—", sub: "Not Checked In", icon: AlertCircle, gradient: "from-amber-500 to-orange-600" },
                ].map(({ label, value, sub, icon: Icon, gradient }, i) => (
                    <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                        className="group relative overflow-hidden rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/50 dark:border-gray-700/50 shadow-2xl p-6"
                    >
                        <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${gradient} opacity-[0.03] -mr-12 -mt-12 rounded-full blur-3xl`} />
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground/60 mb-2">{label}</p>
                                <h3 className="text-3xl font-extrabold text-gray-900 dark:text-white tabular-nums tracking-tight">
                                    {statsLoading && value === 0 ? <Loader2 className="h-8 w-8 animate-spin text-gray-200" /> : value}
                                </h3>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-2 flex items-center gap-2">
                                    <div className={`h-1.5 w-1.5 rounded-full bg-gradient-to-r ${gradient}`} />
                                    {sub}
                                </p>
                            </div>
                            <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg transform group-hover:scale-110 group-hover:rotate-6 transition-transform shadow-${gradient.split('-')[1]}-500/20`}>
                                <Icon className="h-6 w-6 text-white" />
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* ── Workspace Area */}
            <div className="space-y-6">
                <div className="flex flex-col lg:flex-row gap-6 items-end">
                    <div className="bg-white/40 dark:bg-gray-800/40 backdrop-blur-md rounded-2xl p-1.5 border border-white/50 dark:border-gray-700/50 flex flex-wrap shadow-xl">
                        {tabs.map((t) => (
                            <button key={t.id} type="button" onClick={() => setTab(t.id)}
                                className={`px-6 py-2.5 text-[10px] font-extrabold uppercase tracking-[0.1em] rounded-xl transition-all ${tab === t.id ? "bg-violet-600 text-white shadow-xl shadow-violet-500/20" : "text-muted-foreground hover:bg-white/50 dark:hover:bg-gray-700/50"}`}>
                                {t.label}
                            </button>
                        ))}
                    </div>
                    
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground group-focus-within:text-violet-500 transition-colors" />
                        <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Enter Name, Department, or Employee ID to search..."
                            className="w-full pl-12 pr-12 h-14 bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/50 dark:border-gray-700/50 rounded-2xl font-bold text-sm text-gray-900 dark:text-gray-100 placeholder:text-muted-foreground/60 focus:outline-none focus:ring-4 focus:ring-violet-500/10 shadow-2xl transition-all" />
                        {searchInput && (
                            <button onClick={() => setSearchInput("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gray-900 dark:hover:text-white">
                                <X className="size-5" />
                            </button>
                        )}
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-40 bg-white/40 dark:bg-gray-800/40 backdrop-blur-xl rounded-3xl border border-white/50 dark:border-gray-700/50">
                        <Loader2 className="h-14 w-14 animate-spin text-violet-600 mb-6" />
                        <p className="text-sm font-extrabold text-violet-600 animate-pulse uppercase tracking-[0.3em]">Synchronizing Records...</p>
                    </div>
                ) : listError ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-rose-50/50 dark:bg-rose-950/10 rounded-3xl border border-rose-100 dark:border-rose-900/20">
                        <AlertCircle className="h-14 w-14 text-rose-500 mb-4" />
                        <h2 className="text-xl font-extrabold text-rose-900 dark:text-rose-100">Synchronization Fault</h2>
                        <p className="text-sm text-rose-600 dark:text-rose-400 mt-2 max-w-md text-center font-medium">{listError}</p>
                        <Button onClick={() => fetchTeachers(1, searchQuery, tab)} className="mt-6 bg-rose-600 hover:bg-rose-700 text-white rounded-xl h-11 px-8 font-extrabold uppercase tracking-widest text-[10px]">
                            Re-initialize Fetch
                        </Button>
                    </div>
                ) : teachers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 bg-white/40 dark:bg-gray-800/40 backdrop-blur-xl rounded-3xl border border-white/50 dark:border-gray-700/50 shadow-2xl">
                        <div className="h-24 w-24 rounded-full bg-gray-100 dark:bg-gray-900 flex items-center justify-center mb-6">
                            <GraduationCap className="h-12 w-12 text-gray-300 dark:text-gray-700" />
                        </div>
                        <h2 className="text-2xl font-extrabold text-gray-400 dark:text-gray-600">No Personnel Found</h2>
                        <p className="text-sm text-muted-foreground mt-2 font-bold uppercase tracking-widest">
                            {searchInput ? "0 Matches for Current Query" : "Repository currently empty"}
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Desktop: Table layout */}
                        <div className="hidden lg:block bg-white/40 dark:bg-gray-800/40 backdrop-blur-xl rounded-3xl border border-white/50 dark:border-gray-700/50 shadow-2xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <Table className="w-full">
                                    <TableHeader>
                                        <TableRow className="border-0 hover:bg-transparent bg-violet-50/80 dark:bg-violet-900/30">
                                            <TableHead className="px-8 h-16 text-[10px] font-bold uppercase tracking-widest text-violet-600 dark:text-violet-300">Staff ID</TableHead>
                                            <TableHead className="h-16 text-[10px] font-bold uppercase tracking-widest text-violet-600 dark:text-violet-300">Faculty Name</TableHead>
                                            <TableHead className="h-16 text-[10px] font-bold uppercase tracking-widest text-violet-600 dark:text-violet-300">Subject / Dept</TableHead>
                                            <TableHead className="h-16 text-[10px] font-bold uppercase tracking-widest text-violet-600 dark:text-violet-300">Contact Info</TableHead>
                                            <TableHead className="h-16 text-[10px] font-bold uppercase tracking-widest text-violet-600 dark:text-violet-300">Status</TableHead>
                                            <TableHead className="px-8 h-16 text-[10px] font-bold uppercase tracking-widest text-violet-600 dark:text-violet-300 text-right">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {teachers.map((t, i) => (
                                            <motion.tr
                                                key={t.id}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i * 0.03 }}
                                                className="group border-gray-100 dark:border-gray-800 hover:bg-violet-50/40 dark:hover:bg-violet-900/10 transition-all cursor-pointer"
                                                onClick={() => router.push(`/dashboard/teachers/${t.id}`)}
                                            >
                                                <TableCell className="px-8 py-5">
                                                    <Badge variant="outline" className="font-mono text-[11px] bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 font-bold px-3 py-1 rounded-lg">
                                                        {t.employee_id || "OFFBOARD"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <div className={`h-10 w-10 rounded-2xl bg-gradient-to-br ${AVATAR_GRADIENTS[t.id % AVATAR_GRADIENTS.length]} flex items-center justify-center text-white text-xs font-extrabold shadow-lg transform group-hover:scale-110 group-hover:rotate-3 transition-all`}>
                                                            {t.first_name[0]}{t.last_name[0]}
                                                        </div>
                                                        <div>
                                                            <p className="font-extrabold text-gray-900 dark:text-gray-100 text-sm tracking-tight leading-none mb-1">
                                                                {t.first_name} {t.last_name}
                                                            </p>
                                                            {!t.is_active && <span className="text-[9px] font-extrabold bg-amber-100 text-amber-700 dark:bg-amber-950/30 px-1.5 py-0.5 rounded uppercase">Restricted</span>}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-violet-600" />
                                                        <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                                                            {[t.subject, t.department].filter(Boolean).join(" · ") || "General Faculty"}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-0.5">
                                                        <p className="text-xs font-bold text-gray-600 dark:text-gray-400 tabular-nums">{t.phone}</p>
                                                        <p className="text-[10px] font-medium text-muted-foreground truncate max-w-[150px]">{t.email || "No Email Provided"}</p>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                     {t.presenceLastType ? (
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <div className={`h-1.5 w-1.5 rounded-full ${t.presenceLastType === "IN" ? "bg-emerald-500 shadow-sm shadow-emerald-500/50" : "bg-amber-500"}`} />
                                                                <span className={`text-[10px] font-extrabold tracking-widest ${t.presenceLastType === "IN" ? "text-emerald-600" : "text-amber-600"}`}>
                                                                    {t.presenceLastType}
                                                                </span>
                                                            </div>
                                                            <span className="text-[9px] font-bold text-muted-foreground/60 mt-1 uppercase tracking-tighter">
                                                                {t.presenceLastAt?.slice(11, 16)} · {t.presenceDevice}
                                                            </span>
                                                        </div>
                                                     ) : (
                                                        <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-800 text-gray-400 font-extrabold text-[9px] uppercase tracking-tighter px-2">No Tap Detected</Badge>
                                                     )}
                                                </TableCell>
                                                <TableCell className="px-8 py-5 text-right">
                                                    <Button variant="ghost" className="h-10 w-10 p-0 rounded-xl bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 hover:bg-violet-600 hover:text-white transition-all group/btn shadow-sm border border-violet-100/50 dark:border-violet-800/50">
                                                        <Eye className="size-5 group-hover/btn:scale-110 transition-transform" />
                                                    </Button>
                                                </TableCell>
                                            </motion.tr>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Mobile: Card layout */}
                        <motion.div
                            variants={staggerContainer}
                            initial="hidden"
                            animate="visible"
                            className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-6"
                        >
                            {teachers.map((t) => (
                                <TeacherCard key={t.id} teacher={t} />
                            ))}
                        </motion.div>
                    </>
                )}

                {/* ── Pagination — show whenever there are records */}
                {total > 0 && totalPages >= 1 && (
                    <PremiumPagination
                        page={page}
                        totalPages={Math.max(1, totalPages)}
                        total={total}
                        onPageChange={(p) => { setPage(p); fetchTeachers(p, searchQuery, tab) }}
                        label="Teachers"
                    />
                )}
            </div>

            {/* ── Modals Area */}
            <BulkUploadModal
                open={showBulk}
                onClose={() => { setShowBulk(false); setImportResult(null); setUploadProgress(0) }}
                onImport={handleImport}
                isImporting={isImporting}
                importResult={importResult}
                uploadProgress={uploadProgress}
            />
        </motion.main>
    )
}

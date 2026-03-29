"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Users, UserPlus, Upload, Search, Filter,
  CheckCircle2, AlertCircle, Smartphone,
  GraduationCap, RefreshCw, X, Download, Plus,
  FileSpreadsheet, Trash2, UserCheck,
  LogIn, UserX, Loader2, Cpu, ExternalLink, ChevronLeft, ChevronRight,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { StudentList } from "@/components/features/students/StudentList"
import { useAuthStore } from "@/lib/store/authStore"
import {
  listStudents,
  type StudentResponse,
  StudentApiError,
  bulkImportStudentsFile,
  bulkImportStudentsJson,
} from "@/lib/api/students"
import { listClasses, type ClassResponse } from "@/lib/api/classes"
import { listStreams, type StreamResponse } from "@/lib/api/streams"
import {
  getRosterSummary,
  type RosterSummary,
} from "@/lib/api/attendance"
import { getSuccessfulEnrollmentCount } from "@/lib/api/enrollment"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
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
import { listDevices, type DeviceResponse } from "@/lib/api/devices"
import {
  listUnsyncedStudents,
  listUnsyncedTeachers,
  bulkSyncStudentsToDevice,
  bulkSyncTeachersToDevice,
  type UnsyncedStudentItem,
  type UnsyncedTeacherItem,
} from "@/lib/api/sync"

/** Rows rendered per page inside the device sync ledger (keeps DOM light for 500–1000+ pending users). */
const SYNC_LEDGER_PAGE_SIZE = 50

function SyncLedgerPagination({
  page,
  totalPages,
  filteredCount,
  pageSize,
  variant,
  onPageChange,
}: {
  page: number
  totalPages: number
  filteredCount: number
  pageSize: number
  variant: "blue" | "indigo"
  onPageChange: (p: number) => void
}) {
  const safePage = Math.min(Math.max(1, page), Math.max(1, totalPages))
  const start = filteredCount === 0 ? 0 : (safePage - 1) * pageSize + 1
  const end = Math.min(safePage * pageSize, filteredCount)
  const barBorder =
    variant === "blue"
      ? "border-blue-200/60 dark:border-blue-800/50"
      : "border-indigo-200/60 dark:border-indigo-800/50"
  const btnClass =
    variant === "blue"
      ? "border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
      : "border-indigo-600 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
  const pillClass =
    variant === "blue" ? "bg-blue-600 text-white" : "bg-indigo-600 text-white"

  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border ${barBorder} bg-white/80 p-3 backdrop-blur-sm dark:bg-gray-900/60 sm:flex-row sm:items-center sm:justify-between`}
    >
      <p className="text-center text-xs text-muted-foreground sm:text-left">
        <span className="font-semibold text-gray-900 dark:text-gray-100">
          {start}–{end}
        </span>{" "}
        of <span className="font-semibold text-gray-900 dark:text-gray-100">{filteredCount}</span>
        <span className="hidden sm:inline"> · {pageSize} per page</span>
      </p>
      <div className="flex items-center justify-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={safePage <= 1}
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          className={`h-10 min-w-10 rounded-xl px-3 font-semibold ${btnClass}`}
        >
          <ChevronLeft className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">Prev</span>
        </Button>
        <span
          className={`min-w-[4.25rem] rounded-xl px-3 py-2 text-center text-xs font-bold ${pillClass}`}
        >
          {safePage} / {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          className={`h-10 min-w-10 rounded-xl px-3 font-semibold ${btnClass}`}
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4 sm:ml-1" />
        </Button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────── Stat Card Component

function StatCard({
  label,
  value,
  icon: Icon,
  gradient,
  sub,
  delay = 0,
  onClick,
  hint,
}: {
  label: string
  value: number | string
  icon: typeof Users
  gradient: string
  sub?: string
  delay?: number
  onClick?: () => void
  hint?: string
}) {
  const className =
    "relative overflow-hidden rounded-2xl bg-white dark:bg-gray-800 border border-gray-200/70 dark:border-gray-700/70 shadow-sm p-4 w-full text-left transition-all" +
    (onClick
      ? " cursor-pointer hover:border-blue-300 dark:hover:border-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      : "")

  const inner = (
    <>
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient}`} />
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-sm`}>
          <Icon className="h-4.5 w-4.5 text-white" />
        </div>
        <div>
          <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
        </div>
      </div>
      {sub && <p className="mt-2 text-[9px] text-gray-400 dark:text-gray-500 uppercase tracking-widest font-bold font-mono">{sub}</p>}
      {hint && onClick && (
        <p className="mt-1 text-[9px] text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wide">{hint}</p>
      )}
    </>
  )

  if (onClick) {
    return (
      <motion.button
        type="button"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.4, ease: "easeOut" }}
        className={className}
        onClick={onClick}
      >
        {inner}
      </motion.button>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      className={className}
    >
      {inner}
    </motion.div>
  )
}

// ─────────────────────────────────────────── Bulk Upload Modal

function BulkUploadModal({
  open,
  onClose,
  onRefresh
}: {
  open: boolean
  onClose: () => void
  onRefresh: () => void
}) {
  const { token } = useAuthStore()
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [result, setResult] = useState<{ inserted: number; updated: number; skipped: number; errors: string[] } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  useEffect(() => {
    if (open) {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }, [open])

  if (!open) return null

  const handleUpload = async () => {
    if (!file || !token) return
    setIsUploading(true)
    setResult(null) // Clear previous result
    setUploadProgress(0)
    try {
      const res = await bulkImportStudentsFile(token, file, (pct) => setUploadProgress(pct))
      setResult(res)
      if (res.inserted > 0 || res.updated > 0) onRefresh()
    } catch (err: any) {
      const raw = err.response?.data?.detail ?? err.message ?? "Import failed. Please check the file format or connection."
      const errors: string[] = Array.isArray(raw)
        ? raw.map((e: unknown) => (typeof e === "object" && e && "msg" in e) ? String((e as { msg?: unknown }).msg) : String(e))
        : [typeof raw === "string" ? raw : "Import failed"]
      setResult({
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors
      })
    } finally {
      setIsUploading(false)
      // Only show 100% after we leave the uploading spinner state
      requestAnimationFrame(() => setUploadProgress(100))
    }
  }

  const resetFile = () => {
    setFile(null)
    setResult(null)
    setUploadProgress(0)
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
          className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-gray-200 dark:border-gray-800"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Progress Bar Header - real upload progress */}
          <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800">
            {isUploading && (
              <motion.div
                initial={false}
                animate={{ width: `${uploadProgress}%` }}
                transition={{ duration: 0.2 }}
                className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500"
              />
            )}
            {result && !isUploading && (
              <div className={`h-full ${result.errors.length > 0 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: '100%' }} />
            )}
          </div>

          <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/20">
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Bulk Registration</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Import student roster from CSV/TSV</p>
            </div>
            <button onClick={onClose} className="p-2.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-2xl transition-all text-gray-400 hover:text-gray-900 dark:hover:text-white">
              <X className="size-5" />
            </button>
          </div>

          <div className="p-6 space-y-5">
            {!result && !isUploading ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
                  <div className="p-3 rounded-2xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30">
                    <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Required</p>
                    <p className="text-xs font-semibold leading-relaxed">Admission #, Name</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-gray-50/50 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Optional</p>
                    <p className="text-xs font-semibold leading-relaxed">Parent Email, Phone</p>
                  </div>
                </div>

                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]) }}
                  onClick={() => !file && document.getElementById("student-csv")?.click()}
                  className={`relative border-2 border-dashed rounded-3xl p-10 text-center transition-all duration-300 group
                    ${dragOver ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/10 scale-[0.99] shadow-inner" : "border-gray-200 dark:border-gray-800 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800/50"}
                    ${file ? "border-green-500/50 bg-green-50/10 dark:bg-green-900/5" : ""}
                  `}
                >
                  <input type="file" id="student-csv" className="hidden" accept=".csv,.tsv,.txt,.xlsx,.xls" onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} />

                  {file ? (
                    <div className="flex flex-col items-center">
                      <div className="size-16 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4 shadow-sm">
                        <FileSpreadsheet className="size-8 text-green-600 dark:text-green-500" />
                      </div>
                      <p className="font-bold text-gray-900 dark:text-white truncate max-w-[280px]">{file.name}</p>
                      <p className="text-xs text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB · Ready to sync</p>
                      <button
                        onClick={(e) => { e.stopPropagation(); resetFile(); }}
                        className="mt-4 px-4 py-1.5 text-xs font-bold text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-900/20 rounded-full transition-all flex items-center gap-1.5"
                      >
                        <Trash2 className="size-3" /> Remove File
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="size-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-all">
                        <Upload className="size-8 text-gray-400 group-hover:text-blue-500" />
                      </div>
                      <p className="font-bold text-gray-700 dark:text-gray-300">Click or drag CSV/TSV here</p>
                      <p className="text-xs text-gray-400 mt-2">Maximum file size 5MB</p>
                    </>
                  )}
                </div>
              </>
            ) : isUploading ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <div className="relative size-20 mb-6">
                  <div className="absolute inset-0 border-4 border-blue-100 dark:border-blue-900/30 rounded-full" />
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-extrabold tabular-nums text-blue-700 dark:text-blue-300">
                      {uploadProgress}%
                    </span>
                  </div>
                </div>
                <h4 className="text-lg font-bold text-gray-900 dark:text-white">Importing Roster...</h4>
                <p className="text-sm text-gray-500 mt-2">Processing your file. Progress updates in real time.</p>
              </div>
            ) : result && (
              <div className="space-y-4">
                <div className={`rounded-3xl p-6 border-2 ${result.errors.length > 0 ? "bg-amber-50/50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-900/30" : "bg-green-50/50 border-green-200 dark:bg-green-900/10 dark:border-green-900/30"}`}>
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-2xl shadow-sm ${result.errors.length > 0 ? "bg-amber-500 text-white" : "bg-green-500 text-white"}`}>
                      {result.errors.length > 0 ? <AlertCircle className="size-6" /> : <CheckCircle2 className="size-6" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-lg text-gray-900 dark:text-white">
                        {result.errors.length > 0 && result.inserted === 0 && result.updated === 0 ? "Import Failed" : "Import Successful"}
                      </h4>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                        <div className="text-sm">
                          <span className="font-bold text-green-600 dark:text-green-500">{result.inserted}</span>
                          <span className="ml-1 text-gray-500">inserted</span>
                        </div>
                        <div className="text-sm">
                          <span className="font-bold text-blue-600 dark:text-blue-500">{result.updated}</span>
                          <span className="ml-1 text-gray-500">updated</span>
                        </div>
                        <div className="text-sm">
                          <span className="font-bold text-amber-600 dark:text-amber-500">{result.skipped}</span>
                          <span className="ml-1 text-gray-500">skipped</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {result.errors.length > 0 && (
                    <div className="mt-5 bg-white/50 dark:bg-black/20 rounded-2xl p-4 border border-black/5 dark:border-white/5">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Error Logs</p>
                      <div className="max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                        {result.errors.map((err, i) => (
                          <div key={i} className="flex gap-2 py-1.5 border-b border-black/5 dark:border-white/5 last:border-0">
                            <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 rounded h-4 mt-0.5">ROW {i + 1}</span>
                            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed font-medium">{err}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {result.errors.length > 0 && (
                  <button
                    onClick={resetFile}
                    className="w-full py-4 text-sm font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-2xl transition-all flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="size-4" /> Try with a different file
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="p-6 bg-gray-50 dark:bg-gray-800/30 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row gap-3">
            {!result && !isUploading && (
              <button
                onClick={handleUpload}
                disabled={!file}
                className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-xl shadow-blue-500/20 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
              >
                <Upload className="size-5" />
                Upload Student Roster
              </button>
            )}
            <button
              onClick={onClose}
              className={`px-6 py-4 font-bold rounded-2xl transition-all ${result ? "flex-1 bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-100"}`}
            >
              {result ? "Complete & Return" : "Cancel"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ─────────────────────────────────────────── Main Page

export default function StudentsPage() {
  const router = useRouter()
  const { token } = useAuthStore()

  const [students, setStudents] = useState<StudentResponse[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState("")
  const [classFilter, setClassFilter] = useState<number | null>(null)
  const [streamFilter, setStreamFilter] = useState<number | null>(null)

  const [classes, setClasses] = useState<ClassResponse[]>([])
  const [streams, setStreams] = useState<StreamResponse[]>([])
  const [enrollmentCount, setEnrollmentCount] = useState(0)
  const [rosterSummary, setRosterSummary] = useState<RosterSummary | null>(null)

  const [showBulkModal, setShowBulkModal] = useState(false)
  const [syncModalOpen, setSyncModalOpen] = useState(false)

  const [devices, setDevices] = useState<DeviceResponse[]>([])
  const [syncDeviceId, setSyncDeviceId] = useState<number | "">("")
  const [unsyncedStudents, setUnsyncedStudents] = useState<UnsyncedStudentItem[]>([])
  const [unsyncedTeachers, setUnsyncedTeachers] = useState<UnsyncedTeacherItem[]>([])
  const [syncListLoading, setSyncListLoading] = useState(false)
  const [syncBusy, setSyncBusy] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [syncStudentFilter, setSyncStudentFilter] = useState("")
  const [syncTeacherFilter, setSyncTeacherFilter] = useState("")
  const [syncLedgerTab, setSyncLedgerTab] = useState<"students" | "teachers">("students")
  const [syncStudentLedgerPage, setSyncStudentLedgerPage] = useState(1)
  const [syncTeacherLedgerPage, setSyncTeacherLedgerPage] = useState(1)

  const unsyncedStudentsFiltered = useMemo(() => {
    const q = syncStudentFilter.toLowerCase().trim()
    if (!q) return unsyncedStudents
    return unsyncedStudents.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        s.admission_number.toLowerCase().includes(q) ||
        (s.class_name ?? "").toLowerCase().includes(q)
    )
  }, [unsyncedStudents, syncStudentFilter])

  const unsyncedTeachersFiltered = useMemo(() => {
    const q = syncTeacherFilter.toLowerCase().trim()
    if (!q) return unsyncedTeachers
    return unsyncedTeachers.filter(
      (t) =>
        t.full_name.toLowerCase().includes(q) ||
        t.employee_id.toLowerCase().includes(q)
    )
  }, [unsyncedTeachers, syncTeacherFilter])

  const syncStudentLedgerTotalPages = Math.max(
    1,
    Math.ceil(unsyncedStudentsFiltered.length / SYNC_LEDGER_PAGE_SIZE)
  )
  const syncTeacherLedgerTotalPages = Math.max(
    1,
    Math.ceil(unsyncedTeachersFiltered.length / SYNC_LEDGER_PAGE_SIZE)
  )

  const unsyncedStudentsPageSlice = useMemo(() => {
    const page = Math.min(syncStudentLedgerPage, syncStudentLedgerTotalPages)
    const start = (page - 1) * SYNC_LEDGER_PAGE_SIZE
    return unsyncedStudentsFiltered.slice(start, start + SYNC_LEDGER_PAGE_SIZE)
  }, [unsyncedStudentsFiltered, syncStudentLedgerPage, syncStudentLedgerTotalPages])

  const unsyncedTeachersPageSlice = useMemo(() => {
    const page = Math.min(syncTeacherLedgerPage, syncTeacherLedgerTotalPages)
    const start = (page - 1) * SYNC_LEDGER_PAGE_SIZE
    return unsyncedTeachersFiltered.slice(start, start + SYNC_LEDGER_PAGE_SIZE)
  }, [unsyncedTeachersFiltered, syncTeacherLedgerPage, syncTeacherLedgerTotalPages])

  useEffect(() => {
    setSyncStudentLedgerPage(1)
  }, [syncStudentFilter, unsyncedStudents])

  useEffect(() => {
    setSyncTeacherLedgerPage(1)
  }, [syncTeacherFilter, unsyncedTeachers])

  const fetchStudents = useCallback(async () => {
    if (!token) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await listStudents(token, {
        page,
        page_size: 15,
        search: search || undefined,
        class_id: classFilter || undefined,
        stream_id: streamFilter || undefined,
      })
      setStudents(res.items)
      setTotal(res.total)
      setTotalPages(res.total_pages)

      if (page === 1 && !search && !classFilter && !streamFilter) {
        const enrollStats = await getSuccessfulEnrollmentCount(token).catch(() => 0)
        setEnrollmentCount(enrollStats)
      }
    } catch (err) {
      setError(err instanceof StudentApiError ? err.message : "Failed to load students")
    } finally {
      setIsLoading(false)
    }
  }, [token, page, search, classFilter, streamFilter])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    ;(async () => {
      try {
        const rs = await getRosterSummary(token, {
          class_id: classFilter ?? undefined,
          stream_id: streamFilter ?? undefined,
        })
        if (!cancelled) setRosterSummary(rs)
      } catch {
        if (!cancelled) setRosterSummary(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, classFilter, streamFilter])

  useEffect(() => {
    if (!token) return
    listDevices(token, { page: 1, page_size: 100 })
      .then((r) => setDevices(r.items))
      .catch(() => setDevices([]))
  }, [token])

  useEffect(() => {
    setSyncMessage(null)
  }, [syncDeviceId, classFilter, streamFilter])

  useEffect(() => {
    if (!syncModalOpen) {
      setSyncStudentFilter("")
      setSyncTeacherFilter("")
    } else {
      setSyncLedgerTab("students")
    }
  }, [syncModalOpen])

  const rosterQuery = () => {
    const q = new URLSearchParams()
    if (classFilter) q.set("class_id", String(classFilter))
    if (streamFilter) q.set("stream_id", String(streamFilter))
    const s = q.toString()
    return s ? `?${s}` : ""
  }

  const goRosterSession = (kind: "on-site" | "absent") => {
    router.push(`/dashboard/students/roster/${kind}${rosterQuery()}`)
  }

  const refreshUnsyncedLists = useCallback(async () => {
    if (!token || syncDeviceId === "") return
    setSyncListLoading(true)
    setSyncMessage(null)
    try {
      const [stu, tch] = await Promise.all([
        listUnsyncedStudents(Number(syncDeviceId), token, {
          class_id: classFilter ?? undefined,
          stream_id: streamFilter ?? undefined,
        }),
        listUnsyncedTeachers(Number(syncDeviceId), token),
      ])
      setUnsyncedStudents(stu)
      setUnsyncedTeachers(tch)
    } catch (e: unknown) {
      setUnsyncedStudents([])
      setUnsyncedTeachers([])
      setSyncMessage(e instanceof Error ? e.message : "Could not read device roster")
    } finally {
      setSyncListLoading(false)
    }
  }, [token, syncDeviceId, classFilter, streamFilter])

  useEffect(() => {
    if (!syncModalOpen || syncDeviceId === "") return
    void refreshUnsyncedLists()
  }, [syncModalOpen, syncDeviceId, refreshUnsyncedLists])

  const runBulkStudentSync = async () => {
    if (!token || syncDeviceId === "") return
    setSyncBusy(true)
    setSyncMessage(null)
    try {
      const r = await bulkSyncStudentsToDevice(Number(syncDeviceId), token, {
        class_id: classFilter ?? undefined,
        stream_id: streamFilter ?? undefined,
      })
      setSyncMessage(`Synced ${r.synced} of ${r.attempted} students.${r.failed.length ? ` ${r.failed.length} failed.` : ""}`)
      await refreshUnsyncedLists()
    } catch (e: unknown) {
      setSyncMessage(e instanceof Error ? e.message : "Bulk sync failed")
    } finally {
      setSyncBusy(false)
    }
  }

  const runBulkTeacherSync = async () => {
    if (!token || syncDeviceId === "") return
    setSyncBusy(true)
    setSyncMessage(null)
    try {
      const r = await bulkSyncTeachersToDevice(Number(syncDeviceId), token)
      setSyncMessage(`Synced ${r.synced} of ${r.attempted} teachers.${r.failed.length ? ` ${r.failed.length} failed.` : ""}`)
      await refreshUnsyncedLists()
    } catch (e: unknown) {
      setSyncMessage(e instanceof Error ? e.message : "Bulk sync failed")
    } finally {
      setSyncBusy(false)
    }
  }

  useEffect(() => {
    fetchStudents()
  }, [fetchStudents])

  useEffect(() => {
    if (token) {
      listClasses(token).then(setClasses).catch(() => { })
    }
  }, [token])

  useEffect(() => {
    if (token && classFilter) {
      listStreams(token, classFilter).then(setStreams).catch(() => { })
    } else {
      setStreams([])
    }
  }, [token, classFilter])

  const handleAddStudent = () => {
    router.push("/dashboard/students/new")
  }

  const handleStudentClick = (id: number) => {
    router.push(`/dashboard/students/${id}`)
  }

  return (
    <motion.main
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8"
    >
      {/* ── Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 sm:text-4xl uppercase">
            Student Management
          </h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-1">
            Institutional Roster & Enrollment Analytics
          </p>
        </div>
      </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => window.location.assign("/dashboard/teachers")}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200/70 dark:border-indigo-800/40 text-[10px] font-bold uppercase rounded-lg shadow-sm hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
          >
            <UserCheck className="size-3.5 text-indigo-600 dark:text-indigo-300" />
            Teachers
          </button>
          <button
            onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-[10px] font-bold uppercase rounded-lg shadow-sm hover:bg-gray-50 transition-all"
          >
            <Upload className="size-3.5 text-blue-600" />
            Import
          </button>
          <button
            onClick={handleAddStudent}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold uppercase rounded-lg shadow-md transition-all scale-100 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="size-3.5" />
            Register
          </button>
        </div>
      </div>

      {/* ── Stats Hero */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="Total Students"
          value={total}
          icon={Users}
          gradient="from-blue-500 to-blue-600"
          sub="Registered"
          delay={0}
        />
        <StatCard
          label="Biometric Enrolled"
          value={enrollmentCount}
          icon={CheckCircle2}
          gradient="from-green-500 to-green-600"
          sub={`${total ? Math.round((enrollmentCount / total) * 100) : 0}% Coverage`}
          delay={0.05}
        />
        <StatCard
          label="In school now"
          value={rosterSummary?.currently_in_school ?? "—"}
          icon={LogIn}
          gradient="from-indigo-500 to-indigo-600"
          sub="Last tap today is IN"
          delay={0.1}
          onClick={() => goRosterSession("on-site")}
          hint="Open full session view"
        />
        <StatCard
          label="Absent (no check-in)"
          value={rosterSummary?.absent_no_check_in ?? "—"}
          icon={UserX}
          gradient="from-red-500 to-red-600"
          sub="No IN event today"
          delay={0.12}
          onClick={() => goRosterSession("absent")}
          hint="Open full session view"
        />
        <StatCard
          label="Active Classes"
          value={classes.length}
          icon={GraduationCap}
          gradient="from-purple-500 to-purple-600"
          sub="Academic Units"
          delay={0.15}
        />
      </div>

      {/* ── Quick links + device sync (opens in modal) */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-gray-200/50 dark:border-gray-700/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-lg shadow-indigo-500/5 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-blue-600 text-blue-600"
            onClick={() => goRosterSession("on-site")}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            On-site session
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-amber-600 text-amber-700 dark:text-amber-400"
            onClick={() => goRosterSession("absent")}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Absent session
          </Button>
        </div>
        <Button
          type="button"
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/20"
          onClick={() => setSyncModalOpen(true)}
        >
          <Cpu className="h-4 w-4 mr-2" />
          Open device sync workspace
        </Button>
      </motion.section>

      <Dialog open={syncModalOpen} onOpenChange={setSyncModalOpen}>
        <DialogContent className="flex h-[min(92dvh,920px)] max-h-[92dvh] w-full max-w-none flex-col gap-0 overflow-hidden rounded-none border-gray-200/50 bg-white/98 p-0 shadow-[0_0_50px_-12px_rgba(0,0,0,0.25)] backdrop-blur-2xl dark:border-gray-800/50 dark:bg-gray-950/98 sm:h-[min(92dvh,920px)] sm:max-h-[92dvh] sm:w-[min(96vw,1680px)] sm:max-w-[min(96vw,1680px)] sm:rounded-[2rem] max-sm:h-[100dvh] max-sm:max-h-[100dvh]">
          <div className="absolute top-0 left-0 w-full h-1.5 sm:h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600" />

          <DialogHeader className="p-4 sm:p-6 lg:p-8 pb-4 shrink-0 text-left">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2 min-w-0 pr-8">
                <DialogTitle className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 tracking-tight leading-tight">
                  Hardware synchronization workspace
                </DialogTitle>
                <DialogDescription className="text-xs font-medium text-muted-foreground sm:text-sm">
                  Choose a device, review the pending list, then push to the terminal. Bulk push includes all pending
                  records for this school, not only the current page.
                </DialogDescription>
              </div>
              <div className="hidden lg:flex flex-col items-end gap-2 shrink-0">
                <Badge
                  variant="outline"
                  className="bg-blue-50/50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 py-1.5 px-4 rounded-xl font-bold uppercase tracking-[0.2em] text-[10px]"
                >
                  Node sync
                </Badge>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Encrypted channel</p>
              </div>
            </div>
          </DialogHeader>

          <div className="px-4 sm:px-6 lg:px-8 pb-4 sm:pb-6 lg:pb-8 space-y-4 sm:space-y-6 min-h-0 flex-1 flex flex-col overflow-hidden">
            {/* Control Bar */}
            <div className="grid grid-cols-1 gap-4 rounded-2xl border border-gray-100 bg-gray-50/80 p-4 shadow-sm dark:border-gray-800/50 dark:bg-gray-900/40 sm:p-6 sm:rounded-[2rem] xl:grid-cols-12">
              <div className="min-w-0 space-y-2 xl:col-span-4">
                <label className="block px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Target biometric node
                </label>
                <select
                  className="h-12 w-full rounded-2xl border border-blue-300 bg-white px-4 text-sm font-semibold text-gray-900 shadow-sm outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 sm:h-14 sm:px-5"
                  value={syncDeviceId === "" ? "" : String(syncDeviceId)}
                  onChange={(e) => setSyncDeviceId(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">Select device…</option>
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} · {d.status.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end xl:col-span-8">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="flex-1 min-h-12 sm:min-h-14 rounded-2xl border-gray-200 dark:border-gray-800 font-bold uppercase tracking-[0.15em] text-[10px] hover:bg-white dark:hover:bg-gray-900 transition-all shadow-sm"
                  disabled={syncDeviceId === "" || syncListLoading}
                  onClick={() => refreshUnsyncedLists()}
                >
                  {syncListLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2 shrink-0" /> : <RefreshCw className="h-4 w-4 mr-2 shrink-0" />}
                  Refresh ledger
                </Button>
                <Button
                  type="button"
                  size="lg"
                  className="flex-1 min-w-[140px] min-h-12 sm:min-h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase tracking-[0.15em] text-[10px] shadow-xl shadow-blue-500/20"
                  disabled={syncDeviceId === "" || syncBusy || unsyncedStudents.length === 0}
                  onClick={() => runBulkStudentSync()}
                >
                  {syncBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2 shrink-0" /> : <Users className="h-4 w-4 mr-2 shrink-0" />}
                  Push students ({unsyncedStudents.length})
                </Button>
                <Button
                  type="button"
                  size="lg"
                  className="flex-1 min-w-[140px] min-h-12 sm:min-h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold uppercase tracking-[0.15em] text-[10px] shadow-xl shadow-indigo-500/20"
                  disabled={syncDeviceId === "" || syncBusy || unsyncedTeachers.length === 0}
                  onClick={() => runBulkTeacherSync()}
                >
                  {syncBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2 shrink-0" /> : <GraduationCap className="h-4 w-4 mr-2 shrink-0" />}
                  Push faculty ({unsyncedTeachers.length})
                </Button>
              </div>
            </div>

            {syncMessage && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-4 rounded-[1.5rem] border border-blue-100 bg-blue-50/80 p-5 text-sm font-semibold text-blue-800 shadow-sm dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-800/40">
                  {syncListLoading ? (
                    <RefreshCw className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-300" />
                  ) : /fail|error|could not/i.test(syncMessage) ? (
                    <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  )}
                </div>
                <span className="min-w-0">{syncMessage}</span>
              </motion.div>
            )}

            {unsyncedStudents.length > 0 || unsyncedTeachers.length > 0 ? (
              <Tabs
                value={syncLedgerTab}
                onValueChange={(v) => setSyncLedgerTab(v as "students" | "teachers")}
                className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden"
              >
                <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 rounded-2xl border border-gray-200/50 bg-gray-100/80 p-2 dark:border-gray-700/50 dark:bg-gray-900/50">
                  <TabsTrigger
                    value="students"
                    className="rounded-xl px-4 py-2.5 text-xs font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                  >
                    <Users className="mr-2 inline size-4" />
                    Pending students ({unsyncedStudents.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="teachers"
                    className="rounded-xl px-4 py-2.5 text-xs font-bold data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
                  >
                    <GraduationCap className="mr-2 inline size-4" />
                    Pending faculty ({unsyncedTeachers.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="students" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden">
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-950 sm:rounded-[2rem]">
                    <div className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-400">
                          Student ledger
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {unsyncedStudentsFiltered.length} match filter · {unsyncedStudents.length} total pending
                        </p>
                      </div>
                      <Badge className="h-8 w-fit rounded-xl border-0 bg-blue-600 px-4 font-bold text-white hover:bg-blue-700">
                        Page {Math.min(syncStudentLedgerPage, syncStudentLedgerTotalPages)} / {syncStudentLedgerTotalPages}
                      </Badge>
                    </div>
                    <div className="flex flex-col gap-3 p-4 sm:p-6 min-h-0 flex-1">
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={syncStudentFilter}
                          onChange={(e) => setSyncStudentFilter(e.target.value)}
                          placeholder="Search name, admission number, or class…"
                          className="h-12 rounded-2xl border-blue-300 pl-11 text-sm font-medium focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700"
                        />
                      </div>
                      <div className="min-h-[200px] flex-1 overflow-auto rounded-2xl border border-gray-100 dark:border-gray-800">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:bg-transparent">
                              <TableHead className="min-w-[200px] text-[10px] font-bold uppercase tracking-wider text-white">
                                Student
                              </TableHead>
                              <TableHead className="w-[min(28vw,200px)] text-[10px] font-bold uppercase tracking-wider text-white">
                                Admission
                              </TableHead>
                              <TableHead className="min-w-[140px] text-[10px] font-bold uppercase tracking-wider text-white">
                                Class
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {unsyncedStudentsPageSlice.length > 0 ? (
                              unsyncedStudentsPageSlice.map((s) => (
                                <TableRow
                                  key={s.id}
                                  className="border-gray-100 dark:border-gray-900 hover:bg-blue-50/40 dark:hover:bg-blue-950/20"
                                >
                                  <TableCell className="max-w-[50vw] py-3 text-sm font-semibold text-gray-900 dark:text-gray-100 sm:max-w-none">
                                    <span className="break-words">{s.full_name}</span>
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap py-3 font-mono text-sm text-gray-600 dark:text-gray-400">
                                    {s.admission_number}
                                  </TableCell>
                                  <TableCell className="py-3 text-sm text-gray-600 dark:text-gray-400">
                                    {s.class_name ?? "—"}
                                  </TableCell>
                                </TableRow>
                              ))
                            ) : (
                              <TableRow>
                                <TableCell colSpan={3} className="py-16 text-center text-sm text-muted-foreground">
                                  No rows match this filter.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                      {unsyncedStudentsFiltered.length > 0 && (
                        <SyncLedgerPagination
                          page={syncStudentLedgerPage}
                          totalPages={syncStudentLedgerTotalPages}
                          filteredCount={unsyncedStudentsFiltered.length}
                          pageSize={SYNC_LEDGER_PAGE_SIZE}
                          variant="blue"
                          onPageChange={setSyncStudentLedgerPage}
                        />
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="teachers" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden">
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-950 sm:rounded-[2rem]">
                    <div className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-700 dark:text-indigo-400">
                          Faculty ledger
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {unsyncedTeachersFiltered.length} match filter · {unsyncedTeachers.length} total pending
                        </p>
                      </div>
                      <Badge className="h-8 w-fit rounded-xl border-0 bg-indigo-600 px-4 font-bold text-white hover:bg-indigo-700">
                        Page {Math.min(syncTeacherLedgerPage, syncTeacherLedgerTotalPages)} / {syncTeacherLedgerTotalPages}
                      </Badge>
                    </div>
                    <div className="flex flex-col gap-3 p-4 sm:p-6 min-h-0 flex-1">
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={syncTeacherFilter}
                          onChange={(e) => setSyncTeacherFilter(e.target.value)}
                          placeholder="Search name or employee ID…"
                          className="h-12 rounded-2xl border-indigo-300 pl-11 text-sm font-medium focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-700"
                        />
                      </div>
                      <div className="min-h-[200px] flex-1 overflow-auto rounded-2xl border border-gray-100 dark:border-gray-800">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 hover:bg-transparent">
                              <TableHead className="min-w-[220px] text-[10px] font-bold uppercase tracking-wider text-white">
                                Name
                              </TableHead>
                              <TableHead className="w-[min(36vw,240px)] text-[10px] font-bold uppercase tracking-wider text-white">
                                Employee ID
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {unsyncedTeachersPageSlice.length > 0 ? (
                              unsyncedTeachersPageSlice.map((t) => (
                                <TableRow
                                  key={t.id}
                                  className="border-gray-100 dark:border-gray-900 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20"
                                >
                                  <TableCell className="max-w-[60vw] py-3 text-sm font-semibold text-gray-900 dark:text-gray-100 sm:max-w-none">
                                    <span className="break-words">{t.full_name}</span>
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap py-3 font-mono text-sm text-gray-600 dark:text-gray-400">
                                    {t.employee_id}
                                  </TableCell>
                                </TableRow>
                              ))
                            ) : (
                              <TableRow>
                                <TableCell colSpan={2} className="py-16 text-center text-sm text-muted-foreground">
                                  No rows match this filter.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                      {unsyncedTeachersFiltered.length > 0 && (
                        <SyncLedgerPagination
                          page={syncTeacherLedgerPage}
                          totalPages={syncTeacherLedgerTotalPages}
                          filteredCount={unsyncedTeachersFiltered.length}
                          pageSize={SYNC_LEDGER_PAGE_SIZE}
                          variant="indigo"
                          onPageChange={setSyncTeacherLedgerPage}
                        />
                      )}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-20 bg-gray-50/30 dark:bg-gray-900/20 rounded-[3rem] border-2 border-dashed border-gray-100 dark:border-gray-800">
                <div className="h-24 w-24 rounded-full bg-white dark:bg-gray-800 shadow-2xl flex items-center justify-center mb-8 relative">
                  <div className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-10" />
                  <CheckCircle2 className="h-12 w-12 text-emerald-500 relative z-10" />
                </div>
                <h3 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-2xl">
                  Nothing pending for this device
                </h3>
                <p className="mt-3 max-w-sm text-center text-sm font-medium leading-relaxed text-muted-foreground">
                  New enrollments or roster changes will appear here after you pick a device above.
                </p>
              </div>
            )}
          </div>
          
          <DialogFooter className="flex flex-col-reverse gap-3 border-t border-gray-100 bg-gray-50/80 p-4 dark:border-gray-800 dark:bg-gray-900/80 sm:flex-row sm:items-center sm:justify-end sm:rounded-b-[2rem] sm:p-6 lg:p-8">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => setSyncModalOpen(false)}
              className="h-12 w-full rounded-2xl border-gray-200 font-semibold dark:border-gray-700 sm:h-14 sm:w-auto sm:px-10"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Main List Component */}
      <div className="mt-8">
        <StudentList
          students={students}
          isLoading={isLoading}
          error={error}
          search={search}
          onSearchChange={setSearch}
          classFilter={classFilter}
          onClassFilterChange={setClassFilter}
          streamFilter={streamFilter}
          onStreamFilterChange={setStreamFilter}
          page={page}
          totalPages={totalPages}
          total={total}
          onPageChange={setPage}
          onAddStudent={handleAddStudent}
          onStudentClick={handleStudentClick}
          classes={classes}
          streams={streams}
        />
      </div>

      <BulkUploadModal
        open={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        onRefresh={fetchStudents}
      />
    </motion.main>
  )
}

"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { ArrowLeft, Download, Loader2, Search, Printer } from "lucide-react"
import { useAuthStore } from "@/lib/store/authStore"
import {
  listRosterCurrentlyIn,
  listRosterAbsent,
  type RosterStudentItem,
  type RosterAbsentItem,
} from "@/lib/api/attendance"
import { getApiBaseUrlOrFallback } from "@/lib/env"
import { fadeInUp } from "@/lib/animations/framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

function useDebouncedValue<T>(value: T, ms: number): T {
  const [d, setD] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setD(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return d
}

function csvEscape(s: string) {
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function StudentRosterSessionPageInner() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { token, hasHydrated } = useAuthStore()
  const kind = (params.kind as string) === "absent" ? "absent" : "on-site"

  const classId = searchParams.get("class_id")
  const streamId = searchParams.get("stream_id")
  const classIdNum = classId ? parseInt(classId, 10) : undefined
  const streamIdNum = streamId ? parseInt(streamId, 10) : undefined

  const [loading, setLoading] = useState(true)
  const [inRows, setInRows] = useState<RosterStudentItem[]>([])
  const [absentRows, setAbsentRows] = useState<RosterAbsentItem[]>([])
  const [searchInput, setSearchInput] = useState("")
  const debouncedSearch = useDebouncedValue(searchInput, 280)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    const q = {
      class_id: classIdNum,
      stream_id: streamIdNum,
    }
    try {
      if (kind === "on-site") {
        const rows = await listRosterCurrentlyIn(token, q)
        setInRows(rows)
        setAbsentRows([])
      } else {
        const rows = await listRosterAbsent(token, q)
        setAbsentRows(rows)
        setInRows([])
      }
    } catch {
      setInRows([])
      setAbsentRows([])
    } finally {
      setLoading(false)
    }
  }, [token, kind, classIdNum, streamIdNum])

  useEffect(() => {
    if (hasHydrated && token) load()
  }, [hasHydrated, token, load])

  const qLower = debouncedSearch.toLowerCase().trim()

  const filteredIn = useMemo(() => {
    if (!qLower) return inRows
    return inRows.filter(
      (r) =>
        r.full_name.toLowerCase().includes(qLower) ||
        r.admission_number.toLowerCase().includes(qLower) ||
        (r.class_name ?? "").toLowerCase().includes(qLower)
    )
  }, [inRows, qLower])

  const filteredAbsent = useMemo(() => {
    if (!qLower) return absentRows
    return absentRows.filter(
      (r) =>
        r.full_name.toLowerCase().includes(qLower) ||
        r.admission_number.toLowerCase().includes(qLower) ||
        (r.class_name ?? "").toLowerCase().includes(qLower)
    )
  }, [absentRows, qLower])

  const exportCsv = () => {
    if (kind === "on-site") {
      const headers = ["Name", "Admission", "Class", "Time_IN", "Device"]
      const lines = [
        headers.join(","),
        ...filteredIn.map((r) =>
          [
            csvEscape(r.full_name),
            csvEscape(r.admission_number),
            csvEscape(r.class_name ?? ""),
            csvEscape(r.last_event_at.replace("T", " ").slice(0, 19)),
            csvEscape(r.device_name),
          ].join(",")
        ),
      ]
      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
      const u = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = u
      a.download = `students-on-site-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(u)
    } else {
      const headers = ["Name", "Admission", "Class"]
      const lines = [
        headers.join(","),
        ...filteredAbsent.map((r) =>
          [
            csvEscape(r.full_name),
            csvEscape(r.admission_number),
            csvEscape(r.class_name ?? ""),
          ].join(",")
        ),
      ]
      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
      const u = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = u
      a.download = `students-absent-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(u)
    }
  }

  const downloadScopedPdf = async () => {
    if (!token) return
    const base = getApiBaseUrlOrFallback()
    const q = new URLSearchParams({
      user_type: "student",
      report_layout: "summary",
      group_by_class: "false",
    })
    if (classIdNum != null && !Number.isNaN(classIdNum)) q.set("class_id", String(classIdNum))
    if (streamIdNum != null && !Number.isNaN(streamIdNum)) q.set("stream_id", String(streamIdNum))
    try {
      const res = await fetch(`${base}/api/v1/reports/present-today?${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const blob = await res.blob()
      const u = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = u
      a.download = "present-today-students.pdf"
      a.click()
      URL.revokeObjectURL(u)
    } catch {
      /* ignore */
    }
  }

  const total = kind === "on-site" ? inRows.length : absentRows.length
  const shown = kind === "on-site" ? filteredIn.length : filteredAbsent.length

  if (!hasHydrated) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 sm:p-6 lg:p-8 print:bg-white print:p-2">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeInUp}
        className="mx-auto max-w-7xl space-y-6"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <Button
            type="button"
            variant="ghost"
            className="w-fit border border-gray-200 dark:border-gray-700"
            onClick={() => router.push("/dashboard/students")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to students
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-indigo-600 text-indigo-600"
              onClick={() => exportCsv()}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV ({shown})
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-blue-600 text-blue-600"
              onClick={() => downloadScopedPdf()}
            >
              PDF (today)
            </Button>
            <Button
              type="button"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => window.print()}
            >
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200/50 dark:border-gray-700/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-lg shadow-blue-500/10 overflow-hidden">
          <div className="border-b border-gray-200/50 dark:border-gray-700/50 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-5 py-4 print:bg-blue-700">
            <h1 className="text-xl font-bold text-white tracking-tight">
              {kind === "on-site" ? "Students on site" : "Students absent (no check-in today)"}
            </h1>
            <p className="text-xs text-white/90 mt-1 font-medium">
              {total.toLocaleString()} loaded
              {qLower ? ` · ${shown} match search` : ""}
              {(classIdNum || streamIdNum) && " · filtered by class/stream from Students page"}
            </p>
          </div>

          <div className="p-4 sm:p-5 space-y-4 print:hidden">
            <div>
              <Label className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                Search by name or admission number
              </Label>
              <div className="relative mt-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Type to filter…"
                  className="pl-9 h-11 border-blue-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="px-2 sm:px-4 pb-4 max-h-[min(70vh,1200px)] overflow-auto print:max-h-none">
            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
              </div>
            ) : kind === "on-site" ? (
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-gray-200 dark:border-gray-700 hover:bg-transparent bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-950 dark:to-slate-900">
                    <TableHead className="text-white font-bold uppercase text-[10px] tracking-wider">Name</TableHead>
                    <TableHead className="text-white font-bold uppercase text-[10px] tracking-wider">Admission</TableHead>
                    <TableHead className="text-white font-bold uppercase text-[10px] tracking-wider">Class</TableHead>
                    <TableHead className="text-white font-bold uppercase text-[10px] tracking-wider whitespace-nowrap min-w-[11rem]">
                      Time (IN)
                    </TableHead>
                    <TableHead className="text-white font-bold uppercase text-[10px] tracking-wider">Device</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIn.map((r) => (
                    <TableRow
                      key={r.student_id}
                      className="border-gray-100 dark:border-gray-800 hover:bg-blue-50/40 dark:hover:bg-blue-950/20"
                    >
                      <TableCell className="font-medium text-gray-900 dark:text-gray-100">{r.full_name}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{r.admission_number}</TableCell>
                      <TableCell className="text-muted-foreground">{r.class_name ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground text-sm">
                        {r.last_event_at.replace("T", " ").slice(0, 19)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.device_name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-gray-200 dark:border-gray-700 hover:bg-transparent bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-950 dark:to-slate-900">
                    <TableHead className="text-white font-bold uppercase text-[10px] tracking-wider">Name</TableHead>
                    <TableHead className="text-white font-bold uppercase text-[10px] tracking-wider">Admission</TableHead>
                    <TableHead className="text-white font-bold uppercase text-[10px] tracking-wider">Class</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAbsent.map((r) => (
                    <TableRow
                      key={r.student_id}
                      className="border-gray-100 dark:border-gray-800 hover:bg-amber-50/40 dark:hover:bg-amber-950/10"
                    >
                      <TableCell className="font-medium text-gray-900 dark:text-gray-100">{r.full_name}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{r.admission_number}</TableCell>
                      <TableCell className="text-muted-foreground">{r.class_name ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {!loading && shown === 0 && (
              <p className="text-center text-sm text-muted-foreground py-16">No rows match your search.</p>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default function StudentRosterSessionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[40vh] flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        </div>
      }
    >
      <StudentRosterSessionPageInner />
    </Suspense>
  )
}

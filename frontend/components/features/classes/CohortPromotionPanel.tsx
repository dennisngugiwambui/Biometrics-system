"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, ArrowUp, GraduationCap, Trash2, Cpu } from "lucide-react"
import { fadeInUp } from "@/lib/animations/framer-motion"
import { useAuthStore } from "@/lib/store/authStore"
import { promoteCohort, bulkGraduateStudents, bulkRemoveStudentsFromDevices, StudentApiError } from "@/lib/api/students"
import type { ClassResponse } from "@/lib/api/classes"

type Props = {
  classes: ClassResponse[]
  selectedClassId: number | null
  onRefresh: () => Promise<void>
}

export function CohortPromotionPanel({ classes, selectedClassId, onRefresh }: Props) {
  const { token } = useAuthStore()
  const [ladder, setLadder] = useState<number[]>([])
  const [graduateTop, setGraduateTop] = useState(true)
  const [removeFromDevices, setRemoveFromDevices] = useState(true)
  const [autoStreams, setAutoStreams] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const sorted = [...classes].sort((a, b) => a.name.localeCompare(b.name))

  const addToLadder = (id: number) => {
    setLadder((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }

  const removeFromLadder = (id: number) => {
    setLadder((prev) => prev.filter((x) => x !== id))
  }

  const moveUp = (index: number) => {
    if (index <= 0) return
    setLadder((prev) => {
      const next = [...prev]
      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
      return next
    })
  }

  const runPromote = async () => {
    if (!token || ladder.length < 2) {
      setErr("Build a ladder with at least two classes: lowest grade first, highest last.")
      return
    }
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      const r = await promoteCohort(token, {
        ladder_class_ids: ladder,
        graduate_top_rung: graduateTop,
        remove_graduates_from_devices: removeFromDevices,
        create_target_streams_if_missing: autoStreams,
      })
      setMsg(
        `Graduated ${r.graduated_count} from the top class; moved ${r.moved_count} students up one level.` +
          (r.device_removal_error ? ` Device note: ${r.device_removal_error}` : "")
      )
      await onRefresh()
    } catch (e) {
      setErr(e instanceof StudentApiError ? e.message : "Promotion failed")
    } finally {
      setBusy(false)
    }
  }

  const runGraduateClass = async () => {
    if (!token || !selectedClassId) {
      setErr("Select a class in the list on the left, then use Graduate class.")
      return
    }
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      const r = await bulkGraduateStudents(token, {
        class_id: selectedClassId,
        remove_from_devices: removeFromDevices,
      })
      setMsg(
        `Marked ${r.graduated_count} students as graduated.` +
          (r.device_removal_error ? ` Device: ${r.device_removal_error}` : "")
      )
      await onRefresh()
    } catch (e) {
      setErr(e instanceof StudentApiError ? e.message : "Graduation failed")
    } finally {
      setBusy(false)
    }
  }

  const runDeviceOnly = async () => {
    if (!token || !selectedClassId) {
      setErr("Select a class first, or use promotion with explicit IDs via API.")
      return
    }
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      const r = await bulkRemoveStudentsFromDevices(token, {
        class_id: selectedClassId,
        include_graduated_in_class: true,
      })
      setMsg(`Requested device cleanup for ${r.student_ids.length} students.`)
    } catch (e) {
      setErr(e instanceof StudentApiError ? e.message : "Device cleanup failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div initial="hidden" animate="visible" variants={fadeInUp}>
      <Card className="border border-gray-200/50 bg-white/80 shadow-lg backdrop-blur-sm dark:border-gray-700/50 dark:bg-gray-800/80">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-lg text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
            <GraduationCap className="h-5 w-5 text-indigo-600" />
            Promotion &amp; leavers
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Add classes in order from the lowest grade to the highest (e.g. Form 1 → Form 4). The top class is
            graduated first, then everyone else moves up. Create missing streams on the target class automatically
            when names match (e.g. East → East). Add a new empty class/streams under Classes first if you need a
            new grade (e.g. Grade 11).
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {err && (
            <Alert variant="destructive">
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          )}
          {msg && (
            <Alert className="border-green-200 bg-green-50/80 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-200">
              <AlertDescription>{msg}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-blue-700 dark:text-blue-400">Add class to ladder (low → high)</Label>
              <div className="flex flex-wrap gap-2">
                {sorted.map((c) => (
                  <Button
                    key={c.id}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-blue-600 text-blue-600"
                    disabled={busy || ladder.includes(c.id)}
                    onClick={() => addToLadder(c.id)}
                  >
                    + {c.name}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-indigo-700 dark:text-indigo-400">Ladder order</Label>
              <div className="min-h-[120px] space-y-2 rounded-xl border border-gray-200/50 bg-gray-50/50 p-3 dark:border-gray-700/50 dark:bg-gray-900/40">
                {ladder.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No classes in ladder yet.</p>
                ) : (
                  ladder.map((id, idx) => {
                    const name = classes.find((c) => c.id === id)?.name ?? `#${id}`
                    return (
                      <div
                        key={`${id}-${idx}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-gray-200/50 bg-white/80 px-3 py-2 dark:border-gray-700/50 dark:bg-gray-800/80"
                      >
                        <span className="text-sm font-semibold">
                          {idx + 1}. {name}
                        </span>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            disabled={busy || idx === 0}
                            onClick={() => moveUp(idx)}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-600"
                            disabled={busy}
                            onClick={() => removeFromLadder(id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={graduateTop}
                onChange={(e) => setGraduateTop(e.target.checked)}
                className="rounded border-blue-300 text-blue-600 focus:ring-blue-500"
              />
              Graduate top class
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={removeFromDevices}
                onChange={(e) => setRemoveFromDevices(e.target.checked)}
                className="rounded border-blue-300 text-blue-600 focus:ring-blue-500"
              />
              Remove graduates from devices (via gateway)
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoStreams}
                onChange={(e) => setAutoStreams(e.target.checked)}
                className="rounded border-purple-300 text-purple-600 focus:ring-purple-500"
              />
              Auto-create matching streams on target
            </label>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              className="bg-blue-600 hover:bg-blue-700"
              disabled={busy || ladder.length < 2}
              onClick={runPromote}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Run promotion
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="bg-indigo-600 text-white hover:bg-indigo-700"
              disabled={busy || !selectedClassId}
              onClick={runGraduateClass}
            >
              Graduate selected class only
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-indigo-600 text-indigo-600"
              disabled={busy || !selectedClassId}
              onClick={runDeviceOnly}
            >
              <Cpu className="mr-2 h-4 w-4" />
              Devices: remove class from terminals
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Soft-delete for a class or stream still lives in the class list (trash icon). Graduated students stay in
            the database for attendance history; new device events store class/stream snapshots for reporting after
            promotion.
          </p>
        </CardContent>
      </Card>
    </motion.div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ArrowLeft,
  Edit,
  Trash2,
  Calendar,
  User,
  Phone,
  Mail,
  School,
  Loader2,
  AlertCircle,
  Server,
} from "lucide-react"
import { fadeInUp, pageTransition } from "@/lib/animations/framer-motion"
import { useAuthStore } from "@/lib/store/authStore"
import {
  getStudent,
  deleteStudent,
  type StudentResponse,
  StudentApiError,
} from "@/lib/api/students"
import { getClass, type ClassResponse } from "@/lib/api/classes"
import { getStream, type StreamResponse } from "@/lib/api/streams"
import { formatDate, formatDateTime } from "@/lib/utils"
import { SyncToDeviceDialog } from "@/components/features/students/SyncToDeviceDialog"

export default function StudentDetailPage() {
  const router = useRouter()
  const params = useParams()
  const studentId = params.id ? parseInt(params.id as string) : undefined
  const { token } = useAuthStore()
  const [student, setStudent] = useState<StudentResponse | null>(null)
  const [classData, setClassData] = useState<ClassResponse | null>(null)
  const [streamData, setStreamData] = useState<StreamResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showSyncDialog, setShowSyncDialog] = useState(false)

  useEffect(() => {
    if (!token || !studentId) return

    const fetchStudent = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const data = await getStudent(token, studentId)
        setStudent(data)

        // Fetch class and stream data if they exist
        if (data.class_id) {
          try {
            const classInfo = await getClass(token, data.class_id)
            setClassData(classInfo)
          } catch (err) {
            console.error("Failed to load class:", err)
          }
        }

        if (data.stream_id) {
          try {
            const streamInfo = await getStream(token, data.stream_id)
            setStreamData(streamInfo)
          } catch (err) {
            console.error("Failed to load stream:", err)
          }
        }
      } catch (err) {
        if (err instanceof StudentApiError) {
          setError(err.message)
        } else {
          setError("Failed to load student")
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchStudent()
  }, [token, studentId])

  const handleEdit = () => {
    router.push(`/dashboard/students/${studentId}/edit`)
  }

  const handleDelete = async () => {
    if (!token || !studentId) return

    try {
      setIsDeleting(true)
      await deleteStudent(token, studentId)
      router.push("/dashboard/students")
    } catch (err) {
      if (err instanceof StudentApiError) {
        setError(err.message)
      } else {
        setError("Failed to delete student")
      }
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  if (isLoading) {
    return (
      <motion.main
        variants={pageTransition}
        initial="initial"
        animate="animate"
        className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8"
      >
        <div className="space-y-6">
          <Skeleton className="h-10 w-32" />
          <Card>
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        </div>
      </motion.main>
    )
  }

  if (error || !student) {
    return (
      <motion.main
        variants={pageTransition}
        initial="initial"
        animate="animate"
        className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8"
      >
        <div className="space-y-4">
          <Button
            variant="ghost"
            onClick={() => router.push("/dashboard/students")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Students
          </Button>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error || "Student not found"}
            </AlertDescription>
          </Alert>
        </div>
      </motion.main>
    )
  }

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative flex-1 overflow-hidden"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900" />
      <div className="pointer-events-none absolute -right-24 top-20 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl dark:bg-blue-400/10" />
      <div className="pointer-events-none absolute -left-24 bottom-20 h-72 w-72 rounded-full bg-purple-400/20 blur-3xl dark:bg-purple-400/10" />

      <div className="relative z-10 mx-auto max-w-3xl space-y-5 px-4 py-6 sm:space-y-6 sm:px-6 lg:py-10">
        <motion.div variants={fadeInUp} initial="hidden" animate="visible">
          <Button
            variant="ghost"
            onClick={() => router.push("/dashboard/students")}
            className="gap-2 px-0 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to students
          </Button>
        </motion.div>

        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-gray-200/50 bg-white/80 p-4 shadow-lg backdrop-blur-sm dark:border-gray-700/50 dark:bg-gray-800/80"
        >
          <p className="mb-3 text-xs text-muted-foreground sm:hidden">Actions</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setShowSyncDialog(true)}
              className="w-full border-indigo-600 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 sm:w-auto"
            >
              <Server className="mr-2 h-4 w-4" />
              Sync to device
            </Button>
            <Button
              variant="outline"
              onClick={handleEdit}
              className="w-full border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 sm:w-auto"
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit student
            </Button>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
              className="w-full bg-red-600 hover:bg-red-700 sm:w-auto"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </motion.div>

        <motion.div variants={fadeInUp} initial="hidden" animate="visible" transition={{ delay: 0.1 }}>
          <Card className="overflow-hidden rounded-2xl border border-gray-200/50 bg-white/80 shadow-lg backdrop-blur-sm dark:border-gray-700/50 dark:bg-gray-800/80">
            <CardHeader className="space-y-6 border-b border-gray-200/50 p-6 dark:border-gray-700/50 sm:p-8">
              <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-2xl font-bold text-white shadow-lg shadow-blue-500/20 sm:h-24 sm:w-24 sm:text-3xl">
                  {student.first_name[0]}
                  {student.last_name[0]}
                </div>
                <div className="min-w-0 flex-1 text-center sm:text-left">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Admission number</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-blue-600 dark:text-blue-400">
                    {student.admission_number}
                  </p>
                  <CardTitle className="mt-3 text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 sm:text-3xl">
                    {student.first_name} {student.last_name}
                  </CardTitle>
                  <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
                    <Badge className="border-0 bg-green-500 text-white hover:bg-green-600">Enrolled</Badge>
                    {student.gender ? (
                      <Badge variant="secondary" className="font-medium capitalize">
                        {student.gender}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-8 p-6 sm:p-8">
              <section>
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
                    <User className="h-4 w-4 text-blue-600" />
                  </div>
                  <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Profile</h2>
                </div>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-gray-200/50 bg-gray-50/50 p-4 dark:border-gray-700/50 dark:bg-gray-900/30">
                    <dt className="text-xs text-muted-foreground">Full name</dt>
                    <dd className="mt-1 font-semibold text-gray-900 dark:text-gray-100">
                      {student.first_name} {student.last_name}
                    </dd>
                  </div>
                  {student.date_of_birth ? (
                    <div className="rounded-xl border border-gray-200/50 bg-gray-50/50 p-4 dark:border-gray-700/50 dark:bg-gray-900/30">
                      <dt className="text-xs text-muted-foreground">Date of birth</dt>
                      <dd className="mt-1 flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
                        <Calendar className="h-4 w-4 text-blue-500" />
                        {formatDate(student.date_of_birth)}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </section>

              <section>
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
                    <School className="h-4 w-4 text-indigo-600" />
                  </div>
                  <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Class &amp; stream</h2>
                </div>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-gray-200/50 bg-gray-50/50 p-4 dark:border-gray-700/50 dark:bg-gray-900/30">
                    <dt className="text-xs text-muted-foreground">Class</dt>
                    <dd className="mt-1 font-semibold text-gray-900 dark:text-gray-100">
                      {classData ? classData.name : "Unassigned"}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-gray-200/50 bg-gray-50/50 p-4 dark:border-gray-700/50 dark:bg-gray-900/30">
                    <dt className="text-xs text-muted-foreground">Stream</dt>
                    <dd className="mt-1 font-semibold text-gray-900 dark:text-gray-100">
                      {streamData ? streamData.name : "Unassigned"}
                    </dd>
                  </div>
                </dl>
              </section>

              <section>
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
                    <Phone className="h-4 w-4 text-purple-600" />
                  </div>
                  <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Parent / guardian</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-gray-200/50 bg-gray-50/50 p-4 dark:border-gray-700/50 dark:bg-gray-900/30">
                    <p className="text-xs text-muted-foreground">Phone</p>
                    {student.parent_phone ? (
                      <a
                        href={`tel:${student.parent_phone}`}
                        className="mt-2 inline-flex items-center gap-2 font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                      >
                        <Phone className="h-4 w-4 shrink-0" />
                        {student.parent_phone}
                      </a>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">Not provided</p>
                    )}
                  </div>
                  <div className="rounded-xl border border-gray-200/50 bg-gray-50/50 p-4 dark:border-gray-700/50 dark:bg-gray-900/30">
                    <p className="text-xs text-muted-foreground">Email</p>
                    {student.parent_email ? (
                      <a
                        href={`mailto:${student.parent_email}`}
                        className="mt-2 inline-flex items-start gap-2 break-all font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      >
                        <Mail className="mt-0.5 h-4 w-4 shrink-0" />
                        {student.parent_email}
                      </a>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">Not provided</p>
                    )}
                  </div>
                </div>
              </section>

              <footer className="flex flex-col gap-2 border-t border-gray-200/50 pt-6 text-xs text-muted-foreground sm:flex-row sm:justify-between dark:border-gray-700/50">
                <span>Created {formatDateTime(student.created_at)}</span>
                <span>Updated {student.updated_at ? formatDateTime(student.updated_at) : "—"}</span>
              </footer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Sync to Device Dialog */}
      <SyncToDeviceDialog
        open={showSyncDialog}
        onOpenChange={setShowSyncDialog}
        studentId={student.id}
        studentName={`${student.first_name} ${student.last_name}`}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Student</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {student.first_name} {student.last_name}? This
              action will soft-delete the student (data will be preserved but marked as deleted).
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Student"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.main>
  )
}


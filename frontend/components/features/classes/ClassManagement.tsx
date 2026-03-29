"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert"
import {
  Loader2,
  Plus,
  Edit,
  Trash2,
  AlertCircle,
  ChevronRight,
} from "lucide-react"
import { fadeInUp, staggerContainer, staggerItem } from "@/lib/animations/framer-motion"
import { useAuthStore } from "@/lib/store/authStore"
import {
  listClasses,
  createClass,
  updateClass,
  deleteClass,
  type ClassResponse,
  ClassApiError,
} from "@/lib/api/classes"
import {
  listStreams,
  createStream,
  updateStream,
  deleteStream,
  type StreamResponse,
  StreamApiError,
} from "@/lib/api/streams"
import { ClassForm } from "./ClassForm"
import { StreamForm } from "./StreamForm"
import { CohortPromotionPanel } from "./CohortPromotionPanel"

export function ClassManagement() {
  const { token } = useAuthStore()
  const [classes, setClasses] = useState<ClassResponse[]>([])
  const [streams, setStreams] = useState<StreamResponse[]>([])
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Dialog states
  const [showClassForm, setShowClassForm] = useState(false)
  const [showStreamForm, setShowStreamForm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "class" | "stream"
    id: number
    name: string
  } | null>(null)
  const [editingClass, setEditingClass] = useState<ClassResponse | undefined>()
  const [editingStream, setEditingStream] = useState<StreamResponse | undefined>()

  // Load classes
  const loadClasses = async () => {
    if (!token) return

    try {
      setIsLoading(true)
      setError(null)
      const data = await listClasses(token)
      setClasses(data)
      if (data.length > 0 && !selectedClassId) {
        setSelectedClassId(data[0].id)
      }
    } catch (err) {
      if (err instanceof ClassApiError) {
        setError(err.message)
      } else {
        setError("Failed to load classes")
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Load streams for selected class
  const loadStreams = async (classId: number) => {
    if (!token) return

    try {
      const data = await listStreams(token, classId)
      setStreams(data)
    } catch (err) {
      if (err instanceof StreamApiError) {
        setError(err.message)
      } else {
        setError("Failed to load streams")
      }
    }
  }

  useEffect(() => {
    if (token) {
      loadClasses()
    }
  }, [token])

  useEffect(() => {
    if (selectedClassId && token) {
      loadStreams(selectedClassId)
    } else {
      setStreams([])
    }
  }, [selectedClassId, token])

  const handleCreateClass = () => {
    setEditingClass(undefined)
    setShowClassForm(true)
  }

  const handleEditClass = (classData: ClassResponse) => {
    setEditingClass(classData)
    setShowClassForm(true)
  }

  const handleDeleteClass = (classData: ClassResponse) => {
    setDeleteTarget({
      type: "class",
      id: classData.id,
      name: classData.name,
    })
    setShowDeleteConfirm(true)
  }

  const handleCreateStream = () => {
    if (!selectedClassId) return
    setEditingStream(undefined)
    setShowStreamForm(true)
  }

  const handleEditStream = (streamData: StreamResponse) => {
    setEditingStream(streamData)
    setShowStreamForm(true)
  }

  const handleDeleteStream = (streamData: StreamResponse) => {
    setDeleteTarget({
      type: "stream",
      id: streamData.id,
      name: streamData.name,
    })
    setShowDeleteConfirm(true)
  }

  const handleClassFormSuccess = async () => {
    setShowClassForm(false)
    setEditingClass(undefined)
    await loadClasses()
  }

  const handleStreamFormSuccess = async () => {
    setShowStreamForm(false)
    setEditingStream(undefined)
    if (selectedClassId) {
      await loadStreams(selectedClassId)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!token || !deleteTarget) return

    try {
      if (deleteTarget.type === "class") {
        await deleteClass(token, deleteTarget.id)
        await loadClasses()
        if (selectedClassId === deleteTarget.id) {
          setSelectedClassId(null)
        }
      } else {
        await deleteStream(token, deleteTarget.id)
        if (selectedClassId) {
          await loadStreams(selectedClassId)
        }
      }
      setShowDeleteConfirm(false)
      setDeleteTarget(null)
    } catch (err) {
      if (err instanceof ClassApiError || err instanceof StreamApiError) {
        setError(err.message)
      } else {
        setError("Failed to delete")
      }
    }
  }

  const selectedClass = classes.find((c) => c.id === selectedClassId)

  if (isLoading && classes.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <CohortPromotionPanel
        classes={classes}
        selectedClassId={selectedClassId}
        onRefresh={loadClasses}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Classes Section */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
        >
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                Classes
              </CardTitle>
              <Button
                onClick={handleCreateClass}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Class
              </Button>
            </CardHeader>
            <CardContent>
              {classes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No classes yet. Create your first class to get started.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {classes.map((classItem) => (
                    <motion.div
                      key={classItem.id}
                      variants={staggerItem}
                      initial="hidden"
                      animate="visible"
                    >
                      <motion.div
                        variants={cardHover}
                        initial="rest"
                        whileHover="hover"
                        className={`p-4 rounded-lg border cursor-pointer transition-all ${
                          selectedClassId === classItem.id
                            ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700"
                            : "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700"
                        }`}
                        onClick={() => setSelectedClassId(classItem.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold">{classItem.name}</h3>
                            {classItem.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {classItem.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEditClass(classItem)
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteClass(classItem)
                              }}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            {selectedClassId === classItem.id && (
                              <ChevronRight className="h-4 w-4 text-blue-600" />
                            )}
                          </div>
                        </div>
                      </motion.div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Streams Section */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                  Streams
                </CardTitle>
                {selectedClass && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedClass.name}
                  </p>
                )}
              </div>
              <Button
                onClick={handleCreateStream}
                size="sm"
                disabled={!selectedClassId}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Stream
              </Button>
            </CardHeader>
            <CardContent>
              {!selectedClassId ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Select a class to view and manage streams.</p>
                </div>
              ) : streams.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No streams yet. Create your first stream for this class.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {streams.map((stream) => (
                    <motion.div
                      key={stream.id}
                      variants={staggerItem}
                      initial="hidden"
                      animate="visible"
                    >
                      <motion.div
                        variants={cardHover}
                        initial="rest"
                        whileHover="hover"
                        className="p-4 rounded-lg border bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold">{stream.name}</h3>
                            {stream.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {stream.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditStream(stream)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteStream(stream)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Class Form Dialog */}
      <Dialog open={showClassForm} onOpenChange={setShowClassForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingClass ? "Edit Class" : "Create New Class"}
            </DialogTitle>
          </DialogHeader>
          <ClassForm
            classData={editingClass}
            onSuccess={handleClassFormSuccess}
            onCancel={() => {
              setShowClassForm(false)
              setEditingClass(undefined)
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Stream Form Dialog */}
      <Dialog open={showStreamForm} onOpenChange={setShowStreamForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingStream ? "Edit Stream" : "Create New Stream"}
            </DialogTitle>
          </DialogHeader>
          {selectedClassId && (
            <StreamForm
              classId={selectedClassId}
              streamData={editingStream}
              onSuccess={handleStreamFormSuccess}
              onCancel={() => {
                setShowStreamForm(false)
                setEditingStream(undefined)
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete{" "}
              <span className="font-semibold">{deleteTarget?.name}</span>? This
              action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeleteTarget(null)
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteConfirm}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Card hover animation variant
const cardHover = {
  rest: { scale: 1, y: 0 },
  hover: { scale: 1.02, y: -4 },
}


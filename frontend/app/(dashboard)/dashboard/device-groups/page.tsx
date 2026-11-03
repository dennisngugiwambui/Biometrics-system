"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { fadeInUp } from "@/lib/animations/framer-motion"
import { DeviceGroupList } from "@/components/features/devices/DeviceGroupList"
import { useAuthStore } from "@/lib/store/authStore"
import {
  listDeviceGroups,
  deleteDeviceGroup,
  DeviceGroupApiError,
} from "@/lib/api/device_groups"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default function DeviceGroupsPage() {
  const router = useRouter()
  const { token } = useAuthStore()
  const [groups, setGroups] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchGroups = useCallback(async () => {
    if (!token) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const result = await listDeviceGroups(token, {
        page,
        page_size: pageSize,
      })

      setGroups(result.items)
      setTotal(result.total)
      setTotalPages(result.pages)
    } catch (err) {
      if (err instanceof DeviceGroupApiError) {
        setError(err.message)
      } else {
        setError("Failed to load device groups. Please try again.")
      }
    } finally {
      setIsLoading(false)
    }
  }, [token, page, pageSize])

  useEffect(() => {
    fetchGroups()
  }, [fetchGroups])

  const handleDelete = (groupId: number) => {
    const group = groups.find((g) => g.id === groupId)
    if (group) {
      setDeleteTarget({ id: groupId, name: group.name })
      setShowDeleteConfirm(true)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!token || !deleteTarget) return

    try {
      setIsDeleting(true)
      await deleteDeviceGroup(token, deleteTarget.id)
      await fetchGroups()
      setShowDeleteConfirm(false)
      setDeleteTarget(null)
    } catch (err) {
      if (err instanceof DeviceGroupApiError) {
        setError(err.message)
      } else {
        setError("Failed to delete device group. Please try again.")
      }
    } finally {
      setIsDeleting(false)
    }
  }

  if (!token) {
    return (
      <div className="flex-1 ">
        <div className="relative z-10 container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Please log in to continue.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 ">
      {/* Animated background shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header with Back Button */}
        <motion.header
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          className="mb-6"
        >
          <Button
            variant="ghost"
            onClick={() => router.push("/dashboard/devices")}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Devices
          </Button>
        </motion.header>

        <motion.main
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          transition={{ delay: 0.2 }}
        >
          <DeviceGroupList
            groups={groups}
            isLoading={isLoading}
            error={error}
            page={page}
            totalPages={totalPages}
            total={total}
            onPageChange={setPage}
            onAddGroup={() => router.push("/dashboard/device-groups/new")}
            onGroupClick={(id) => router.push(`/dashboard/device-groups/${id}/edit`)}
            onEdit={(id) => router.push(`/dashboard/device-groups/${id}/edit`)}
            onDelete={handleDelete}
          />
        </motion.main>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the device group{" "}
              <span className="font-semibold">{deleteTarget?.name}</span>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteConfirm(false)
                setDeleteTarget(null)
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}


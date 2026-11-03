"use client"

import { motion } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Plus, AlertCircle, Inbox, Loader2 } from "lucide-react"
import { fadeInUp, staggerContainer } from "@/lib/animations/framer-motion"
import { DeviceGroupTableRow } from "./DeviceGroupTableRow"
import { DeviceListPagination } from "./DeviceListPagination"
import { type DeviceGroupResponse } from "@/lib/api/device_groups"

export interface DeviceGroupListProps {
  groups: DeviceGroupResponse[]
  isLoading: boolean
  error: string | null
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
  onAddGroup: () => void
  onGroupClick: (id: number) => void
  onEdit: (id: number) => void
  onDelete: (id: number) => void
}

export function DeviceGroupList({
  groups,
  isLoading,
  error,
  page,
  totalPages,
  total,
  onPageChange,
  onAddGroup,
  onGroupClick,
  onEdit,
  onDelete,
}: DeviceGroupListProps) {
  const showEmptyState = !isLoading && groups.length === 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-primary">
            Device Groups
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Organize your devices into logical groups
          </p>
        </div>
        <Button
          onClick={onAddGroup}
          className="bg-blue-600 hover:bg-blue-700 text-white"
          size="lg"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Group
        </Button>
      </motion.div>

      {/* Error State */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Alert variant="destructive" className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* Loading State */}
      {isLoading && (
        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50">
          <div className="p-6">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Empty State */}
      {showEmptyState && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50">
            <div className="p-12 text-center">
              <Inbox className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No device groups yet</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Create your first device group to organize your biometric devices.
              </p>
              <Button
                onClick={onAddGroup}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Group
              </Button>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Groups Table */}
      {!isLoading && groups.length > 0 && (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-200/50 dark:border-gray-700/50">
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Devices</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((group) => (
                    <DeviceGroupTableRow
                      key={group.id}
                      group={group}
                      onGroupClick={onGroupClick}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Pagination */}
      {!isLoading && groups.length > 0 && totalPages > 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50">
            <div className="p-4">
              <DeviceListPagination
                page={page}
                totalPages={totalPages}
                total={total}
                onPageChange={onPageChange}
              />
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  )
}


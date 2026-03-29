"use client"

import { motion } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Users, UserPlus, Search, X, AlertCircle, Inbox } from "lucide-react"
import { fadeInUp, staggerContainer, staggerItem } from "@/lib/animations/framer-motion"
import { StudentTable } from "./StudentTable"
import { StudentCardGrid } from "./StudentCardGrid"
import { StudentListFilters } from "./StudentListFilters"
import { PremiumPagination } from "@/components/shared/PremiumPagination"
import type { StudentResponse } from "@/lib/api/students"

export interface StudentListProps {
  students: StudentResponse[]
  isLoading: boolean
  error: string | null
  search: string
  onSearchChange: (value: string) => void
  classFilter: number | null
  onClassFilterChange: (value: number | null) => void
  streamFilter: number | null
  onStreamFilterChange: (value: number | null) => void
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
  onAddStudent: () => void
  onStudentClick: (id: number) => void
  classes?: Array<{ id: number; name: string }>
  streams?: Array<{ id: number; name: string; class_id: number }>
}

export function StudentList({
  students,
  isLoading,
  error,
  search,
  onSearchChange,
  classFilter,
  onClassFilterChange,
  streamFilter,
  onStreamFilterChange,
  page,
  totalPages,
  total,
  onPageChange,
  onAddStudent,
  onStudentClick,
  classes = [],
  streams = [],
}: StudentListProps) {
  const hasFilters = search || classFilter || streamFilter
  const showEmptyState = !isLoading && students.length === 0 && !hasFilters
  const showNoResults = !isLoading && students.length === 0 && hasFilters

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
          <h1 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 sm:text-4xl">
            Students
          </h1>
          <p className="mt-2 text-sm text-muted-foreground font-medium">
            Central repository for student enrollment and biometric status.
          </p>
        </div>
        <Button
          onClick={onAddStudent}
          className="bg-blue-600 hover:bg-blue-700 text-white"
          size="lg"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Add Student
        </Button>
      </motion.div>

      {/* Filters and Search */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.1 }}
      >
        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50">
          <div className="p-4 space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by name or admission number..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 pr-10 border-blue-300 focus:border-blue-500 focus:ring-blue-500"
              />
              {search && (
                <button
                  onClick={() => onSearchChange("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filters */}
            <StudentListFilters
              classFilter={classFilter}
              onClassFilterChange={onClassFilterChange}
              streamFilter={streamFilter}
              onStreamFilterChange={onStreamFilterChange}
              classes={classes}
              streams={streams}
            />
          </div>
        </Card>
      </motion.div>

      {/* Error State */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4">
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50">
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-[250px]" />
                    <Skeleton className="h-4 w-[200px]" />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {showEmptyState && (
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center justify-center py-16"
        >
          <div className="rounded-full bg-blue-100 dark:bg-blue-900/30 p-6 mb-4">
            <Inbox className="h-12 w-12 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No students yet</h3>
          <p className="text-muted-foreground text-center mb-6 max-w-md">
            Get started by adding your first student to the system.
          </p>
          <Button
            onClick={onAddStudent}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Add Your First Student
          </Button>
        </motion.div>
      )}

      {/* No Results State */}
      {showNoResults && (
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center justify-center py-16"
        >
          <div className="rounded-full bg-yellow-100 dark:bg-yellow-900/30 p-6 mb-4">
            <Search className="h-12 w-12 text-yellow-600 dark:text-yellow-400" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No students found</h3>
          <p className="text-muted-foreground text-center mb-6 max-w-md">
            Try adjusting your search or filters to find what you're looking for.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              onSearchChange("")
              onClassFilterChange(null)
              onStreamFilterChange(null)
            }}
          >
            <X className="mr-2 h-4 w-4" />
            Clear Filters
          </Button>
        </motion.div>
      )}

      {/* Student List */}
      {!isLoading && !error && students.length > 0 && (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="space-y-4"
        >
          {/* Desktop Table View */}
          <div className="hidden lg:block">
            <StudentTable
              students={students}
              onStudentClick={onStudentClick}
            />
          </div>

          {/* Mobile/Tablet Card View */}
          <div className="lg:hidden">
            <StudentCardGrid
              students={students}
              onStudentClick={onStudentClick}
            />
          </div>

          {/* Pagination — show whenever there are records (including single-page) */}
          {total > 0 && totalPages >= 1 && (
            <PremiumPagination
              page={page}
              totalPages={Math.max(1, totalPages)}
              total={total}
              onPageChange={onPageChange}
              label="Students"
            />
          )}
        </motion.div>
      )}
    </div>
  )
}


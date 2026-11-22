"use client"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Users, UserPlus, Search, X, AlertCircle, Inbox } from "lucide-react"
import { DataCard, DataToolbar } from "@/components/shared/DataCard"
import { PanelEmpty } from "@/components/shared/KpiCard"
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
    <DataCard>
      <DataToolbar
        search={search}
        onSearch={onSearchChange}
        placeholder="Search by name or admission number…"
        filters={
          <StudentListFilters
            classFilter={classFilter}
            onClassFilterChange={onClassFilterChange}
            streamFilter={streamFilter}
            onStreamFilterChange={onStreamFilterChange}
            classes={classes}
            streams={streams}
          />
        }
        right={<span className="tabular-nums">{total.toLocaleString()} records</span>}
      />

      {error && (
        <div className="p-4">
          <Alert variant="destructive" className="rounded-xl border-rose-200 bg-rose-50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {isLoading && (
        <div className="space-y-3 p-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 flex-1 rounded" />
              <Skeleton className="hidden h-4 w-40 rounded sm:block" />
            </div>
          ))}
        </div>
      )}

      {showEmptyState && (
        <PanelEmpty
          icon={Inbox}
          title="No students yet"
          hint="Add your first student to start capturing attendance."
          action={
            <Button onClick={onAddStudent}>
              <UserPlus className="h-4 w-4" />
              Add your first student
            </Button>
          }
        />
      )}

      {showNoResults && (
        <PanelEmpty
          icon={Search}
          title="No students found"
          hint="Try adjusting your search or filters."
          action={
            <Button
              variant="outline"
              onClick={() => {
                onSearchChange("")
                onClassFilterChange(null)
                onStreamFilterChange(null)
              }}
            >
              <X className="h-4 w-4" />
              Clear filters
            </Button>
          }
        />
      )}

      {!isLoading && !error && students.length > 0 && (
        <>
          <div className="hidden lg:block">
            <StudentTable students={students} onStudentClick={onStudentClick} />
          </div>
          <div className="lg:hidden">
            <StudentCardGrid students={students} onStudentClick={onStudentClick} />
          </div>
          {total > 0 && (
            <PremiumPagination
              page={page}
              totalPages={Math.max(1, totalPages)}
              total={total}
              onPageChange={onPageChange}
              label="students"
            />
          )}
        </>
      )}
    </DataCard>
  )
}

"use client"

import { useState, useMemo, useEffect } from "react"
import { Search, User, CheckCircle2, Briefcase } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { listTeachers, type TeacherResponse } from "@/lib/api/teachers"
import { useAuthStore } from "@/lib/store/authStore"

interface TeacherSelectorProps {
  selectedTeacher: TeacherResponse | null
  onSelect: (teacher: TeacherResponse) => void
}

export function TeacherSelector({ selectedTeacher, onSelect }: TeacherSelectorProps) {
  const { token } = useAuthStore()
  const [searchQuery, setSearchQuery] = useState("")
  const [teachers, setTeachers] = useState<TeacherResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setTeachers([])
      return
    }
    setIsLoading(true)
    setError(null)
    listTeachers(token, { page: 1, page_size: 200, is_active: true })
      .then((result) => setTeachers(result.items))
      .catch(() => {
        setError("Failed to load teachers")
        setTeachers([])
      })
      .finally(() => setIsLoading(false))
  }, [token])

  const filteredTeachers = useMemo(() => {
    if (!searchQuery.trim()) return teachers
    const q = searchQuery.toLowerCase()
    return teachers.filter(
      (t) =>
        t.first_name.toLowerCase().includes(q) ||
        t.last_name.toLowerCase().includes(q) ||
        (t.employee_id?.toLowerCase().includes(q) ?? false)
    )
  }, [teachers, searchQuery])

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-500 dark:text-gray-400" />
        <Input
          placeholder="Search by name or employee ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-white dark:bg-gray-800 border-blue-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800">
        <div className="max-h-[400px] overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-600 dark:text-gray-400">
              <User className="size-10 mb-3 opacity-40 animate-pulse" />
              <p className="text-sm">Loading teachers...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-red-600 dark:text-red-400">
              <User className="size-10 mb-3 opacity-40" />
              <p className="text-sm">{error}</p>
            </div>
          ) : filteredTeachers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-600 dark:text-gray-400">
              <Briefcase className="size-10 mb-3 opacity-40" />
              <p className="text-sm">No teachers found</p>
            </div>
          ) : (
            filteredTeachers.map((teacher) => {
              const isSelected = selectedTeacher?.id === teacher.id
              return (
                <button
                  key={teacher.id}
                  onClick={() => onSelect(teacher)}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 text-left transition-all",
                    isSelected
                      ? "bg-indigo-50 ring-2 ring-inset ring-indigo-600 dark:bg-indigo-900/30 dark:ring-indigo-500"
                      : "hover:bg-indigo-50/50 dark:hover:bg-gray-700/50"
                  )}
                >
                  <div
                    className={cn(
                      "relative flex items-center justify-center size-12 rounded-full font-semibold text-sm shrink-0 transition-all",
                      isSelected
                        ? "bg-indigo-600 text-white scale-105"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                    )}
                  >
                    {teacher.first_name[0]}
                    {teacher.last_name[0]}
                    {isSelected && (
                      <div className="absolute -bottom-0.5 -right-0.5 size-5 rounded-full bg-background flex items-center justify-center">
                        <CheckCircle2 className="size-4 text-indigo-600" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={cn(
                          "font-medium truncate transition-colors",
                          isSelected
                            ? "text-indigo-600 dark:text-indigo-400"
                            : "text-gray-900 dark:text-gray-100"
                        )}
                      >
                        {teacher.first_name} {teacher.last_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                      {teacher.employee_id && <span>{teacher.employee_id}</span>}
                      {teacher.department && (
                        <>
                          {teacher.employee_id && <span className="text-border">•</span>}
                          <span>{teacher.department}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div
                    className={cn(
                      "flex items-center justify-center size-6 rounded-full border-2 transition-all shrink-0",
                      isSelected
                        ? "border-indigo-600 bg-indigo-600"
                        : "border-gray-300 dark:border-gray-600"
                    )}
                  >
                    {isSelected && <CheckCircle2 className="size-4 text-white" />}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

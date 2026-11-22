"use client"

import { ChevronRight } from "lucide-react"

import { InitialsAvatar } from "@/components/shared/DataCard"
import type { StudentResponse } from "@/lib/api/students"

export interface StudentCardGridProps {
  students: StudentResponse[]
  onStudentClick: (id: number) => void
}

function classLabel(s: StudentResponse) {
  if (s.class_name != null || s.stream_name != null) return [s.class_name, s.stream_name].filter(Boolean).join(" · ")
  if (s.class_id && s.stream_id) return `Form ${s.class_id}-${s.stream_id}`
  if (s.class_id) return `Form ${s.class_id}`
  return "Unassigned"
}

/** Phones and tablets: one tappable row per learner, divided by hairlines. */
export function StudentCardGrid({ students, onStudentClick }: StudentCardGridProps) {
  return (
    <ul className="divide-y divide-slate-100">
      {students.map((student) => {
        const name = `${student.first_name} ${student.last_name}`
        return (
          <li key={student.id}>
            <button
              type="button"
              onClick={() => onStudentClick(student.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-primary/5 active:bg-primary/10"
            >
              <InitialsAvatar name={name} className="h-9 w-9" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-900">{name}</span>
                <span className="block truncate text-xs text-slate-500">
                  <span className="font-mono">{student.admission_number}</span> · {classLabel(student)}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

"use client"

import { Eye } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DataScroll, InitialsAvatar, StatusPill } from "@/components/shared/DataCard"
import type { StudentResponse } from "@/lib/api/students"
import { formatDate } from "@/lib/utils"

export interface StudentTableProps {
  students: StudentResponse[]
  onStudentClick: (id: number) => void
}

function classLabel(s: StudentResponse) {
  if (s.class_name != null || s.stream_name != null) return [s.class_name, s.stream_name].filter(Boolean).join(" · ")
  if (s.class_id && s.stream_id) return `Form ${s.class_id}-${s.stream_id}`
  if (s.class_id) return `Form ${s.class_id}`
  return "Unassigned"
}

export function StudentTable({ students, onStudentClick }: StudentTableProps) {
  return (
    <DataScroll>
      <Table className="min-w-[860px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-14 text-center">#</TableHead>
            <TableHead>Student</TableHead>
            <TableHead>Adm no</TableHead>
            <TableHead>Class</TableHead>
            <TableHead>Gender</TableHead>
            <TableHead>Birth date</TableHead>
            <TableHead>Parent contact</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.map((student, index) => {
            const name = `${student.first_name} ${student.last_name}`
            return (
              <TableRow key={student.id} className="cursor-pointer" onClick={() => onStudentClick(student.id)}>
                <TableCell className="text-center text-xs text-slate-400 tabular-nums">{index + 1}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <InitialsAvatar name={name} />
                    <span className="cell-strong">{name}</span>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-[13px] text-slate-700">{student.admission_number}</TableCell>
                <TableCell>{classLabel(student)}</TableCell>
                <TableCell>
                  {student.gender ? (
                    <span className="capitalize">{student.gender}</span>
                  ) : (
                    <span className="cell-muted">—</span>
                  )}
                </TableCell>
                <TableCell className="text-slate-500">{student.date_of_birth ? formatDate(student.date_of_birth) : "—"}</TableCell>
                <TableCell>
                  {student.parent_phone || student.parent_email ? (
                    <>
                      {student.parent_phone && <span>{student.parent_phone}</span>}
                      {student.parent_email && <span className="cell-sub max-w-[180px] truncate">{student.parent_email}</span>}
                    </>
                  ) : (
                    <span className="cell-muted">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label={`View ${name}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onStudentClick(student.id)
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </DataScroll>
  )
}

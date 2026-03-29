"use client"

import { motion } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Eye } from "lucide-react"
import { staggerItem } from "@/lib/animations/framer-motion"
import type { StudentResponse } from "@/lib/api/students"
import { formatDate } from "@/lib/utils"

export interface StudentTableProps {
  students: StudentResponse[]
  onStudentClick: (id: number) => void
}

export function StudentTable({ students, onStudentClick }: StudentTableProps) {
  return (
    <Card className="bg-white/40 dark:bg-gray-800/40 backdrop-blur-xl border-white/50 dark:border-gray-700/50 overflow-hidden shadow-2xl rounded-3xl">
      <div className="w-full overflow-x-auto">
        <Table className="min-w-[860px]">
          <TableHeader>
            <TableRow className="border-0 hover:bg-transparent bg-blue-50/80 dark:bg-blue-900/30">
              <TableHead className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300 h-14 px-6">Admission</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300 h-14">Full Name</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300 h-14 hidden lg:table-cell">Birth Date</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300 h-14">Gender</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300 h-14">Academic Class</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300 h-14 hidden md:table-cell">Contact Info</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300 h-14 text-right px-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((student, index) => (
              <motion.tr
                key={student.id}
                variants={staggerItem}
                initial="hidden"
                animate="visible"
                transition={{ delay: index * 0.05 }}
                className="group border-gray-100 dark:border-gray-800 hover:bg-blue-50/40 dark:hover:bg-blue-900/10 transition-all cursor-pointer relative"
                onClick={() => onStudentClick(student.id)}
              >
                <TableCell className="px-6 py-5">
                  <Badge variant="outline" className="font-mono text-[11px] bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 font-bold px-3 py-1 rounded-lg">
                    {student.admission_number}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-extrabold shadow-lg shadow-blue-500/20 transform group-hover:scale-110 group-hover:rotate-3 transition-transform">
                      {student.first_name[0]}{student.last_name[0]}
                    </div>
                    <div>
                      <p className="font-extrabold text-gray-900 dark:text-gray-100 tracking-tight leading-none mb-1">
                        {student.first_name} {student.last_name}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                        Student ID: #{student.id}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground font-medium text-sm hidden lg:table-cell">
                  {student.date_of_birth ? formatDate(student.date_of_birth) : "—"}
                </TableCell>
                <TableCell>
                  {student.gender ? (
                    <Badge className={`capitalize text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                      student.gender === 'male' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/30' : 'bg-pink-50 text-pink-600 dark:bg-pink-950/30'
                    }`}>
                      {student.gender}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                      {student.class_name != null || student.stream_name != null
                        ? [student.class_name, student.stream_name].filter(Boolean).join(" · ")
                        : student.class_id && student.stream_id
                        ? `Form ${student.class_id}-${student.stream_id}`
                        : student.class_id
                        ? `Form ${student.class_id}`
                        : "Unassigned"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="space-y-1">
                    {student.parent_phone && (
                      <div className="text-xs font-bold text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                        <div className="h-1 w-1 rounded-full bg-gray-300" />
                        {student.parent_phone}
                      </div>
                    )}
                    {student.parent_email && (
                      <div className="text-[10px] font-medium text-muted-foreground truncate max-w-[150px]">
                        {student.parent_email}
                      </div>
                    )}
                    {!student.parent_phone && !student.parent_email && <span className="text-muted-foreground text-xs">—</span>}
                  </div>
                </TableCell>
                <TableCell className="text-right px-6">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      onStudentClick(student.id)
                    }}
                    className="h-10 w-10 p-0 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white transition-all group/btn shadow-sm border border-blue-100/50 dark:border-blue-800/50"
                  >
                    <Eye className="h-5 w-5 group-hover/btn:scale-110 transition-transform" />
                  </Button>
                </TableCell>
              </motion.tr>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  )
}


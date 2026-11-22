"use client"

import { GraduationCap } from "lucide-react"

import { ClassManagement } from "@/components/features/classes/ClassManagement"
import { PageHeader } from "@/components/shared/PageHeader"

export default function ClassesPage() {
  return (
    <div className="page-shell space-y-5">
      <PageHeader
        icon={GraduationCap}
        title="Classes"
        subtitle="Create and manage the classes and streams your learners belong to"
      />
      <ClassManagement />
    </div>
  )
}

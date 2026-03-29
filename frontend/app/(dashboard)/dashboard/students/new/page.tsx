"use client"

import { motion } from "framer-motion"
import { StudentWizard } from "@/components/features/students/StudentWizard"
import { pageTransition } from "@/lib/animations/framer-motion"

export default function NewStudentPage() {
  return (
    <motion.main
      variants={pageTransition}
      initial="initial"
      animate="animate"
      className="flex-1 page-shell space-y-6"
    >
      <StudentWizard mode="add" />
    </motion.main>
  )
}


"use client"

import { motion } from "framer-motion"
import { fadeInUp } from "@/lib/animations/framer-motion"
import { ClassManagement } from "@/components/features/classes/ClassManagement"

export default function ClassesPage() {
  return (
    <div className="min-h-screen ">
      {/* Animated background shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-8">
        <motion.header
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          className="mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-bold mb-2 text-primary">
            Class Management
          </h1>
          <p className="text-muted-foreground">
            Create and manage classes and streams for organizing students.
          </p>
        </motion.header>

        <motion.main
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          transition={{ delay: 0.2 }}
        >
          <ClassManagement />
        </motion.main>
      </div>
    </div>
  )
}


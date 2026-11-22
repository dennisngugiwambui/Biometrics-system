"use client"

import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { LucideIcon, TrendingUp } from "lucide-react"
import { fadeInUp, cardHover } from "@/lib/animations/framer-motion"

export interface StatCardProps {
  label: string
  value: number | string
  icon: LucideIcon
  colorClass: string
  index?: number
}

export function StatCard({ label, value, icon: Icon, colorClass, index = 0 }: StatCardProps) {
  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      transition={{ delay: index * 0.1 }}
    >
      <motion.div variants={cardHover} initial="rest" whileHover="hover" animate="rest">
        <Card className="border-none bg-card shadow-sm transition-shadow hover:shadow-[var(--shadow-card)]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${colorClass}`}>
                <Icon className="h-6 w-6" />
              </div>
              <TrendingUp className="h-4 w-4 text-muted-foreground/50" />
            </div>
            <div className="mt-4 space-y-1">
              <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
              <p className="text-sm font-medium text-muted-foreground">{label}</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}


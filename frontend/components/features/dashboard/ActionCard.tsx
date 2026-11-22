"use client"

import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, LucideIcon } from "lucide-react"
import { fadeInUp, cardHover } from "@/lib/animations/framer-motion"

export interface ActionCardProps {
  icon: LucideIcon
  title: string
  description: string
  buttonText: string
  colorClass: string
  onAction?: () => void
  index?: number
}

export function ActionCard({
  icon: Icon,
  title,
  description,
  buttonText,
  colorClass,
  onAction,
  index = 0,
}: ActionCardProps) {
  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      transition={{ delay: index * 0.1 }}
    >
      <motion.div variants={cardHover} initial="rest" whileHover="hover" animate="rest">
        <Card className="h-full border-none bg-card shadow-sm transition-shadow hover:shadow-[var(--shadow-card)]">
          <CardContent className="flex h-full flex-col p-6">
            <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${colorClass}`}>
              <Icon className="h-6 w-6" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-foreground">{title}</h3>
            <p className="mb-4 flex-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
            <Button className="w-full" size="sm" onClick={onAction}>
              <Plus className="mr-2 h-4 w-4" />
              {buttonText}
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}


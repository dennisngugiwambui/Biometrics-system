"use client"

import { motion } from "framer-motion"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

export interface StepDef {
  id: number
  name: string
  icon: LucideIcon
  description: string
  optional?: boolean
}

interface StepIndicatorProps {
  steps: StepDef[]
  currentStep: number
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <nav aria-label="Progress" className="w-full">
      <ol className="flex flex-col gap-8">
        {steps.map((step, idx) => {
          const status =
            step.id < currentStep
              ? "completed"
              : step.id === currentStep
                ? "active"
                : "pending"
          const isLast = idx === steps.length - 1

          return (
            <li key={step.id} className="relative flex items-start group">
              {!isLast && (
                <div
                  className={cn(
                    "absolute left-5 top-10 w-0.5 -bottom-8 rounded-full transition-all duration-700",
                    status === "completed" ? "bg-blue-600" : "bg-muted/20"
                  )}
                />
              )}

              <div className="flex items-center gap-5 relative z-10">
                <motion.div
                  initial={false}
                  animate={{
                    scale: status === "active" ? 1.05 : 1,
                  }}
                  className={cn(
                    "flex items-center justify-center size-10 rounded-2xl border-2 transition-all duration-500 shadow-sm",
                    status === "completed" && "bg-blue-600 border-blue-600 text-white shadow-blue-500/20",
                    status === "active" && "border-blue-600 bg-white dark:bg-gray-900 text-blue-600 shadow-premium-sm",
                    status === "pending" && "border-muted/30 bg-muted/5 text-muted-foreground/40"
                  )}
                >
                  {status === "completed" ? (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                      <Check className="size-4 stroke-[3]" />
                    </motion.div>
                  ) : (
                    <step.icon className={cn("size-4 transition-colors", status === "active" ? "text-blue-600" : "")} />
                  )}
                </motion.div>

                <div className="flex flex-col">
                  <span
                    className={cn(
                      "text-[10px] font-black uppercase tracking-[0.2em] transition-colors",
                      status === "active" && "text-blue-600",
                      status === "completed" && "text-foreground",
                      status === "pending" && "text-muted-foreground/60"
                    )}
                  >
                    Phase {step.id}
                  </span>
                  <span
                    className={cn(
                      "text-sm font-bold tracking-tight transition-colors",
                      status === "active" && "text-foreground dark:text-white",
                      status === "completed" && "text-muted-foreground",
                      status === "pending" && "text-muted-foreground/40"
                    )}
                  >
                    {step.name}
                  </span>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

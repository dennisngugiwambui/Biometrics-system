"use client"

import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { School, CheckCircle2 } from "lucide-react"
import { fadeInUp } from "@/lib/animations/framer-motion"

export interface WelcomeBannerProps {
  schoolCode: string
  adminFirstName: string
  isSetupComplete?: boolean
}

export function WelcomeBanner({ schoolCode, adminFirstName, isSetupComplete = true }: WelcomeBannerProps) {
  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible">
      <Card className="overflow-hidden border-none bg-primary text-primary-foreground shadow-lg">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30">
                  {schoolCode}
                </Badge>
              </div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Welcome back, {adminFirstName}!
              </h2>
              {isSetupComplete && (
                <p className="flex items-center gap-2 text-primary-foreground/80">
                  <CheckCircle2 className="h-4 w-4" />
                  Your school is set up and ready to go
                </p>
              )}
            </div>
            <div className="hidden sm:block">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
                <School className="h-10 w-10 text-white/80" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}


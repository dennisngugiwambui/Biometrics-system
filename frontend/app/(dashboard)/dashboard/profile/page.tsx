"use client"

import { motion } from "framer-motion"
import { useAuthStore } from "@/lib/store/authStore"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { fadeInUp } from "@/lib/animations/framer-motion"
import { User, Mail, Phone, Building2, AtSign, LogOut } from "lucide-react"

export default function ProfilePage() {
  const { user, logout } = useAuthStore()

  const name = user
    ? [user.first_name, user.last_name].filter(Boolean).join(" ")
    : "Administrator"

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  const u = user as
    | {
        username?: string
        email?: string
        phone?: string
        school_name?: string
        avatar_url?: string
      }
    | null
    | undefined

  const fields = [
    {
      key: "username",
      label: "Username",
      value: u?.username,
      icon: AtSign,
      optional: true,
    },
    {
      key: "email",
      label: "Email",
      value: u?.email,
      icon: Mail,
      optional: false,
    },
    {
      key: "phone",
      label: "Phone",
      value: u?.phone,
      icon: Phone,
      optional: true,
    },
    {
      key: "school",
      label: "School",
      value: u?.school_name,
      icon: Building2,
      optional: true,
    },
  ] as const

  return (
    <div className="min-h-full w-full bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <motion.main
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="mx-auto w-full max-w-3xl space-y-6 px-3 py-4 sm:px-4 sm:py-6 md:px-6 md:py-8 lg:max-w-4xl"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 sm:text-3xl">
              Full profile
            </h1>
            <p className="text-sm text-muted-foreground">Your account information</p>
          </div>
          <Button
            variant="destructive"
            onClick={logout}
            className="h-11 w-full shrink-0 rounded-xl sm:h-10 sm:w-auto sm:self-start"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>

        <Card className="overflow-hidden rounded-2xl border border-gray-200/50 bg-white/80 shadow-lg backdrop-blur-sm dark:border-gray-700/50 dark:bg-gray-800/80 sm:rounded-3xl">
          <CardHeader className="space-y-1 px-4 pt-5 sm:px-6 sm:pt-6">
            <CardTitle className="text-lg text-blue-700 dark:text-blue-400">Account</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Details from your signed-in session</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 px-4 pb-6 sm:px-6 sm:pb-8">
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-gray-200/50 bg-white/60 p-4 dark:border-gray-700/50 dark:bg-gray-900/30 sm:flex-row sm:items-center sm:p-5">
              <Avatar className="h-20 w-20 border-2 border-blue-200 dark:border-blue-800 sm:h-24 sm:w-24">
                <AvatarImage src={u?.avatar_url || undefined} />
                <AvatarFallback className="text-lg font-bold bg-gradient-to-br from-blue-600 to-indigo-600 text-white sm:text-xl">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <p className="truncate text-lg font-bold text-gray-900 dark:text-gray-100 sm:text-xl">{name}</p>
                <p className="mt-1 inline-flex items-center justify-center gap-2 rounded-full bg-indigo-100/80 px-3 py-1 text-xs font-semibold text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200 sm:justify-start">
                  <User className="h-3.5 w-3.5" />
                  Administrator
                </p>
              </div>
            </div>

            <Separator className="bg-gray-200/60 dark:bg-gray-700/60" />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              {fields.map(({ key, label, value, icon: Icon }) => (
                <div
                  key={key}
                  className="flex flex-col gap-1.5 rounded-xl border border-gray-200/50 bg-white/70 p-4 dark:border-gray-700/50 dark:bg-gray-900/40"
                >
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {label}
                  </div>
                  <p className="break-words text-sm font-medium leading-snug text-gray-900 dark:text-gray-100 sm:text-base">
                    {value && String(value).trim() ? value : "—"}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.main>
    </div>
  )
}

"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Users, Smartphone, UserPlus, TrendingUp, TrendingDown,
  BarChart2, LineChartIcon, PieChartIcon, Activity,
  ChevronRight, RefreshCw, GraduationCap,
} from "lucide-react"
import { MobileConnectionCard } from "@/components/features/dashboard"
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts"
import { useAuthStore } from "@/lib/store/authStore"
import { getMySchool, type SchoolResponse } from "@/lib/api/schools"
import { listStudents } from "@/lib/api/students"
import { listDevices } from "@/lib/api/devices"
import { getAttendanceStats, listAttendance } from "@/lib/api/attendance"
import { getSuccessfulEnrollmentCount } from "@/lib/api/enrollment"
import { listTeachers } from "@/lib/api/teachers"
import type { UserResponse } from "@/lib/api/auth"

// ─────────────────────────────────────────── types
type ChartType = "bar" | "line" | "area" | "pie"

interface WeekDay {
  day: string
  present: number
  absent: number
  date: string
}

// ─────────────────────────────────────────── helpers

function getLast7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().split("T")[0]
  })
}

function dayLabel(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { weekday: "short" })
}

// ─────────────────────────────────────────── sub-components

function StatCard({
  label,
  value,
  icon: Icon,
  accentColor,
  sub,
  trend,
}: {
  label: string
  value: number | string
  icon: typeof Users
  accentColor: string
  sub?: string
  trend?: "up" | "down" | null
}) {
  return (
    <div className="relative bg-card border border-border rounded-md p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between mb-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded ${accentColor}`}>
          <Icon className="h-4 w-4" />
        </div>
        {trend && (
          <span className={`flex items-center gap-0.5 text-xs font-medium rounded px-1.5 py-0.5 ${
            trend === "up" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                           : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
          }`}>
            {trend === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-foreground tabular-nums">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      <p className="mt-0.5 text-sm text-muted-foreground">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground/70">{sub}</p>}
    </div>
  )
}

type TooltipProps = {
  active?: boolean
  payload?: { value: number; name: string; color: string }[]
  label?: string
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-lg text-sm dark:bg-gray-800 dark:border-gray-700">
      <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="flex gap-2">
          <span>{p.name}:</span>
          <span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

const CHART_COLORS = {
  present: "#3b82f6",
  absent: "#e5e7eb",
  blue: "#3b82f6",
  indigo: "#6366f1",
  purple: "#8b5cf6",
  emerald: "#10b981",
}

const PIE_COLORS = ["#3b82f6", "#f3f4f6", "#8b5cf6", "#10b981"]

function ChartTypeButton({ type, current, icon: Icon, label, onClick }: {
  type: ChartType; current: ChartType; icon: typeof BarChart2; label: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-[11px] font-medium transition-colors ${
        current === type
          ? "bg-card text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  )
}

// ─────────────────────────────────────────── main page

export default function DashboardPage() {
  const router = useRouter()
  const { token, user, setUser } = useAuthStore()

  const [school, setSchool] = useState<SchoolResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [chartType, setChartType] = useState<ChartType>("bar")

  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    registeredDevices: 0,
    enrollments: 0,
    presentToday: 0,
    presentRate: 0,
    totalToday: 0,
  })

  const [viewMode, setViewMode] = useState<"student" | "teacher">("student")
  const [weeklyData, setWeeklyData] = useState<WeekDay[]>([])
  const [pieData, setPieData] = useState<{ name: string; value: number }[]>([])

  const adminFirstName = user?.first_name || user?.email?.split("@")[0] || "Admin"

  const fetchData = useCallback(async (quiet = false) => {
    if (!token) return
    if (!quiet) setIsLoading(true)
    else setIsRefreshing(true)

    try {
      const dates = getLast7Days()

      const [schoolRes, studentsRes, devicesRes, attendanceRes, enrollments, teachersRes] = await Promise.allSettled([
        getMySchool(token),
        listStudents(token, { page: 1, page_size: 1 }),
        listDevices(token, { page: 1, page_size: 1 }),
        getAttendanceStats(token, undefined, viewMode),
        getSuccessfulEnrollmentCount(token),
        listTeachers(token, { page: 1, page_size: 1 }),
      ])

      if (schoolRes.status === "fulfilled") {
        setSchool(schoolRes.value)
        if (schoolRes.value.user) setUser(schoolRes.value.user as UserResponse)
      }

      const totalStudents = studentsRes.status === "fulfilled" ? studentsRes.value.total : 0
      const totalDevices = devicesRes.status === "fulfilled" ? devicesRes.value.total : 0
      const totalEnrollments = enrollments.status === "fulfilled" ? enrollments.value : 0
      const totalTeachers = teachersRes.status === "fulfilled" ? teachersRes.value.total : 0
      const atStats = attendanceRes.status === "fulfilled" ? attendanceRes.value : null

      setStats({
        totalStudents,
        totalTeachers,
        registeredDevices: totalDevices,
        enrollments: totalEnrollments,
        presentToday: atStats?.checked_in ?? 0,
        presentRate: atStats?.present_rate ?? 0,
        totalToday: atStats?.total_events ?? 0,
      })

      setPieData([
        { name: "Present", value: atStats?.checked_in ?? 0 },
        { name: "Absent", value: Math.max(0, (viewMode === "student" ? totalStudents : totalTeachers) - (atStats?.checked_in ?? 0)) },
      ])

      // Build weekly chart data — fetch per day in parallel
      const weekResults = await Promise.allSettled(
        dates.map((d) => getAttendanceStats(token, d, viewMode))
      )
      const week: WeekDay[] = dates.map((d, i) => {
        const r = weekResults[i]
        const s = r.status === "fulfilled" ? r.value : null
        const total = viewMode === "student" ? totalStudents : totalTeachers
        return {
          date: d,
          day: dayLabel(d),
          present: s?.checked_in ?? 0,
          absent: Math.max(0, total - (s?.checked_in ?? 0)),
        }
      })
      setWeeklyData(week)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [token, setUser])

  useEffect(() => { fetchData() }, [fetchData, viewMode])

  // ── chart rendering
  const renderChart = () => {
    if (weeklyData.length === 0) return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">No data yet</div>
    )

    const commonProps = {
      data: weeklyData,
      margin: { top: 5, right: 10, left: -20, bottom: 0 },
    }

    if (chartType === "pie") {
      const total = pieData.reduce((s, d) => s + d.value, 0)
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius="45%" outerRadius="70%" paddingAngle={3}
              dataKey="value" nameKey="name" stroke="none">
              {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
            </Pie>
            <Tooltip formatter={(v: number | undefined) => [v?.toLocaleString() || "0", viewMode === "student" ? "Students" : "Teachers"]} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )
    }

    const bars = (
      <>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </>
    )

    if (chartType === "bar") return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart {...commonProps}>
          {bars}
          <Bar dataKey="present" name="Present" fill={CHART_COLORS.present} radius={[4, 4, 0, 0]} />
          <Bar dataKey="absent" name="Absent" fill={CHART_COLORS.absent} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )

    if (chartType === "line") return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart {...commonProps}>
          {bars}
          <Line type="monotone" dataKey="present" name="Present" stroke={CHART_COLORS.present} strokeWidth={2.5} dot={{ r: 4, fill: CHART_COLORS.present }} />
          <Line type="monotone" dataKey="absent" name="Absent" stroke="#d1d5db" strokeWidth={2.5} dot={{ r: 4, fill: "#d1d5db" }} />
        </LineChart>
      </ResponsiveContainer>
    )

    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart {...commonProps}>
          {bars}
          <defs>
            <linearGradient id="gPresent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.present} stopOpacity={0.3} />
              <stop offset="95%" stopColor={CHART_COLORS.present} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="present" name="Present" stroke={CHART_COLORS.present} strokeWidth={2.5} fill="url(#gPresent)" />
          <Area type="monotone" dataKey="absent" name="Absent" stroke="#d1d5db" strokeWidth={2} fill="transparent" />
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  return (
    <main className="flex-1 space-y-5 p-4 sm:p-6">

      {/* ── Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {school?.name ?? "Dashboard"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            {" · "}Welcome, {adminFirstName}
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={isRefreshing}
          className="flex items-center gap-2 self-start sm:self-auto px-3 py-1.5 rounded border border-border bg-card text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* ── Stat Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Students"
            value={stats.totalStudents}
            icon={Users}
            accentColor="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
            sub="Registered"
          />
          <StatCard
            label="Present Today"
            value={stats.presentToday}
            icon={Activity}
            accentColor="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
            sub={`${Math.round(stats.presentRate)}% attendance rate`}
            trend="up"
          />
          <StatCard
            label="Teachers"
            value={stats.totalTeachers}
            icon={GraduationCap}
            accentColor="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
            sub="Staff members"
          />
          <StatCard
            label="Devices"
            value={stats.registeredDevices}
            icon={Smartphone}
            accentColor="bg-primary/10 text-primary dark:bg-primary/20"
            sub={`${stats.enrollments} enrollments`}
          />
        </div>
      )}

      {/* ── Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Attendance trend chart */}
        <div className="xl:col-span-2 bg-card border border-border rounded-md shadow-sm p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-foreground">Attendance — Last 7 Days</h2>
                <div className="flex items-center bg-muted rounded border border-border p-0.5">
                  <button
                    onClick={() => setViewMode("student")}
                    className={`px-2.5 py-0.5 text-[11px] font-medium rounded-sm transition-colors ${
                      viewMode === "student"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Students
                  </button>
                  <button
                    onClick={() => setViewMode("teacher")}
                    className={`px-2.5 py-0.5 text-[11px] font-medium rounded-sm transition-colors ${
                      viewMode === "teacher"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Teachers
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {viewMode === "student" ? "Student" : "Teacher"} presence over the last 7 days
              </p>
            </div>
            <div className="flex items-center gap-0.5 bg-muted rounded border border-border p-0.5">
              <ChartTypeButton type="bar" current={chartType} icon={BarChart2} label="Bar" onClick={() => setChartType("bar")} />
              <ChartTypeButton type="line" current={chartType} icon={LineChartIcon} label="Line" onClick={() => setChartType("line")} />
              <ChartTypeButton type="area" current={chartType} icon={Activity} label="Area" onClick={() => setChartType("area")} />
              <ChartTypeButton type="pie" current={chartType} icon={PieChartIcon} label="Pie" onClick={() => setChartType("pie")} />
            </div>
          </div>

          <div className="h-60">
            <AnimatePresence mode="wait">
              <motion.div
                key={chartType}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="h-full"
              >
                {isLoading ? (
                  <div className="h-full rounded bg-muted animate-pulse" />
                ) : renderChart()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Mobile Setup Card */}
        <MobileConnectionCard />

        {/* Today's Snapshot */}
        <div className="bg-card border border-border rounded-md shadow-sm p-5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Today&rsquo;s Snapshot</h2>
            <span className="text-xs text-muted-foreground">
              {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          </div>

          {isLoading ? (
            <div className="space-y-2.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 rounded bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {[
                {
                  label: "Present",
                  value: stats.presentToday,
                  color: "bg-primary",
                  bar: (viewMode === "student" ? stats.totalStudents : stats.totalTeachers)
                    ? stats.presentToday / (viewMode === "student" ? stats.totalStudents : stats.totalTeachers)
                    : 0,
                },
                {
                  label: "Absent",
                  value: Math.max(0, (viewMode === "student" ? stats.totalStudents : stats.totalTeachers) - stats.presentToday),
                  color: "bg-muted-foreground/30",
                  bar: (viewMode === "student" ? stats.totalStudents : stats.totalTeachers)
                    ? Math.max(0, (viewMode === "student" ? stats.totalStudents : stats.totalTeachers) - stats.presentToday) /
                      (viewMode === "student" ? stats.totalStudents : stats.totalTeachers)
                    : 0,
                },
                { label: "Total Events", value: stats.totalToday, color: "bg-emerald-500", bar: 1 },
              ].map(({ label, value, color, bar }) => (
                <div key={label} className="rounded border border-border bg-muted/40 px-3 py-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span className="text-sm font-semibold text-foreground tabular-nums">{value.toLocaleString()}</span>
                  </div>
                  <div className="h-1 rounded-full bg-border overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${color}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(bar * 100, 100)}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-border">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Quick Links</p>
            <div className="space-y-0.5">
              {[
                { label: "View Attendance", path: "/dashboard/attendance" },
                { label: "Manage Students", path: "/dashboard/students" },
                { label: "View Teachers", path: "/dashboard/teachers" },
              ].map(({ label, path }) => (
                <button
                  key={label}
                  onClick={() => router.push(path)}
                  className="flex w-full items-center justify-between rounded px-2 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 transition-colors"
                >
                  {label}
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            icon: Users,
            title: "Register Student",
            description: "Add a new student to the directory with biometric enrollment.",
            action: () => router.push("/dashboard/students/new"),
            accentColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
            label: "Go to Students",
          },
          {
            icon: GraduationCap,
            title: "Manage Teachers",
            description: "View teacher profiles, attendance records, and manage staff.",
            action: () => router.push("/dashboard/teachers"),
            accentColor: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
            label: "Go to Teachers",
          },
          {
            icon: UserPlus,
            title: "Start Enrollment",
            description: "Enroll students with biometric data for accurate tracking.",
            action: () => router.push("/dashboard/enrollment"),
            accentColor: "bg-primary/10 text-primary dark:bg-primary/20",
            label: "Begin Enrollment",
          },
        ].map(({ icon: Icon, title, description, action, accentColor, label }) => (
          <button
            key={title}
            onClick={action}
            className="group text-left bg-card border border-border rounded-md p-4 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-200"
          >
            <div className={`flex h-9 w-9 items-center justify-center rounded mb-3 ${accentColor}`}>
              <Icon className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground mt-1 mb-3 leading-relaxed">{description}</p>
            <span className="flex items-center gap-1 text-xs font-semibold text-primary group-hover:gap-1.5 transition-all">
              {label} <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </button>
        ))}
      </div>
    </main>
  )
}

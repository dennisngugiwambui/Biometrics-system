"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Users, Smartphone, UserPlus, TrendingUp, TrendingDown,
  BarChart2, LineChartIcon, PieChartIcon, Activity,
  ChevronRight, RefreshCw, Calendar, GraduationCap,
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
  gradient,
  sub,
  trend,
  delay = 0,
}: {
  label: string
  value: number | string
  icon: typeof Users
  gradient: string
  sub?: string
  trend?: "up" | "down" | null
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow"
      style={{ background: "white" }}
    >
      {/* Gradient accent bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient}`} />

      <div className="flex items-start justify-between">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-sm`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        {trend && (
          <span className={`flex items-center gap-0.5 text-xs font-medium rounded-full px-2 py-0.5 ${trend === "up" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
            }`}>
            {trend === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          </span>
        )}
      </div>

      <div className="mt-3">
        <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        <p className="mt-0.5 text-sm font-medium text-gray-600 dark:text-gray-400">{label}</p>
        {sub && <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{sub}</p>}
      </div>
    </motion.div>
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
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${current === type
        ? "bg-blue-600 text-white shadow-sm"
        : "text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
        }`}
    >
      <Icon className="h-3.5 w-3.5" />
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
    <motion.main
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8"
    >
      {/* ── Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
            Welcome back, {adminFirstName} 👋
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {school?.name ?? "Your school"} · {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={isRefreshing}
          className="flex items-center gap-2 self-start sm:self-auto px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* ── Stat Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Students"
            value={stats.totalStudents}
            icon={Users}
            gradient="from-blue-500 to-blue-600"
            sub="Registered"
            delay={0}
          />
          <StatCard
            label="Present Today"
            value={stats.presentToday}
            icon={Activity}
            gradient="from-emerald-500 to-teal-600"
            sub={`${Math.round(stats.presentRate)}% attendance rate`}
            trend="up"
            delay={0.05}
          />
          <StatCard
            label="Teachers"
            value={stats.totalTeachers}
            icon={GraduationCap}
            gradient="from-violet-500 to-purple-600"
            sub="Staff members"
            delay={0.1}
          />
          <StatCard
            label="Devices"
            value={stats.registeredDevices}
            icon={Smartphone}
            gradient="from-indigo-500 to-blue-600"
            sub={`${stats.enrollments} enrollments`}
            delay={0.15}
          />
        </div>
      )}

      {/* ── Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Attendance trend chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="xl:col-span-2 rounded-2xl border border-gray-200/70 dark:border-gray-700/70 bg-white dark:bg-gray-800 shadow-sm p-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="font-bold text-gray-900 dark:text-gray-100">Attendance This Week</h2>
                <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5 ml-2">
                  <button
                    onClick={() => setViewMode("student")}
                    className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${viewMode === "student" ? "bg-white dark:bg-gray-600 text-blue-600 shadow-sm" : "text-gray-500"
                      }`}
                  >
                    Students
                  </button>
                  <button
                    onClick={() => setViewMode("teacher")}
                    className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${viewMode === "teacher" ? "bg-white dark:bg-gray-600 text-blue-600 shadow-sm" : "text-gray-500"
                      }`}
                  >
                    Teachers
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{viewMode === "student" ? "Student" : "Teacher"} presence over the last 7 days</p>
            </div>
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700/50 rounded-xl p-1">
              <ChartTypeButton type="bar" current={chartType} icon={BarChart2} label="Bar" onClick={() => setChartType("bar")} />
              <ChartTypeButton type="line" current={chartType} icon={LineChartIcon} label="Line" onClick={() => setChartType("line")} />
              <ChartTypeButton type="area" current={chartType} icon={Activity} label="Area" onClick={() => setChartType("area")} />
              <ChartTypeButton type="pie" current={chartType} icon={PieChartIcon} label="Pie" onClick={() => setChartType("pie")} />
            </div>
          </div>

          <div className="h-64">
            <AnimatePresence mode="wait">
              <motion.div
                key={chartType}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                {isLoading ? (
                  <div className="h-full rounded-xl bg-gray-100 dark:bg-gray-700 animate-pulse" />
                ) : renderChart()}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Mobile Setup Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.4 }}
        >
          <MobileConnectionCard />
        </motion.div>

        {/* Today's Snapshot */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="rounded-2xl border border-gray-200/70 dark:border-gray-700/70 bg-white dark:bg-gray-800 shadow-sm p-5"
        >
          <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-1">Today&rsquo;s Snapshot</h2>
          <p className="text-xs text-gray-400 mb-5">
            {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" })}
          </p>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-gray-100 dark:bg-gray-700 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { label: "Present", value: stats.presentToday, color: "bg-blue-500", bar: (viewMode === "student" ? stats.totalStudents : stats.totalTeachers) ? (stats.presentToday / (viewMode === "student" ? stats.totalStudents : stats.totalTeachers)) : 0 },
                { label: "Absent", value: Math.max(0, (viewMode === "student" ? stats.totalStudents : stats.totalTeachers) - stats.presentToday), color: "bg-gray-300", bar: (viewMode === "student" ? stats.totalStudents : stats.totalTeachers) ? Math.max(0, (viewMode === "student" ? stats.totalStudents : stats.totalTeachers) - stats.presentToday) / (viewMode === "student" ? stats.totalStudents : stats.totalTeachers) : 0 },
                { label: "Total Events", value: stats.totalToday, color: "bg-indigo-500", bar: 1 },
              ].map(({ label, value, color, bar }) => (
                <div key={label} className="rounded-xl bg-gray-50 dark:bg-gray-700/50 p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
                    <span className="text-base font-bold text-gray-900 dark:text-white tabular-nums">{value.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${color}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(bar * 100, 100)}%` }}
                      transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Quick Access</p>
            <div className="space-y-2">
              {[
                { label: "View Attendance", path: "/dashboard/attendance", color: "text-blue-600" },
                { label: "Manage Students", path: "/dashboard/students", color: "text-indigo-600" },
                { label: "View Teachers", path: "/dashboard/teachers", color: "text-violet-600" },
              ].map(({ label, path, color }) => (
                <button
                  key={label}
                  onClick={() => router.push(path)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium ${color} hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors`}
                >
                  {label}
                  <ChevronRight className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Action Cards */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        {[
          {
            icon: Users,
            title: "Register Student",
            description: "Add a new student to your directory with biometric enrollment.",
            action: () => router.push("/dashboard/students/new"),
            gradient: "from-blue-500 to-blue-600",
            label: "Go to Students",
          },
          {
            icon: GraduationCap,
            title: "Manage Teachers",
            description: "View teacher profiles, attendance and manage your staff.",
            action: () => router.push("/dashboard/teachers"),
            gradient: "from-violet-500 to-purple-600",
            label: "Go to Teachers",
          },
          {
            icon: UserPlus,
            title: "Start Enrollment",
            description: "Enroll students with biometric data for accurate tracking.",
            action: () => router.push("/dashboard/enrollment"),
            gradient: "from-indigo-500 to-blue-600",
            label: "Begin Enrollment",
          },
        ].map(({ icon: Icon, title, description, action, gradient, label }, i) => (
          <motion.button
            key={title}
            onClick={action}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 + i * 0.05 }}
            className="group text-left rounded-2xl border border-gray-200/70 dark:border-gray-700/70 bg-white dark:bg-gray-800 p-5 shadow-sm hover:shadow-lg transition-all hover:-translate-y-1"
          >
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-sm mb-4`}>
              <Icon className="h-6 w-6 text-white" />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-gray-100">{title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4 leading-relaxed">{description}</p>
            <span className={`text-sm font-semibold bg-clip-text text-transparent bg-gradient-to-r ${gradient} flex items-center gap-1 group-hover:gap-2 transition-all`}>
              {label} <ChevronRight className="h-4 w-4" style={{ color: "rgb(99 102 241)" }} />
            </span>
          </motion.button>
        ))}
      </motion.div>
    </motion.main>
  )
}

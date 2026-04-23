"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Users, Smartphone, UserPlus, TrendingUp, TrendingDown,
  BarChart2, LineChartIcon, PieChartIcon, Activity,
  ChevronRight, RefreshCw, GraduationCap, ArrowUpRight,
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

type ChartType = "bar" | "line" | "area" | "pie"

interface WeekDay {
  day: string
  present: number
  absent: number
  date: string
}

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

// ── Enterprise Stat Card

function StatCard({
  label, value, icon: Icon, accent, sub, trend,
}: {
  label: string
  value: number | string
  icon: typeof Users
  accent: string      // tailwind color class for icon bg/text
  accentBorder: string // left-border accent class
  sub?: string
  trend?: "up" | "down" | null
}) {
  return (
    <div className={`bg-white dark:bg-card border border-border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow duration-200 border-l-[3px] ${accent}`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800`}>
          <Icon className="h-4 w-4 text-slate-600 dark:text-slate-300" />
        </div>
        {trend && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold rounded-full px-2 py-0.5 ${
            trend === "up"
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
              : "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
          }`}>
            {trend === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-foreground tabular-nums">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      <p className="mt-0.5 text-sm font-medium text-foreground/70">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

// ── Chart Tooltip

type TooltipProps = {
  active?: boolean
  payload?: { value: number; name: string; color: string }[]
  label?: string
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-white p-3 shadow-lg text-sm dark:bg-card dark:border-border">
      <p className="font-semibold text-foreground mb-1.5">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-sm">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold text-foreground">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

const CHART_COLORS = {
  present: "#2563eb",
  absent:  "#e2e8f0",
}

const PIE_COLORS = ["#2563eb", "#e2e8f0"]

function ChartTypeButton({ type, current, icon: Icon, label, onClick }: {
  type: ChartType; current: ChartType; icon: typeof BarChart2; label: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
        current === type
          ? "bg-white dark:bg-card text-foreground shadow-sm border border-border"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  )
}

// ── Main Page

export default function DashboardPage() {
  const router = useRouter()
  const { token, user, setUser } = useAuthStore()

  const [school,      setSchool]      = useState<SchoolResponse | null>(null)
  const [isLoading,   setIsLoading]   = useState(true)
  const [isRefreshing,setIsRefreshing]= useState(false)
  const [chartType,   setChartType]   = useState<ChartType>("bar")
  const [viewMode,    setViewMode]    = useState<"student" | "teacher">("student")
  const [weeklyData,  setWeeklyData]  = useState<WeekDay[]>([])
  const [pieData,     setPieData]     = useState<{ name: string; value: number }[]>([])

  const [stats, setStats] = useState({
    totalStudents: 0, totalTeachers: 0, registeredDevices: 0,
    enrollments: 0,   presentToday: 0,  presentRate: 0,   totalToday: 0,
  })

  const adminFirstName = user?.first_name || user?.email?.split("@")[0] || "Admin"

  const fetchData = useCallback(async (quiet = false) => {
    if (!token) return
    if (!quiet) setIsLoading(true); else setIsRefreshing(true)
    try {
      const dates = getLast7Days()
      const [schoolRes, studentsRes, devicesRes, attendanceRes, enrollments, teachersRes] =
        await Promise.allSettled([
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

      const totalStudents    = studentsRes.status    === "fulfilled" ? studentsRes.value.total    : 0
      const totalDevices     = devicesRes.status     === "fulfilled" ? devicesRes.value.total     : 0
      const totalEnrollments = enrollments.status    === "fulfilled" ? enrollments.value           : 0
      const totalTeachers    = teachersRes.status    === "fulfilled" ? teachersRes.value.total    : 0
      const atStats          = attendanceRes.status  === "fulfilled" ? attendanceRes.value         : null

      setStats({
        totalStudents, totalTeachers,
        registeredDevices: totalDevices, enrollments: totalEnrollments,
        presentToday: atStats?.checked_in ?? 0,
        presentRate:  atStats?.present_rate ?? 0,
        totalToday:   atStats?.total_events ?? 0,
      })

      const total = viewMode === "student" ? totalStudents : totalTeachers
      setPieData([
        { name: "Present", value: atStats?.checked_in ?? 0 },
        { name: "Absent",  value: Math.max(0, total - (atStats?.checked_in ?? 0)) },
      ])

      const weekResults = await Promise.allSettled(
        dates.map((d) => getAttendanceStats(token, d, viewMode))
      )
      setWeeklyData(
        dates.map((d, i) => {
          const r = weekResults[i]
          const s = r.status === "fulfilled" ? r.value : null
          const t = viewMode === "student" ? totalStudents : totalTeachers
          return { date: d, day: dayLabel(d), present: s?.checked_in ?? 0, absent: Math.max(0, t - (s?.checked_in ?? 0)) }
        })
      )
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [token, setUser, viewMode])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Chart rendering
  const renderChart = () => {
    if (!weeklyData.length)
      return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No data available</div>

    const common = { data: weeklyData, margin: { top: 5, right: 10, left: -20, bottom: 0 } }

    if (chartType === "pie") {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius="42%" outerRadius="68%" paddingAngle={3}
              dataKey="value" nameKey="name" stroke="none">
              {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )
    }

    const axes = (
      <>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </>
    )

    if (chartType === "bar") return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart {...common}>
          {axes}
          <Bar dataKey="present" name="Present" fill={CHART_COLORS.present} radius={[3, 3, 0, 0]} />
          <Bar dataKey="absent"  name="Absent"  fill={CHART_COLORS.absent}  radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )

    if (chartType === "line") return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart {...common}>
          {axes}
          <Line type="monotone" dataKey="present" name="Present" stroke={CHART_COLORS.present} strokeWidth={2} dot={{ r: 3, fill: CHART_COLORS.present }} />
          <Line type="monotone" dataKey="absent"  name="Absent"  stroke="#cbd5e1" strokeWidth={2} dot={{ r: 3, fill: "#cbd5e1" }} />
        </LineChart>
      </ResponsiveContainer>
    )

    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart {...common}>
          {axes}
          <defs>
            <linearGradient id="gPresent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={CHART_COLORS.present} stopOpacity={0.25} />
              <stop offset="95%" stopColor={CHART_COLORS.present} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="present" name="Present" stroke={CHART_COLORS.present} strokeWidth={2} fill="url(#gPresent)" />
          <Area type="monotone" dataKey="absent"  name="Absent"  stroke="#cbd5e1" strokeWidth={1.5} fill="transparent" />
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  return (
    <main className="flex-1 space-y-6 p-5 sm:p-6">

      {/* ── Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">{school?.name ?? "Dashboard"}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            {" — "}Welcome back, <span className="font-medium text-foreground">{adminFirstName}</span>
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={isRefreshing}
          className="flex items-center gap-2 self-start sm:self-auto px-3 py-1.5 rounded-lg border border-border bg-white dark:bg-card text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50 shadow-sm"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* ── Stat cards */}
      {isLoading
        ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Students"
              value={stats.totalStudents}
              icon={Users}
              accent="border-l-blue-500"
              accentBorder=""
              sub="Registered students"
            />
            <StatCard
              label="Present Today"
              value={stats.presentToday}
              icon={Activity}
              accent="border-l-emerald-500"
              accentBorder=""
              sub={`${Math.round(stats.presentRate)}% attendance rate`}
              trend="up"
            />
            <StatCard
              label="Teachers"
              value={stats.totalTeachers}
              icon={GraduationCap}
              accent="border-l-violet-500"
              accentBorder=""
              sub="Staff members"
            />
            <StatCard
              label="Devices"
              value={stats.registeredDevices}
              icon={Smartphone}
              accent="border-l-amber-500"
              accentBorder=""
              sub={`${stats.enrollments} enrollments`}
            />
          </div>
        )
      }

      {/* ── Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Attendance chart */}
        <div className="xl:col-span-2 bg-white dark:bg-card border border-border rounded-lg shadow-sm p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-sm font-semibold text-foreground">Attendance — Last 7 Days</h2>
                {/* View toggle */}
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg border border-border p-0.5">
                  {(["student", "teacher"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-colors capitalize ${
                        viewMode === mode
                          ? "bg-white dark:bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {mode === "student" ? "Students" : "Teachers"}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {viewMode === "student" ? "Student" : "Teacher"} presence over the last 7 days
              </p>
            </div>
            {/* Chart type switcher */}
            <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-border p-0.5">
              <ChartTypeButton type="bar"  current={chartType} icon={BarChart2}     label="Bar"  onClick={() => setChartType("bar")} />
              <ChartTypeButton type="line" current={chartType} icon={LineChartIcon} label="Line" onClick={() => setChartType("line")} />
              <ChartTypeButton type="area" current={chartType} icon={Activity}      label="Area" onClick={() => setChartType("area")} />
              <ChartTypeButton type="pie"  current={chartType} icon={PieChartIcon}  label="Pie"  onClick={() => setChartType("pie")} />
            </div>
          </div>

          <div className="h-56">
            <AnimatePresence mode="wait">
              <motion.div
                key={chartType}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="h-full"
              >
                {isLoading
                  ? <div className="h-full rounded-lg bg-muted animate-pulse" />
                  : renderChart()
                }
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Mobile setup card */}
        <MobileConnectionCard />

        {/* Today's Snapshot */}
        <div className="bg-white dark:bg-card border border-border rounded-lg shadow-sm p-5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Today&rsquo;s Snapshot</h2>
            <span className="text-xs text-muted-foreground font-medium">
              {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          </div>

          {isLoading
            ? <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
              ))}</div>
            : (
              <div className="space-y-3">
                {[
                  {
                    label: "Present",
                    value: stats.presentToday,
                    color: "bg-blue-500",
                    pct: (viewMode === "student" ? stats.totalStudents : stats.totalTeachers)
                      ? stats.presentToday / (viewMode === "student" ? stats.totalStudents : stats.totalTeachers)
                      : 0,
                  },
                  {
                    label: "Absent",
                    value: Math.max(0, (viewMode === "student" ? stats.totalStudents : stats.totalTeachers) - stats.presentToday),
                    color: "bg-slate-300",
                    pct: (viewMode === "student" ? stats.totalStudents : stats.totalTeachers)
                      ? Math.max(0, (viewMode === "student" ? stats.totalStudents : stats.totalTeachers) - stats.presentToday) /
                        (viewMode === "student" ? stats.totalStudents : stats.totalTeachers)
                      : 0,
                  },
                  { label: "Total Events", value: stats.totalToday, color: "bg-emerald-500", pct: 1 },
                ].map(({ label, value, color, pct }) => (
                  <div key={label} className="rounded-lg border border-border bg-slate-50 dark:bg-slate-900/40 px-3 py-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <span className="text-sm font-bold text-foreground tabular-nums">{value.toLocaleString()}</span>
                    </div>
                    <div className="h-1 rounded-full bg-border overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${color}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(pct * 100, 100)}%` }}
                        transition={{ duration: 0.7, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )
          }

          {/* Quick links */}
          <div className="mt-5 pt-3 border-t border-border">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Quick Links</p>
            <div className="space-y-0.5">
              {[
                { label: "View Attendance",  path: "/dashboard/attendance" },
                { label: "Manage Students",  path: "/dashboard/students" },
                { label: "View Teachers",    path: "/dashboard/teachers" },
              ].map(({ label, path }) => (
                <button
                  key={label}
                  onClick={() => router.push(path)}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  {label}
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick action cards */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              icon: Users,
              title: "Register Student",
              description: "Add a new student with biometric enrollment to the directory.",
              action: () => router.push("/dashboard/students/new"),
              accent: "border-l-blue-500",
              linkLabel: "Go to Students",
            },
            {
              icon: GraduationCap,
              title: "Manage Teachers",
              description: "View teacher profiles, track attendance, and manage staff records.",
              action: () => router.push("/dashboard/teachers"),
              accent: "border-l-violet-500",
              linkLabel: "Go to Teachers",
            },
            {
              icon: UserPlus,
              title: "Start Enrollment",
              description: "Enroll students or staff with fingerprint data for accurate tracking.",
              action: () => router.push("/dashboard/enrollment"),
              accent: "border-l-emerald-500",
              linkLabel: "Begin Enrollment",
            },
          ].map(({ icon: Icon, title, description, action, accent, linkLabel }) => (
            <button
              key={title}
              onClick={action}
              className={`group text-left bg-white dark:bg-card border border-border rounded-lg p-4 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 border-l-[3px] ${accent}`}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800 mb-3">
                <Icon className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              <p className="text-xs text-muted-foreground mt-1 mb-3 leading-relaxed">{description}</p>
              <span className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 group-hover:gap-1.5 transition-all">
                {linkLabel} <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}

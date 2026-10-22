"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Users, Smartphone, UserPlus, TrendingUp,
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
import { getAttendanceStats } from "@/lib/api/attendance"
import { getSuccessfulEnrollmentCount } from "@/lib/api/enrollment"
import { listTeachers } from "@/lib/api/teachers"
import type { UserResponse } from "@/lib/api/auth"

type ChartType = "bar" | "line" | "area" | "pie"

interface WeekDay { day: string; present: number; absent: number; date: string }

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

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, accent, sub, trend,
}: {
  label: string
  value: number | string
  icon: typeof Users
  accent: string
  sub?: string
  trend?: "up" | "down" | null
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-950/5 transition-shadow hover:shadow-md dark:bg-gray-800 dark:ring-white/5">
      {/* Coloured left accent bar */}
      <div className="absolute left-0 top-4 bottom-4 w-[3px] rounded-full" style={{ background: accent }} />

      <div className="flex items-start justify-between pl-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">{label}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-gray-900 dark:text-white">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {sub && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{sub}</p>}
        </div>
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `${accent}18` }}
        >
          <Icon className="h-5 w-5" style={{ color: accent }} />
        </div>
      </div>

      {trend && (
        <div className="mt-3 pl-3 flex items-center gap-1">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-xs font-medium text-emerald-600">Trending up</span>
        </div>
      )}
    </div>
  )
}

// ─── Chart tooltip ─────────────────────────────────────────────────────────────

type TooltipProps = {
  active?: boolean
  payload?: { value: number; name: string; color: string }[]
  label?: string
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-gray-100 bg-white px-3.5 py-3 shadow-xl text-sm dark:bg-gray-800 dark:border-gray-700">
      <p className="mb-2 font-semibold text-gray-700 dark:text-gray-200">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-500 dark:text-gray-400">{p.name}:</span>
          <span className="font-bold text-gray-800 dark:text-gray-100">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

const BLUE   = "#2563eb"
const ABSENT = "#e2e8f0"
const PIE_COLORS = [BLUE, ABSENT]

function ChartTab({ type, current, icon: Icon, label, onClick }: {
  type: ChartType; current: ChartType; icon: typeof BarChart2; label: string; onClick: () => void
}) {
  const active = current === type
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all ${
        active
          ? "bg-blue-600 text-white shadow-sm"
          : "text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
      }`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter()
  const { token, user, setUser } = useAuthStore()

  const [school,       setSchool]       = useState<SchoolResponse | null>(null)
  const [isLoading,    setIsLoading]    = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [chartType,    setChartType]    = useState<ChartType>("bar")
  const [viewMode,     setViewMode]     = useState<"student" | "teacher">("student")
  const [weeklyData,   setWeeklyData]   = useState<WeekDay[]>([])
  const [pieData,      setPieData]      = useState<{ name: string; value: number }[]>([])

  const [stats, setStats] = useState({
    totalStudents: 0, totalTeachers: 0, registeredDevices: 0,
    enrollments: 0, presentToday: 0, presentRate: 0, totalToday: 0,
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

      const totalStudents    = studentsRes.status  === "fulfilled" ? studentsRes.value.total  : 0
      const totalDevices     = devicesRes.status   === "fulfilled" ? devicesRes.value.total   : 0
      const totalEnrollments = enrollments.status  === "fulfilled" ? enrollments.value        : 0
      const totalTeachers    = teachersRes.status  === "fulfilled" ? teachersRes.value.total  : 0
      const atStats          = attendanceRes.status === "fulfilled" ? attendanceRes.value      : null

      setStats({
        totalStudents, totalTeachers,
        registeredDevices: totalDevices,
        enrollments: totalEnrollments,
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

  const renderChart = () => {
    if (!weeklyData.length)
      return <div className="flex h-full items-center justify-center text-sm text-gray-400">No data available</div>

    const common = { data: weeklyData, margin: { top: 5, right: 10, left: -20, bottom: 0 } }

    if (chartType === "pie") return (
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
          <Bar dataKey="present" name="Present" fill={BLUE}   radius={[4, 4, 0, 0]} />
          <Bar dataKey="absent"  name="Absent"  fill={ABSENT} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )

    if (chartType === "line") return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart {...common}>
          {axes}
          <Line type="monotone" dataKey="present" name="Present" stroke={BLUE}   strokeWidth={2.5} dot={{ r: 3, fill: BLUE }} />
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
              <stop offset="5%"  stopColor={BLUE} stopOpacity={0.2} />
              <stop offset="95%" stopColor={BLUE} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="present" name="Present" stroke={BLUE}   strokeWidth={2.5} fill="url(#gPresent)" />
          <Area type="monotone" dataKey="absent"  name="Absent"  stroke="#cbd5e1" strokeWidth={1.5} fill="transparent" />
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })

  return (
    <main className="space-y-6 p-5 sm:p-7">

      {/* ── Page header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {school?.name ?? "Dashboard"}
          </h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {today} — Welcome back,{" "}
            <span className="font-semibold text-gray-700 dark:text-gray-300">{adminFirstName}</span>
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={isRefreshing}
          className="flex items-center gap-2 self-start rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm transition-all hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* ── Stat cards ── */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-gray-100 animate-pulse dark:bg-gray-800" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Total Students"
            value={stats.totalStudents}
            icon={Users}
            accent="#2563eb"
            sub="Registered students"
          />
          <StatCard
            label="Present Today"
            value={stats.presentToday}
            icon={Activity}
            accent="#10b981"
            sub={`${Math.round(stats.presentRate)}% attendance rate`}
            trend="up"
          />
          <StatCard
            label="Teachers"
            value={stats.totalTeachers}
            icon={GraduationCap}
            accent="#8b5cf6"
            sub="Staff members"
          />
          <StatCard
            label="Devices"
            value={stats.registeredDevices}
            icon={Smartphone}
            accent="#f59e0b"
            sub={`${stats.enrollments} enrollments`}
          />
        </div>
      )}

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">

        {/* Attendance chart */}
        <div className="xl:col-span-2 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-950/5 dark:bg-gray-800 dark:ring-white/5">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Attendance — Last 7 Days</h2>
              <p className="mt-0.5 text-xs text-gray-400">
                {viewMode === "student" ? "Student" : "Teacher"} presence over the last week
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Student / Teacher toggle */}
              <div className="flex rounded-xl border border-gray-100 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-900">
                {(["student", "teacher"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold capitalize transition-all ${
                      viewMode === mode
                        ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                        : "text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    }`}
                  >
                    {mode === "student" ? "Students" : "Teachers"}
                  </button>
                ))}
              </div>

              {/* Chart type switcher */}
              <div className="flex items-center gap-1 rounded-xl border border-gray-100 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-900">
                <ChartTab type="bar"  current={chartType} icon={BarChart2}     label="Bar"  onClick={() => setChartType("bar")} />
                <ChartTab type="line" current={chartType} icon={LineChartIcon} label="Line" onClick={() => setChartType("line")} />
                <ChartTab type="area" current={chartType} icon={Activity}      label="Area" onClick={() => setChartType("area")} />
                <ChartTab type="pie"  current={chartType} icon={PieChartIcon}  label="Pie"  onClick={() => setChartType("pie")} />
              </div>
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
                {isLoading
                  ? <div className="h-full rounded-xl bg-gray-50 animate-pulse dark:bg-gray-900" />
                  : renderChart()
                }
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Mobile setup card */}
        <MobileConnectionCard />

        {/* Today's snapshot */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-950/5 dark:bg-gray-800 dark:ring-white/5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Today&rsquo;s Snapshot</h2>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
              {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-gray-50 animate-pulse dark:bg-gray-900" />
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {[
                {
                  label: "Present",
                  value: stats.presentToday,
                  color: BLUE,
                  pct: (viewMode === "student" ? stats.totalStudents : stats.totalTeachers)
                    ? stats.presentToday / (viewMode === "student" ? stats.totalStudents : stats.totalTeachers)
                    : 0,
                },
                {
                  label: "Absent",
                  value: Math.max(0, (viewMode === "student" ? stats.totalStudents : stats.totalTeachers) - stats.presentToday),
                  color: "#e2e8f0",
                  pct: (viewMode === "student" ? stats.totalStudents : stats.totalTeachers)
                    ? Math.max(0, (viewMode === "student" ? stats.totalStudents : stats.totalTeachers) - stats.presentToday) /
                      (viewMode === "student" ? stats.totalStudents : stats.totalTeachers)
                    : 0,
                },
                { label: "Total Events", value: stats.totalToday, color: "#10b981", pct: 1 },
              ].map(({ label, value, color, pct }) => (
                <div key={label} className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-900/50">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
                    <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">{value.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(pct * 100, 100)}%` }}
                      transition={{ duration: 0.7, ease: "easeOut" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick links */}
          <div className="mt-5 border-t border-gray-100 pt-4 dark:border-gray-700">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">Quick Links</p>
            <div className="space-y-0.5">
              {[
                { label: "View Attendance", path: "/dashboard/attendance" },
                { label: "Manage Students", path: "/dashboard/students" },
                { label: "View Teachers",   path: "/dashboard/teachers" },
              ].map(({ label, path }) => (
                <button
                  key={label}
                  onClick={() => router.push(path)}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                >
                  {label}
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick actions ── */}
      <div>
        <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              icon: Users,
              title: "Register Student",
              description: "Add a new student with biometric enrollment to the directory.",
              action: () => router.push("/dashboard/students/new"),
              accent: "#2563eb",
              linkLabel: "Go to Students",
            },
            {
              icon: GraduationCap,
              title: "Manage Teachers",
              description: "View teacher profiles, track attendance, and manage staff records.",
              action: () => router.push("/dashboard/teachers"),
              accent: "#8b5cf6",
              linkLabel: "Go to Teachers",
            },
            {
              icon: UserPlus,
              title: "Start Enrollment",
              description: "Enroll students or staff with fingerprint data for accurate tracking.",
              action: () => router.push("/dashboard/enrollment"),
              accent: "#10b981",
              linkLabel: "Begin Enrollment",
            },
          ].map(({ icon: Icon, title, description, action, accent, linkLabel }) => (
            <button
              key={title}
              onClick={action}
              className="group text-left rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-950/5 transition-all hover:shadow-md dark:bg-gray-800 dark:ring-white/5"
            >
              <div
                className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl shadow-sm"
                style={{ background: `${accent}18` }}
              >
                <Icon className="h-5 w-5" style={{ color: accent }} />
              </div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h3>
              <p className="mt-1.5 mb-4 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>
              <span
                className="flex items-center gap-1 text-xs font-semibold transition-all group-hover:gap-1.5"
                style={{ color: accent }}
              >
                {linkLabel}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}

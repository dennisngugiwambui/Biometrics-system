"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Users, Smartphone, UserPlus, TrendingUp,
  BarChart2, LineChartIcon, PieChartIcon, Activity,
  ChevronRight, RefreshCw, GraduationCap, ArrowUpRight, LayoutDashboard,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/PageHeader"
import { KpiCard, Panel } from "@/components/shared/KpiCard"
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

// ─── Chart tooltip ─────────────────────────────────────────────────────────────

type TooltipProps = {
  active?: boolean
  payload?: { value: number; name: string; color: string }[]
  label?: string
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-[var(--shadow-card-md)] text-sm">
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

const BLUE   = "var(--primary)"
const ABSENT = "#dbe2ea"
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
          ? "bg-white text-primary shadow-[var(--shadow-key-2)]"
          : "text-slate-500 hover:text-slate-800"
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
        <CartesianGrid strokeDasharray="3 4" stroke="#e6ebf1" vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#7b889c" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#7b889c" }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </>
    )

    if (chartType === "bar") return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart {...common}>
          {axes}
          <Bar dataKey="present" name="Present" fill={BLUE}   radius={[6, 6, 2, 2]} />
          <Bar dataKey="absent"  name="Absent"  fill={ABSENT} radius={[6, 6, 2, 2]} />
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
  const roster = viewMode === "student" ? stats.totalStudents : stats.totalTeachers
  const absentToday = Math.max(0, roster - stats.presentToday)

  return (
    <main className="page-shell space-y-5">

      {/* ── Page header ── */}
      <PageHeader
        icon={LayoutDashboard}
        title={school?.name ?? "Dashboard"}
        subtitle={<>{today} · Welcome back, <span className="font-semibold text-slate-700">{adminFirstName}</span></>}
        actions={
          <Button variant="outline" onClick={() => fetchData(true)} disabled={isRefreshing}>
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {/* ── KPI cards ── */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[118px] animate-pulse rounded-2xl bg-slate-200/60" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <KpiCard label="Total students" value={stats.totalStudents.toLocaleString()} icon={Users} tone="primary" hint="Registered learners" />
          <KpiCard
            label="Present today"
            value={stats.presentToday.toLocaleString()}
            icon={Activity}
            tone="success"
            bar={{ value: stats.presentRate, label: `${Math.round(stats.presentRate)}% attendance rate` }}
          />
          <KpiCard label="Teachers" value={stats.totalTeachers.toLocaleString()} icon={GraduationCap} tone="info" hint="Staff members" />
          <KpiCard label="Devices" value={stats.registeredDevices.toLocaleString()} icon={Smartphone} tone="warning" hint={`${(stats.enrollments ?? 0).toLocaleString()} fingerprints enrolled`} />
        </div>
      )}

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-3">

        {/* Attendance chart */}
        <Panel
          className="xl:col-span-2"
          title="Attendance, last 7 days"
          subtitle={`${viewMode === "student" ? "Student" : "Teacher"} presence over the last week`}
          actions={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="flex rounded-xl border border-slate-200 bg-slate-100/80 p-0.5">
                {(["student", "teacher"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all ${
                      viewMode === mode ? "bg-white text-primary shadow-[var(--shadow-key-2)]" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {mode === "student" ? "Students" : "Teachers"}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-0.5 rounded-xl border border-slate-200 bg-slate-100/80 p-0.5">
                <ChartTab type="bar"  current={chartType} icon={BarChart2}     label="Bar"  onClick={() => setChartType("bar")} />
                <ChartTab type="line" current={chartType} icon={LineChartIcon} label="Line" onClick={() => setChartType("line")} />
                <ChartTab type="area" current={chartType} icon={Activity}      label="Area" onClick={() => setChartType("area")} />
                <ChartTab type="pie"  current={chartType} icon={PieChartIcon}  label="Pie"  onClick={() => setChartType("pie")} />
              </div>
            </div>
          }
        >
          <div className="h-60 sm:h-64">
            <AnimatePresence mode="wait">
              <motion.div
                key={chartType}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="h-full"
              >
                {isLoading ? <div className="h-full animate-pulse rounded-xl bg-slate-100" /> : renderChart()}
              </motion.div>
            </AnimatePresence>
          </div>
        </Panel>

        {/* Mobile setup card */}
        <MobileConnectionCard />

        {/* Today's snapshot */}
        <Panel
          title="Today’s snapshot"
          actions={<span className="pill pill-neutral">{new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
        >
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {[
                { label: "Present", value: stats.presentToday, color: "var(--primary)", pct: roster ? stats.presentToday / roster : 0 },
                { label: "Absent", value: absentToday, color: "#f43f5e", pct: roster ? absentToday / roster : 0 },
                { label: "Total events", value: stats.totalToday, color: "#3b82f6", pct: 1 },
              ].map(({ label, value, color, pct }) => (
                <div key={label} className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs text-slate-500">{label}</span>
                    <span className="text-sm font-bold tabular-nums text-slate-900">{value.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
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

          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Quick links</p>
            <div className="space-y-0.5">
              {[
                { label: "View attendance", path: "/dashboard/attendance" },
                { label: "Manage students", path: "/dashboard/students" },
                { label: "View teachers", path: "/dashboard/teachers" },
              ].map(({ label, path }) => (
                <button
                  key={label}
                  onClick={() => router.push(path)}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                >
                  {label}
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          </div>
        </Panel>

      {/* ── Quick actions ── */}
      <div className="xl:col-span-2">
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Quick actions</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          {[
            { icon: Users, title: "Register student", description: "Add a new student with biometric enrollment to the directory.", action: () => router.push("/dashboard/students/new"), linkLabel: "Go to students" },
            { icon: GraduationCap, title: "Manage teachers", description: "View teacher profiles, track attendance, and manage staff records.", action: () => router.push("/dashboard/teachers"), linkLabel: "Go to teachers" },
            { icon: UserPlus, title: "Start enrollment", description: "Enroll students or staff with fingerprint data for accurate tracking.", action: () => router.push("/dashboard/enrollment"), linkLabel: "Begin enrollment" },
          ].map(({ icon: Icon, title, description, action, linkLabel }) => (
            <button key={title} onClick={action} className="card-portal card-portal-hover group p-4 text-left sm:p-5">
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/20 transition-colors group-hover:bg-primary group-hover:text-white">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <h3 className="text-sm font-bold text-slate-900">{title}</h3>
              <p className="mb-3 mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
              <span className="flex items-center gap-1 text-xs font-semibold text-primary transition-all group-hover:gap-1.5">
                {linkLabel}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </button>
          ))}
        </div>
      </div>
      </div>
    </main>
  )
}

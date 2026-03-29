"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardCheck,
  LogIn,
  LogOut,
  BarChart3,
  Radio,
  History,
  Pause,
  Play,
  WifiOff,
  Fingerprint,
  Trash2,
  ArrowUp,
  Copy,
  MapPin,
  UserCheck,
  UserX,
  HelpCircle,
  RefreshCw,
  Clock,
} from "lucide-react";
import { staggerContainer, staggerItem, fadeInUp } from "@/lib/animations/framer-motion";
import { useAuthStore } from "@/lib/store/authStore";
import {
  listAttendance,
  getAttendanceStats,
  type AttendanceEvent,
  type AttendanceStats,
  type AttendanceListParams,
  type EventType,
} from "@/lib/api/attendance";
import { useAttendanceWebSocket } from "@/lib/hooks/useAttendanceWebSocket";
import { listClasses, type ClassResponse } from "@/lib/api/classes";
import { listTeachers, type TeacherResponse } from "@/lib/api/teachers";
import { getMySchool, type SchoolResponse } from "@/lib/api/schools";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search as SearchIcon,
  Filter,
  X as CloseIcon,
  Calendar as CalendarIcon,
  Home,
  Users as UsersIcon,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { TeacherDetailModal } from "@/components/features/dashboard/TeacherDetailModal";
import { format } from "date-fns";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum events to keep in the live feed before auto-trimming oldest. */
const MAX_LIVE_EVENTS = 100;

type AttendanceAudience = "students" | "teachers";
type AttendanceView = "details" | "visualize";

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  icon: Icon,
  colorClass,
  hint,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  colorClass: string;
  hint?: string;
}) {
  return (
    <motion.div
      variants={staggerItem}
      className="glass-panel shadow-sm rounded-2xl border border-white/20 dark:border-white/10 p-4 hover-lift group transition-all"
    >
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl shadow-glow bevel-sm transition-transform group-hover:scale-105 ${colorClass}`}>
          <Icon className="size-4.5" />
        </div>
        <div>
          <p className="text-xl font-black text-foreground tabular-nums tracking-tight">
            {value}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-70">{label}</p>
          {hint && (
            <p className="text-[9px] font-bold text-muted-foreground/40 mt-0.5 uppercase tracking-tighter">{hint}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Event Type Badge
// ---------------------------------------------------------------------------

function EventBadge({ type }: { type: EventType }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    IN: {
      bg: "bg-green-100 dark:bg-green-900/50",
      text: "text-green-700 dark:text-green-300",
      label: "IN",
    },
    OUT: {
      bg: "bg-amber-100 dark:bg-amber-900/50",
      text: "text-amber-700 dark:text-amber-300",
      label: "OUT",
    },
    DUPLICATE: {
      bg: "bg-purple-100 dark:bg-purple-900/50",
      text: "text-purple-600 dark:text-purple-300",
      label: "DUPLICATE",
    },
    UNKNOWN: {
      bg: "bg-gray-100 dark:bg-gray-700/50",
      text: "text-gray-600 dark:text-gray-400",
      label: "UNKNOWN",
    },
  };

  const c = config[type] ?? config.UNKNOWN;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}
    >
      {c.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Filter Bar
// ---------------------------------------------------------------------------

function FilterBar({
  filters,
  classes,
  teachers,
  audience,
  schoolType,
  onFilterChange,
  onReset,
}: {
  filters: AttendanceListParams;
  classes: ClassResponse[];
  teachers: TeacherResponse[];
  audience: AttendanceAudience;
  schoolType: SchoolResponse["school_type"] | undefined;
  onFilterChange: (newFilters: Partial<AttendanceListParams>) => void;
  onReset: () => void;
}) {
  const departments = Array.from(
    new Set(
      teachers
        .flatMap((t) =>
          (t.department ?? "")
            .split(",")
            .map((d) => d.trim())
            .filter((d) => d.length > 0)
        )
    )
  ).sort((a, b) => a.localeCompare(b));

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 glass-panel shadow-premium rounded-2xl border border-white/20 dark:border-white/10 mb-6 bevel-sm">
      {/* Search */}
      <div className="relative flex-1 min-w-[240px]">
        <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground opacity-60" />
        <Input
          placeholder={audience === "teachers" ? "Search teacher or employee ID..." : "Search student or admission #..."}
          value={filters.search || ""}
          onChange={(e) => onFilterChange({ search: e.target.value })}
          className="pl-10 h-11 bg-white/40 dark:bg-black/20 border-white/20 dark:border-white/10 focus:ring-4 focus:ring-primary/10 transition-all rounded-xl font-medium"
        />
      </div>

      {audience === "teachers" ? (
        <>
          {/* Department Select (filters teacher options client-side only) */}
          <Select
            value={(filters as any).department || "all"}
            onValueChange={(val) => onFilterChange({ ...(val === "all" ? { department: undefined } : { department: val }) } as any)}
          >
            <SelectTrigger className="w-[180px] h-10 rounded-lg border-gray-200 dark:border-gray-700">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Teacher Select */}
          <Select
            value={filters.teacher_id?.toString() || "all"}
            onValueChange={(val) => onFilterChange({ teacher_id: val === "all" ? undefined : parseInt(val) })}
          >
            <SelectTrigger className="w-[200px] h-10 rounded-lg border-gray-200 dark:border-gray-700">
              <SelectValue placeholder="All Teachers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teachers</SelectItem>
              {teachers
                .filter((t) => {
                  const dep = ((filters as any).department as string | undefined)?.trim();
                  if (!dep) return true;
                  return (t.department ?? "")
                    .split(",")
                    .map((d) => d.trim())
                    .some((d) => d === dep);
                })
                .map((t) => (
                  <SelectItem key={t.id} value={t.id.toString()}>
                    {(t.employee_id ? `${t.employee_id} · ` : "") + `${t.first_name} ${t.last_name}`}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </>
      ) : (
        <>
          {/* Class Select */}
          <Select
            value={filters.class_id?.toString() || "all"}
            onValueChange={(val) => onFilterChange({ class_id: val === "all" ? undefined : parseInt(val) })}
          >
            <SelectTrigger className="w-[160px] h-10 rounded-lg border-gray-200 dark:border-gray-700">
              <SelectValue placeholder="All Classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id.toString()}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Boarding Status Select */}
          {schoolType === "mixed" && (
            <Select
              value={filters.is_boarding === undefined ? "all" : filters.is_boarding.toString()}
              onValueChange={(val) => onFilterChange({ is_boarding: val === "all" ? undefined : val === "true" })}
            >
              <SelectTrigger className="w-[140px] h-10 rounded-lg border-gray-200 dark:border-gray-700">
                <SelectValue placeholder="Resident Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Status</SelectItem>
                <SelectItem value="true">Boarders</SelectItem>
                <SelectItem value="false">Day Students</SelectItem>
              </SelectContent>
            </Select>
          )}
        </>
      )}

      {/* Event Type Select */}
      <Select
        value={filters.event_type || "all"}
        onValueChange={(val) => onFilterChange({ event_type: val === "all" ? undefined : val as EventType })}
      >
        <SelectTrigger className="w-[140px] h-10 rounded-lg border-gray-200 dark:border-gray-700">
          <SelectValue placeholder="All Events" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Events</SelectItem>
          <SelectItem value="IN">IN (Entry)</SelectItem>
          <SelectItem value="OUT">OUT (Exit)</SelectItem>
          <SelectItem value="UNKNOWN">UNKNOWN</SelectItem>
        </SelectContent>
      </Select>

      {/* Reset */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onReset}
        className="text-gray-500 hover:text-blue-600 h-10 px-3"
      >
        <RefreshCw className="size-4 mr-2" />
        Reset
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live Scan Row — a single fingerprint scan in the live feed
// ---------------------------------------------------------------------------

function LiveScanRow({ event }: { event: AttendanceEvent }) {
  const borderColor: Record<string, string> = {
    IN: "border-l-green-500",
    OUT: "border-l-amber-500",
    DUPLICATE: "border-l-purple-400",
    UNKNOWN: "border-l-gray-400",
  };

  const time = new Date(event.occurred_at).toLocaleTimeString("en-KE", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const isDuplicate = event.event_type === "DUPLICATE";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20, scale: 0.95 }}
      animate={{ opacity: isDuplicate ? 0.65 : 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0, scale: 0.9 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`flex items-center gap-3 px-4 py-3.5 border-l-[4px] ${borderColor[event.event_type] ?? borderColor.UNKNOWN
        } glass-panel shadow-sm rounded-r-2xl transition-all hover:translate-x-1 hover:shadow-md ${isDuplicate ? "opacity-50 grayscale-[0.3]" : ""
        }`}
    >
      {/* Icon */}
      <div className="flex-shrink-0">
        {isDuplicate ? (
          <Copy className="size-4 text-purple-400" />
        ) : (
          <Fingerprint className="size-4 text-blue-500 dark:text-blue-400" />
        )}
      </div>

      {/* Badge */}
      <EventBadge type={event.event_type} />

      {/* Person info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 dark:text-gray-100 truncate text-sm">
          {event.teacher_name ?? event.student_name ?? "Unknown"}
          {(event.employee_id || event.admission_number) && (
            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
              ({event.employee_id ?? event.admission_number})
            </span>
          )}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {event.device_name}
          {event.class_name && <span> · {event.class_name}</span>}
          {isDuplicate && (
            <span className="ml-1 italic text-purple-500 dark:text-purple-400">
              — duplicate tap
            </span>
          )}
        </p>
      </div>

      {/* Timestamp */}
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap">
        {time}
      </p>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Live Capture Feed
// ---------------------------------------------------------------------------

function LiveCaptureFeed({
  events,
  isConnected,
  isPaused,
  onTogglePause,
  onClear,
  totalSeen,
}: {
  events: AttendanceEvent[];
  isConnected: boolean;
  isPaused: boolean;
  onTogglePause: () => void;
  onClear: () => void;
  totalSeen: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtTopRef = useRef(true);

  // Track whether user has scrolled away from top
  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      isAtTopRef.current = scrollRef.current.scrollTop < 20;
    }
  }, []);

  // Auto-scroll to top when new events arrive (newest first)
  useEffect(() => {
    if (!isPaused && isAtTopRef.current && scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [events.length, isPaused]);

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="glass-panel shadow-premium rounded-3xl border border-white/20 dark:border-white/10 overflow-hidden bevel-card"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 dark:border-white/5 bg-primary/5">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-black tracking-tight text-foreground uppercase">
            Live Stream
          </h3>
          {isConnected ? (
            <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
              <span className="relative flex size-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
                <span className="relative inline-flex rounded-full size-2 bg-green-500" />
              </span>
              Live
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <WifiOff className="size-3" />
              Reconnecting…
            </span>
          )}
          {events.length > 0 && (
            <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
              {events.length} shown · {totalSeen} total scans
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {events.length > 0 && (
            <button
              onClick={onClear}
              title="Clear feed"
              className="p-1.5 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50"
            >
              <Trash2 className="size-4" />
            </button>
          )}
          <button
            onClick={onTogglePause}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50"
          >
            {isPaused ? <Play className="size-4" /> : <Pause className="size-4" />}
            {isPaused ? "Resume" : "Pause"}
          </button>
        </div>
      </div>

      {/* Paused banner */}
      {isPaused && (
        <div className="px-5 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-sm flex items-center gap-2">
          <Pause className="size-4" />
          Feed paused — new scans will appear when resumed
        </div>
      )}

      {/* Disconnected banner */}
      {!isConnected && (
        <div className="px-5 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-sm flex items-center gap-2">
          <WifiOff className="size-4" />
          Connection lost. Attempting to reconnect…
        </div>
      )}

      {/* Scan list */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="max-h-[540px] overflow-y-auto p-3 space-y-1.5 scroll-smooth"
      >
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
            <Fingerprint className="size-12 mb-3 opacity-40" />
            <p className="font-medium">Waiting for fingerprint scans…</p>
            <p className="text-sm mt-1">
              Every scan will appear here instantly as students place their
              fingers on any connected device.
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false} mode="popLayout">
            {events.map((evt) => (
              <LiveScanRow key={evt.id} event={evt} />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Scroll to top button */}
      {events.length > 10 && (
        <div className="flex justify-center py-2 border-t border-gray-200/50 dark:border-gray-700/50">
          <button
            onClick={scrollToTop}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400 transition-colors"
          >
            <ArrowUp className="size-3" />
            Scroll to latest
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// History Tab
// ---------------------------------------------------------------------------

function HistoryTab({
  events,
  total,
  page,
  totalPages,
  isLoading,
  onPageChange,
  filters,
  classes,
  teachers,
  audience,
  schoolType,
  onFilterChange,
  onReset,
}: {
  events: AttendanceEvent[];
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  onPageChange: (p: number) => void;
  filters: AttendanceListParams;
  classes: ClassResponse[];
  teachers: TeacherResponse[];
  audience: AttendanceAudience;
  schoolType: SchoolResponse["school_type"] | undefined;
  onFilterChange: (newFilters: Partial<AttendanceListParams>) => void;
  onReset: () => void;
}) {
  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      <FilterBar
        filters={filters}
        classes={classes}
        teachers={teachers}
        audience={audience}
        schoolType={schoolType}
        onFilterChange={onFilterChange}
        onReset={onReset}
      />

      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 dark:border-gray-700/50">
        {/* Summary */}
        <div className="px-5 py-4 border-b border-gray-200/50 dark:border-gray-700/50 flex justify-between items-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {total} record{total !== 1 ? "s" : ""} found
          </p>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-gray-200/50 dark:border-gray-700/50">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left border-b border-indigo-200/40 dark:border-indigo-900/50 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
                <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">Time</th>
                <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-white">{audience === "teachers" ? "Teacher" : "Student"}</th>
                <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-white hidden sm:table-cell whitespace-nowrap">
                  {audience === "teachers" ? "Employee #" : "Admission #"}
                </th>
                <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-white hidden md:table-cell">
                  {audience === "teachers" ? "Dept / class" : "Class"}
                </th>
                <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-white hidden md:table-cell">Device</th>
                <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-white">Event</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-5 py-3"><div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" /></td>
                    <td className="px-5 py-3"><div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" /></td>
                    <td className="px-5 py-3 hidden sm:table-cell"><div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" /></td>
                    <td className="px-5 py-3 hidden md:table-cell"><div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" /></td>
                    <td className="px-5 py-3 hidden md:table-cell"><div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" /></td>
                    <td className="px-5 py-3"><div className="h-4 w-10 bg-gray-200 dark:bg-gray-700 rounded" /></td>
                  </tr>
                ))
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-gray-400 dark:text-gray-500">
                    No attendance records found for the selected filters.
                  </td>
                </tr>
              ) : (
                events.map((evt) => {
                  const time = new Date(evt.occurred_at).toLocaleTimeString("en-KE", {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  });
                  return (
                    <tr
                      key={evt.id}
                      className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors"
                    >
                      <td className="px-5 py-3 text-gray-900 dark:text-gray-100 tabular-nums">{time}</td>
                      <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">
                        {audience === "teachers" ? (evt.teacher_name ?? "Unknown") : (evt.student_name ?? "Unknown")}
                      </td>
                      <td className="px-5 py-3 text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                        {audience === "teachers" ? (evt.employee_id ?? "—") : (evt.admission_number ?? "—")}
                      </td>
                      <td className="px-5 py-3 text-gray-500 dark:text-gray-400 hidden md:table-cell">
                        {audience === "teachers" ? (evt.department ?? evt.class_name ?? "—") : (evt.class_name ?? "—")}
                      </td>
                      <td className="px-5 py-3 text-gray-500 dark:text-gray-400 hidden md:table-cell">
                        {evt.device_name}
                      </td>
                      <td className="px-5 py-3">
                        <EventBadge type={evt.event_type} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200/50 dark:border-gray-700/50">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
                className="px-3 py-1 text-sm rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
                className="px-3 py-1 text-sm rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Presence Status Tab
// Derives each student's current presence from the latest IN/OUT event.
// ---------------------------------------------------------------------------

interface PresenceRecord {
  name: string;
  identifier: string | null | undefined;
  class_name: string | null | undefined;
  department: string | null | undefined;
  teacherId: number | null;
  status: "Inside" | "Outside" | "Unknown";
  lastSeen: string;
  is_boarding: boolean;
}

function PresenceStatusTab({
  token,
  audience,
  schoolType,
  teachers,
  onTeacherClick,
}: {
  token: string | null;
  audience: AttendanceAudience;
  schoolType: SchoolResponse["school_type"] | undefined;
  teachers: TeacherResponse[];
  onTeacherClick: (id: number, name: string, empId?: string) => void;
}) {
  const [records, setRecords] = useState<PresenceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [search, setSearch] = useState("");
  const [isBoardingFilter, setIsBoardingFilter] = useState<boolean | undefined>(undefined);
  const [presenceView, setPresenceView] = useState<"all" | "inside" | "outside">("all");

  const buildPresence = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const todayLocal = format(new Date(), "yyyy-MM-dd");
      const res = await listAttendance(token, {
        target_date: todayLocal,
        page_size: 500,
        page: 1,
        user_type: audience === "teachers" ? "teacher" : "student",
        is_boarding: audience === "students" ? isBoardingFilter : undefined,
      });
      // Reduce to last event per student
      const map = new Map<string, AttendanceEvent>();
      for (const evt of res.items) {
        const key =
          audience === "teachers"
            ? (evt.employee_id ?? evt.teacher_name ?? String(evt.id))
            : (evt.admission_number ?? evt.student_name ?? String(evt.id));
        if (!map.has(key)) {
          map.set(key, evt);
        } else {
          const existing = map.get(key)!;
          if (new Date(evt.occurred_at) > new Date(existing.occurred_at)) {
            map.set(key, evt);
          }
        }
      }
      const built: PresenceRecord[] = Array.from(map.values()).map((evt) => ({
        name: audience === "teachers" ? (evt.teacher_name ?? "Unknown Teacher") : (evt.student_name ?? "Unknown Student"),
        identifier: audience === "teachers" ? evt.employee_id : evt.admission_number,
        class_name: audience === "students" ? evt.class_name : null,
        department: audience === "teachers" ? (evt.department ?? null) : null,
        teacherId: audience === "teachers" ? (evt.teacher_id ?? null) : null,
        status:
          evt.event_type === "IN"
            ? "Inside"
            : evt.event_type === "OUT"
              ? "Outside"
              : "Unknown",
        lastSeen: evt.occurred_at,
        is_boarding: evt.is_boarding,
      }));
      // Sort: Inside first, then Outside, then Unknown
      const order = { Inside: 0, Outside: 1, Unknown: 2 };
      built.sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name));
      setRecords(built);
      setLastRefreshed(new Date());
    } catch {
      /* silently ignore */
    } finally {
      setIsLoading(false);
    }
  }, [token, isBoardingFilter, audience]);

  useEffect(() => {
    buildPresence();
  }, [buildPresence]);

  const filtered = records.filter((r) => {
    if (presenceView === "inside" && r.status !== "Inside") return false;
    if (presenceView === "outside" && r.status !== "Outside") return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      (r.identifier ?? "").toLowerCase().includes(q) ||
      (r.class_name ?? "").toLowerCase().includes(q) ||
      (r.department ?? "").toLowerCase().includes(q)
    );
  });

  const inside = records.filter((r) => r.status === "Inside").length;
  const outside = records.filter((r) => r.status === "Outside").length;
  const unknown = records.filter((r) => r.status === "Unknown").length;

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      {/* Summary cards + quick filter */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => setPresenceView("inside")}
          className={`text-left glass-panel shadow-sm rounded-2xl px-4 py-3.5 border transition-all bevel-sm ${
            presenceView === "inside"
              ? "ring-2 ring-green-500 border-green-500/40 bg-green-500/10"
              : "border-green-500/20 bg-green-500/5 hover:border-green-500/30"
          }`}
        >
          <div className="flex items-center gap-2">
            <UserCheck className="size-4 text-green-600 dark:text-green-400" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-green-700/60 dark:text-green-300/60">
              {audience === "teachers" ? "Teachers in" : "Students in"}
            </p>
          </div>
          <p className="text-2xl font-black text-green-700 dark:text-green-300 tabular-nums mt-1">{inside}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Tap to list only</p>
        </button>
        <button
          type="button"
          onClick={() => setPresenceView("outside")}
          className={`text-left glass-panel shadow-sm rounded-2xl px-4 py-3.5 border transition-all bevel-sm ${
            presenceView === "outside"
              ? "ring-2 ring-amber-500 border-amber-500/40 bg-amber-500/10"
              : "border-amber-500/20 bg-amber-500/5 hover:border-amber-500/30"
          }`}
        >
          <div className="flex items-center gap-2">
            <UserX className="size-4 text-amber-600 dark:text-amber-400" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700/60 dark:text-amber-300/60">
              {audience === "teachers" ? "Teachers out" : "Students out"}
            </p>
          </div>
          <p className="text-2xl font-black text-amber-700 dark:text-amber-300 tabular-nums mt-1">{outside}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Tap to list only</p>
        </button>
        <button
          type="button"
          onClick={() => setPresenceView("all")}
          className={`text-left glass-panel shadow-sm rounded-2xl px-4 py-3.5 border transition-all bevel-sm ${
            presenceView === "all"
              ? "ring-2 ring-blue-500 border-blue-500/40 bg-blue-500/5"
              : "border-white/20 bg-white/5 dark:bg-white/5 hover:border-blue-500/20"
          }`}
        >
          <div className="flex items-center gap-2">
            <UsersIcon className="size-4 text-blue-600 dark:text-blue-400" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">
              {audience === "teachers" ? "All staff today" : "Everyone today"}
            </p>
          </div>
          <p className="text-2xl font-black text-foreground tabular-nums mt-1">{records.length}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            {unknown} unknown status · tap to show all
          </p>
        </button>
      </div>

      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={audience === "teachers" ? "Search teacher, employee id…" : "Search student, adm no, class…"}
            className="pl-9 h-10 rounded-xl border-gray-200 dark:border-gray-700"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {audience === "students" && schoolType === "mixed" && (
            <Select
              value={isBoardingFilter === undefined ? "all" : isBoardingFilter.toString()}
              onValueChange={(val) => setIsBoardingFilter(val === "all" ? undefined : val === "true")}
            >
              <SelectTrigger className="w-full sm:w-[160px] h-10 rounded-xl border-gray-200 dark:border-gray-700">
                <SelectValue placeholder="Boarding / Day" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Students</SelectItem>
                <SelectItem value="true">Boarders Only</SelectItem>
                <SelectItem value="false">Day Students Only</SelectItem>
              </SelectContent>
            </Select>
          )}

          <Button
            onClick={buildPresence}
            disabled={isLoading}
            variant="outline"
            className="h-10 px-4 rounded-xl border-gray-200 dark:border-gray-700"
          >
            <RefreshCw className={`size-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
        {isLoading && records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-3" />
            <p>Loading presence data…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
            <MapPin className="size-12 mb-3 opacity-30" />
            <p className="font-medium">{audience === "teachers" ? "No teachers found" : "No students found"}</p>
            <p className="text-sm mt-1">{search ? "Try a different search term." : "No attendance data available today."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
              <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-indigo-200/40 dark:border-indigo-900/50 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 shadow-md">
                  <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-white">{audience === "teachers" ? "Teacher" : "Student"}</th>
                  <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-white">{audience === "teachers" ? "Employee #" : "Adm No."}</th>
                  <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    {audience === "teachers" ? "Department" : "Class"}
                  </th>
                  <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    {audience === "teachers" ? "Role" : "Type"}
                  </th>
                  <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-white">Status</th>
                  <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">Last seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200/60 dark:divide-gray-700/60">
                {filtered.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50/60 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">
                      {audience === "teachers" ? (
                        <button
                          type="button"
                          onClick={() => {
                            let tid = r.teacherId;
                            if (!tid && r.identifier) {
                              const t = teachers.find((x) => x.employee_id === r.identifier);
                              tid = t?.id ?? null;
                            }
                            if (tid) onTeacherClick(tid, r.name, (r.identifier as string) ?? undefined);
                          }}
                          className="text-left font-semibold text-blue-600 dark:text-blue-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:underline underline-offset-4"
                        >
                          {r.name}
                        </button>
                      ) : (
                        r.name
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400 tabular-nums">{r.identifier ?? "—"}</td>
                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400">
                      {audience === "teachers" ? (r.department ?? "—") : (r.class_name ?? "—")}
                    </td>
                    <td className="px-5 py-3">
                      {audience === "teachers" ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                          Staff
                        </span>
                      ) : (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${r.is_boarding
                          ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                          }`}>
                          {r.is_boarding ? "Boarding" : "Day"}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${r.status === "Inside"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                          : r.status === "Outside"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                          }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${r.status === "Inside" ? "bg-green-500" : r.status === "Outside" ? "bg-amber-500" : "bg-gray-400"
                          }`} />
                        {r.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400 tabular-nums text-xs">
                      {new Date(r.lastSeen).toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {lastRefreshed && (
          <div className="px-5 py-2 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-200/50 dark:border-gray-700/50 bg-gray-50/60 dark:bg-gray-700/30">
            Last refreshed: {lastRefreshed.toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true })}
            {" · "}{records.length} students tracked
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AttendancePage() {
  const { token } = useAuthStore();

  const [audience, setAudience] = useState<AttendanceAudience>("students");
  const [view, setView] = useState<AttendanceView>("details");

  // --- Tabs ---
  const [activeTab, setActiveTab] = useState<"live" | "history" | "presence">("live");

  // --- Stats ---
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [statsUpdatedAt, setStatsUpdatedAt] = useState<string | null>(null);

  // --- Live feed (purely WebSocket-driven) ---
  const [liveEvents, setLiveEvents] = useState<AttendanceEvent[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [totalSeen, setTotalSeen] = useState(0);
  const [liveCounters, setLiveCounters] = useState({
    in: 0,
    out: 0,
    duplicate: 0,
    unknown: 0,
  });
  const [lastScanAt, setLastScanAt] = useState<string | null>(null);
  const seenIdsRef = useRef(new Set<string | number>());
  const pauseBufferRef = useRef<AttendanceEvent[]>([]);

  // --- History ---
  const [historyEvents, setHistoryEvents] = useState<AttendanceEvent[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilters, setHistoryFilters] = useState<AttendanceListParams>({});

  // --- Teacher Detail Modal ---
  const [showTeacherDetail, setShowTeacherDetail] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<{ id: number | null, name: string | null, empId: string | null }>({
    id: null,
    name: null,
    empId: null
  });

  const handleTeacherClick = (id: number, name: string, empId?: string) => {
    setSelectedTeacher({ id, name, empId: empId ?? null });
    setShowTeacherDetail(true);
  };

  // Class list for filters
  const [classes, setClasses] = useState<ClassResponse[]>([]);

  const [teachers, setTeachers] = useState<TeacherResponse[]>([]);

  const [school, setSchool] = useState<SchoolResponse | null>(null);

  // ---------------------------------------------------------------
  // Fetch classes
  // ---------------------------------------------------------------
  useEffect(() => {
    if (!token) return;
    listClasses(token).then(setClasses).catch(console.error);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    getMySchool(token).then(setSchool).catch(() => { });
  }, [token]);

  useEffect(() => {
    if (!token) return;
    listTeachers(token, { page: 1, page_size: 200 }).then((r) => setTeachers(r.items)).catch(() => { });
  }, [token]);

  // ---------------------------------------------------------------
  // Fetch stats
  // ---------------------------------------------------------------
  const fetchStats = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getAttendanceStats(token, undefined, audience === "teachers" ? "teacher" : "student");
      setStats(data);
      setStatsUpdatedAt(new Date().toISOString());
    } catch (err: unknown) {
      // Handle 503 Service Unavailable (Attendance Service not running)
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosError = err as { response?: { status?: number } };
        if (axiosError.response?.status === 503) {
          // Service unavailable - silently fail (user will see empty stats)
          // The service needs to be started via start-backend-services.ps1
          if (process.env.NODE_ENV === 'development') {
            console.warn("Attendance Service is not running. Start it via start-backend-services.ps1");
          }
          return;
        }
      }
      // Only log other errors in development
      if (process.env.NODE_ENV === 'development') {
        console.error("Failed to fetch attendance stats:", err);
      }
    }
  }, [token, audience]);

  useEffect(() => {
    if (token) fetchStats();
  }, [token, fetchStats]);

  // Opening Visualize should always reflect the current Students/Teachers toggle
  useEffect(() => {
    if (token && view === "visualize") fetchStats();
  }, [token, view, fetchStats]);

  // ---------------------------------------------------------------
  // WebSocket — always connected regardless of active tab
  // ---------------------------------------------------------------
  const handleWsEvents = useCallback(
    (incoming: AttendanceEvent[]) => {
      const scoped = incoming.filter((e) =>
        audience === "teachers" ? Boolean(e.teacher_id) : Boolean(e.student_id)
      )

      // Deduplicate by ID
      const newEvents = scoped.filter((e) => !seenIdsRef.current.has(e.id));
      if (newEvents.length === 0) return;

      for (const e of newEvents) seenIdsRef.current.add(e.id);
      setTotalSeen((prev) => prev + newEvents.length);

      let inDelta = 0;
      let outDelta = 0;
      let duplicateDelta = 0;
      let unknownDelta = 0;
      let latestOccurredAt: string | null = null;
      for (const e of newEvents) {
        if (!latestOccurredAt || new Date(e.occurred_at) > new Date(latestOccurredAt)) {
          latestOccurredAt = e.occurred_at;
        }
        if (e.event_type === "IN") inDelta += 1;
        else if (e.event_type === "OUT") outDelta += 1;
        else if (e.event_type === "DUPLICATE") duplicateDelta += 1;
        else unknownDelta += 1;
      }
      setLiveCounters((prev) => ({
        in: prev.in + inDelta,
        out: prev.out + outDelta,
        duplicate: prev.duplicate + duplicateDelta,
        unknown: prev.unknown + unknownDelta,
      }));
      if (latestOccurredAt) setLastScanAt(latestOccurredAt);

      const newestFirst = [...newEvents].reverse();

      if (isPaused) {
        // Buffer events while paused — they'll be prepended on resume
        pauseBufferRef.current = [
          ...newestFirst,
          ...pauseBufferRef.current,
        ].slice(0, MAX_LIVE_EVENTS);
      } else {
        // Prepend newest events, auto-trim oldest
        setLiveEvents((prev) =>
          [...newestFirst, ...prev].slice(0, MAX_LIVE_EVENTS)
        );
      }

      // Refresh stats on new scans
      fetchStats();
    },
    [isPaused, fetchStats, audience]
  );

  const { isConnected } = useAttendanceWebSocket({
    onEvents: handleWsEvents,
    enabled: true, // Always connected
  });

  // Flush buffer when unpaused
  useEffect(() => {
    if (!isPaused && pauseBufferRef.current.length > 0) {
      const buffered = pauseBufferRef.current;
      pauseBufferRef.current = [];
      setLiveEvents((prev) =>
        [...buffered, ...prev].slice(0, MAX_LIVE_EVENTS)
      );
    }
  }, [isPaused]);

  // Clear live feed
  const handleClear = useCallback(() => {
    setLiveEvents([]);
    setTotalSeen(0);
    setLiveCounters({ in: 0, out: 0, duplicate: 0, unknown: 0 });
    setLastScanAt(null);
    seenIdsRef.current.clear();
    pauseBufferRef.current = [];
  }, []);

  // ---------------------------------------------------------------
  // Fetch history
  // ---------------------------------------------------------------
  const fetchHistory = useCallback(
    async (page: number, filters: AttendanceListParams = historyFilters) => {
      if (!token) return;
      setHistoryLoading(true);
      try {
        const res = await listAttendance(token, {
          ...filters,
          user_type: audience === "teachers" ? "teacher" : "student",
          page,
          page_size: 50,
        });
        setHistoryEvents(res.items);
        setHistoryTotal(res.total);
        setHistoryPage(res.page);
        setHistoryTotalPages(res.total_pages);
      } catch (err: unknown) {
        // Handle 503 Service Unavailable (Attendance Service not running)
        if (err && typeof err === 'object' && 'response' in err) {
          const axiosError = err as { response?: { status?: number } };
          if (axiosError.response?.status === 503) {
            // Service unavailable - set empty state
            setHistoryEvents([]);
            setHistoryTotal(0);
            if (process.env.NODE_ENV === 'development') {
              console.warn("Attendance Service is not running. Start it via start-backend-services.ps1");
            }
            return;
          }
        }
        // Only log other errors in development
        if (process.env.NODE_ENV === 'development') {
          console.error("Failed to fetch history:", err);
        }
      } finally {
        setHistoryLoading(false);
      }
    },
    [token, audience]
  );

  useEffect(() => {
    if (activeTab === "history" && token) {
      fetchHistory(1, historyFilters);
    }
  }, [activeTab, token, fetchHistory, historyFilters]);

  useEffect(() => {
    setHistoryFilters({});
    if (activeTab === "history") {
      fetchHistory(1, {});
    }
    fetchStats();
  }, [audience]);

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------

  const statCards = [
    {
      label: "Total Events",
      value: stats?.total_events ?? 0,
      icon: ClipboardCheck,
      colorClass: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
      hint: "Stored attendance records",
    },
    {
      label: "Checked In",
      value: stats?.checked_in ?? 0,
      icon: LogIn,
      colorClass: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
      hint: "Classified as IN",
    },
    {
      label: "Checked Out",
      value: stats?.checked_out ?? 0,
      icon: LogOut,
      colorClass: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
      hint: "Classified as OUT",
    },
    {
      label: "Present Rate",
      value: stats ? `${stats.present_rate}%` : "—",
      icon: BarChart3,
      colorClass: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400",
      hint: "Based on daily attendance",
    },
  ];

  return (
    <motion.main
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8"
    >
      {/* Header */}
      <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        {/* Header */}
        <div className="relative mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/20 text-white">
              <ClipboardCheck className="size-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground uppercase">
                Attendance Terminal
              </h1>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="flex items-center bg-gray-100 dark:bg-gray-700/50 rounded-xl p-1 self-start">
            <button
              onClick={() => setAudience("students")}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${audience === "students" ? "bg-white dark:bg-gray-800 text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
            >
              Students
            </button>
            <button
              onClick={() => setAudience("teachers")}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${audience === "teachers" ? "bg-white dark:bg-gray-800 text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
            >
              Teachers
            </button>
          </div>

          <Button
            variant={view === "visualize" ? "default" : "outline"}
            className="h-10 rounded-xl"
            onClick={() => setView((v) => (v === "details" ? "visualize" : "details"))}
          >
            <BarChart3 className="size-4 mr-2" />
            Visualize
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        {statCards.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </motion.div>

      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="glass-panel shadow-premium rounded-3xl border border-white/20 dark:border-white/10 p-5 bevel-sm"
      >
        <div className="flex items-center justify-between gap-3 mb-5 px-1">
          <h2 className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground opacity-70">
            Scanning Metrics
          </h2>
          <div className="flex items-center gap-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-white/40 dark:bg-black/20 px-3 py-1.5 rounded-full border border-white/10">
            <div className="flex items-center gap-1.5">
              <Clock className="size-3 text-primary" />
              Scan: <span className="text-foreground tabular-nums">
                {lastScanAt
                  ? new Date(lastScanAt).toLocaleTimeString("en-KE", {
                    hour: "numeric",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: true,
                  })
                  : "—"}
              </span>
            </div>
            <Separator orientation="vertical" className="h-2.5 opacity-20" />
            <div className="flex items-center gap-1.5">
              <RefreshCw className="size-3 text-primary" />
              Sync: <span className="text-foreground tabular-nums">
                {statsUpdatedAt
                  ? new Date(statsUpdatedAt).toLocaleTimeString("en-KE", {
                    hour: "numeric",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: true,
                  })
                  : "—"}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Live Scans", value: totalSeen, icon: Fingerprint, color: "blue" },
            { label: "Check-Ins", value: liveCounters.in, icon: LogIn, color: "green" },
            { label: "Check-Outs", value: liveCounters.out, icon: LogOut, color: "amber" },
            { label: "Duplicates", value: liveCounters.duplicate, icon: Copy, color: "purple" },
            { label: "Unknown", value: liveCounters.unknown, icon: HelpCircle, color: "gray" },
          ].map((item, i) => (
            <div key={i} className={`rounded-2xl px-4 py-3.5 border bevel-sm flex flex-col items-center text-center transition-all hover:scale-[1.02] ${item.color === 'blue' ? 'border-blue-500/20 bg-blue-500/5 text-blue-700 dark:text-blue-300' :
              item.color === 'green' ? 'border-green-500/20 bg-green-500/5 text-green-700 dark:text-green-300' :
                item.color === 'amber' ? 'border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-300' :
                  item.color === 'purple' ? 'border-purple-500/20 bg-purple-500/5 text-purple-700 dark:text-purple-300' :
                    'border-white/20 bg-white/5 dark:bg-white/5 text-foreground'
              }`}>
              <item.icon className="size-4 opacity-40 mb-2" />
              <p className="text-xl font-black tabular-nums tracking-tighter">{item.value}</p>
              <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {view === "details" && (
        <>
          {/* Tabs */}
          <div className="flex gap-6 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab("live")}
              className={`pb-3 text-sm font-medium transition-colors relative ${activeTab === "live"
                ? "text-blue-600 dark:text-blue-400"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
            >
              <span className="flex items-center gap-2">
                <Radio className="size-4" />
                Live Capture
                {liveEvents.length > 0 && activeTab !== "live" && (
                  <span className="flex size-2">
                    <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-500 opacity-75" />
                    <span className="relative inline-flex rounded-full size-2 bg-green-500" />
                  </span>
                )}
              </span>
              {activeTab === "live" && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full"
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`pb-3 text-sm font-medium transition-colors relative ${activeTab === "history"
                ? "text-blue-600 dark:text-blue-400"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
            >
              <span className="flex items-center gap-2">
                <History className="size-4" />
                Attendance History
              </span>
              {activeTab === "history" && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full"
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab("presence")}
              className={`pb-3 text-sm font-medium transition-colors relative ${activeTab === "presence"
                ? "text-blue-600 dark:text-blue-400"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
            >
              <span className="flex items-center gap-2">
                <MapPin className="size-4" />
                Presence Status
              </span>
              {activeTab === "presence" && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full"
                />
              )}
            </button>
          </div>

          {/* Tab content */}
          <AnimatePresence mode="wait">
            {activeTab === "live" ? (
              <LiveCaptureFeed
                key="live"
                events={liveEvents}
                isConnected={isConnected}
                isPaused={isPaused}
                onTogglePause={() => setIsPaused((p) => !p)}
                onClear={handleClear}
                totalSeen={totalSeen}
              />
            ) : activeTab === "history" ? (
              <HistoryTab
                key="history"
                events={historyEvents}
                total={historyTotal}
                page={historyPage}
                totalPages={historyTotalPages}
                isLoading={historyLoading}
                onPageChange={(p) => fetchHistory(p)}
                filters={historyFilters}
                classes={classes}
                teachers={teachers}
                audience={audience}
                schoolType={school?.school_type}
                onFilterChange={(newF) => {
                  const updated = { ...historyFilters, ...newF };
                  setHistoryFilters(updated);
                  fetchHistory(1, updated);
                }}
                onReset={() => {
                  setHistoryFilters({});
                  fetchHistory(1, {});
                }}
              />
            ) : (
              <PresenceStatusTab
                key="presence"
                token={token}
                audience={audience}
                schoolType={school?.school_type}
                teachers={teachers}
                onTeacherClick={handleTeacherClick}
              />
            )}
          </AnimatePresence>

          <TeacherDetailModal
            open={showTeacherDetail}
            onOpenChange={setShowTeacherDetail}
            teacherId={selectedTeacher.id}
            teacherName={selectedTeacher.name}
            employeeId={selectedTeacher.empId}
            token={token}
          />
        </>
      )}

      {view === "visualize" && (
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="rounded-2xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 p-5"
        >
          <h2 className="font-bold text-gray-900 dark:text-gray-100">
            {audience === "teachers" ? "Teacher Attendance Overview" : "Student Attendance Overview"}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Quick visual summary based on the current day’s stats.
          </p>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Primary Rate Card */}
            <div className="lg:col-span-1 glass-panel shadow-premium rounded-3xl border border-white/20 p-6 flex flex-col justify-center items-center text-center bevel-card relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:rotate-12 transition-transform duration-700">
                <BarChart3 className="size-32" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-60 mb-2">Overall Presence Rate</p>
              <div className="relative">
                <svg className="size-32 transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="58"
                    stroke="currentColor"
                    strokeWidth="10"
                    fill="transparent"
                    className="text-muted/10"
                  />
                  <motion.circle
                    cx="64"
                    cy="64"
                    r="58"
                    stroke="currentColor"
                    strokeWidth="10"
                    fill="transparent"
                    strokeDasharray={364.4}
                    initial={{ strokeDashoffset: 364.4 }}
                    animate={{ strokeDashoffset: 364.4 - (364.4 * (stats?.present_rate ?? 0)) / 100 }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    strokeLinecap="round"
                    className="text-primary"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black tabular-nums tracking-tighter">{stats ? Math.round(stats.present_rate) : "—"}%</span>
                </div>
              </div>
              <p className="text-[10px] font-bold text-muted-foreground mt-4 uppercase tracking-widest">
                {stats?.checked_in ?? 0} / {stats?.total_users ?? 0}{" "}
                {audience === "teachers" ? "teachers" : "students"} present
              </p>
            </div>

            {/* Movement Trends */}
            <div className="lg:col-span-2 glass-panel shadow-premium rounded-3xl border border-white/20 p-6 bevel-card">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-60 mb-6">Movement Analytics</p>
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-foreground">
                      <LogIn className="size-3.5 text-green-500" /> entries
                    </span>
                    <span className="text-sm font-black tabular-nums">{stats?.checked_in ?? 0}</span>
                  </div>
                  <div className="h-3 rounded-full bg-muted/10 overflow-hidden bevel-sm">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${stats?.total_users ? Math.min(100, (stats.checked_in * 100) / stats.total_users) : 0}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-green-400 to-emerald-600 shadow-glow"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-foreground">
                      <LogOut className="size-3.5 text-amber-500" /> exits
                    </span>
                    <span className="text-sm font-black tabular-nums">{stats?.checked_out ?? 0}</span>
                  </div>
                  <div className="h-3 rounded-full bg-muted/10 overflow-hidden bevel-sm">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${stats?.total_users ? Math.min(100, (stats.checked_out * 100) / stats.total_users) : 0}%` }}
                      transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                      className="h-full bg-gradient-to-r from-amber-400 to-orange-600 shadow-glow"
                    />
                  </div>
                </div>

                {audience === "students" && school?.school_type === "mixed" && (
                  <div className="pt-4 mt-6 border-t border-white/10 grid grid-cols-2 gap-8">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-60 mb-3">Boarders</p>
                      <div className="flex items-end gap-2">
                        <span className="text-2xl font-black tabular-nums">84%</span>
                        <span className="text-[10px] font-bold text-green-500 mb-1">+2.4%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-60 mb-3">Day Students</p>
                      <div className="flex items-end gap-2">
                        <span className="text-2xl font-black tabular-nums">71%</span>
                        <span className="text-[10px] font-bold text-amber-500 mb-1">-1.2%</span>
                      </div>
                    </div>
                  </div>
                )}

                {audience === "teachers" && (
                  <div className="pt-4 mt-6 border-t border-white/10">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-60 mb-4">Department Deployment</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {[
                        { name: "Science", count: 12, total: 14 },
                        { name: "Languages", count: 8, total: 10 },
                        { name: "Math", count: 9, total: 9 },
                        { name: "Hum", count: 6, total: 8 },
                      ].map((dep, i) => (
                        <div key={i} className="space-y-2">
                          <div className="flex justify-between text-[10px] font-bold uppercase">
                            <span className="text-muted-foreground">{dep.name}</span>
                            <span>{dep.count}/{dep.total}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted/10 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${(dep.count * 100) / dep.total}%` }}
                              transition={{ duration: 1, delay: i * 0.1 }}
                              className="h-full bg-primary/40"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <Button
              variant="outline"
              className="rounded-2xl h-11 px-8 font-black uppercase tracking-widest text-[10px] bevel-sm hover:bg-primary hover:text-white transition-all active:scale-95"
              onClick={() => setView("details")}
            >
              Back to Terminal
            </Button>
          </div>
        </motion.div>
      )}
    </motion.main>
  );
}

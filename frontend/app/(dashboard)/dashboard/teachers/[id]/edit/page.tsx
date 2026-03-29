"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import { useAuthStore } from "@/lib/store/authStore"
import { getTeacher, updateTeacher, type TeacherResponse, type TeacherUpdateData } from "@/lib/api/teachers"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react"
import { fadeInUp, staggerContainer, staggerItem } from "@/lib/animations/framer-motion"
import { toast } from "sonner"
import { Check, ChevronsUpDown, X, Plus, BookOpen, Briefcase, Save as SaveIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const PREDEFINED_SUBJECTS = [
  "English",
  "Kiswahili",
  "Kenya Sign Language",
  "Mathematics",
  "Integrated Science",
  "Health Education",
  "Pre-Technical Education",
  "Pre-Career Education",
  "Social Studies",
  "Religious Education (CRE/IRE/HRE)",
  "Business Studies",
  "Agriculture",
  "Life Skills Education",
  "Sports and Physical Education",
  "Music",
  "Computer Studies",
  "Home Science",
]

const DEPARTMENTS = [
  "Languages",
  "Mathematics",
  "Sciences",
  "Humanities",
  "Technical & Creative Arts",
  "Physical Education",
  "Business",
]

export default function EditTeacherPage() {
  const router = useRouter()
  const params = useParams()
  const { token } = useAuthStore()
  const teacherId = useMemo(() => {
    const raw = params.id
    const value = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined
    const parsed = value ? Number(value) : NaN
    return Number.isFinite(parsed) ? parsed : undefined
  }, [params.id])

  const [teacher, setTeacher] = useState<TeacherResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<TeacherUpdateData>({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    subject: [],
    department: "",
  })
  const [subjectOpen, setSubjectOpen] = useState(false)
  const [customSubject, setCustomSubject] = useState("")

  useEffect(() => {
    if (!token || !teacherId) return
    let cancelled = false
    setIsLoading(true)
    setError(null)
    getTeacher(token, teacherId)
      .then((t) => {
        if (!cancelled) {
          setTeacher(t)
          setForm({
            first_name: t.first_name,
            last_name: t.last_name,
            phone: t.phone,
            email: t.email ?? "",
            subject: t.subject ?? [],
            department: t.department ?? "",
          })
        }
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load teacher.")
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => { cancelled = true }
  }, [token, teacherId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !teacherId || !form.first_name?.trim() || !form.last_name?.trim() || !form.phone?.trim()) {
      setError("First name, last name, and phone are required.")
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      await updateTeacher(token, teacherId, {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim(),
        email: form.email?.trim() || undefined,
        subject: form.subject && form.subject.length > 0 ? form.subject : undefined,
        department: form.department?.trim() || undefined,
      })
      toast.success("Changes saved", {
        description: "Teacher details have been updated successfully.",
      })
      router.push(`/dashboard/teachers/${teacherId}`)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Failed to save. Please try again."
      setError(msg)
      toast.error("Could not save", { description: msg })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading || !teacher) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
        <Skeleton className="h-10 w-32 mb-6" />
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-full mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error && !teacher) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
        <Button variant="ghost" onClick={() => router.push("/dashboard/teachers")} className="mb-6">
          <ArrowLeft className="mr-2 size-4" />
          Back to Teachers
        </Button>
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="pt-6 flex items-center gap-3 text-red-700 dark:text-red-300">
            <AlertCircle className="size-5 shrink-0" />
            {error}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-400/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
      </div>

      <div className="relative z-10 p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
        <motion.div initial="hidden" animate="visible" variants={fadeInUp}>
          <Button
            variant="ghost"
            onClick={() => router.push(`/dashboard/teachers/${teacherId}`)}
            className="mb-6 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 size-4" />
            Back to Profile
          </Button>

          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                  <SaveIcon className="size-6" />
                </div>
                <div>
                  <CardTitle className="text-2xl text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                    Edit Teacher
                  </CardTitle>
                  <CardDescription>
                    Update details for {teacher.first_name} {teacher.last_name}.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
                    <AlertCircle className="size-4 shrink-0" />
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name" className="text-blue-700 dark:text-blue-400">
                      First Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="first_name"
                      value={form.first_name}
                      onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                      placeholder="e.g. James"
                      className="border-blue-300 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name" className="text-blue-700 dark:text-blue-400">
                      Last Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="last_name"
                      value={form.last_name}
                      onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                      placeholder="e.g. Kariuki"
                      className="border-blue-300 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-blue-700 dark:text-blue-400">
                    Phone Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="e.g. +254712345678"
                    className="border-blue-300 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Must be unique — no two teachers can share the same number.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-700 dark:text-gray-300">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="e.g. j.kariuki@school.ke"
                    className="border-gray-300 focus:border-purple-500 focus:ring-purple-500 dark:border-gray-600"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="subject" className="text-gray-700 dark:text-gray-300 font-bold flex items-center gap-2">
                      <BookOpen className="size-4 text-blue-500" />
                      Subjects <span className="text-muted-foreground font-normal text-xs">(Select 1-5)</span>
                    </Label>
                    <div className="flex flex-wrap gap-2 mb-2 min-h-10 p-2 rounded-xl border border-dashed border-blue-200 dark:border-blue-900/30 bg-blue-50/30 dark:bg-blue-900/10">
                      {form.subject && form.subject.length > 0 ? (
                        (form.subject as string[]).map(s => (
                          <Badge
                            key={s}
                            variant="secondary"
                            className="bg-white dark:bg-gray-800 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 pr-1 py-1 rounded-lg shadow-sm animate-in fade-in zoom-in duration-200"
                          >
                            {s}
                            <button
                              type="button"
                              onClick={() => setForm(f => ({ ...f, subject: (f.subject as string[]).filter(x => x !== s) }))}
                              className="ml-1 rounded-full p-0.5 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                            >
                              <X className="size-3" />
                            </button>
                          </Badge>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground flex items-center h-full px-2 italic">
                          No subjects assigned
                        </p>
                      )}
                    </div>
                    <Popover open={subjectOpen} onOpenChange={setSubjectOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={subjectOpen}
                          className="w-full justify-between border-blue-200 dark:border-gray-700 rounded-xl hover:bg-blue-50 dark:hover:bg-violet-900/10 transition-all font-medium h-11"
                        >
                          Select subjects...
                          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full min-w-[300px] p-0 rounded-2xl border-blue-100 shadow-2xl overflow-hidden" align="start">
                        <Command className="p-1">
                          <CommandInput placeholder="Search subjects..." className="h-10" />
                          <CommandList className="max-h-[300px]">
                            <CommandEmpty className="p-4">
                              <div className="flex flex-col items-center gap-2 text-center">
                                <p className="text-sm font-medium">Subject not found</p>
                                <div className="flex gap-2 w-full mt-2">
                                  <Input
                                    placeholder="Add custom subject..."
                                    value={customSubject}
                                    onChange={(e) => setCustomSubject(e.target.value)}
                                    className="h-9 text-xs rounded-lg"
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && customSubject.trim()) {
                                        const s = customSubject.trim()
                                        if (!(form.subject as string[])?.includes(s)) {
                                          setForm(f => ({ ...f, subject: [...(f.subject as string[]), s] }))
                                        }
                                        setCustomSubject("")
                                      }
                                    }}
                                  />
                                  <Button
                                    size="sm"
                                    className="h-9 px-3 rounded-lg"
                                    onClick={() => {
                                      if (customSubject.trim()) {
                                        const s = customSubject.trim()
                                        if (!(form.subject as string[])?.includes(s)) {
                                          setForm(f => ({ ...f, subject: [...(f.subject as string[]), s] }))
                                        }
                                        setCustomSubject("")
                                      }
                                    }}
                                  >
                                    <Plus className="size-3" />
                                  </Button>
                                </div>
                              </div>
                            </CommandEmpty>
                            <CommandGroup heading="Academic Subjects">
                              {PREDEFINED_SUBJECTS.map((s) => (
                                <CommandItem
                                  key={s}
                                  value={s}
                                  onSelect={() => {
                                    const current = (form.subject as string[]) || []
                                    if (current.includes(s)) {
                                      setForm(f => ({ ...f, subject: current.filter(x => x !== s) }))
                                    } else if (current.length < 10) {
                                      setForm(f => ({ ...f, subject: [...current, s] }))
                                    } else {
                                      toast.error("Maximum 10 subjects allowed")
                                    }
                                  }}
                                  className="rounded-lg py-2.5 px-3 cursor-pointer"
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 size-4 text-blue-600",
                                      (form.subject as string[])?.includes(s) ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <span className="font-medium">{s}</span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="department" className="text-gray-700 dark:text-gray-300 font-bold flex items-center gap-2">
                      <Briefcase className="size-4 text-blue-500" />
                      Department
                    </Label>
                    <select
                      id="department"
                      value={form.department ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                      className="flex h-11 w-full rounded-xl border border-blue-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all font-medium shadow-sm hover:border-blue-400 dark:hover:border-blue-800"
                    >
                      <option value="">Select department...</option>
                      {DEPARTMENTS.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push(`/dashboard/teachers/${teacherId}`)}
                    className="sm:min-w-[120px]"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSaving || !form.first_name?.trim() || !form.last_name?.trim() || !form.phone?.trim()}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg sm:min-w-[160px]"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <SaveIcon className="mr-2 size-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

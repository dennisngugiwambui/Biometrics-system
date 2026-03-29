"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/store/authStore"
import { createTeacher, type TeacherCreateData } from "@/lib/api/teachers"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UserPlus, ArrowLeft } from "lucide-react"
import { Loader2 } from "lucide-react"
import { fadeInUp, staggerContainer, staggerItem } from "@/lib/animations/framer-motion"
import { toast } from "sonner"
import { Check, ChevronsUpDown, X, Plus, BookOpen, GraduationCap, Briefcase, Award } from "lucide-react"
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

export default function AddTeacherPage() {
  const router = useRouter()
  const { token } = useAuthStore()
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<TeacherCreateData>({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    subject: [],
    department: "",
  })
  const [subjectOpen, setSubjectOpen] = useState(false)
  const [customSubject, setCustomSubject] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !form.first_name?.trim() || !form.last_name?.trim() || !form.phone?.trim()) {
      setError("First name, last name, and phone are required.")
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      const created = await createTeacher(token, {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim(),
        email: form.email?.trim() || undefined,
        subject: form.subject && form.subject.length > 0 ? form.subject : undefined,
        department: form.department?.trim() || undefined,
      })
      toast.success("Teacher added", {
        description: `${created.first_name} ${created.last_name} has been added successfully.`,
      })
      router.push("/dashboard/teachers")
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Failed to add teacher. Please try again."
      setError(msg)
      toast.error("Could not add teacher", { description: msg })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <motion.main
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="flex-1 page-shell"
    >
      <motion.div variants={staggerItem} className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => router.push("/dashboard/teachers")}
          className="mb-6 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 size-4" />
          Back to Teachers
        </Button>

        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 shadow-premium hover-lift overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-violet-500 via-indigo-500 to-purple-500" />
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20">
                <UserPlus className="size-6" />
              </div>
              <div>
                <CardTitle className="text-2xl text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-purple-600">
                  Add Teacher
                </CardTitle>
                <CardDescription>
                  Register a new teacher. All fields marked with * are required.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="message-box border-red-200 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-200">
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
                      <BookOpen className="size-4 text-violet-500" />
                      Subjects <span className="text-muted-foreground font-normal text-xs">(Select 1-5)</span>
                    </Label>
                    <div className="flex flex-wrap gap-2 mb-2 min-h-10 p-2 rounded-xl border border-dashed border-violet-200 dark:border-violet-900/30 bg-violet-50/30 dark:bg-violet-900/10">
                      {form.subject && form.subject.length > 0 ? (
                        form.subject.map(s => (
                          <Badge
                            key={s}
                            variant="secondary"
                            className="bg-white dark:bg-gray-800 border-violet-200 dark:border-violet-700 text-violet-700 dark:text-violet-300 pr-1 py-1 rounded-lg shadow-sm animate-in fade-in zoom-in duration-200"
                          >
                            {s}
                            <button
                              type="button"
                              onClick={() => setForm(f => ({ ...f, subject: (f.subject as string[]).filter(x => x !== s) }))}
                              className="ml-1 rounded-full p-0.5 hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors"
                            >
                              <X className="size-3" />
                            </button>
                          </Badge>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground flex items-center h-full px-2 italic">
                          No subjects selected yet
                        </p>
                      )}
                    </div>
                    <Popover open={subjectOpen} onOpenChange={setSubjectOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={subjectOpen}
                          className="w-full justify-between border-violet-200 dark:border-gray-700 rounded-xl hover:bg-violet-50 dark:hover:bg-violet-900/10 transition-all font-medium h-11"
                        >
                          Select subjects...
                          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full min-w-[300px] p-0 rounded-2xl border-violet-100 shadow-2xl overflow-hidden" align="start">
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
                                        if (!form.subject?.includes(s)) {
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
                                        if (!form.subject?.includes(s)) {
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
                                    const current = form.subject as string[]
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
                                      "mr-2 size-4 text-violet-600",
                                      form.subject?.includes(s) ? "opacity-100" : "opacity-0"
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
                      <Briefcase className="size-4 text-indigo-500" />
                      Department
                    </Label>
                    <select
                      id="department"
                      value={form.department ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                      className="flex h-11 w-full rounded-xl border border-indigo-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all font-medium shadow-sm hover:border-indigo-400 dark:hover:border-indigo-800"
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
                  onClick={() => router.push("/dashboard/teachers")}
                  className="sm:min-w-[120px]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving || !form.first_name?.trim() || !form.last_name?.trim() || !form.phone?.trim()}
                  className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg shadow-violet-500/20 sm:min-w-[160px]"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 size-4" />
                      Add Teacher
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </motion.main>
  )
}

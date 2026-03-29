"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, BookOpen, Briefcase, Plus, Check, ChevronsUpDown, Phone, Mail, User } from "lucide-react"
import type { TeacherResponse, TeacherCreateData, TeacherUpdateData } from "@/lib/api/teachers"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"

const PREDEFINED_SUBJECTS = [
  "English", "Kiswahili", "Mathematics", "Biology", "Chemistry", "Physics",
  "History", "Geography", "CRE", "IRE", "HRE", "Computer Studies",
  "Business Studies", "Agriculture", "Home Science", "Music", "Art & Design",
  "Physical Education"
]

const DEPARTMENTS = [
  "Languages", "Mathematics", "Sciences", "Humanities",
  "Technical & Applied", "Physical Education", "Special Needs"
]

interface TeacherFormModalProps {
  open: boolean
  onClose: () => void
  onSave: (data: TeacherCreateData | TeacherUpdateData) => void
  initial?: TeacherResponse | null
  isSaving: boolean
}

export function TeacherFormModal({
  open,
  onClose,
  onSave,
  initial,
  isSaving,
}: TeacherFormModalProps) {
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

  useEffect(() => {
    if (initial) {
      setForm({
        first_name: initial.first_name,
        last_name: initial.last_name,
        phone: initial.phone,
        email: initial.email ?? "",
        subject: initial.subject ?? [],
        department: initial.department ?? "",
      })
    } else {
      setForm({
        first_name: "",
        last_name: "",
        phone: "",
        email: "",
        subject: [],
        department: "",
      })
    }
  }, [initial, open])

  if (!open) return null

  const handleToggleSubject = (s: string) => {
    setForm(f => {
      const current = f.subject || []
      const exists = current.includes(s)
      return {
        ...f,
        subject: exists ? current.filter(x => x !== s) : [...current, s]
      }
    })
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-[32px] shadow-premium w-full max-w-xl border border-white/20 dark:border-white/10 overflow-hidden bevel-card"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600" />

          <div className="p-8 pb-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-glow">
                <User className="size-6" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight">
                  {initial ? "Edit Profile" : "New Teacher"}
                </h3>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground opacity-60">
                  Staff Management Core
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-3 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 transition-all active:scale-90"
            >
              <X className="size-6" />
            </button>
          </div>

          <ScrollArea className="max-h-[70vh]">
            <div className="p-8 pt-4 space-y-6">
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest opacity-70">First Name *</Label>
                  <Input
                    value={form.first_name}
                    onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                    placeholder="e.g. James"
                    className="h-12 rounded-xl bg-muted/30 border-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest opacity-70">Last Name *</Label>
                  <Input
                    value={form.last_name}
                    onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                    placeholder="e.g. Kariuki"
                    className="h-12 rounded-xl bg-muted/30 border-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest opacity-70 flex items-center gap-2">
                  <Phone className="size-3.5" /> Phone Number *
                </Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  type="tel"
                  placeholder="e.g. +254 712 345 678"
                  className="h-12 rounded-xl bg-muted/30 border-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                />
                <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tight">Required for unique system ID</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest opacity-70 flex items-center gap-2">
                  <Mail className="size-3.5" /> Email Address
                </Label>
                <Input
                  value={form.email || ""}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  type="email"
                  placeholder="e.g. j.kariuki@school.ke"
                  className="h-12 rounded-xl bg-muted/30 border-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="text-xs font-black uppercase tracking-widest opacity-70 flex items-center gap-2">
                    <BookOpen className="size-3.5" /> Subjects
                  </Label>
                  <div className="flex flex-wrap gap-2 mb-2 p-3 rounded-2xl bg-muted/20 border border-dashed border-border min-h-[50px]">
                    {form.subject && form.subject.length > 0 ? (
                      form.subject.map((s) => (
                        <Badge key={s} variant="secondary" className="pl-2 pr-1 py-1 rounded-lg bg-white dark:bg-gray-700 shadow-sm border-blue-100 group">
                          {s}
                          <button onClick={() => handleToggleSubject(s)} className="ml-1 rounded flex items-center justify-center size-4 hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors">
                            <X className="size-3" />
                          </button>
                        </Badge>
                      ))
                    ) : (
                      <span className="text-[10px] font-bold text-muted-foreground/40 uppercase items-center flex">None Assigned</span>
                    )}
                  </div>
                  <Popover open={subjectOpen} onOpenChange={setSubjectOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between h-12 rounded-2xl border-none bg-muted/30 hover:bg-muted/50 font-bold text-xs uppercase tracking-widest">
                        Manage Subjects
                        <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0 rounded-[24px] border-none shadow-premium overflow-hidden">
                      <Command className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl">
                        <CommandInput placeholder="Search catalog..." />
                        <CommandList>
                          <CommandEmpty className="p-4 flex flex-col gap-2">
                            <p className="text-xs font-bold text-muted-foreground">Not found</p>
                            <div className="flex gap-1">
                              <Input
                                placeholder="Add custom..."
                                value={customSubject}
                                onChange={(e) => setCustomSubject(e.target.value)}
                                className="h-9 text-xs rounded-xl"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && customSubject.trim()) {
                                    handleToggleSubject(customSubject.trim());
                                    setCustomSubject("");
                                  }
                                }}
                              />
                              <Button size="sm" className="h-9 w-9 rounded-xl p-0" onClick={() => { if (customSubject.trim()) { handleToggleSubject(customSubject.trim()); setCustomSubject(""); } }}>
                                <Plus className="size-4" />
                              </Button>
                            </div>
                          </CommandEmpty>
                          <CommandGroup heading="Academic Standards">
                            {PREDEFINED_SUBJECTS.map((s) => (
                              <CommandItem
                                key={s}
                                onSelect={() => handleToggleSubject(s)}
                                className="cursor-pointer font-medium m-1 rounded-xl"
                              >
                                <Check className={cn("mr-2 size-4 text-primary", form.subject?.includes(s) ? "opacity-100" : "opacity-0")} />
                                {s}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-3">
                  <Label className="text-xs font-black uppercase tracking-widest opacity-70 flex items-center gap-2">
                    <Briefcase className="size-3.5" /> Department
                  </Label>
                  <Select
                    value={form.department || ""}
                    onValueChange={(v) => setForm(f => ({ ...f, department: v }))}
                  >
                    <SelectTrigger className="h-12 rounded-2xl border-none bg-muted/30 hover:bg-muted/50 font-bold text-xs uppercase tracking-widest">
                      <SelectValue placeholder="Select Dept" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-none shadow-premium">
                      {DEPARTMENTS.map(d => (
                        <SelectItem key={d} value={d} className="rounded-xl m-1 font-medium">{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </ScrollArea>

          <div className="p-8 pt-4 flex gap-4 justify-end bg-muted/5">
            <Button
              variant="ghost"
              onClick={onClose}
              className="h-12 px-6 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-muted transition-all"
            >
              Cancel
            </Button>
            <Button
              onClick={() => onSave(form)}
              disabled={isSaving || !form.first_name || !form.last_name || !form.phone}
              className="h-12 px-10 rounded-2xl font-black text-xs uppercase tracking-[0.2em] bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-glow hover:shadow-glow-lg transition-all active:scale-95 disabled:opacity-40"
            >
              {isSaving ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                />
              ) : (
                initial ? "Update Account" : "Deploy Staff"
              )}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    HelpCircle, Mail, Phone, BookOpen, ChevronDown,
    ArrowLeft, ExternalLink, FileText, Video,
    Smartphone, ShieldCheck, Clock
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

const FAQ_ITEMS = [
    { q: "How do I enroll a student's fingerprint?", a: "Navigate to the Enrollment page, select a student, choose a device, and click 'Start Enrollment'. The system will guide you through the process." },
    { q: "What should I do if a device goes offline?", a: "Check the device's network connection and power supply. If the issue persists, use the 'Test Connection' feature in the device settings to diagnose the problem." },
    { q: "How do I sync students to a device?", a: "Go to the Devices page, select your device, and click 'Sync Students'. You can sync individual students or all students at once." },
    { q: "Can I export attendance reports?", a: "Yes! Navigate to the Attendance page and use the export feature to download reports in various formats (CSV, PDF)." },
    { q: "How do I add a new class or stream?", a: "Go to the Classes page and click 'Add Class' or 'Add Stream'. Fill in the required information and save." },
    { q: "I forgot my password, how do I reset it?", a: "Please contact your school system administrator to reset your credentials. For security reasons, biometric system passwords must be reset by an authorized admin." },
]

function FaqItem({ q, a, index }: { q: string; a: string; index: number }) {
    const [open, setOpen] = useState(false)
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
        >
            <button
                onClick={() => setOpen(!open)}
                className="w-full text-left group"
            >
                <div className="flex items-center justify-between rounded-xl border border-border/50 bg-white dark:bg-gray-800 px-5 py-4 shadow-sm hover:shadow-md transition-all duration-200">
                    <span className="font-medium text-slate-900 dark:text-white pr-4">{q}</span>
                    <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </motion.div>
                </div>
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22 }}
                        className="overflow-hidden"
                    >
                        <div className="px-5 py-4 text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 rounded-b-xl border border-t-0 border-border/50 -mt-1 leading-relaxed">
                            {a}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}

export default function SupportPage() {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8">
            <div className="max-w-4xl mx-auto space-y-8">

                {/* Navigation */}
                <div className="flex items-center justify-between">
                    <Link href="/login">
                        <Button variant="ghost" className="gap-2 text-slate-600 dark:text-slate-400">
                            <ArrowLeft className="h-4 w-4" />
                            Back to Login
                        </Button>
                    </Link>
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">System Online</span>
                    </div>
                </div>

                {/* Hero */}
                <div className="relative overflow-hidden rounded-[2rem] bg-slate-900 px-8 py-12 text-white shadow-2xl">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/20 blur-[100px] -mr-32 -mt-32" />
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                                    <HelpCircle className="h-5 w-5 text-white" />
                                </div>
                                <span className="text-xs font-black uppercase tracking-[0.2em] text-indigo-400">Support Terminal</span>
                            </div>
                            <h1 className="text-3xl md:text-5xl font-black tracking-tight">How can we help?</h1>
                            <p className="text-slate-400 text-lg max-w-md font-medium">
                                Access self-help resources or contact our technical team for immediate assistance.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 gap-3 shrink-0">
                            <Button asChild className="h-12 px-6 rounded-xl bg-white text-slate-900 hover:bg-slate-100 font-bold gap-2 shadow-lg transition-all active:scale-95">
                                <a href="mailto:dellyit001@gmail.com">
                                    <Mail className="h-4 w-4" />
                                    Email Support
                                </a>
                            </Button>
                            <Button asChild variant="outline" className="h-12 px-6 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold gap-2 transition-all active:scale-95">
                                <a href="tel:+254758024400">
                                    <Phone className="h-4 w-4" />
                                    Call Engineering
                                </a>
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Content Tabs (Simplified) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                    {/* Main FAQ Area */}
                    <div className="md:col-span-2 space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-indigo-600/10 flex items-center justify-center text-indigo-600">
                                <BookOpen className="h-4 w-4" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Frequently Asked Questions</h2>
                        </div>
                        <div className="space-y-3">
                            {FAQ_ITEMS.map((item, i) => (
                                <FaqItem key={i} q={item.q} a={item.a} index={i} />
                            ))}
                        </div>
                    </div>

                    {/* Side Resources */}
                    <div className="space-y-6">
                        <Card className="rounded-[1.5rem] bg-indigo-600 text-white border-none shadow-xl shadow-indigo-500/20 overflow-hidden relative">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <ShieldCheck className="h-16 w-16" />
                            </div>
                            <CardHeader>
                                <CardTitle className="text-lg">Admin Support</CardTitle>
                                <CardDescription className="text-indigo-100">For school administrators and technical staff.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <Clock className="h-4 w-4 shrink-0 mt-0.5 text-indigo-200" />
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-wider opacity-60">Avg. Response Time</p>
                                        <p className="text-sm font-semibold">Under 2 hours</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Smartphone className="h-4 w-4 shrink-0 mt-0.5 text-indigo-200" />
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-wider opacity-60">Technical Readiness</p>
                                        <p className="text-sm font-semibold">Remote & On-site support</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="space-y-3">
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Knowledge Hub</h3>
                            {[
                                { icon: FileText, title: "Operations Manual", href: "#" },
                                { icon: Video, title: "Training Videos", href: "#" },
                                { icon: ExternalLink, title: "System Status", href: "#" },
                            ].map((item) => (
                                <a key={item.title} href={item.href} className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-gray-800 border border-border/50 hover:border-indigo-500 transition-all group shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <item.icon className="h-4 w-4 text-slate-400 group-hover:text-indigo-500" />
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{item.title}</span>
                                    </div>
                                    <ChevronDown className="h-4 w-4 -rotate-90 text-slate-300" />
                                </a>
                            ))}
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="text-center pt-12 pb-8">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 opacity-40">
                        Institutional Academic Management Environment • Support Node
                    </p>
                </div>

            </div>
        </div>
    )
}

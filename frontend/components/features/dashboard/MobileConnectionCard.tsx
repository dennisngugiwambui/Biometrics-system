"use client"

import { useEffect, useState } from "react"
import { Smartphone, Copy, Check, Download, Share, PlusSquare, MoreVertical, CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { promptInstall, useInstallState } from "@/components/shared/PwaRegister"
import { toast } from "sonner"

/**
 * Install the system as an app (PWA). Teachers and staff open the site on
 * their phone and add it to the home screen; they sign in with the same
 * account and see the same pages their role allows here.
 */
export function MobileConnectionCard() {
    const state = useInstallState()
    const [origin, setOrigin] = useState("")
    const [copied, setCopied] = useState(false)

    useEffect(() => setOrigin(window.location.origin), [])

    const copyLink = () => {
        navigator.clipboard.writeText(origin)
        setCopied(true)
        toast.success("App link copied — share it with your staff")
        setTimeout(() => setCopied(false), 2000)
    }

    const install = async () => {
        if (await promptInstall()) toast.success("Installed — open Shulepoa from your home screen")
    }

    return (
        <Card className="relative overflow-hidden border-none shadow-lg bg-gradient-to-br from-white to-green-50/40 dark:from-gray-900 dark:to-green-900/10">
            <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
                <Smartphone size={120} className="text-green-600 rotate-12" />
            </div>

            <CardHeader>
                <div className="flex items-center gap-2 mb-1">
                    <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-700">
                        <Smartphone size={16} />
                    </div>
                    <CardTitle className="text-lg font-bold">Shulepoa App</CardTitle>
                </div>
                <CardDescription>Install on any phone — same login, same permissions</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
                <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-green-100 dark:border-green-900/20 shadow-sm">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Open on the phone</p>
                    <div className="flex items-center justify-between gap-3">
                        <code className="min-w-0 truncate text-sm font-bold text-green-700 dark:text-green-400 select-all">
                            {origin || "…"}
                        </code>
                        <Button variant="ghost" size="icon" aria-label="Copy app link"
                            className="h-8 w-8 shrink-0 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30" onClick={copyLink}>
                            {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    {state === "installed" ? (
                        <div className="flex items-center justify-center gap-2 rounded-xl bg-green-50 text-sm font-semibold text-green-700 dark:bg-green-900/20">
                            <CheckCircle2 size={16} /> Installed
                        </div>
                    ) : state === "available" ? (
                        <Button onClick={install} className="w-full bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-md border-none">
                            <Download size={16} className="mr-2" /> Install app
                        </Button>
                    ) : (
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button className="w-full bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-md border-none">
                                    <Download size={16} className="mr-2" /> Get App
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-lg">
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2">
                                        <Smartphone size={18} className="text-green-600" /> Install Shulepoa on a phone
                                    </DialogTitle>
                                    <DialogDescription>
                                        No download from a store. Open <span className="font-semibold text-gray-900 dark:text-white">{origin}</span> on
                                        the phone, add it to the home screen, then sign in with the same account used here.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <Steps title="Android (Chrome)" steps={[
                                        { icon: <MoreVertical size={15} />, text: "Tap the ⋮ menu" },
                                        { icon: <Download size={15} />, text: "Tap “Install app” (or “Add to Home screen”)" },
                                        { icon: <Smartphone size={15} />, text: "Open Shulepoa from the home screen" },
                                    ]} />
                                    <Steps title="iPhone (Safari)" steps={[
                                        { icon: <Share size={15} />, text: "Tap the Share button" },
                                        { icon: <PlusSquare size={15} />, text: "Tap “Add to Home Screen”" },
                                        { icon: <Smartphone size={15} />, text: "Open Shulepoa from the home screen" },
                                    ]} />
                                </div>
                                <p className="text-xs text-gray-500">
                                    Each person only sees the pages their account is allowed — the app and this website are the same system.
                                </p>
                            </DialogContent>
                        </Dialog>
                    )}

                    <Button variant="outline" className="w-full rounded-xl border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/20" onClick={copyLink}>
                        {copied ? <Check size={16} className="mr-2 text-green-600" /> : <Copy size={16} className="mr-2" />}
                        Copy link
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

function Steps({ title, steps }: { title: string; steps: { icon: React.ReactNode; text: string }[] }) {
    return (
        <div className="rounded-xl border border-gray-100 p-4 dark:border-gray-800">
            <p className="mb-3 text-sm font-bold text-gray-900 dark:text-white">{title}</p>
            <ol className="space-y-2.5">
                {steps.map((s, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-gray-300">
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-700 dark:bg-green-900/30">
                            {s.icon}
                        </span>
                        {s.text}
                    </li>
                ))}
            </ol>
        </div>
    )
}

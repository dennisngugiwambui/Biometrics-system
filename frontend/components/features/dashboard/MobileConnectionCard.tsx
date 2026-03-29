"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Smartphone, Copy, Check, Download, Info, ExternalLink, ShieldCheck, Zap } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog"
import { getSystemInfo } from "@/lib/api/system"
import { useAuthStore } from "@/lib/store/authStore"
import { toast } from "sonner"

export function MobileConnectionCard() {
    const { token } = useAuthStore()
    const [ip, setIp] = useState<string>("Detecting...")
    const [copied, setCopied] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            if (!token) return
            try {
                const info = await getSystemInfo(token)
                setIp(info.internal_ip)
            } catch (err) {
                setIp(window.location.hostname)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [token])

    const copyToClipboard = () => {
        const url = `http://${ip}:8000`
        navigator.clipboard.writeText(url)
        setCopied(true)
        toast.success("Connection URL copied to clipboard")
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <Card className="relative overflow-hidden border-none shadow-lg bg-gradient-to-br from-white to-blue-50/30 dark:from-gray-900 dark:to-blue-900/10">
            <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
                <Smartphone size={120} className="text-blue-600 rotate-12" />
            </div>

            <CardHeader>
                <div className="flex items-center gap-2 mb-1">
                    <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600">
                        <Smartphone size={16} />
                    </div>
                    <CardTitle className="text-lg font-bold">Mobile App Setup</CardTitle>
                </div>
                <CardDescription>Connect teachers to the system via mobile</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
                <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-blue-100 dark:border-blue-900/20 shadow-sm">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Server Connection URL</p>
                    <div className="flex items-center justify-between gap-3">
                        <code className="text-sm font-bold text-blue-600 dark:text-blue-400 select-all">
                            {loading ? "Loading..." : `http://${ip}:8000`}
                        </code>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30"
                            onClick={copyToClipboard}
                        >
                            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md border-none group">
                                <Download size={16} className="mr-2 group-hover:animate-bounce" />
                                Get App
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-2xl bg-white dark:bg-gray-900 border-none shadow-2xl p-0 overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-white">
                                <DialogHeader>
                                    <DialogTitle className="text-2xl font-bold flex items-center gap-3 text-white">
                                        <Smartphone className="animate-pulse" />
                                        Mobile App Setup Guide
                                    </DialogTitle>
                                    <DialogDescription className="text-blue-100 text-base mt-2">
                                        Follow these simple steps to start tracking attendance on your phone.
                                    </DialogDescription>
                                </DialogHeader>
                            </div>

                            <div className="p-8 space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <InstructionStep
                                        number="1"
                                        icon={<Download size={20} />}
                                        title="Download"
                                        desc="Download the APK from the link below and install it on your Android device."
                                    />
                                    <InstructionStep
                                        number="2"
                                        icon={<Zap size={20} />}
                                        title="Configure"
                                        desc="Open the app and paste the Server URL shown on your dashboard."
                                    />
                                    <InstructionStep
                                        number="3"
                                        icon={<ShieldCheck size={20} />}
                                        title="Login"
                                        desc="Use your teacher credentials to securely sign in and start tracking."
                                    />
                                </div>

                                <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                                    <h4 className="font-bold flex items-center gap-2 mb-4 text-blue-900 dark:text-blue-100">
                                        <Info size={18} />
                                        Configuration Details
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <p className="text-xs text-blue-600 font-medium uppercase tracking-wider">Server Address</p>
                                            <p className="font-mono text-sm font-bold select-all">http://{ip}:8000</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-xs text-blue-600 font-medium uppercase tracking-wider">Requirements</p>
                                            <p className="text-sm">Android 8.0 or higher</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-4">
                                    <Button className="flex-1 h-14 bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-lg transition-all rounded-2xl text-white font-bold text-lg gap-2">
                                        <Download size={20} />
                                        Download APK
                                    </Button>
                                    <Button variant="outline" className="flex-1 h-14 rounded-2xl font-bold gap-2" onClick={copyToClipboard}>
                                        {copied ? <Check size={20} className="text-green-500" /> : <Copy size={20} />}
                                        Copy URL
                                    </Button>
                                </div>
                            </div>

                            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 text-center border-t border-gray-100 dark:border-gray-800">
                                <p className="text-xs text-gray-500">
                                    Need help? Contact technical support at support@pixel-solutions.co.ke
                                </p>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Button variant="outline" className="w-full rounded-xl border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20" onClick={copyToClipboard}>
                        {copied ? <Check size={16} className="mr-2 text-green-500" /> : <Copy size={16} className="mr-2" />}
                        Copy URL
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

function InstructionStep({ number, icon, title, desc }: { number: string; icon: React.ReactNode; title: string; desc: string }) {
    return (
        <div className="space-y-3 relative group">
            <div className="absolute -top-3 -right-3 text-4xl font-black text-blue-600/5 pointer-events-none group-hover:text-blue-600/10 transition-colors">
                {number}
            </div>
            <div className="h-12 w-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                {icon}
            </div>
            <h5 className="font-bold text-gray-900 dark:text-white">{title}</h5>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                {desc}
            </p>
        </div>
    )
}

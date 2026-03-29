"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Loader2,
  Network,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Server,
  Router,
  Cpu,
  ArrowRight,
  AlertCircle,
} from "lucide-react"
import { fadeInUp } from "@/lib/animations/framer-motion"
import {
  fetchNetworkSetupHints,
  type DeviceNetworkSetupHintsResponse,
} from "@/lib/api/devices"
import type { UseFormSetValue } from "react-hook-form"
import type { DeviceFormData, DeviceUpdateFormData } from "@/lib/validations/device"

interface DeviceNetworkSetupCardProps {
  token: string
  setValue: UseFormSetValue<DeviceFormData | DeviceUpdateFormData>
}

/**
 * Professional LAN / K40 Ethernet assistant: loads server-derived hints and applies suggested IP to the form.
 */
export function DeviceNetworkSetupCard({ token, setValue }: DeviceNetworkSetupCardProps) {
  const [hints, setHints] = useState<DeviceNetworkSetupHintsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(true)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchNetworkSetupHints(token)
      setHints(data)
      setOpen(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load network suggestions")
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="relative overflow-hidden rounded-2xl border border-gray-200/50 dark:border-gray-700/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-lg shadow-blue-500/5"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 pointer-events-none" />
      <div className="relative p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/25">
                <Network className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                  Network setup assistant
                </h3>
                <p className="text-xs text-muted-foreground max-w-xl">
                  Suggested values for your ZKTeco terminal (K40). The device must use its own IP — never your PC&apos;s
                  ipconfig address.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-blue-300 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
              disabled={loading}
              onClick={load}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scanning…
                </>
              ) : (
                <>
                  <Server className="mr-2 h-4 w-4" />
                  Get suggestions
                </>
              )}
            </Button>
            {hints && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => setOpen((o) => !o)}
              >
                {open ? (
                  <>
                    <ChevronUp className="mr-1 h-4 w-4" />
                    Collapse
                  </>
                ) : (
                  <>
                    <ChevronDown className="mr-1 h-4 w-4" />
                    Expand
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="border-red-300 bg-red-50/90 dark:bg-red-950/30">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <AnimatePresence initial={false}>
          {hints && open && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-4 overflow-hidden"
            >
              {hints.warnings.length > 0 && (
                <Alert className="border-yellow-300 bg-yellow-50/90 dark:bg-yellow-950/25 dark:border-yellow-700">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-900 dark:text-yellow-100 text-sm">
                    <ul className="list-disc pl-4 space-y-1">
                      {hints.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {hints.registered_device_ips.length > 0 && (
                <div className="rounded-xl border border-indigo-200/50 dark:border-indigo-800/40 bg-indigo-50/40 dark:bg-indigo-950/20 px-4 py-3">
                  <p className="text-xs font-medium text-indigo-800 dark:text-indigo-200 mb-2">
                    IPs already registered for devices in your school (skipped when suggesting a new terminal)
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {hints.registered_device_ips.map((ip) => (
                      <Badge
                        key={ip}
                        variant="secondary"
                        className="font-mono text-[10px] bg-white/80 dark:bg-gray-900/80 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800"
                      >
                        {ip}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-gray-200/50 dark:border-gray-700/50 bg-white/50 dark:bg-gray-900/30 px-4 py-3">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-medium text-blue-700 dark:text-blue-400">On the terminal:</span>{" "}
                  {hints.menu_path}. TCP port{" "}
                  <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">{hints.tcp_port}</span>.
                </p>
                <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                  {hints.instructions.map((line) => (
                    <li key={line} className="flex gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600 mt-0.5" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Separator className="bg-gray-200/60 dark:bg-gray-700/60" />

              {hints.subnets.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Suggested configuration rows
                  </p>
                  {hints.subnets.map((row) => (
                    <div
                      key={`${row.your_pc_or_server_ip}-${row.suggested_k40_ip}`}
                      className="rounded-xl border border-gray-200/50 dark:border-gray-700/50 p-4 bg-gradient-to-r from-gray-50/80 to-blue-50/30 dark:from-gray-900/40 dark:to-blue-950/20"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                        <div className="space-y-1">
                          <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-muted-foreground">
                            <Server className="h-3 w-3" /> Server / PC (reference)
                          </span>
                          <p className="font-mono text-gray-900 dark:text-gray-100">{row.your_pc_or_server_ip}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-muted-foreground">
                            <Router className="h-3 w-3" /> Gateway · Mask · DNS
                          </span>
                          <p className="font-mono text-xs text-gray-700 dark:text-gray-300">
                            {row.suggested_gateway} · {row.subnet_mask}
                          </p>
                          <p className="font-mono text-xs text-gray-600 dark:text-gray-400">DNS: {row.dns_suggestion}</p>
                        </div>
                        <div className="space-y-1 sm:col-span-2 lg:col-span-1">
                          <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-green-700 dark:text-green-400">
                            <Cpu className="h-3 w-3" /> Set this IP on the K40
                          </span>
                          <p className="font-mono text-lg font-bold text-green-700 dark:text-green-400">
                            {row.suggested_k40_ip}
                          </p>
                        </div>
                        <div className="flex items-end sm:col-span-2 lg:col-span-1">
                          <Button
                            type="button"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20"
                            onClick={() => {
                              setValue("ip_address", row.suggested_k40_ip, { shouldValidate: true })
                              setValue("port", hints.tcp_port, { shouldValidate: true })
                            }}
                          >
                            Apply to form
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No private LAN IPv4 was detected on the server. Use{" "}
                  <span className="font-mono text-xs">ipconfig</span> on the PC that shares the router with the K40 and
                  pick a free address on the same subnet.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

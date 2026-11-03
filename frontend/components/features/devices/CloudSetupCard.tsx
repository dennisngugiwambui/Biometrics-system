"use client"

import { useEffect, useState } from "react"
import { Check, Copy, Globe, Loader2, Radio } from "lucide-react"
import { getCloudSetup, type CloudSetup } from "@/lib/api/devices"

/**
 * Cloud connection: the device calls this system over the internet, so it works
 * from any school network — no port forwarding, no fixed IP. Shows what to enter
 * on the device and lists devices already calling in that are not added yet.
 */
export function CloudSetupCard({ token, onPickSerial }: { token: string; onPickSerial: (serial: string) => void }) {
  const [setup, setSetup] = useState<CloudSetup | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    const load = () => getCloudSetup(token).then((s) => alive && setSetup(s)).catch(() => {})
    load()
    // New devices appear here within seconds of being pointed at the server.
    const t = setInterval(load, 8000)
    return () => { alive = false; clearInterval(t) }
  }, [token])

  const address = setup?.server_address || (typeof window !== "undefined" ? window.location.hostname : "")

  return (
    <div className="space-y-4 rounded-xl border border-green-200 bg-green-50/50 p-4 dark:border-green-900/40 dark:bg-green-950/10">
      <div className="flex items-start gap-3">
        <Globe className="mt-0.5 h-5 w-5 shrink-0 text-green-700" />
        <div className="min-w-0 text-sm">
          <p className="font-semibold text-gray-900 dark:text-white">On the device</p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-gray-600 dark:text-gray-300">
            <li>Connect it to the school internet (LAN cable or Wi-Fi).</li>
            <li>Open <b>Menu → Comm → Cloud Server Setting</b>.</li>
            <li>
              Server address <code className="rounded bg-white px-1.5 py-0.5 font-mono text-green-800 ring-1 ring-green-200 dark:bg-gray-900">{address}</code>
              <button type="button" aria-label="Copy server address"
                onClick={() => { navigator.clipboard.writeText(address); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
                className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded text-gray-500 hover:bg-green-100 align-middle">
                {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
              , port <b>80</b>, HTTPS / proxy <b>off</b>.
            </li>
            <li>Enter the device&apos;s serial number below (it is under <b>Menu → System Info → Device Info</b>).</li>
          </ol>
          <p className="mt-2 text-xs text-gray-500">
            Works from any network — no port forwarding or fixed IP. Punches reach this system the moment they happen;
            if the internet drops, the device keeps them and sends them when it is back.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-green-100 bg-white p-3 dark:border-green-900/30 dark:bg-gray-900">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          <Radio className="h-3.5 w-3.5 text-green-600" /> Devices calling in, not added yet
        </p>
        {!setup ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />Looking…</p>
        ) : setup.unclaimed.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">None yet. Once the device is set up as above it appears here within a few seconds.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {setup.unclaimed.map((d) => (
              <li key={d.serial}>
                <button type="button" onClick={() => onPickSerial(d.serial)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2 text-left text-sm hover:border-green-400 hover:bg-green-50 dark:border-gray-700">
                  <span className="font-mono font-semibold">{d.serial}</span>
                  <span className="text-xs text-gray-500">
                    {d.same_network ? "on your network · " : ""}{d.firmware || "ZKTeco"} · tap to use
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

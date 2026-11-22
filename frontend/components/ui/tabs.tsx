"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface TabsContextProps {
    value: string
    onValueChange: (value: string) => void
}

const TabsContext = React.createContext<TabsContextProps | undefined>(undefined)

export function Tabs({
    value,
    onValueChange,
    children,
    className,
}: {
    value: string
    onValueChange: (value: string) => void
    children: React.ReactNode
    className?: string
}) {
    return (
        <TabsContext.Provider value={{ value, onValueChange }}>
            <div className={cn("w-full", className)}>{children}</div>
        </TabsContext.Provider>
    )
}

export function TabsList({
    children,
    className,
}: {
    children: React.ReactNode
    className?: string
}) {
    return (
        <div
            className={cn(
                "inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-100/80 p-1 text-slate-500",
                className
            )}
        >
            {children}
        </div>
    )
}

export function TabsTrigger({
    value,
    children,
    className,
}: {
    value: string
    children: React.ReactNode
    className?: string
}) {
    const context = React.useContext(TabsContext)
    if (!context) throw new Error("TabsTrigger must be used within Tabs")

    const isActive = context.value === value

    return (
        <button
            type="button"
            onClick={() => context.onValueChange(value)}
            className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
                isActive
                    ? "bg-white text-primary shadow-[var(--shadow-key-2)]"
                    : "hover:bg-white/60 hover:text-slate-900",
                className
            )}
        >
            {children}
        </button>
    )
}

export function TabsContent({
    value,
    children,
    className,
}: {
    value: string
    children: React.ReactNode
    className?: string
}) {
    const context = React.useContext(TabsContext)
    if (!context) throw new Error("TabsContent must be used within Tabs")

    if (context.value !== value) return null

    return (
        <div className={cn("mt-2 ring-offset-background", className)}>
            {children}
        </div>
    )
}

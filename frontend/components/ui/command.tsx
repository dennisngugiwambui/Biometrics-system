"use client"

import * as React from "react"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent } from "@/components/ui/dialog"

/**
 * A simplified, custom implementation of the Command component 
 * that doesn't depend on the 'cmdk' package, to avoid installation issues.
 */

const CommandContext = React.createContext<{
    search: string
    setSearch: (v: string) => void
}>({ search: "", setSearch: () => { } })

const Command = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
    const [search, setSearch] = React.useState("")
    return (
        <CommandContext.Provider value={{ search, setSearch }}>
            <div
                ref={ref}
                className={cn(
                    "flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
                    className
                )}
                {...props}
            >
                {children}
            </div>
        </CommandContext.Provider>
    )
})
Command.displayName = "Command"

const CommandInput = React.forwardRef<
    HTMLInputElement,
    React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
    const { setSearch } = React.useContext(CommandContext)
    return (
        <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
                ref={ref}
                className={cn(
                    "flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
                    className
                )}
                onChange={(e) => {
                    setSearch(e.target.value)
                    props.onChange?.(e)
                }}
                {...props}
            />
        </div>
    )
})
CommandInput.displayName = "CommandInput"

const CommandList = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("max-h-[300px] overflow-y-auto overflow-x-hidden", className)}
        {...props}
    />
))
CommandList.displayName = "CommandList"

const CommandEmpty = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
    const { search } = React.useContext(CommandContext)
    // This is a simplified "empty" logic. In reality, cmdk handles visibility.
    // We'll just provide the component for now.
    return (
        <div
            ref={ref}
            className={cn("py-6 text-center text-sm", className)}
            {...props}
        />
    )
})
CommandEmpty.displayName = "CommandEmpty"

const CommandGroup = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { heading?: string }
>(({ className, heading, children, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "overflow-hidden p-1 text-foreground",
            className
        )}
        {...props}
    >
        {heading && (
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                {heading}
            </div>
        )}
        {children}
    </div>
)
)
CommandGroup.displayName = "CommandGroup"

const CommandItem = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { value?: string, onSelect?: (v: string) => void }
>(({ className, value, onSelect, ...props }, ref) => {
    const { search } = React.useContext(CommandContext)

    // Basic filtering logic
    const isVisible = React.useMemo(() => {
        if (!search) return true
        const target = value || (typeof props.children === 'string' ? props.children : '')
        return target.toLowerCase().includes(search.toLowerCase())
    }, [search, value, props.children])

    if (!isVisible) return null

    return (
        <div
            ref={ref}
            className={cn(
                "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
                className
            )}
            onClick={() => onSelect?.(value || "")}
            {...props}
        />
    )
})
CommandItem.displayName = "CommandItem"

const CommandSeparator = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("-mx-1 h-px bg-border", className)}
        {...props}
    />
))
CommandSeparator.displayName = "CommandSeparator"

export {
    Command,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandSeparator,
}

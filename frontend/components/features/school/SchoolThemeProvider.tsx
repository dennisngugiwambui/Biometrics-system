"use client"

/**
 * SchoolThemeProvider
 *
 * Reads the school branding store and:
 * 1. Derives CSS custom property overrides from the chosen colors
 * 2. Injects them as a <style> tag into :root
 * 3. Updates the document title to the school name
 * 4. Updates the favicon to the school logo
 */

import { useEffect } from "react"
import { useSchoolBrandingStore } from "@/lib/store/schoolBrandingStore"

// ---------------------------------------------------------------------------
// Color utility helpers
// ---------------------------------------------------------------------------

/** Parse a hex color to [r, g, b] 0-255 */
function hexToRgb(hex: string): [number, number, number] {
    const clean = hex.replace("#", "")
    const r = parseInt(clean.substring(0, 2), 16)
    const g = parseInt(clean.substring(2, 4), 16)
    const b = parseInt(clean.substring(4, 6), 16)
    return [r, g, b]
}

/** Convert [r,g,b] to hex string */
function rgbToHex(r: number, g: number, b: number): string {
    return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")
}

/** Lighten (positive amount) or darken (negative amount) a hex color */
function adjustColor(hex: string, amount: number): string {
    const [r, g, b] = hexToRgb(hex)
    return rgbToHex(r + amount, g + amount, b + amount)
}

/** Calculate relative luminance for contrast checking */
function luminance(hex: string): number {
    const [r, g, b] = hexToRgb(hex).map((v) => {
        const c = v / 255
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Returns white or black depending on which has higher contrast */
function getContrastForeground(hex: string): string {
    const L = luminance(hex)
    return L > 0.179 ? "#0f172a" : "#ffffff"
}

/** Convert hex to oklch approximation for Tailwind CSS vars */
function hexToOklchApprox(hex: string): string {
    const [r, g, b] = hexToRgb(hex).map((v) => v / 255)
    // Simple approximation — good enough for CSS custom properties
    const L = 0.2126 * r + 0.7152 * g + 0.0722 * b
    const lightness = Math.cbrt(L) * 0.85 + 0.08
    // Estimate chroma from color saturation
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const chroma = ((max - min) / 2) * 0.4
    // Estimate hue angle
    let hue = 0
    if (max !== min) {
        if (max === r) hue = ((g - b) / (max - min)) * 60
        else if (max === g) hue = (2 + (b - r) / (max - min)) * 60
        else hue = (4 + (r - g) / (max - min)) * 60
        if (hue < 0) hue += 360
    }
    return `oklch(${lightness.toFixed(3)} ${chroma.toFixed(3)} ${hue.toFixed(1)})`
}

/** Build CSS variables from the 3-5 chosen colors */
function buildCssVariables(colors: string[]): string {
    const [primary, secondary = colors[0], accent = colors[0], success = colors[0], warning = colors[0]] = colors

    const primaryFg = getContrastForeground(primary)
    const secondaryFg = getContrastForeground(secondary)

    const sidebarBg = adjustColor(primary, -40)
    const sidebarFg = getContrastForeground(sidebarBg)
    const sidebarAccent = adjustColor(primary, -20)
    const sidebarAccentFg = getContrastForeground(sidebarAccent)
    const sidebarPrimaryFg = getContrastForeground(primary)

    const gradientFrom = hexToOklchApprox(adjustColor(accent, 60))
    const gradientVia = hexToOklchApprox(adjustColor(accent, 80))

    return `
  :root {
    --primary: ${hexToOklchApprox(primary)};
    --primary-foreground: ${hexToOklchApprox(primaryFg)};
    --secondary: ${hexToOklchApprox(secondary)};
    --secondary-foreground: ${hexToOklchApprox(secondaryFg)};
    --accent: ${hexToOklchApprox(accent)};
    --accent-foreground: ${hexToOklchApprox(getContrastForeground(accent))};
    --ring: ${hexToOklchApprox(adjustColor(primary, 20))};
    --sidebar: ${hexToOklchApprox(sidebarBg)};
    --sidebar-foreground: ${hexToOklchApprox(sidebarFg)};
    --sidebar-primary: ${hexToOklchApprox(primary)};
    --sidebar-primary-foreground: ${hexToOklchApprox(sidebarPrimaryFg)};
    --sidebar-accent: ${hexToOklchApprox(sidebarAccent)};
    --sidebar-accent-foreground: ${hexToOklchApprox(sidebarAccentFg)};
    --sidebar-border: ${hexToOklchApprox(adjustColor(sidebarBg, 15))};
    --chart-1: ${hexToOklchApprox(primary)};
    --chart-2: ${hexToOklchApprox(secondary)};
    --chart-3: ${hexToOklchApprox(accent)};
    --chart-4: ${hexToOklchApprox(success)};
    --chart-5: ${hexToOklchApprox(warning)};
    --school-gradient-from: ${gradientFrom};
    --school-gradient-via: ${gradientVia};
  }
  .school-gradient-bg {
    background: linear-gradient(135deg, ${primary}22, ${secondary}15, ${accent}10) !important;
  }
  `
}

/** Update the browser favicon dynamically.
 * Removes ALL existing icon links and inserts a fresh one to avoid
 * Next.js caching the old favicon.ico path.
 */
function updateFavicon(dataUrl: string) {
    if (typeof document === "undefined") return
    // Remove all existing icon links
    const existing = document.querySelectorAll<HTMLLinkElement>("link[rel*='icon']")
    existing.forEach((el) => el.parentNode?.removeChild(el))
    // Insert fresh favicon link
    const link = document.createElement("link")
    link.rel = "icon"
    link.type = "image/png"
    link.href = dataUrl
    document.head.appendChild(link)
}

/** Reset favicon to default */
function resetFavicon() {
    if (typeof document === "undefined") return
    const existing = document.querySelectorAll<HTMLLinkElement>("link[rel*='icon']")
    existing.forEach((el) => el.parentNode?.removeChild(el))
    const link = document.createElement("link")
    link.rel = "icon"
    link.href = "/favicon.ico"
    document.head.appendChild(link)
}

// ---------------------------------------------------------------------------
// Provider component
// ---------------------------------------------------------------------------

interface SchoolThemeProviderProps {
    children: React.ReactNode
}

export function SchoolThemeProvider({ children }: SchoolThemeProviderProps) {
    const { colors, schoolName, logoDataUrl } = useSchoolBrandingStore()

    // Inject CSS variables whenever colors change
    useEffect(() => {
        if (typeof document === "undefined") return
        const styleId = "school-theme-vars"
        let styleEl = document.getElementById(styleId) as HTMLStyleElement | null
        if (!styleEl) {
            styleEl = document.createElement("style")
            styleEl.id = styleId
            document.head.appendChild(styleEl)
        }
        styleEl.textContent = buildCssVariables(colors)
    }, [colors])

    // Update document title with school name — always set if name is non-empty
    useEffect(() => {
        if (typeof document === "undefined") return
        const name = schoolName && schoolName !== "SchoolAdmin" ? schoolName : null
        if (name) {
            document.title = `${name} – Biometric System`
        }
    }, [schoolName])

    // Update favicon with school logo — run after mount so DOM is ready
    useEffect(() => {
        if (logoDataUrl) {
            updateFavicon(logoDataUrl)
        } else {
            resetFavicon()
        }
    }, [logoDataUrl])

    return <>{children}</>
}

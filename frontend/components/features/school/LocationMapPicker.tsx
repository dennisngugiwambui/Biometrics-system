"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { MapPin, Loader2, Search } from "lucide-react"

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

interface LocationMapPickerProps {
  /** Initial center [lat, lng] */
  initialCenter?: [number, number] | null
  /** Called when user clicks "Use this location" with lat, lng, and optional address */
  onUseLocation: (lat: number, lng: number, address?: string | null) => void
  disabled?: boolean
  /** Optional class for the container */
  className?: string
}

export function LocationMapPicker({
  initialCenter,
  onUseLocation,
  disabled = false,
  className = "",
}: LocationMapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<{
    map: { remove: () => void; setView: (center: [number, number], zoom: number) => void; getZoom: () => number }
    marker: { setLatLng: (latlng: [number, number]) => void }
    setView: (lat: number, lng: number) => void
    setMarker: (lat: number, lng: number) => void
  } | null>(null)
  const [mounted, setMounted] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searching, setSearching] = useState(false)
  const [selectedLat, setSelectedLat] = useState<number | null>(null)
  const [selectedLng, setSelectedLng] = useState<number | null>(null)
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null)

  const defaultCenter: [number, number] = initialCenter ?? [-1.286389, 36.817223]

  const initMap = useCallback(() => {
    if (!containerRef.current || typeof window === "undefined") return
    void import("leaflet").then((L) => {
      void import("leaflet/dist/leaflet.css")
      const Lib = L.default

      const map = Lib.map(containerRef.current!).setView(defaultCenter, 14)
      Lib.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }).addTo(map)

      const icon = Lib.icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
      })
      const marker = Lib.marker(defaultCenter, { icon }).addTo(map)

      map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        const { lat, lng } = e.latlng
        marker.setLatLng([lat, lng])
        setSelectedLat(lat)
        setSelectedLng(lng)
        setSelectedAddress(null)
      })

      const setView = (lat: number, lng: number) => {
        map.setView([lat, lng], map.getZoom())
        marker.setLatLng([lat, lng])
      }
      const setMarker = (lat: number, lng: number) => {
        marker.setLatLng([lat, lng])
        map.setView([lat, lng], map.getZoom())
      }

      mapRef.current = { map, marker, setView, setMarker }
      setSelectedLat(defaultCenter[0])
      setSelectedLng(defaultCenter[1])
      setMounted(true)
    })
  }, [defaultCenter[0], defaultCenter[1]])

  useEffect(() => {
    initMap()
    return () => {
      mapRef.current?.map.remove()
      mapRef.current = null
    }
  }, [initMap])

  useEffect(() => {
    if (!mapRef.current || !initialCenter) return
    mapRef.current.setView(initialCenter[0], initialCenter[1])
    setSelectedLat(initialCenter[0])
    setSelectedLng(initialCenter[1])
  }, [initialCenter?.[0], initialCenter?.[1]])

  const handleSearch = async () => {
    const q = searchQuery.trim()
    if (!q || searching) return
    setSearching(true)
    try {
      const params = new URLSearchParams({
        q,
        format: "json",
        limit: "1",
      })
      const res = await fetch(`${NOMINATIM_URL}?${params}`, {
        headers: { Accept: "application/json" },
      })
      const data = await res.json()
      if (data?.[0]) {
        const { lat, lon, display_name } = data[0]
        const latN = parseFloat(lat)
        const lngN = parseFloat(lon)
        mapRef.current?.setMarker(latN, lngN)
        setSelectedLat(latN)
        setSelectedLng(lngN)
        setSelectedAddress(display_name ?? null)
      }
    } catch {
      setSelectedAddress(null)
    } finally {
      setSearching(false)
    }
  }

  const handleUseLocation = () => {
    if (selectedLat != null && selectedLng != null) {
      onUseLocation(selectedLat, selectedLng, selectedAddress ?? undefined)
    }
  }

  return (
    <div className={className}>
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search for a place (e.g. Bridge International Academy Ol Kalou)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            disabled={disabled}
            className="pl-9"
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={handleSearch}
          disabled={!searchQuery.trim() || disabled || searching}
          className="shrink-0 gap-2"
        >
          {searching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          Search
        </Button>
      </div>
      <div
        ref={containerRef}
        className="h-[280px] w-full rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-muted/30"
        style={{ minHeight: 280 }}
      />
      {!mounted && (
        <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
          Loading map…
        </div>
      )}
      <p className="text-xs text-muted-foreground mt-2">
        Click on the map to set the school location. You can also search for a place above.
      </p>
      {selectedLat != null && selectedLng != null && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-foreground">
            Selected: {selectedLat.toFixed(6)}, {selectedLng.toFixed(6)}
          </span>
          {selectedAddress && (
            <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={selectedAddress}>
              {selectedAddress}
            </span>
          )}
          <Button
            type="button"
            size="sm"
            onClick={handleUseLocation}
            disabled={disabled}
            className="gap-2"
          >
            <MapPin className="h-4 w-4" />
            Use this location
          </Button>
        </div>
      )}
    </div>
  )
}

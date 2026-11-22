"use client"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { X } from "lucide-react"

export interface StudentListFiltersProps {
  classFilter: number | null
  onClassFilterChange: (value: number | null) => void
  streamFilter: number | null
  onStreamFilterChange: (value: number | null) => void
  classes?: Array<{ id: number; name: string }>
  streams?: Array<{ id: number; name: string; class_id: number }>
}

export function StudentListFilters({
  classFilter,
  onClassFilterChange,
  streamFilter,
  onStreamFilterChange,
  classes = [],
  streams = [],
}: StudentListFiltersProps) {
  // Filter streams by selected class
  const availableStreams = classFilter
    ? streams.filter((s) => s.class_id === classFilter)
    : streams

  const hasFilters = classFilter || streamFilter

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* Class Filter */}
        <Select
          value={classFilter?.toString() || "all"}
          onValueChange={(value) =>
            onClassFilterChange(value === "all" ? null : parseInt(value))
          }
        >
          <SelectTrigger className="min-w-[140px]">
            <SelectValue placeholder="All Classes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All classes</SelectItem>
            {classes.map((cls) => (
              <SelectItem key={cls.id} value={cls.id.toString()}>
                {cls.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Stream Filter */}
        <Select
          value={streamFilter?.toString() || "all"}
          onValueChange={(value) =>
            onStreamFilterChange(value === "all" ? null : parseInt(value))
          }
          disabled={!classFilter && streams.length > 0}
        >
          <SelectTrigger className="min-w-[140px]">
            <SelectValue placeholder="All Streams" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All streams</SelectItem>
            {availableStreams.map((stream) => (
              <SelectItem key={stream.id} value={stream.id.toString()}>
                {stream.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Clear Filters Button */}
      {hasFilters && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            onClassFilterChange(null)
            onStreamFilterChange(null)
          }}
        >
          <X className="h-3.5 w-3.5" />
          Clear filters
        </Button>
      )}
    </div>
  )
}


'use client'

import { GaitMetrics } from '@/lib/types'
import { formatPercentage, getColorForValue } from '@/utils/calculations'

interface GaitAnalysisProps {
  metrics: GaitMetrics | null
}

interface GaugeProps {
  label: string
  value: number
  max: number
  unit: string
  thresholds?: { good: number; warning: number }
  formatValue?: (v: number) => string
}

function Gauge({ label, value, max, unit, thresholds, formatValue }: GaugeProps) {
  const percentage = Math.min(100, (value / max) * 100)
  const color = thresholds
    ? getColorForValue(value / max, { good: thresholds.good / max, warning: thresholds.warning / max })
    : '#3B82F6'

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium">
          {formatValue ? formatValue(value) : value.toFixed(1)} {unit}
        </span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${percentage}%`,
            backgroundColor: color
          }}
        />
      </div>
    </div>
  )
}

export function GaitAnalysis({ metrics }: GaitAnalysisProps) {
  const defaultMetrics: GaitMetrics = {
    speed: 0,
    stride_length: 0,
    cadence: 0,
    symmetry: 0,
    smoothness: 0
  }

  const m = metrics || defaultMetrics

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">Gait Analysis</h2>

      <div className="space-y-4">
        <Gauge
          label="Speed"
          value={m.speed}
          max={500}
          unit="px/s"
        />

        <Gauge
          label="Stride Length"
          value={m.stride_length}
          max={200}
          unit="px"
        />

        <Gauge
          label="Cadence"
          value={m.cadence}
          max={120}
          unit="steps/min"
        />

        <Gauge
          label="Symmetry"
          value={m.symmetry * 100}
          max={100}
          unit="%"
          thresholds={{ good: 80, warning: 60 }}
          formatValue={(v) => v.toFixed(1)}
        />

        <Gauge
          label="Smoothness"
          value={m.smoothness * 100}
          max={100}
          unit="%"
          thresholds={{ good: 70, warning: 50 }}
          formatValue={(v) => v.toFixed(1)}
        />
      </div>

      {/* Summary indicator */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <div className="flex items-center gap-3">
          <div
            className="w-4 h-4 rounded-full"
            style={{
              backgroundColor: getColorForValue(
                (m.symmetry + m.smoothness) / 2,
                { good: 0.75, warning: 0.5 }
              )
            }}
          />
          <div>
            <div className="text-sm font-medium">
              Overall Score: {formatPercentage((m.symmetry + m.smoothness) / 2)}
            </div>
            <div className="text-xs text-gray-500">
              Based on symmetry and smoothness
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

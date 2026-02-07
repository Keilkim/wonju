'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import { Session } from '@/lib/types'

interface ProgressChartProps {
  sessions: Session[]
}

export function ProgressChart({ sessions }: ProgressChartProps) {
  const chartData = sessions
    .filter(s => s.metrics_summary)
    .slice(-10)
    .map((session, index) => ({
      name: `Session ${index + 1}`,
      date: new Date(session.started_at).toLocaleDateString('ko-KR', {
        month: 'short',
        day: 'numeric'
      }),
      symmetry: (session.metrics_summary?.symmetry || 0) * 100,
      smoothness: (session.metrics_summary?.smoothness || 0) * 100,
      speed: session.metrics_summary?.speed || 0,
    }))

  if (chartData.length === 0) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Session Progress</h2>
        <div className="chart-container flex items-center justify-center text-gray-400">
          <div className="text-center">
            <p>No previous sessions</p>
            <p className="text-sm">Complete sessions to track progress</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">Session Progress</h2>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 12 }}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{ backgroundColor: 'white', border: '1px solid #E5E7EB' }}
              formatter={(value: number, name: string) => [
                `${value.toFixed(1)}${name === 'speed' ? ' px/s' : '%'}`,
                name.charAt(0).toUpperCase() + name.slice(1)
              ]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="symmetry" name="Symmetry" fill="#10B981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="smoothness" name="Smoothness" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

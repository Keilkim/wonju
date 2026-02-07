'use client'

import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import { JointAngles } from '@/lib/types'

interface JointAngleChartProps {
  data: Array<{ timestamp: number; angles: JointAngles }>
  maxPoints?: number
}

const JOINT_COLORS = {
  left_shoulder: '#3B82F6',
  right_shoulder: '#60A5FA',
  left_hip: '#10B981',
  right_hip: '#34D399',
  left_elbow: '#F59E0B',
  right_elbow: '#FBBF24',
  left_knee: '#8B5CF6',
  right_knee: '#A78BFA',
}

const JOINT_LABELS: Record<string, string> = {
  left_shoulder: 'L Shoulder',
  right_shoulder: 'R Shoulder',
  left_hip: 'L Hip',
  right_hip: 'R Hip',
  left_elbow: 'L Elbow',
  right_elbow: 'R Elbow',
  left_knee: 'L Knee',
  right_knee: 'R Knee',
}

export function JointAngleChart({ data, maxPoints = 100 }: JointAngleChartProps) {
  const chartData = useMemo(() => {
    const sliced = data.slice(-maxPoints)
    const startTime = sliced[0]?.timestamp || 0

    return sliced.map((item) => ({
      time: ((item.timestamp - startTime) / 1000).toFixed(1),
      ...item.angles
    }))
  }, [data, maxPoints])

  if (chartData.length === 0) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Joint Angles</h2>
        <div className="chart-container flex items-center justify-center text-gray-400">
          Waiting for data...
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">Joint Angles (degrees)</h2>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 12 }}
              tickFormatter={(v) => `${v}s`}
            />
            <YAxis
              domain={[0, 180]}
              tick={{ fontSize: 12 }}
              tickFormatter={(v) => `${v}°`}
            />
            <Tooltip
              contentStyle={{ backgroundColor: 'white', border: '1px solid #E5E7EB' }}
              formatter={(value: number) => [`${value.toFixed(1)}°`, '']}
              labelFormatter={(label) => `Time: ${label}s`}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {Object.entries(JOINT_COLORS).map(([key, color]) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                name={JOINT_LABELS[key]}
                stroke={color}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

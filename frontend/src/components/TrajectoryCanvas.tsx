'use client'

import { useRef, useEffect, useMemo } from 'react'
import { TrajectoryPoint } from '@/lib/types'

interface TrajectoryCanvasProps {
  trajectories: {
    left_front: TrajectoryPoint[]
    right_front: TrajectoryPoint[]
    left_back: TrajectoryPoint[]
    right_back: TrajectoryPoint[]
  }
  maxPoints?: number
}

const TRAJECTORY_COLORS = {
  left_front: '#3B82F6',   // blue
  right_front: '#EF4444',  // red
  left_back: '#10B981',    // green
  right_back: '#F59E0B',   // yellow
}

export function TrajectoryCanvas({ trajectories, maxPoints = 200 }: TrajectoryCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Limit points
  const limitedTrajectories = useMemo(() => ({
    left_front: trajectories.left_front.slice(-maxPoints),
    right_front: trajectories.right_front.slice(-maxPoints),
    left_back: trajectories.left_back.slice(-maxPoints),
    right_back: trajectories.right_back.slice(-maxPoints),
  }), [trajectories, maxPoints])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear
    ctx.fillStyle = '#1F2937'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw grid
    ctx.strokeStyle = '#374151'
    ctx.lineWidth = 0.5
    const gridSize = 40
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, canvas.height)
      ctx.stroke()
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(canvas.width, y)
      ctx.stroke()
    }

    // Find bounds for normalization
    const allPoints = [
      ...limitedTrajectories.left_front,
      ...limitedTrajectories.right_front,
      ...limitedTrajectories.left_back,
      ...limitedTrajectories.right_back,
    ]

    if (allPoints.length === 0) {
      ctx.fillStyle = '#6B7280'
      ctx.font = '14px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Waiting for trajectory data...', canvas.width / 2, canvas.height / 2)
      return
    }

    const minX = Math.min(...allPoints.map(p => p.x))
    const maxX = Math.max(...allPoints.map(p => p.x))
    const minY = Math.min(...allPoints.map(p => p.y))
    const maxY = Math.max(...allPoints.map(p => p.y))

    const rangeX = maxX - minX || 1
    const rangeY = maxY - minY || 1
    const padding = 40

    const scaleX = (canvas.width - padding * 2) / rangeX
    const scaleY = (canvas.height - padding * 2) / rangeY
    const scale = Math.min(scaleX, scaleY)

    const offsetX = padding + (canvas.width - padding * 2 - rangeX * scale) / 2
    const offsetY = padding + (canvas.height - padding * 2 - rangeY * scale) / 2

    // Transform point to canvas coordinates
    const transform = (p: TrajectoryPoint) => ({
      x: offsetX + (p.x - minX) * scale,
      y: offsetY + (p.y - minY) * scale
    })

    // Draw trajectories
    for (const [key, points] of Object.entries(limitedTrajectories)) {
      if (points.length < 2) continue

      const color = TRAJECTORY_COLORS[key as keyof typeof TRAJECTORY_COLORS]

      // Draw path with fading effect
      for (let i = 1; i < points.length; i++) {
        const opacity = (i / points.length) * 0.8 + 0.2
        const p1 = transform(points[i - 1])
        const p2 = transform(points[i])

        ctx.beginPath()
        ctx.strokeStyle = color
        ctx.globalAlpha = opacity
        ctx.lineWidth = 2
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.stroke()
      }

      // Draw current position (last point)
      const lastPoint = transform(points[points.length - 1])
      ctx.globalAlpha = 1
      ctx.beginPath()
      ctx.arc(lastPoint.x, lastPoint.y, 6, 0, 2 * Math.PI)
      ctx.fillStyle = color
      ctx.fill()
      ctx.strokeStyle = '#FFFFFF'
      ctx.lineWidth = 2
      ctx.stroke()
    }

    ctx.globalAlpha = 1

    // Draw legend
    const legendY = 20
    let legendX = 10
    ctx.font = '11px sans-serif'
    for (const [key, color] of Object.entries(TRAJECTORY_COLORS)) {
      ctx.fillStyle = color
      ctx.fillRect(legendX, legendY, 12, 12)
      ctx.fillStyle = '#FFFFFF'
      const label = key.replace('_', ' ')
      ctx.fillText(label, legendX + 16, legendY + 10)
      legendX += ctx.measureText(label).width + 30
    }
  }, [limitedTrajectories])

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">Movement Trajectory</h2>
      <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
        <canvas
          ref={canvasRef}
          width={640}
          height={360}
          className="w-full h-full"
        />
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Paw movement paths over time. Recent positions shown brighter.
      </p>
    </div>
  )
}

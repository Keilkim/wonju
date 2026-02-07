import { Keypoint, JointAngles, GaitMetrics, TrajectoryPoint } from '@/lib/types'

// Calculate angle between three points (in degrees)
export function calculateAngle(
  p1: Keypoint,
  p2: Keypoint, // vertex
  p3: Keypoint
): number {
  const radians = Math.atan2(p3.y - p2.y, p3.x - p2.x) -
                  Math.atan2(p1.y - p2.y, p1.x - p2.x)
  let degrees = Math.abs(radians * 180 / Math.PI)
  if (degrees > 180) degrees = 360 - degrees
  return Math.round(degrees * 10) / 10
}

// Calculate distance between two points
export function calculateDistance(p1: Keypoint, p2: Keypoint): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))
}

// Calculate joint angles from keypoints
export function calculateJointAngles(keypoints: Record<string, Keypoint>): JointAngles {
  return {
    left_shoulder: calculateAngle(
      keypoints.left_elbow,
      keypoints.left_shoulder,
      keypoints.left_hip
    ),
    right_shoulder: calculateAngle(
      keypoints.right_elbow,
      keypoints.right_shoulder,
      keypoints.right_hip
    ),
    left_elbow: calculateAngle(
      keypoints.left_shoulder,
      keypoints.left_elbow,
      keypoints.left_wrist
    ),
    right_elbow: calculateAngle(
      keypoints.right_shoulder,
      keypoints.right_elbow,
      keypoints.right_wrist
    ),
    left_hip: calculateAngle(
      keypoints.left_shoulder,
      keypoints.left_hip,
      keypoints.left_knee
    ),
    right_hip: calculateAngle(
      keypoints.right_shoulder,
      keypoints.right_hip,
      keypoints.right_knee
    ),
    left_knee: calculateAngle(
      keypoints.left_hip,
      keypoints.left_knee,
      keypoints.left_ankle
    ),
    right_knee: calculateAngle(
      keypoints.right_hip,
      keypoints.right_knee,
      keypoints.right_ankle
    ),
  }
}

// Calculate gait symmetry (0-1, 1 = perfect symmetry)
export function calculateSymmetry(leftAngles: number[], rightAngles: number[]): number {
  if (leftAngles.length !== rightAngles.length || leftAngles.length === 0) return 0

  let totalDiff = 0
  for (let i = 0; i < leftAngles.length; i++) {
    const maxAngle = Math.max(leftAngles[i], rightAngles[i])
    if (maxAngle > 0) {
      totalDiff += Math.abs(leftAngles[i] - rightAngles[i]) / maxAngle
    }
  }

  return Math.max(0, 1 - (totalDiff / leftAngles.length))
}

// Calculate movement smoothness using jerk (derivative of acceleration)
export function calculateSmoothness(trajectory: TrajectoryPoint[]): number {
  if (trajectory.length < 4) return 1

  const velocities: number[] = []
  for (let i = 1; i < trajectory.length; i++) {
    const dt = (trajectory[i].timestamp - trajectory[i-1].timestamp) / 1000 // seconds
    if (dt > 0) {
      const dx = trajectory[i].x - trajectory[i-1].x
      const dy = trajectory[i].y - trajectory[i-1].y
      velocities.push(Math.sqrt(dx*dx + dy*dy) / dt)
    }
  }

  if (velocities.length < 2) return 1

  // Calculate variance in velocity changes
  let sumSquaredDiff = 0
  for (let i = 1; i < velocities.length; i++) {
    sumSquaredDiff += Math.pow(velocities[i] - velocities[i-1], 2)
  }

  const variance = sumSquaredDiff / velocities.length
  // Normalize to 0-1 (lower variance = smoother)
  return Math.max(0, 1 - Math.min(1, variance / 1000))
}

// Calculate cadence (steps per minute) from paw positions
export function calculateCadence(pawPositions: TrajectoryPoint[]): number {
  if (pawPositions.length < 10) return 0

  // Find peaks (step cycles) by detecting direction changes
  let stepCount = 0
  let prevDirection = 0

  for (let i = 2; i < pawPositions.length; i++) {
    const currentDirection = pawPositions[i].y - pawPositions[i-1].y
    if (prevDirection > 0 && currentDirection < 0) {
      stepCount++
    }
    prevDirection = currentDirection
  }

  const durationMs = pawPositions[pawPositions.length - 1].timestamp - pawPositions[0].timestamp
  const durationMin = durationMs / 60000

  return durationMin > 0 ? Math.round(stepCount / durationMin) : 0
}

// Format angle for display
export function formatAngle(angle: number): string {
  return `${angle.toFixed(1)}°`
}

// Format percentage for display
export function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

// Get color based on value (for gauges)
export function getColorForValue(value: number, thresholds: { good: number; warning: number }): string {
  if (value >= thresholds.good) return '#10B981' // green
  if (value >= thresholds.warning) return '#F59E0B' // yellow
  return '#EF4444' // red
}

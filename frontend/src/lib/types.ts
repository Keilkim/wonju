// 24 keypoints for dog pose (YOLO Dog-Pose format)
export interface Keypoint {
  x: number
  y: number
  confidence: number
}

export interface DogKeypoints {
  nose: Keypoint
  left_eye: Keypoint
  right_eye: Keypoint
  left_ear: Keypoint
  right_ear: Keypoint
  left_shoulder: Keypoint
  right_shoulder: Keypoint
  left_elbow: Keypoint
  right_elbow: Keypoint
  left_wrist: Keypoint
  right_wrist: Keypoint
  left_hip: Keypoint
  right_hip: Keypoint
  left_knee: Keypoint
  right_knee: Keypoint
  left_ankle: Keypoint
  right_ankle: Keypoint
  tail_base: Keypoint
  tail_mid: Keypoint
  tail_tip: Keypoint
  left_front_paw: Keypoint
  right_front_paw: Keypoint
  left_back_paw: Keypoint
  right_back_paw: Keypoint
}

export interface JointAngles {
  left_shoulder: number
  right_shoulder: number
  left_elbow: number
  right_elbow: number
  left_hip: number
  right_hip: number
  left_knee: number
  right_knee: number
}

export interface GaitMetrics {
  speed: number              // pixels per second
  stride_length: number      // average stride length
  cadence: number           // steps per minute
  symmetry: number          // 0-1, 1 = perfect symmetry
  smoothness: number        // movement smoothness score
}

export interface AnalysisResult {
  timestamp: number
  keypoints: DogKeypoints | null
  joint_angles: JointAngles | null
  gait_metrics: GaitMetrics | null
  confidence: number
}

export interface Session {
  id: string
  dog_id: string
  started_at: string
  ended_at: string | null
  notes: string
  metrics_summary: GaitMetrics | null
}

export interface TrajectoryPoint {
  x: number
  y: number
  timestamp: number
}

export interface WebSocketMessage {
  type: 'frame' | 'result' | 'error' | 'status'
  data: unknown
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

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

// Detection mode
export type DetectionMode = 'ai_pose' | 'color_marker'

// HSV color range for a single marker
export interface HSVRange {
  hue_low: number
  hue_high: number
  sat_low: number
  sat_high: number
  val_low: number
  val_high: number
}

// Color marker definition for one joint
export interface ColorMarkerConfig {
  joint_name: string
  color_name: string
  hsv_range: HSVRange
  display_color: string
}

// A detected point during calibration
export interface DetectedPoint {
  id: string
  x: number
  y: number
  suggested_label: string
  color_name?: string | null
  display_color?: string
  confidence: number
}

// Calibration state
export interface CalibrationState {
  mode: DetectionMode
  detected_points: DetectedPoint[]
  is_confirmed: boolean
  label_mapping: Record<string, string>  // color_name -> joint_name
  marker_configs: ColorMarkerConfig[]
}

// Default 8 marker color presets
export const DEFAULT_MARKER_CONFIGS: ColorMarkerConfig[] = [
  { joint_name: 'left_shoulder', color_name: 'Red', hsv_range: { hue_low: 170, hue_high: 10, sat_low: 120, sat_high: 255, val_low: 100, val_high: 255 }, display_color: '#EF4444' },
  { joint_name: 'right_shoulder', color_name: 'Blue', hsv_range: { hue_low: 100, hue_high: 130, sat_low: 120, sat_high: 255, val_low: 80, val_high: 255 }, display_color: '#3B82F6' },
  { joint_name: 'left_elbow', color_name: 'Green', hsv_range: { hue_low: 35, hue_high: 85, sat_low: 120, sat_high: 255, val_low: 80, val_high: 255 }, display_color: '#22C55E' },
  { joint_name: 'right_elbow', color_name: 'Yellow', hsv_range: { hue_low: 20, hue_high: 35, sat_low: 120, sat_high: 255, val_low: 150, val_high: 255 }, display_color: '#EAB308' },
  { joint_name: 'left_hip', color_name: 'Orange', hsv_range: { hue_low: 10, hue_high: 20, sat_low: 150, sat_high: 255, val_low: 150, val_high: 255 }, display_color: '#F97316' },
  { joint_name: 'right_hip', color_name: 'Purple', hsv_range: { hue_low: 130, hue_high: 160, sat_low: 80, sat_high: 255, val_low: 60, val_high: 255 }, display_color: '#A855F7' },
  { joint_name: 'left_knee', color_name: 'Pink', hsv_range: { hue_low: 160, hue_high: 170, sat_low: 80, sat_high: 255, val_low: 100, val_high: 255 }, display_color: '#EC4899' },
  { joint_name: 'right_knee', color_name: 'Cyan', hsv_range: { hue_low: 85, hue_high: 100, sat_low: 120, sat_high: 255, val_low: 80, val_high: 255 }, display_color: '#06B6D4' },
]

// Joint display names in Korean
export const JOINT_LABELS: Record<string, string> = {
  left_shoulder: '왼쪽 어깨',
  right_shoulder: '오른쪽 어깨',
  left_elbow: '왼쪽 팔꿈치',
  right_elbow: '오른쪽 팔꿈치',
  left_hip: '왼쪽 고관절',
  right_hip: '오른쪽 고관절',
  left_knee: '왼쪽 무릎',
  right_knee: '오른쪽 무릎',
}

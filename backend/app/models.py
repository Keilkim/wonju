from pydantic import BaseModel
from typing import Optional, Dict, List
from datetime import datetime
from enum import Enum


class Keypoint(BaseModel):
    x: float
    y: float
    confidence: float


class DogKeypoints(BaseModel):
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


class JointAngles(BaseModel):
    left_shoulder: float
    right_shoulder: float
    left_elbow: float
    right_elbow: float
    left_hip: float
    right_hip: float
    left_knee: float
    right_knee: float


class GaitMetrics(BaseModel):
    speed: float
    stride_length: float
    cadence: float
    symmetry: float
    smoothness: float


class AnalysisResult(BaseModel):
    timestamp: int
    keypoints: Optional[DogKeypoints] = None
    joint_angles: Optional[JointAngles] = None
    gait_metrics: Optional[GaitMetrics] = None
    confidence: float


class WebSocketMessage(BaseModel):
    type: str  # 'frame', 'result', 'error', 'status'
    data: dict
    timestamp: Optional[int] = None


class FrameData(BaseModel):
    type: str
    data: str  # base64 encoded image
    timestamp: int


class DetectionMode(str, Enum):
    AI_POSE = "ai_pose"
    COLOR_MARKER = "color_marker"


class HSVRange(BaseModel):
    hue_low: int = 0
    hue_high: int = 179
    sat_low: int = 100
    sat_high: int = 255
    val_low: int = 100
    val_high: int = 255


class ColorMarkerConfig(BaseModel):
    joint_name: str
    color_name: str
    hsv_range: HSVRange
    display_color: str = "#FFFFFF"


class DetectedPoint(BaseModel):
    id: str
    x: float
    y: float
    suggested_label: str
    color_name: Optional[str] = None
    confidence: float

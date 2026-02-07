from pydantic import BaseModel
from typing import Optional, Dict, List
from datetime import datetime


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

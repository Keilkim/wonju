import cv2
import numpy as np
import logging
from typing import List, Dict, Tuple, Optional

from .models import HSVRange, ColorMarkerConfig, DetectedPoint

logger = logging.getLogger(__name__)

# 8 joints tracked by color markers
COLOR_MARKER_JOINTS = [
    'left_shoulder', 'right_shoulder',
    'left_elbow', 'right_elbow',
    'left_hip', 'right_hip',
    'left_knee', 'right_knee',
]

# Default marker presets - practical colors that contrast with dog fur
DEFAULT_MARKER_CONFIGS = [
    ColorMarkerConfig(
        joint_name='left_shoulder', color_name='Red', position_order=1,
        hsv_range=HSVRange(hue_low=170, hue_high=10, sat_low=120, sat_high=255, val_low=100, val_high=255),
        display_color='#EF4444',
    ),
    ColorMarkerConfig(
        joint_name='right_shoulder', color_name='Blue', position_order=1,
        hsv_range=HSVRange(hue_low=100, hue_high=130, sat_low=120, sat_high=255, val_low=80, val_high=255),
        display_color='#3B82F6',
    ),
    ColorMarkerConfig(
        joint_name='left_elbow', color_name='Green', position_order=1,
        hsv_range=HSVRange(hue_low=35, hue_high=85, sat_low=120, sat_high=255, val_low=80, val_high=255),
        display_color='#22C55E',
    ),
    ColorMarkerConfig(
        joint_name='right_elbow', color_name='Yellow', position_order=1,
        hsv_range=HSVRange(hue_low=20, hue_high=35, sat_low=120, sat_high=255, val_low=150, val_high=255),
        display_color='#EAB308',
    ),
    ColorMarkerConfig(
        joint_name='left_hip', color_name='Orange', position_order=1,
        hsv_range=HSVRange(hue_low=10, hue_high=20, sat_low=150, sat_high=255, val_low=150, val_high=255),
        display_color='#F97316',
    ),
    ColorMarkerConfig(
        joint_name='right_hip', color_name='Purple', position_order=1,
        hsv_range=HSVRange(hue_low=130, hue_high=160, sat_low=80, sat_high=255, val_low=60, val_high=255),
        display_color='#A855F7',
    ),
    ColorMarkerConfig(
        joint_name='left_knee', color_name='Pink', position_order=1,
        hsv_range=HSVRange(hue_low=160, hue_high=170, sat_low=80, sat_high=255, val_low=100, val_high=255),
        display_color='#EC4899',
    ),
    ColorMarkerConfig(
        joint_name='right_knee', color_name='Cyan', position_order=1,
        hsv_range=HSVRange(hue_low=85, hue_high=100, sat_low=120, sat_high=255, val_low=80, val_high=255),
        display_color='#06B6D4',
    ),
]

ZERO_KP = {'x': 0, 'y': 0, 'confidence': 0}

# Minimum contour area to consider as a valid marker
MIN_MARKER_AREA = 100
# Scale factor for confidence based on contour area
CONFIDENCE_AREA_SCALE = 5000


class ColorMarkerDetector:
    """Detects colored markers on dog joints using HSV color space."""

    def __init__(self, marker_configs: Optional[List[ColorMarkerConfig]] = None):
        self.marker_configs = marker_configs or list(DEFAULT_MARKER_CONFIGS)
        self.label_mapping: Dict[str, str] = {}  # color_name -> joint_name
        self._prev_positions: Dict[str, Dict] = {}  # joint_name -> last known position
        self._missing_frames: Dict[str, int] = {}  # joint_name -> frames since last seen
        self._kernel = np.ones((5, 5), np.uint8)

    def update_configs(self, configs: List[ColorMarkerConfig]):
        """Update marker configurations (e.g., after HSV tuning)."""
        self.marker_configs = configs

    def set_label_mapping(self, mapping: Dict[str, str]):
        """Set confirmed label mapping from calibration (color_name -> joint_name)."""
        self.label_mapping = mapping

    def _create_mask(self, hsv: np.ndarray, hsv_range: HSVRange) -> np.ndarray:
        """Create HSV mask, handling red hue wrapping."""
        lower = np.array([hsv_range.hue_low, hsv_range.sat_low, hsv_range.val_low])
        upper = np.array([hsv_range.hue_high, hsv_range.sat_high, hsv_range.val_high])

        if hsv_range.hue_low > hsv_range.hue_high:
            # Red wraps around 0/180 in HSV
            mask1 = cv2.inRange(hsv, np.array([0, hsv_range.sat_low, hsv_range.val_low]),
                                np.array([hsv_range.hue_high, hsv_range.sat_high, hsv_range.val_high]))
            mask2 = cv2.inRange(hsv, np.array([hsv_range.hue_low, hsv_range.sat_low, hsv_range.val_low]),
                                np.array([179, hsv_range.sat_high, hsv_range.val_high]))
            mask = mask1 | mask2
        else:
            mask = cv2.inRange(hsv, lower, upper)

        # Morphological cleanup to reduce noise
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, self._kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, self._kernel)
        return mask

    def detect_all_colors(self, frame: np.ndarray) -> List[Dict]:
        """Calibration mode: detect all colored regions, return as list of dicts.

        Supports multiple markers of the same color - finds all valid contours
        per color, sorts by y-coordinate (top to bottom), and maps by position_order.
        """
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        detected = []

        # Group configs by color_name to know how many contours to find per color
        color_groups: Dict[str, List] = {}
        for config in self.marker_configs:
            if config.color_name not in color_groups:
                color_groups[config.color_name] = []
            color_groups[config.color_name].append(config)

        # Sort each group by position_order
        for color_name in color_groups:
            color_groups[color_name].sort(key=lambda c: c.position_order)

        # Process each unique color
        processed_colors = set()
        for config in self.marker_configs:
            if config.color_name in processed_colors:
                continue
            processed_colors.add(config.color_name)

            group = color_groups[config.color_name]
            needed_count = len(group)

            mask = self._create_mask(hsv, config.hsv_range)
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            # Find all valid contours for this color
            valid_contours = []
            for cnt in contours:
                area = cv2.contourArea(cnt)
                if area > MIN_MARKER_AREA:
                    M = cv2.moments(cnt)
                    if M["m00"] > 0:
                        cx = M["m10"] / M["m00"]
                        cy = M["m01"] / M["m00"]
                        valid_contours.append({
                            'cx': float(cx),
                            'cy': float(cy),
                            'area': area,
                        })

            # Sort by y-coordinate (top to bottom)
            valid_contours.sort(key=lambda c: c['cy'])

            # Map top N contours to configs by position_order
            for i, cfg in enumerate(group):
                if i < len(valid_contours):
                    vc = valid_contours[i]
                    detected.append({
                        'id': f"{cfg.color_name}_{cfg.position_order}",
                        'x': vc['cx'],
                        'y': vc['cy'],
                        'suggested_label': cfg.joint_name,
                        'color_name': cfg.color_name,
                        'display_color': cfg.display_color,
                        'confidence': min(1.0, vc['area'] / CONFIDENCE_AREA_SCALE),
                        'position_order': cfg.position_order,
                    })

        return detected

    def detect(self, frame: np.ndarray) -> Tuple[Optional[Dict], float]:
        """Production mode: detect markers and return keypoints dict compatible with MetricsCalculator."""
        points = self.detect_all_colors(frame)
        if not points:
            return None, 0.0

        keypoints = {}
        for pt in points:
            # Use suggested_label directly (already mapped by position_order in detect_all_colors)
            joint_name = pt['suggested_label']
            # Override with label_mapping if exists (for legacy single-color mode)
            if not pt.get('position_order') and pt['color_name'] in self.label_mapping:
                joint_name = self.label_mapping[pt['color_name']]
            keypoints[joint_name] = {
                'x': pt['x'],
                'y': pt['y'],
                'confidence': pt['confidence'],
            }
            # Update position tracking
            self._prev_positions[joint_name] = keypoints[joint_name]
            self._missing_frames[joint_name] = 0

        # Handle occlusion: interpolate missing joints from previous positions
        for name in COLOR_MARKER_JOINTS:
            if name not in keypoints:
                self._missing_frames[name] = self._missing_frames.get(name, 0) + 1
                if name in self._prev_positions and self._missing_frames[name] < 5:
                    # Use previous position with decaying confidence
                    prev = self._prev_positions[name]
                    decay = max(0.1, 1.0 - self._missing_frames[name] * 0.2)
                    keypoints[name] = {
                        'x': prev['x'],
                        'y': prev['y'],
                        'confidence': prev['confidence'] * decay,
                    }
                else:
                    keypoints[name] = dict(ZERO_KP)

        confidences = [kp['confidence'] for kp in keypoints.values() if kp['confidence'] > 0]
        avg_conf = float(np.mean(confidences)) if confidences else 0.0
        return keypoints, avg_conf

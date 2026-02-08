import math
from typing import Dict, List, Optional, Tuple
from collections import deque
import numpy as np


class MetricsCalculator:
    """Calculate gait metrics from pose keypoints."""

    def __init__(self, history_size: int = 100):
        self.history_size = history_size
        self.keypoint_history: deque = deque(maxlen=history_size)
        self.timestamp_history: deque = deque(maxlen=history_size)

    def add_frame(self, keypoints: Dict, timestamp: int):
        """Add a frame's keypoints to history."""
        self.keypoint_history.append(keypoints)
        self.timestamp_history.append(timestamp)

    def calculate_angle(self, p1: Dict, p2: Dict, p3: Dict) -> float:
        """
        Calculate angle at p2 formed by p1-p2-p3.
        Returns angle in degrees.
        """
        if p1['confidence'] < 0.3 or p2['confidence'] < 0.3 or p3['confidence'] < 0.3:
            return 0.0

        # Vectors
        v1 = (p1['x'] - p2['x'], p1['y'] - p2['y'])
        v2 = (p3['x'] - p2['x'], p3['y'] - p2['y'])

        # Dot product and magnitudes
        dot = v1[0] * v2[0] + v1[1] * v2[1]
        mag1 = math.sqrt(v1[0]**2 + v1[1]**2)
        mag2 = math.sqrt(v2[0]**2 + v2[1]**2)

        if mag1 == 0 or mag2 == 0:
            return 0.0

        # Angle in radians, then convert to degrees
        cos_angle = max(-1, min(1, dot / (mag1 * mag2)))
        angle = math.acos(cos_angle)

        return math.degrees(angle)

    def calculate_joint_angles(self, keypoints: Dict, detection_mode: str = 'ai_pose') -> Dict[str, float]:
        """Calculate all joint angles from keypoints."""
        Z = {'x': 0, 'y': 0, 'confidence': 0}

        # Shoulder and hip angles work for both modes
        angles = {
            'left_shoulder': self.calculate_angle(
                keypoints.get('left_elbow', Z), keypoints.get('left_shoulder', Z), keypoints.get('left_hip', Z)
            ),
            'right_shoulder': self.calculate_angle(
                keypoints.get('right_elbow', Z), keypoints.get('right_shoulder', Z), keypoints.get('right_hip', Z)
            ),
            'left_hip': self.calculate_angle(
                keypoints.get('left_shoulder', Z), keypoints.get('left_hip', Z), keypoints.get('left_knee', Z)
            ),
            'right_hip': self.calculate_angle(
                keypoints.get('right_shoulder', Z), keypoints.get('right_hip', Z), keypoints.get('right_knee', Z)
            ),
        }

        if detection_mode == 'color_marker':
            # Color marker mode: no wrist/ankle markers, so elbow/knee angles = 0
            angles['left_elbow'] = 0.0
            angles['right_elbow'] = 0.0
            angles['left_knee'] = 0.0
            angles['right_knee'] = 0.0
        else:
            angles['left_elbow'] = self.calculate_angle(
                keypoints.get('left_shoulder', Z), keypoints.get('left_elbow', Z), keypoints.get('left_wrist', Z)
            )
            angles['right_elbow'] = self.calculate_angle(
                keypoints.get('right_shoulder', Z), keypoints.get('right_elbow', Z), keypoints.get('right_wrist', Z)
            )
            angles['left_knee'] = self.calculate_angle(
                keypoints.get('left_hip', Z), keypoints.get('left_knee', Z), keypoints.get('left_ankle', Z)
            )
            angles['right_knee'] = self.calculate_angle(
                keypoints.get('right_hip', Z), keypoints.get('right_knee', Z), keypoints.get('right_ankle', Z)
            )

        return angles

    def calculate_distance(self, p1: Dict, p2: Dict) -> float:
        """Calculate distance between two points."""
        return math.sqrt((p2['x'] - p1['x'])**2 + (p2['y'] - p1['y'])**2)

    def calculate_speed(self) -> float:
        """Calculate movement speed from keypoint history."""
        if len(self.keypoint_history) < 2:
            return 0.0

        # Use hip center as reference point
        total_distance = 0.0
        count = 0

        for i in range(1, len(self.keypoint_history)):
            prev_kp = self.keypoint_history[i - 1]
            curr_kp = self.keypoint_history[i]

            # Calculate hip center movement
            prev_hip = self._get_hip_center(prev_kp)
            curr_hip = self._get_hip_center(curr_kp)

            if prev_hip and curr_hip:
                distance = self.calculate_distance(prev_hip, curr_hip)
                total_distance += distance
                count += 1

        if count == 0 or len(self.timestamp_history) < 2:
            return 0.0

        # Calculate time elapsed (in seconds)
        time_elapsed = (self.timestamp_history[-1] - self.timestamp_history[0]) / 1000.0

        if time_elapsed <= 0:
            return 0.0

        return total_distance / time_elapsed

    def _get_hip_center(self, keypoints: Dict) -> Optional[Dict]:
        """Get center point between hips."""
        left_hip = keypoints.get('left_hip', {'x': 0, 'y': 0, 'confidence': 0})
        right_hip = keypoints.get('right_hip', {'x': 0, 'y': 0, 'confidence': 0})

        if left_hip['confidence'] < 0.3 or right_hip['confidence'] < 0.3:
            return None

        return {
            'x': (left_hip['x'] + right_hip['x']) / 2,
            'y': (left_hip['y'] + right_hip['y']) / 2,
            'confidence': (left_hip['confidence'] + right_hip['confidence']) / 2
        }

    def calculate_stride_length(self, ref_key: str = 'left_front_paw') -> float:
        """Calculate average stride length from limb endpoint movements."""
        if len(self.keypoint_history) < 10:
            return 0.0

        # Track reference point movements
        paw_positions = []
        for kp in self.keypoint_history:
            paw = kp.get(ref_key, {'x': 0, 'y': 0, 'confidence': 0})
            if paw['confidence'] > 0.3:
                paw_positions.append(paw)

        if len(paw_positions) < 2:
            return 0.0

        # Find step cycles (peaks in vertical movement)
        strides = []
        prev_y = paw_positions[0]['y']
        prev_x = paw_positions[0]['x']
        direction = 0
        step_start_x = prev_x

        for pos in paw_positions[1:]:
            curr_direction = 1 if pos['y'] > prev_y else -1

            # Detected direction change (end of step)
            if direction != 0 and curr_direction != direction:
                stride = abs(pos['x'] - step_start_x)
                if stride > 10:  # Minimum stride threshold
                    strides.append(stride)
                step_start_x = pos['x']

            direction = curr_direction
            prev_y = pos['y']
            prev_x = pos['x']

        if len(strides) == 0:
            return 0.0

        return sum(strides) / len(strides)

    def calculate_cadence(self, ref_key: str = 'left_front_paw') -> float:
        """Calculate steps per minute."""
        if len(self.keypoint_history) < 20:
            return 0.0

        # Count direction changes in reference point vertical position
        step_count = 0
        prev_y = None
        direction = 0

        for kp in self.keypoint_history:
            paw = kp.get(ref_key, {'y': 0, 'confidence': 0})
            if paw['confidence'] < 0.3:
                continue

            if prev_y is not None:
                curr_direction = 1 if paw['y'] > prev_y else -1
                if direction != 0 and curr_direction != direction:
                    step_count += 1
                direction = curr_direction

            prev_y = paw['y']

        # Calculate time in minutes
        if len(self.timestamp_history) < 2:
            return 0.0

        time_minutes = (self.timestamp_history[-1] - self.timestamp_history[0]) / 60000.0

        if time_minutes <= 0:
            return 0.0

        return step_count / time_minutes

    def calculate_symmetry(self, joint_angles: Dict[str, float]) -> float:
        """Calculate left-right symmetry score (0-1, 1 = perfect)."""
        pairs = [
            ('left_shoulder', 'right_shoulder'),
            ('left_elbow', 'right_elbow'),
            ('left_hip', 'right_hip'),
            ('left_knee', 'right_knee'),
        ]

        total_diff = 0.0
        valid_pairs = 0

        for left, right in pairs:
            left_angle = joint_angles.get(left, 0)
            right_angle = joint_angles.get(right, 0)

            if left_angle > 0 and right_angle > 0:
                max_angle = max(left_angle, right_angle)
                diff = abs(left_angle - right_angle) / max_angle
                total_diff += diff
                valid_pairs += 1

        if valid_pairs == 0:
            return 0.0

        return max(0, 1 - (total_diff / valid_pairs))

    def calculate_smoothness(self) -> float:
        """Calculate movement smoothness (0-1, 1 = very smooth)."""
        if len(self.keypoint_history) < 4:
            return 0.0

        # Calculate velocity changes (jerk)
        velocities = []

        for i in range(1, len(self.keypoint_history)):
            prev_hip = self._get_hip_center(self.keypoint_history[i - 1])
            curr_hip = self._get_hip_center(self.keypoint_history[i])

            if prev_hip and curr_hip:
                dt = (self.timestamp_history[i] - self.timestamp_history[i - 1]) / 1000.0
                if dt > 0:
                    dx = curr_hip['x'] - prev_hip['x']
                    dy = curr_hip['y'] - prev_hip['y']
                    velocity = math.sqrt(dx**2 + dy**2) / dt
                    velocities.append(velocity)

        if len(velocities) < 2:
            return 0.0

        # Calculate variance in velocity changes
        velocity_changes = [abs(velocities[i] - velocities[i-1]) for i in range(1, len(velocities))]

        if len(velocity_changes) == 0:
            return 1.0

        variance = np.var(velocity_changes)

        # Normalize to 0-1 (lower variance = smoother)
        # Using exponential decay for normalization
        smoothness = math.exp(-variance / 100)

        return min(1.0, max(0.0, smoothness))

    def calculate_gait_metrics(self, keypoints: Dict, timestamp: int, detection_mode: str = 'ai_pose') -> Dict:
        """Calculate all gait metrics."""
        # Add to history
        self.add_frame(keypoints, timestamp)

        # Calculate joint angles
        joint_angles = self.calculate_joint_angles(keypoints, detection_mode)

        # For color marker mode, use elbow as reference point instead of paw
        ref_key = 'left_elbow' if detection_mode == 'color_marker' else 'left_front_paw'

        # Calculate gait metrics
        gait_metrics = {
            'speed': round(self.calculate_speed(), 2),
            'stride_length': round(self.calculate_stride_length(ref_key), 2),
            'cadence': round(self.calculate_cadence(ref_key), 2),
            'symmetry': round(self.calculate_symmetry(joint_angles), 3),
            'smoothness': round(self.calculate_smoothness(), 3),
        }

        return {
            'joint_angles': joint_angles,
            'gait_metrics': gait_metrics,
        }

    def reset(self):
        """Reset history for new session."""
        self.keypoint_history.clear()
        self.timestamp_history.clear()

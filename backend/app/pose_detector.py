import base64
import numpy as np
import cv2
from io import BytesIO
from PIL import Image
from typing import Optional, Dict, Tuple
import logging
import torch

# Fix for PyTorch 2.6+ weights_only default change
torch.serialization.add_safe_globals([])

logger = logging.getLogger(__name__)

# YOLO Dog Pose keypoint names (24 keypoints)
KEYPOINT_NAMES = [
    'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
    'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
    'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
    'left_knee', 'right_knee', 'left_ankle', 'right_ankle',
    'tail_base', 'tail_mid', 'tail_tip',
    'left_front_paw', 'right_front_paw', 'left_back_paw', 'right_back_paw'
]


class PoseDetector:
    def __init__(self, model_path: str = "yolov8n-pose.pt", device: str = "cpu"):
        """
        Initialize the pose detector with YOLO model.

        For production, use a dog-specific pose model.
        For demo, we'll use the standard pose model and map keypoints.
        """
        self.device = device
        self.model = None
        self.model_path = model_path
        self._load_model()

    def _load_model(self):
        """Load YOLO pose model."""
        try:
            # Fix for PyTorch 2.6+ - allow ultralytics model classes
            import torch.serialization
            original_load = torch.load

            def patched_load(*args, **kwargs):
                kwargs['weights_only'] = False
                return original_load(*args, **kwargs)

            torch.load = patched_load

            from ultralytics import YOLO
            self.model = YOLO("yolov8n-pose.pt")
            logger.info("Loaded YOLOv8 pose model successfully")

            # Restore original torch.load
            torch.load = original_load

            self.model.to(self.device)
        except Exception as e:
            logger.error(f"Failed to load YOLO model: {e}")
            logger.info("Running in demo mode with simulated keypoints")
            self.model = None

    def decode_frame(self, base64_data: str) -> Optional[np.ndarray]:
        """Decode base64 image to numpy array."""
        try:
            # Remove data URL prefix if present
            if ',' in base64_data:
                base64_data = base64_data.split(',')[1]

            # Decode base64
            image_bytes = base64.b64decode(base64_data)

            # Convert to PIL Image
            image = Image.open(BytesIO(image_bytes))

            # Convert to numpy array (BGR for OpenCV)
            frame = np.array(image)
            if len(frame.shape) == 3 and frame.shape[2] == 4:
                frame = cv2.cvtColor(frame, cv2.COLOR_RGBA2BGR)
            elif len(frame.shape) == 3 and frame.shape[2] == 3:
                frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)

            return frame
        except Exception as e:
            logger.error(f"Failed to decode frame: {e}")
            return None

    def detect(self, frame: np.ndarray) -> Tuple[Optional[Dict], float]:
        """
        Run pose detection on a frame.

        Returns:
            Tuple of (keypoints dict, confidence score)
        """
        if self.model is None:
            return self._generate_demo_keypoints(frame.shape), 0.5

        try:
            # Run inference
            results = self.model(frame, verbose=False)

            if len(results) == 0 or results[0].keypoints is None:
                return None, 0.0

            # Get keypoints from first detection
            keypoints_data = results[0].keypoints

            if keypoints_data.xy is None or len(keypoints_data.xy) == 0:
                return None, 0.0

            # Get first detected person/animal
            kpts = keypoints_data.xy[0].cpu().numpy()
            conf = keypoints_data.conf[0].cpu().numpy() if keypoints_data.conf is not None else np.ones(len(kpts))

            # Map to our keypoint format
            # Note: Standard YOLO pose has 17 keypoints, we extend to 24 for dogs
            keypoints = self._map_keypoints(kpts, conf, frame.shape)

            avg_confidence = float(np.mean(conf))

            return keypoints, avg_confidence

        except Exception as e:
            logger.error(f"Pose detection failed: {e}")
            return None, 0.0

    def _map_keypoints(self, kpts: np.ndarray, conf: np.ndarray, shape: Tuple) -> Dict:
        """Map YOLO keypoints to our dog keypoint format."""
        h, w = shape[:2]

        # Standard YOLO pose has 17 keypoints for humans
        # We need to adapt/estimate for dogs (24 keypoints)

        keypoints = {}

        # Map available keypoints
        yolo_names = [
            'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
            'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
            'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
            'left_knee', 'right_knee', 'left_ankle', 'right_ankle'
        ]

        for i, name in enumerate(yolo_names):
            if i < len(kpts):
                keypoints[name] = {
                    'x': float(kpts[i][0]),
                    'y': float(kpts[i][1]),
                    'confidence': float(conf[i]) if i < len(conf) else 0.5
                }
            else:
                keypoints[name] = {'x': 0, 'y': 0, 'confidence': 0}

        # Estimate additional dog keypoints
        # Tail points (estimate from hip positions)
        if keypoints['left_hip']['confidence'] > 0.3 and keypoints['right_hip']['confidence'] > 0.3:
            hip_center_x = (keypoints['left_hip']['x'] + keypoints['right_hip']['x']) / 2
            hip_center_y = (keypoints['left_hip']['y'] + keypoints['right_hip']['y']) / 2

            # Tail extends behind the body
            keypoints['tail_base'] = {'x': hip_center_x, 'y': hip_center_y, 'confidence': 0.5}
            keypoints['tail_mid'] = {'x': hip_center_x - 30, 'y': hip_center_y - 10, 'confidence': 0.4}
            keypoints['tail_tip'] = {'x': hip_center_x - 60, 'y': hip_center_y - 20, 'confidence': 0.3}
        else:
            keypoints['tail_base'] = {'x': 0, 'y': 0, 'confidence': 0}
            keypoints['tail_mid'] = {'x': 0, 'y': 0, 'confidence': 0}
            keypoints['tail_tip'] = {'x': 0, 'y': 0, 'confidence': 0}

        # Paw points (offset from ankle/wrist)
        paw_offset = 15
        for side in ['left', 'right']:
            # Front paws
            wrist = keypoints[f'{side}_wrist']
            if wrist['confidence'] > 0.3:
                keypoints[f'{side}_front_paw'] = {
                    'x': wrist['x'],
                    'y': wrist['y'] + paw_offset,
                    'confidence': wrist['confidence'] * 0.8
                }
            else:
                keypoints[f'{side}_front_paw'] = {'x': 0, 'y': 0, 'confidence': 0}

            # Back paws
            ankle = keypoints[f'{side}_ankle']
            if ankle['confidence'] > 0.3:
                keypoints[f'{side}_back_paw'] = {
                    'x': ankle['x'],
                    'y': ankle['y'] + paw_offset,
                    'confidence': ankle['confidence'] * 0.8
                }
            else:
                keypoints[f'{side}_back_paw'] = {'x': 0, 'y': 0, 'confidence': 0}

        return keypoints

    def _generate_demo_keypoints(self, shape: Tuple) -> Dict:
        """Generate demo keypoints for testing without model."""
        import random
        h, w = shape[:2]

        # Generate a walking dog pose centered in frame
        center_x = w / 2
        center_y = h / 2

        keypoints = {}
        for name in KEYPOINT_NAMES:
            # Add some variation
            offset_x = random.uniform(-100, 100)
            offset_y = random.uniform(-50, 50)
            keypoints[name] = {
                'x': center_x + offset_x,
                'y': center_y + offset_y,
                'confidence': random.uniform(0.6, 0.95)
            }

        return keypoints


# Singleton instance
_detector: Optional[PoseDetector] = None


def get_detector() -> PoseDetector:
    """Get or create the pose detector singleton."""
    global _detector
    if _detector is None:
        _detector = PoseDetector()
    return _detector

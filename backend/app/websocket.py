import json
import logging
from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Set, Optional
import asyncio

from .pose_detector import get_detector
from .metrics import MetricsCalculator
from .color_detector import ColorMarkerDetector, DEFAULT_MARKER_CONFIGS
from .models import DetectionMode, ColorMarkerConfig, HSVRange

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manage WebSocket connections."""

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self.metrics_calculators: Dict[WebSocket, MetricsCalculator] = {}
        self.detection_modes: Dict[WebSocket, str] = {}
        self.color_detectors: Dict[WebSocket, ColorMarkerDetector] = {}

    async def connect(self, websocket: WebSocket):
        """Accept new connection."""
        await websocket.accept()
        self.active_connections.add(websocket)
        self.metrics_calculators[websocket] = MetricsCalculator()
        self.detection_modes[websocket] = DetectionMode.AI_POSE
        logger.info(f"Client connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        """Remove connection."""
        self.active_connections.discard(websocket)
        self.metrics_calculators.pop(websocket, None)
        self.detection_modes.pop(websocket, None)
        self.color_detectors.pop(websocket, None)
        logger.info(f"Client disconnected. Total connections: {len(self.active_connections)}")

    def get_calculator(self, websocket: WebSocket) -> MetricsCalculator:
        """Get metrics calculator for connection."""
        if websocket not in self.metrics_calculators:
            self.metrics_calculators[websocket] = MetricsCalculator()
        return self.metrics_calculators[websocket]

    async def send_result(self, websocket: WebSocket, result: dict):
        """Send analysis result to client."""
        try:
            await websocket.send_json({
                'type': 'result',
                'data': result
            })
        except Exception as e:
            logger.error(f"Failed to send result: {e}")

    async def send_error(self, websocket: WebSocket, error: str):
        """Send error message to client."""
        try:
            await websocket.send_json({
                'type': 'error',
                'data': error
            })
        except Exception as e:
            logger.error(f"Failed to send error: {e}")

    async def send_json(self, websocket: WebSocket, msg_type: str, data: dict):
        """Send a typed JSON message to client."""
        try:
            await websocket.send_json({
                'type': msg_type,
                'data': data
            })
        except Exception as e:
            logger.error(f"Failed to send {msg_type}: {e}")


# Global connection manager
manager = ConnectionManager()


async def handle_websocket(websocket: WebSocket):
    """Handle WebSocket connection for frame analysis."""
    await manager.connect(websocket)
    detector = get_detector()
    calculator = manager.get_calculator(websocket)

    try:
        while True:
            # Receive frame data
            data = await websocket.receive_text()

            try:
                message = json.loads(data)
                msg_type = message.get('type', '')

                if msg_type == 'set_mode':
                    # Set detection mode for this connection
                    mode = message.get('data', {}).get('mode', 'ai_pose')
                    manager.detection_modes[websocket] = mode
                    if mode == DetectionMode.COLOR_MARKER:
                        if websocket not in manager.color_detectors:
                            manager.color_detectors[websocket] = ColorMarkerDetector()
                    calculator.reset()
                    await manager.send_json(websocket, 'mode_set', {'mode': mode})

                elif msg_type == 'update_marker_config':
                    # Update HSV ranges for markers
                    markers_data = message.get('data', {}).get('markers', [])
                    configs = []
                    for m in markers_data:
                        configs.append(ColorMarkerConfig(
                            joint_name=m['joint_name'],
                            color_name=m['color_name'],
                            position_order=m.get('position_order', 1),
                            hsv_range=HSVRange(**m['hsv_range']),
                            display_color=m.get('display_color', '#FFFFFF'),
                        ))
                    if websocket not in manager.color_detectors:
                        manager.color_detectors[websocket] = ColorMarkerDetector(configs)
                    else:
                        manager.color_detectors[websocket].update_configs(configs)
                    await manager.send_json(websocket, 'marker_config_updated', {'count': len(configs)})

                elif msg_type == 'calibrate_frame':
                    # Process frame in calibration mode
                    frame_data = message.get('data', '')
                    mode = manager.detection_modes.get(websocket, DetectionMode.AI_POSE)

                    frame = detector.decode_frame(frame_data)
                    if frame is None:
                        await manager.send_error(websocket, 'Failed to decode calibration frame')
                        continue

                    if mode == DetectionMode.COLOR_MARKER:
                        color_det = manager.color_detectors.get(websocket)
                        if not color_det:
                            color_det = ColorMarkerDetector()
                            manager.color_detectors[websocket] = color_det
                        detected_points = color_det.detect_all_colors(frame)
                    else:
                        # AI pose mode calibration: run YOLO and return keypoints as detected points
                        keypoints, confidence = detector.detect(frame)
                        detected_points = []
                        if keypoints:
                            for joint_name, kp in keypoints.items():
                                if kp['confidence'] > 0.3:
                                    detected_points.append({
                                        'id': f"ai_{joint_name}",
                                        'x': kp['x'],
                                        'y': kp['y'],
                                        'suggested_label': joint_name,
                                        'color_name': None,
                                        'confidence': kp['confidence'],
                                    })

                    await manager.send_json(websocket, 'calibration_result', {
                        'detected_points': detected_points
                    })

                elif msg_type == 'confirm_calibration':
                    # Confirm label mapping from calibration
                    label_mapping = message.get('data', {}).get('label_mapping', {})
                    mode = manager.detection_modes.get(websocket, DetectionMode.AI_POSE)

                    if mode == DetectionMode.COLOR_MARKER:
                        color_det = manager.color_detectors.get(websocket)
                        if color_det:
                            color_det.set_label_mapping(label_mapping)

                    calculator.reset()
                    await manager.send_json(websocket, 'calibration_confirmed', {'success': True})

                elif msg_type == 'frame':
                    # Normal frame processing
                    frame_data = message.get('data', '')
                    timestamp = message.get('timestamp', 0)

                    frame = detector.decode_frame(frame_data)
                    if frame is None:
                        await manager.send_error(websocket, 'Failed to decode frame')
                        continue

                    mode = manager.detection_modes.get(websocket, DetectionMode.AI_POSE)

                    if mode == DetectionMode.COLOR_MARKER:
                        color_det = manager.color_detectors.get(websocket)
                        if color_det:
                            keypoints, confidence = color_det.detect(frame)
                        else:
                            keypoints, confidence = None, 0.0
                    else:
                        keypoints, confidence = detector.detect(frame)

                    if keypoints is None:
                        await manager.send_result(websocket, {
                            'timestamp': timestamp,
                            'keypoints': None,
                            'joint_angles': None,
                            'gait_metrics': None,
                            'confidence': 0.0
                        })
                        continue

                    # Calculate metrics with detection mode
                    metrics = calculator.calculate_gait_metrics(keypoints, timestamp, mode)

                    result = {
                        'timestamp': timestamp,
                        'keypoints': keypoints,
                        'joint_angles': metrics['joint_angles'],
                        'gait_metrics': metrics['gait_metrics'],
                        'confidence': confidence
                    }

                    await manager.send_result(websocket, result)

            except json.JSONDecodeError:
                await manager.send_error(websocket, 'Invalid JSON')
            except Exception as e:
                logger.error(f"Error processing frame: {e}")
                await manager.send_error(websocket, str(e))

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)

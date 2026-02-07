import json
import logging
from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Set
import asyncio

from .pose_detector import get_detector
from .metrics import MetricsCalculator

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manage WebSocket connections."""

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self.metrics_calculators: Dict[WebSocket, MetricsCalculator] = {}

    async def connect(self, websocket: WebSocket):
        """Accept new connection."""
        await websocket.accept()
        self.active_connections.add(websocket)
        self.metrics_calculators[websocket] = MetricsCalculator()
        logger.info(f"Client connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        """Remove connection."""
        self.active_connections.discard(websocket)
        if websocket in self.metrics_calculators:
            del self.metrics_calculators[websocket]
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

                if message.get('type') != 'frame':
                    continue

                frame_data = message.get('data', '')
                timestamp = message.get('timestamp', 0)

                # Decode and process frame
                frame = detector.decode_frame(frame_data)

                if frame is None:
                    await manager.send_error(websocket, 'Failed to decode frame')
                    continue

                # Run pose detection
                keypoints, confidence = detector.detect(frame)

                if keypoints is None:
                    # No detection, send empty result
                    await manager.send_result(websocket, {
                        'timestamp': timestamp,
                        'keypoints': None,
                        'joint_angles': None,
                        'gait_metrics': None,
                        'confidence': 0.0
                    })
                    continue

                # Calculate metrics
                metrics = calculator.calculate_gait_metrics(keypoints, timestamp)

                # Send result
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

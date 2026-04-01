"""MQTT消息处理器 - 发布检测事件和告警"""

import logging
import uuid
from datetime import datetime

from app.core.mqtt_client import get_mqtt_client
from app.core.yolo_engine import FrameDetections

logger = logging.getLogger(__name__)


def publish_detection_event(
    camera_id: str,
    detections: FrameDetections,
    event_type: str,
    image_url: str = "",
):
    """发布检测事件到MQTT"""
    client = get_mqtt_client()
    for det in detections.detections:
        payload = {
            "event_id": str(uuid.uuid4()),
            "camera_id": camera_id,
            "event_type": event_type,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "confidence": det.confidence,
            "bbox": det.bbox,
            "class": det.class_name,
            "image_url": image_url,
        }
        client.publish(f"detection/{camera_id}", payload)


def publish_alert(
    camera_id: str,
    severity: str,
    message: str,
):
    """发布告警到MQTT"""
    client = get_mqtt_client()
    payload = {
        "alert_id": str(uuid.uuid4()),
        "severity": severity,
        "message": message,
        "camera_id": camera_id,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }
    client.publish(f"alert/{camera_id}", payload)

"""检测结果后处理与分析"""

import logging
from datetime import datetime
from typing import Optional

import cv2
import numpy as np

from app.core.yolo_engine import FrameDetections, DetectionResult

logger = logging.getLogger(__name__)


def annotate_frame(
    frame: np.ndarray,
    detections: FrameDetections,
    color_map: Optional[dict[str, tuple]] = None,
) -> np.ndarray:
    """在帧上标注检测结果"""
    annotated = frame.copy()
    default_color = (0, 255, 0)

    for det in detections.detections:
        color = (color_map or {}).get(det.class_name, default_color)
        x1, y1, x2, y2 = [int(v) for v in det.bbox]
        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
        label = f"{det.class_name} {det.confidence:.2f}"
        cv2.putText(annotated, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

    return annotated


def save_detection_image(
    frame: np.ndarray,
    detections: FrameDetections,
    save_dir: str,
    camera_id: str,
) -> Optional[str]:
    """保存检测结果图片"""
    if detections.count == 0:
        return None

    import os
    os.makedirs(save_dir, exist_ok=True)

    annotated = annotate_frame(frame, detections)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    filename = f"{camera_id}_{timestamp}.jpg"
    filepath = os.path.join(save_dir, filename)
    cv2.imwrite(filepath, annotated)
    return filepath


def classify_event_type(detections: FrameDetections) -> str:
    """根据检测结果分类事件类型"""
    safety_classes = {"no_helmet", "no_vest", "fall", "intrusion"}
    defect_classes = {"missing_component", "solder_defect", "misalignment", "foreign_object"}

    for det in detections.detections:
        if det.class_name in safety_classes:
            return "safety"
        if det.class_name in defect_classes:
            return "defect"
    return "efficiency"


def determine_severity(event_type: str, confidence: float) -> str:
    """根据事件类型和置信度确定告警级别"""
    if event_type == "safety" and confidence > 0.8:
        return "critical"
    if event_type == "safety" or (event_type == "defect" and confidence > 0.7):
        return "warning"
    return "info"

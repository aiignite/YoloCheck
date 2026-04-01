"""实时检测流水线 - 串联视频采集、YOLO推理、事件处理、告警触发"""

import asyncio
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Optional, Callable

from app.config import get_settings
from app.core.yolo_engine import YOLOEngine, FrameDetections, get_engine
from app.core.stream_manager import stream_manager
from app.core.detection import (
    save_detection_image,
    classify_event_type,
    determine_severity,
)
from app.core.alert_rules import evaluate_rules
from app.core.mqtt_handler import publish_detection_event, publish_alert

logger = logging.getLogger(__name__)
settings = get_settings()


class DetectionPipeline:
    """实时检测流水线"""

    def __init__(
        self,
        engine: Optional[YOLOEngine] = None,
        detection_interval: float = 1.0,
        on_detection: Optional[Callable] = None,
        on_alert: Optional[Callable] = None,
    ):
        self._engine = engine
        self._interval = detection_interval
        self._running = False
        self._executor = ThreadPoolExecutor(max_workers=4)
        self._on_detection = on_detection
        self._on_alert = on_alert
        # 性能统计
        self._stats = {"frames_processed": 0, "detections_total": 0, "avg_inference_ms": 0.0}

    @property
    def stats(self) -> dict:
        return self._stats.copy()

    def _get_engine(self) -> YOLOEngine:
        if self._engine is None:
            self._engine = get_engine(
                model_path=settings.yolo_model_path,
                confidence_threshold=settings.yolo_confidence_threshold,
                device=settings.yolo_device,
            )
        return self._engine

    def _process_camera(self, camera_id: str):
        """处理单路摄像头的一帧"""
        frame = stream_manager.get_frame(camera_id)
        if frame is None:
            return

        engine = self._get_engine()
        result = engine.predict(frame)

        self._stats["frames_processed"] += 1
        self._stats["detections_total"] += result.count
        # 滑动平均推理时间
        alpha = 0.1
        self._stats["avg_inference_ms"] = (
            self._stats["avg_inference_ms"] * (1 - alpha) + result.inference_time_ms * alpha
        )

        if result.count == 0:
            return

        # 保存检测图片
        image_path = save_detection_image(
            frame, result, settings.image_save_dir, camera_id
        )

        # 分类事件
        event_type = classify_event_type(result)

        # 发布MQTT事件
        publish_detection_event(camera_id, result, event_type, image_path or "")

        # 告警规则评估
        alerts = evaluate_rules(result)
        for alert_info in alerts:
            publish_alert(camera_id, alert_info["severity"], alert_info["message"])
            if self._on_alert:
                self._on_alert(camera_id, alert_info)

        if self._on_detection:
            self._on_detection(camera_id, result, event_type, image_path)

    async def run(self):
        """异步运行检测流水线"""
        self._running = True
        logger.info("检测流水线启动")
        loop = asyncio.get_running_loop()

        while self._running:
            cameras = stream_manager.active_cameras
            if not cameras:
                await asyncio.sleep(self._interval)
                continue

            # 并发处理所有活跃摄像头
            tasks = [
                loop.run_in_executor(self._executor, self._process_camera, cam_id)
                for cam_id in cameras
            ]
            await asyncio.gather(*tasks, return_exceptions=True)
            await asyncio.sleep(self._interval)

    def stop(self):
        """停止流水线"""
        self._running = False
        logger.info("检测流水线停止")


# 全局流水线实例
pipeline = DetectionPipeline()

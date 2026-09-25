"""YOLO推理引擎封装 - 支持YOLOv8模型加载与推理"""

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class DetectionResult:
    """单个检测结果"""
    class_id: int
    class_name: str
    confidence: float
    bbox: list[float]  # [x1, y1, x2, y2]


@dataclass
class FrameDetections:
    """单帧检测结果"""
    detections: list[DetectionResult] = field(default_factory=list)
    inference_time_ms: float = 0.0
    frame_shape: tuple = (0, 0, 0)

    @property
    def count(self) -> int:
        return len(self.detections)

    def filter_by_confidence(self, threshold: float) -> "FrameDetections":
        filtered = [d for d in self.detections if d.confidence >= threshold]
        return FrameDetections(
            detections=filtered,
            inference_time_ms=self.inference_time_ms,
            frame_shape=self.frame_shape,
        )


class YOLOEngine:
    """YOLOv8推理引擎"""

    def __init__(
        self,
        model_path: str = "yolov8n.pt",
        confidence_threshold: float = 0.5,
        device: str = "cpu",
    ):
        self.model_path = model_path
        self.confidence_threshold = confidence_threshold
        self.device = device
        self._model = None

    def load_model(self) -> bool:
        """加载YOLO模型"""
        try:
            from ultralytics import YOLO
            model_file = Path(self.model_path)
            if not model_file.exists():
                logger.warning(f"模型文件不存在: {self.model_path}，将下载默认模型")
            self._model = YOLO(self.model_path)
            logger.info(f"模型加载成功: {self.model_path}, 设备: {self.device}")
            return True
        except Exception as e:
            logger.error(f"模型加载失败: {e}")
            return False

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    def predict(
        self,
        frame: np.ndarray,
        confidence: Optional[float] = None,
        iou: Optional[float] = None,
    ) -> FrameDetections:
        """对单帧进行推理"""
        if not self.is_loaded:
            raise RuntimeError("模型未加载，请先调用 load_model()")

        conf = confidence or self.confidence_threshold
        import time
        start = time.perf_counter()

        predict_kwargs = dict(source=frame, conf=conf, device=self.device, verbose=False)
        if iou is not None:
            predict_kwargs["iou"] = max(0.1, min(0.95, iou))
        results = self._model.predict(**predict_kwargs)

        elapsed_ms = (time.perf_counter() - start) * 1000

        detections = []
        for result in results:
            boxes = result.boxes
            if boxes is None:
                continue
            for i in range(len(boxes)):
                box = boxes[i]
                cls_id = int(box.cls[0])
                cls_name = result.names[cls_id]
                conf_val = float(box.conf[0])
                xyxy = box.xyxy[0].tolist()
                detections.append(DetectionResult(
                    class_id=cls_id,
                    class_name=cls_name,
                    confidence=round(conf_val, 4),
                    bbox=[round(v, 2) for v in xyxy],
                ))

        return FrameDetections(
            detections=detections,
            inference_time_ms=round(elapsed_ms, 2),
            frame_shape=frame.shape,
        )

    def predict_batch(
        self,
        frames: list[np.ndarray],
        confidence: Optional[float] = None,
        iou: Optional[float] = None,
    ) -> list[FrameDetections]:
        """批量推理"""
        return [self.predict(frame, confidence, iou) for frame in frames]


# 全局引擎实例（可被多个模块共享）
_engines: dict[str, YOLOEngine] = {}


def get_engine(
    model_path: str = "yolov8n.pt",
    confidence_threshold: float = 0.5,
    device: str = "cpu",
) -> YOLOEngine:
    """获取或创建引擎实例"""
    key = f"{model_path}:{device}"
    if key not in _engines:
        engine = YOLOEngine(model_path, confidence_threshold, device)
        engine.load_model()
        _engines[key] = engine
    return _engines[key]

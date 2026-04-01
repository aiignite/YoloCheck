"""YOLO推理引擎单元测试"""

import pytest
import numpy as np

from app.core.yolo_engine import DetectionResult, FrameDetections
from app.core.detection import classify_event_type, determine_severity, annotate_frame
from app.core.alert_rules import evaluate_rules, DEFAULT_RULES


def _make_detection(class_name: str, confidence: float = 0.9) -> DetectionResult:
    return DetectionResult(
        class_id=0,
        class_name=class_name,
        confidence=confidence,
        bbox=[100.0, 200.0, 300.0, 400.0],
    )


def _make_frame_detections(detections: list[DetectionResult]) -> FrameDetections:
    return FrameDetections(
        detections=detections,
        inference_time_ms=15.0,
        frame_shape=(480, 640, 3),
    )


class TestDetectionResult:
    def test_frame_detections_count(self):
        fd = _make_frame_detections([_make_detection("helmet"), _make_detection("no_helmet")])
        assert fd.count == 2

    def test_filter_by_confidence(self):
        fd = _make_frame_detections([
            _make_detection("a", 0.9),
            _make_detection("b", 0.3),
            _make_detection("c", 0.7),
        ])
        filtered = fd.filter_by_confidence(0.5)
        assert filtered.count == 2


class TestClassifyEventType:
    def test_safety_event(self):
        fd = _make_frame_detections([_make_detection("no_helmet")])
        assert classify_event_type(fd) == "safety"

    def test_defect_event(self):
        fd = _make_frame_detections([_make_detection("missing_component")])
        assert classify_event_type(fd) == "defect"

    def test_efficiency_event(self):
        fd = _make_frame_detections([_make_detection("person")])
        assert classify_event_type(fd) == "efficiency"


class TestDetermineSeverity:
    def test_critical(self):
        assert determine_severity("safety", 0.9) == "critical"

    def test_warning_safety(self):
        assert determine_severity("safety", 0.6) == "warning"

    def test_warning_defect(self):
        assert determine_severity("defect", 0.8) == "warning"

    def test_info(self):
        assert determine_severity("efficiency", 0.5) == "info"


class TestAlertRules:
    def test_no_detections_no_alerts(self):
        fd = _make_frame_detections([])
        alerts = evaluate_rules(fd)
        assert len(alerts) == 0

    def test_no_helmet_triggers_warning(self):
        fd = _make_frame_detections([_make_detection("no_helmet", 0.85)])
        alerts = evaluate_rules(fd)
        assert len(alerts) == 1
        assert alerts[0]["severity"] == "warning"

    def test_intrusion_triggers_critical(self):
        fd = _make_frame_detections([_make_detection("intrusion", 0.9)])
        alerts = evaluate_rules(fd)
        assert len(alerts) == 1
        assert alerts[0]["severity"] == "critical"

    def test_low_confidence_no_trigger(self):
        fd = _make_frame_detections([_make_detection("no_helmet", 0.3)])
        alerts = evaluate_rules(fd)
        assert len(alerts) == 0


class TestAnnotateFrame:
    def test_annotate_empty(self):
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        fd = _make_frame_detections([])
        result = annotate_frame(frame, fd)
        assert result.shape == frame.shape

    def test_annotate_with_detections(self):
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        fd = _make_frame_detections([_make_detection("helmet")])
        result = annotate_frame(frame, fd)
        assert result.shape == frame.shape
        # 因为画了矩形和文字，像素值不应全为0
        assert np.any(result > 0)

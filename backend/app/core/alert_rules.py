"""告警规则引擎"""

import logging
from dataclasses import dataclass
from typing import Optional

from app.core.yolo_engine import FrameDetections

logger = logging.getLogger(__name__)


@dataclass
class AlertRule:
    """告警规则"""
    name: str
    target_classes: set[str]
    min_confidence: float
    severity: str  # critical / warning / info
    message_template: str


# 默认告警规则
DEFAULT_RULES: list[AlertRule] = [
    AlertRule(
        name="危险区域入侵",
        target_classes={"person_in_danger_zone", "intrusion"},
        min_confidence=0.6,
        severity="critical",
        message_template="检测到人员进入危险区域 (置信度: {confidence:.0%})",
    ),
    AlertRule(
        name="未佩戴安全帽",
        target_classes={"no_helmet"},
        min_confidence=0.7,
        severity="warning",
        message_template="检测到未佩戴安全帽 (置信度: {confidence:.0%})",
    ),
    AlertRule(
        name="未穿防护服",
        target_classes={"no_vest"},
        min_confidence=0.7,
        severity="warning",
        message_template="检测到未穿防护服 (置信度: {confidence:.0%})",
    ),
    AlertRule(
        name="人员摔倒",
        target_classes={"fall"},
        min_confidence=0.6,
        severity="critical",
        message_template="检测到人员摔倒 (置信度: {confidence:.0%})",
    ),
    AlertRule(
        name="焊接缺陷",
        target_classes={"solder_defect"},
        min_confidence=0.8,
        severity="warning",
        message_template="检测到焊接缺陷 (置信度: {confidence:.0%})",
    ),
    AlertRule(
        name="元件缺失",
        target_classes={"missing_component"},
        min_confidence=0.8,
        severity="warning",
        message_template="检测到元件缺失 (置信度: {confidence:.0%})",
    ),
]


def evaluate_rules(
    detections: FrameDetections,
    rules: Optional[list[AlertRule]] = None,
) -> list[dict]:
    """评估告警规则，返回匹配的告警列表"""
    rules = rules or DEFAULT_RULES
    triggered = []

    for det in detections.detections:
        for rule in rules:
            if det.class_name in rule.target_classes and det.confidence >= rule.min_confidence:
                triggered.append({
                    "rule_name": rule.name,
                    "severity": rule.severity,
                    "message": rule.message_template.format(confidence=det.confidence),
                    "class_name": det.class_name,
                    "confidence": det.confidence,
                    "bbox": det.bbox,
                })
    return triggered

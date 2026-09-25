"""YOLO标注数据集体检与自动修复引擎

移植自 CheckPlatformWithYOLO 原型 DatasetCheckerTool 的真实校验/钳位算法：
- 逐行解析 YOLO 归一化标注 (class_id cx cy w h)，支持空行与 # 注释
- 校验：字段数、classId 合法性与字典范围、NaN、中心点越界、零/负宽高、
  宽高超 1.0 警告、包围盒边缘出界警告
- Auto-Fix 数学钳位：cx/cy 钳位 [0.01, 0.99]（NaN 回退 0.5），
  w/h 取绝对值后钳位 [0.02, 0.98]（NaN 回退 0.1），
  再按边界裁剪 [0.001, 0.999] 重算中心点与宽高
- 程序化生成 Ultralytics data.yaml
"""

import re
from dataclasses import dataclass, field

# 与原型一致的安全钳位常量
CX_MIN, CX_MAX = 0.01, 0.99
WH_MIN, WH_MAX = 0.02, 0.98
EDGE_MIN, EDGE_MAX = 0.001, 0.999

_INT_RE = re.compile(r"^[+-]?\d+")
_FLOAT_RE = re.compile(r"^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?")


def _parse_int(token: str) -> int | None:
    """按前导整数语义解析（与 JS parseInt 一致），失败返回 None"""
    m = _INT_RE.match(token.strip())
    return int(m.group(0)) if m else None


def _parse_float(token: str) -> float | None:
    """按前导浮点语义解析（与 JS parseFloat 一致），失败返回 None"""
    m = _FLOAT_RE.match(token.strip())
    return float(m.group(0)) if m else None


@dataclass
class LineAudit:
    """单行标注诊断结果"""
    lineNumber: int
    rawText: str
    classId: int | None = None
    className: str | None = None
    cx: float | None = None
    cy: float | None = None
    w: float | None = None
    h: float | None = None
    isValid: bool = True
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


@dataclass
class AuditSummary:
    total: int
    valid: int
    errors: int
    warnings: int
    blocked: bool  # 存在阻止训练的语法错误


def _split_data_part(line: str) -> list[str] | None:
    """剥离行内 # 注释并按空白切分；空行/整行注释返回 None"""
    trimmed = line.strip()
    if not trimmed or trimmed.startswith("#"):
        return None
    comment_idx = trimmed.find("#")
    data_part = trimmed[:comment_idx].strip() if comment_idx != -1 else trimmed
    return data_part.split()


def audit_yolo_text(text: str, num_classes: int = 10,
                    class_names: dict[int, str] | None = None) -> tuple[list[LineAudit], AuditSummary]:
    """对 YOLO 标注文本逐行体检

    num_classes: 类别字典大小（classId 合法区间 [0, num_classes-1]），0 表示不校验范围
    class_names: {classId: 显示名}，用于诊断卡回显类名
    """
    items: list[LineAudit] = []
    err_count = 0
    warn_count = 0

    for idx, line in enumerate(text.split("\n")):
        parts = _split_data_part(line)
        if parts is None:
            continue

        errors: list[str] = []
        warnings: list[str] = []
        class_id: int | None = None
        cx = cy = w = h = None

        if len(parts) < 5:
            errors.append(f"字段不足：需要5个参数 (class_id cx cy w h)，当前仅有 {len(parts)} 个")
        else:
            class_id = _parse_int(parts[0])
            cx, cy, w, h = (_parse_float(p) for p in parts[1:5])

            if class_id is None:
                errors.append(f'类别ID必须为非负整数: "{parts[0]}"')
            elif num_classes > 0 and (class_id < 0 or class_id >= num_classes):
                errors.append(f"类别ID {class_id} 超出当前数据字典范围 [0..{num_classes - 1}]")

            if cx is None or cy is None or w is None or h is None:
                errors.append("坐标参数包含非法非浮点数值")
            else:
                if cx < 0 or cx > 1:
                    errors.append(f"中心点 X 越界: {cx} (必须在 [0.0, 1.0] 归一化区间)")
                if cy < 0 or cy > 1:
                    errors.append(f"中心点 Y 越界: {cy} (必须在 [0.0, 1.0] 归一化区间)")
                if w <= 0:
                    errors.append(f"包围盒宽度非法: {w} (必须严格大于 0)")
                elif w > 1:
                    warnings.append(f"包围盒宽度超过整幅画面 1.0: {w}")
                if h <= 0:
                    errors.append(f"包围盒高度非法: {h} (必须严格大于 0)")
                elif h > 1:
                    warnings.append(f"包围盒高度超过整幅画面 1.0: {h}")

                # 边界溢出检查
                if 0 <= cx <= 1 and 0 <= cy <= 1 and w > 0 and h > 0:
                    xmin, xmax = cx - w / 2, cx + w / 2
                    ymin, ymax = cy - h / 2, cy + h / 2
                    if xmin < 0 or xmax > 1 or ymin < 0 or ymax > 1:
                        warnings.append(
                            f"包围盒边缘超出图像边界: [{min(xmin, ymin):.3f}, {max(xmax, ymax):.3f}]"
                        )

        if errors:
            err_count += 1
        if warnings:
            warn_count += 1

        items.append(LineAudit(
            lineNumber=idx + 1,
            rawText=line,
            classId=class_id,
            className=class_names.get(class_id) if class_names and class_id is not None else None,
            cx=cx, cy=cy, w=w, h=h,
            isValid=not errors,
            errors=errors,
            warnings=warnings,
        ))

    summary = AuditSummary(
        total=len(items),
        valid=sum(1 for i in items if i.isValid),
        errors=err_count,
        warnings=warn_count,
        blocked=err_count > 0,
    )
    return items, summary


def auto_fix_yolo_text(text: str, num_classes: int = 10) -> str:
    """Auto-Fix 数学钳位修复，保留空行与 # 注释行"""
    fixed_lines: list[str] = []

    for line in text.split("\n"):
        parts = _split_data_part(line)
        if parts is None:
            fixed_lines.append(line)
            continue

        if len(parts) < 5:
            # 字段不足无法数学修复，保持原样交由体检报告提示
            fixed_lines.append(line)
            continue

        class_id = _parse_int(parts[0])
        if class_id is None or class_id < 0 or (num_classes > 0 and class_id >= num_classes):
            class_id = 0  # 回退到类别 0

        cx = _parse_float(parts[1])
        cy = _parse_float(parts[2])
        w = _parse_float(parts[3])
        h = _parse_float(parts[4])

        # 钳位（NaN/非法回退默认值）
        cx = max(CX_MIN, min(CX_MAX, 0.5 if cx is None else cx))
        cy = max(CX_MIN, min(CX_MAX, 0.5 if cy is None else cy))
        w = max(WH_MIN, min(WH_MAX, 0.1 if w is None else abs(w)))
        h = max(WH_MIN, min(WH_MAX, 0.1 if h is None else abs(h)))

        # 保证包围盒不越过 [0, 1] 边界
        xmin = max(EDGE_MIN, cx - w / 2)
        xmax = min(EDGE_MAX, cx + w / 2)
        ymin = max(EDGE_MIN, cy - h / 2)
        ymax = min(EDGE_MAX, cy + h / 2)

        fixed_lines.append(
            f"{class_id} {(xmin + xmax) / 2:.4f} {(ymin + ymax) / 2:.4f} "
            f"{xmax - xmin:.4f} {ymax - ymin:.4f}"
        )

    return "\n".join(fixed_lines)


def generate_data_yaml(class_names: dict[int, str],
                       dataset_path: str = "./datasets/inspection") -> str:
    """由类别字典程序化生成 Ultralytics data.yaml"""
    names_block = "\n".join(f"  {cid}: {name}" for cid, name in sorted(class_names.items()))
    return (
        "# YoloCheck Production Dataset Config\n"
        f"path: {dataset_path}\n"
        "train: images/train\n"
        "val: images/val\n"
        "test: images/test\n"
        "\n"
        "# Classes Definition\n"
        f"names:\n{names_block}\n"
    )

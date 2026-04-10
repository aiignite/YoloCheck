"""
视频学习引擎 - 分析视频并提取动作序列、关键帧和业务数据

流程：
1. 读取视频 → 获取元数据
2. 按采样率逐帧分析 → YOLO检测
3. 计算场景变化分数 → 识别动作边界
4. 提取关键帧 → 保存截图
5. 生成动作序列 → 存储业务数据
"""
import os
import cv2
import numpy as np
from datetime import datetime
from typing import Optional
from dataclasses import dataclass, field

from app.core.yolo_engine import YOLOEngine, get_engine, FrameDetections
from app.core.video_training import load_action_model_artifact, predict_action_with_prototypes
from app.config import get_settings

settings = get_settings()
_pose_model = None


@dataclass
class VideoMeta:
    path: str
    fps: float
    frame_count: int
    duration_seconds: float
    width: int
    height: int
    resolution: str


@dataclass
class AnalyzedFrame:
    frame_number: int
    timestamp: float  # seconds
    detections: list[dict]
    pose_keypoints: list[dict] = field(default_factory=list)
    interaction_summary: dict = field(default_factory=dict)
    scene_change_score: float = 0.0
    is_boundary: bool = False
    image_path: Optional[str] = None


@dataclass
class DetectedAction:
    step_order: int
    action_name: str
    description: str
    start_frame: int
    end_frame: int
    start_time: float
    end_time: float
    duration: float
    confidence: float
    keyframe_path: Optional[str]
    objects_in_scene: list[str] = field(default_factory=list)
    pose_summary: dict = field(default_factory=dict)
    interaction_summary: dict = field(default_factory=dict)
    features: dict = field(default_factory=dict)


def get_video_metadata(video_path: str) -> VideoMeta:
    """获取视频元数据"""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"无法打开视频: {video_path}")
    try:
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        duration = frame_count / fps if fps > 0 else 0
        return VideoMeta(
            path=video_path,
            fps=fps,
            frame_count=frame_count,
            duration_seconds=round(duration, 2),
            width=width,
            height=height,
            resolution=f"{width}x{height}",
        )
    finally:
        cap.release()


def compute_scene_change(prev_frame: np.ndarray, curr_frame: np.ndarray) -> float:
    """计算两帧之间的场景变化分数（基于直方图差异）"""
    prev_gray = cv2.cvtColor(prev_frame, cv2.COLOR_BGR2GRAY)
    curr_gray = cv2.cvtColor(curr_frame, cv2.COLOR_BGR2GRAY)

    prev_hist = cv2.calcHist([prev_gray], [0], None, [256], [0, 256])
    curr_hist = cv2.calcHist([curr_gray], [0], None, [256], [0, 256])

    cv2.normalize(prev_hist, prev_hist)
    cv2.normalize(curr_hist, curr_hist)

    # Bhattacharyya 距离 (0=完全相同, 1=完全不同)
    compare_mode = getattr(cv2, "HISTCMP_BHATTACHARYYA", None)
    if compare_mode is None:
        compare_mode = getattr(cv2, "HISTCOMP_BHATTACHARYYA")
    score = cv2.compareHist(prev_hist, curr_hist, compare_mode)
    return round(score * 100, 2)


def _detection_to_dict(det) -> dict:
    data = {
        "class_id": det.class_id,
        "class_name": det.class_name,
        "confidence": round(det.confidence, 3),
        "bbox": det.bbox,
    }
    model_source = getattr(det, "model_source", None)
    if model_source:
        data["model_source"] = model_source
    return data


def _get_pose_model():
    global _pose_model
    if _pose_model is None:
        from ultralytics import YOLO
        _pose_model = YOLO("yolov8n-pose.pt")
    return _pose_model


def _extract_pose_keypoints(frame: np.ndarray) -> list[dict]:
    try:
        model = _get_pose_model()
        results = model.predict(source=frame, conf=0.25, device="cpu", verbose=False)
        keypoints_out: list[dict] = []
        for result in results:
            kps = getattr(result, "keypoints", None)
            if kps is None or kps.xy is None:
                continue
            for idx in range(len(kps.xy)):
                xy = kps.xy[idx].tolist()
                conf = kps.conf[idx].tolist() if kps.conf is not None else []
                points = []
                for p_idx, point in enumerate(xy):
                    points.append({
                        "index": p_idx,
                        "x": round(point[0], 2),
                        "y": round(point[1], 2),
                        "conf": round(conf[p_idx], 3) if p_idx < len(conf) else 0.0,
                    })
                keypoints_out.append({"person_index": idx, "points": points})
        return keypoints_out
    except Exception:
        return []


def _estimate_interaction(detections: list[dict], pose_keypoints: list[dict]) -> dict:
    hand_points = []
    for person in pose_keypoints:
        for point in person.get("points", []):
            if point["index"] in (9, 10) and point.get("conf", 0) > 0.2:
                hand_points.append((point["x"], point["y"]))

    interaction_pairs = []
    for det in detections:
        x1, y1, x2, y2 = det.get("bbox", [0, 0, 0, 0])
        cx = (x1 + x2) / 2
        cy = (y1 + y2) / 2
        min_dist = None
        for hx, hy in hand_points:
            dist = ((hx - cx) ** 2 + (hy - cy) ** 2) ** 0.5
            if min_dist is None or dist < min_dist:
                min_dist = dist
        if min_dist is not None and min_dist < 120:
            interaction_pairs.append({
                "object": det.get("class_name"),
                "distance": round(min_dist, 2),
            })

    return {
        "hand_points": len(hand_points),
        "interactions": interaction_pairs,
        "interaction_count": len(interaction_pairs),
    }


def _summarize_pose(segment: list[AnalyzedFrame]) -> dict:
    wrist_x: list[float] = []
    wrist_y: list[float] = []
    people_frames = 0
    for af in segment:
        if af.pose_keypoints:
            people_frames += 1
        for person in af.pose_keypoints:
            for point in person.get("points", []):
                if point["index"] in (9, 10) and point.get("conf", 0) > 0.2:
                    wrist_x.append(point["x"])
                    wrist_y.append(point["y"])
    return {
        "frames_with_pose": people_frames,
        "wrist_span_x": round((max(wrist_x) - min(wrist_x)), 2) if wrist_x else 0,
        "wrist_span_y": round((max(wrist_y) - min(wrist_y)), 2) if wrist_y else 0,
    }


def _smooth_object_frequency(object_frequency: dict[str, int], frame_count: int) -> dict[str, float]:
    if frame_count <= 0:
        return {}
    return {
        name: round(count / frame_count, 3)
        for name, count in sorted(object_frequency.items())
    }


def _compute_quality_score(
    avg_conf: float,
    pose_summary: dict,
    interaction_summary: dict,
    avg_scene_change: float,
    frame_count: int,
) -> float:
    if frame_count <= 0:
        return 0.0

    pose_coverage = min(pose_summary.get("frames_with_pose", 0) / frame_count, 1.0)
    interaction_coverage = min(interaction_summary.get("frames_with_interaction", 0) / frame_count, 1.0)
    scene_stability = max(0.0, 1 - min(avg_scene_change / 100, 1.0))
    quality = (
        avg_conf * 0.45 +
        pose_coverage * 0.2 +
        interaction_coverage * 0.25 +
        scene_stability * 0.1
    )
    return round(min(max(quality, 0.0), 1.0), 3)


def _suggest_action_name(primary_object: Optional[str], interaction_summary: dict, step_order: int) -> str:
    if primary_object and interaction_summary.get("total_interactions", 0) > 0:
        return f"操作{primary_object}"
    if primary_object:
        return f"处理{primary_object}"
    return f"操作步骤{step_order}"


def _build_action_suggestions(
    suggested_action_name: str,
    quality_score: float,
    interaction_summary: dict,
    avg_scene_change: float,
) -> list[dict]:
    suggestions = [{
        "type": "rename",
        "message": f"建议动作名为{suggested_action_name}",
    }]

    if quality_score < 0.7:
        suggestions.append({
            "type": "quality",
            "message": "动作质量偏低，建议检查操作连贯性和检测置信度",
        })

    if interaction_summary.get("total_interactions", 0) == 0:
        suggestions.append({
            "type": "anomaly",
            "message": "未识别到明显交互，建议确认该步骤是否缺少关键操作",
        })

    if avg_scene_change > 35:
        suggestions.append({
            "type": "stability",
            "message": "该步骤画面波动较大，建议复核动作边界是否稳定",
        })

    return suggestions


def apply_custom_action_model(
    actions: list[DetectedAction],
    action_model: Optional[dict],
) -> list[DetectedAction]:
    if not action_model:
        return actions

    model_name = action_model.get("name") or "custom_action"
    model_id = action_model.get("id")
    model_artifact = load_action_model_artifact(action_model.get("model_path"))
    for action in actions:
        skeleton_summary = action.features.get("skeleton_summary") or {
            "format": "coco17",
            "frames": [{
                "frame_number": action.start_frame,
                "timestamp": action.start_time,
                "keypoints": [],
            }],
        }
        prediction = predict_action_with_prototypes(
            model_artifact,
            skeleton_summary,
            duration=action.duration,
        )
        predicted_name = prediction.get("predicted_action_category") if prediction else f"custom_action_step_{action.step_order}"
        action.features.update({
            "predicted_action_category": predicted_name,
            "action_model_score": prediction.get("action_model_score", round(action.confidence or 0.0, 3)) if prediction else round(action.confidence or 0.0, 3),
            "action_model_source": "custom_action",
            "action_model_id": model_id,
            "action_model_name": model_name,
            "skeleton_summary": skeleton_summary,
        })
        if prediction and "prototype_distance" in prediction:
            action.features["prototype_distance"] = prediction["prototype_distance"]
    return actions


def compute_adaptive_scene_threshold(scores: list[float], configured_threshold: float) -> float:
    """
    根据整段视频的 scene_change_score 分布计算动态阈值。

    采用分位数方案：
    - 若有效分数不足5个，回退到配置阈值
    - 否则取 75th 分位数 + 配置阈值 的加权平均
    """
    if not scores or len(scores) < 5:
        return configured_threshold

    sorted_scores = sorted(scores)
    n = len(sorted_scores)
    q75_idx = int(n * 0.75)
    q75 = sorted_scores[min(q75_idx, n - 1)]
    q75 = float(q75)

    adaptive = (q75 * 0.4 + configured_threshold * 0.6)
    return round(adaptive, 2)


def compute_object_change_score(prev_objects: dict[str, int], curr_objects: dict[str, int]) -> float:
    """
    基于对象集合或对象频次计算变化强度，输出 0-1 范围标准化分值。

    0 = 完全相同，1 = 完全不同（对象集合完全不同）。
    """
    prev_keys = set(prev_objects.keys())
    curr_keys = set(curr_objects.keys())

    if not prev_keys and not curr_keys:
        return 0.0
    if not prev_keys or not curr_keys:
        return 1.0

    all_keys = prev_keys | curr_keys
    if not all_keys:
        return 0.0

    total_diff = 0.0
    for key in all_keys:
        prev_count = prev_objects.get(key, 0)
        curr_count = curr_objects.get(key, 0)
        total_diff += abs(prev_count - curr_count)

    max_possible_diff = sum(
        prev_objects.get(k, 0) + curr_objects.get(k, 0)
        for k in all_keys
    )

    if max_possible_diff == 0:
        return 0.0

    return round(min(total_diff / max_possible_diff, 1.0), 3)


def compute_interaction_change_score(
    prev_interactions: list[dict],
    curr_interactions: list[dict],
) -> float:
    """
    基于手-物交互数量与类型变化评估动作切换概率，输出 0-1 范围标准化分值。
    """
    if not prev_interactions and not curr_interactions:
        return 0.0
    if not prev_interactions or not curr_interactions:
        return 1.0

    prev_set = {(i.get("object"), round(i.get("distance", 0), 1)) for i in prev_interactions}
    curr_set = {(i.get("object"), round(i.get("distance", 0), 1)) for i in curr_interactions}

    if prev_set == curr_set:
        return 0.0

    all_pairs = prev_set | curr_set
    diff_count = len(all_pairs - (prev_set & curr_set))

    return round(min(diff_count / max(len(all_pairs), 1), 1.0), 3)


def compute_pose_motion_score(segment_frames: list[AnalyzedFrame]) -> dict:
    """
    统计 wrist span、关键点覆盖率、位移变化，用于辅助判断动作边界和动作稳定性。
    """
    wrist_x: list[float] = []
    wrist_y: list[float] = []
    frames_with_pose = 0
    total_points: list[int] = []

    for af in segment_frames:
        if af.pose_keypoints:
            frames_with_pose += 1
        for person in af.pose_keypoints:
            for point in person.get("points", []):
                if point["index"] in (9, 10) and point.get("conf", 0) > 0.2:
                    wrist_x.append(point["x"])
                    wrist_y.append(point["y"])
                total_points.append(1)

    span_x = round((max(wrist_x) - min(wrist_x)), 2) if len(wrist_x) > 1 else 0.0
    span_y = round((max(wrist_y) - min(wrist_y)), 2) if len(wrist_y) > 1 else 0.0
    stability = 1.0 if span_x < 30 and span_y < 30 else (0.5 if span_x < 60 and span_y < 60 else 0.0)

    return {
        "frames_with_pose": frames_with_pose,
        "wrist_span_x": span_x,
        "wrist_span_y": span_y,
        "stability_score": round(stability, 3),
    }


def compute_boundary_score(frame_context: dict) -> dict:
    """
    将 scene_change、object_change、interaction_change、pose_motion 合成边界分。
    同时输出 boundary_reasons。
    """
    scene_score = frame_context.get("scene_change_score", 0.0)
    prev_objects = frame_context.get("prev_objects", {})
    curr_objects = frame_context.get("curr_objects", {})
    prev_interactions = frame_context.get("prev_interactions", [])
    curr_interactions = frame_context.get("curr_interactions", [])
    prev_pose = frame_context.get("prev_pose", {})
    curr_pose = frame_context.get("curr_pose", {})

    object_change = compute_object_change_score(prev_objects, curr_objects)
    interaction_change = compute_interaction_change_score(prev_interactions, curr_interactions)

    scene_component = min(scene_score / 100, 1.0)
    combined = (
        scene_component * 0.35 +
        object_change * 0.30 +
        interaction_change * 0.25 +
        0.10
    )
    boundary_score = round(min(combined, 1.0), 3)

    reasons: list[str] = []
    if scene_score >= 40:
        reasons.append("scene_jump")
    if object_change >= 0.5:
        reasons.append("object_set_changed")
    if interaction_change >= 0.5:
        reasons.append("interaction_changed")

    if prev_pose and curr_pose:
        prev_span = abs(prev_pose.get("wrist_span_x", 0) - curr_pose.get("wrist_span_x", 0))
        if prev_span >= 25:
            reasons.append("pose_motion_spike")

    return {
        "score": boundary_score,
        "reasons": reasons,
        "object_change_score": object_change,
        "interaction_change_score": interaction_change,
    }


def merge_similar_actions(actions: list[DetectedAction], min_duration_threshold: float = 0.5) -> list[DetectedAction]:
    """
    对相邻动作段进行二次合并。

    合并条件：
    - 短动作（时长 < min_duration_threshold）与其相邻动作合并
    - 相邻动作间的对象集合相似度高（> 0.6）、姿态摘要相似度高
    """
    if len(actions) <= 1:
        return actions

    merged: list[DetectedAction] = []

    def _can_merge(prev_action: DetectedAction, action: DetectedAction) -> bool:
        prev_objects = dict.fromkeys(prev_action.objects_in_scene or [], 1)
        curr_objects = dict.fromkeys(action.objects_in_scene or [], 1)
        object_change_score = compute_object_change_score(prev_objects, curr_objects)
        obj_similarity = 1.0 - object_change_score

        prev_pose = prev_action.features.get("pose_summary", {}) if prev_action.features else {}
        curr_pose = action.features.get("pose_summary", {}) if action.features else {}

        pose_similar = bool(prev_pose or curr_pose) and (
            abs(prev_pose.get("wrist_span_x", 0) - curr_pose.get("wrist_span_x", 0)) < 20 and
            abs(prev_pose.get("wrist_span_y", 0) - curr_pose.get("wrist_span_y", 0)) < 20
        )

        same_primary_object = (prev_action.features or {}).get("primary_object") == (action.features or {}).get("primary_object")
        objects_overlap = bool(set(prev_action.objects_in_scene or []).intersection(action.objects_in_scene or []))
        return obj_similarity > 0.6 and object_change_score < 1.0 and objects_overlap and pose_similar and same_primary_object

    for action in actions:
        if not merged:
            merged.append(action)
            continue

        prev_action = merged[-1]

        should_merge = False

        if (action.duration or 0) < min_duration_threshold:
            should_merge = _can_merge(prev_action, action)
        else:
            should_merge = _can_merge(prev_action, action)

        if should_merge:
            merged[-1] = _merge_two_actions(prev_action, action)
            merged[-1].features["merged_similar"] = True
        else:
            merged.append(action)

    for idx, act in enumerate(merged, start=1):
        act.step_order = idx

    return merged


def _merge_two_actions(target: DetectedAction, source: DetectedAction) -> DetectedAction:
    target.start_frame = min(target.start_frame, source.start_frame)
    target.end_frame = max(target.end_frame, source.end_frame)
    target.start_time = round(min(target.start_time, source.start_time), 3)
    target.end_time = round(max(target.end_time, source.end_time), 3)
    target.duration = round((target.end_time or 0) - (target.start_time or 0), 3)
    target.objects_in_scene = sorted(set((target.objects_in_scene or []) + (source.objects_in_scene or [])))
    target.features = {
        **(target.features or {}),
        "merged_similar": True,
    }
    if not target.keyframe_path:
        target.keyframe_path = source.keyframe_path
    if target.confidence is not None and source.confidence is not None:
        target.confidence = round((target.confidence + source.confidence) / 2, 3)
    return target


def _build_workflow_summary(actions: list[DetectedAction]) -> tuple[dict, list[dict]]:
    if not actions:
        return {}, []

    suggested_names = [
        action.features.get("suggested_action_name") or action.action_name
        for action in actions
    ]
    quality_scores = [
        action.features.get("quality_score", 0.0)
        for action in actions
    ]
    workflow_summary = {
        "dominant_sequence": suggested_names,
        "quality_score_avg": round(sum(quality_scores) / len(quality_scores), 3),
        "step_count": len(actions),
    }

    workflow_suggestions: list[dict] = []
    low_quality_steps = [
        action.step_order
        for action in actions
        if action.features.get("quality_score", 0.0) < 0.7
    ]
    if low_quality_steps:
        workflow_suggestions.append({
            "type": "quality",
            "message": f"第{', '.join(str(step) for step in low_quality_steps)}步质量评分偏低，建议优先复核",
        })

    anomalous_steps = [
        action.step_order
        for action in actions
        if any(s.get("type") == "anomaly" for s in action.features.get("suggestions", []))
    ]
    if anomalous_steps:
        workflow_suggestions.append({
            "type": "anomaly",
            "message": f"第{', '.join(str(step) for step in anomalous_steps)}步缺少明确交互，建议确认流程完整性",
        })

    if not workflow_suggestions:
        workflow_suggestions.append({
            "type": "quality",
            "message": "当前流程整体稳定，可基于建议动作名进一步整理标准步骤",
        })

    return workflow_summary, workflow_suggestions


def save_keyframe(frame: np.ndarray, template_id: int, session_id: int, frame_number: int) -> str:
    """保存关键帧截图"""
    save_dir = os.path.join(settings.upload_dir, "keyframes", f"template_{template_id}")
    os.makedirs(save_dir, exist_ok=True)
    filename = f"session_{session_id}_frame_{frame_number}.jpg"
    path = os.path.join(save_dir, filename)
    cv2.imwrite(path, frame)
    return path


def analyze_video_frames(
    video_path: str,
    template_id: int,
    session_id: int,
    learning_mode: str = "action_and_object",
    focus_classes: Optional[list[str]] = None,
    sample_rate: int = 5,
    min_confidence: float = 0.4,
    scene_threshold: float = 30.0,
    object_model: Optional[dict] = None,
    progress_callback=None,
) -> list[AnalyzedFrame]:
    """
    逐帧分析视频

    参数:
        video_path: 视频文件路径
        template_id: 模板ID
        session_id: 会话ID
        sample_rate: 每N帧采样一次
        min_confidence: YOLO最低置信度
        scene_threshold: 场景变化判定阈值
        progress_callback: 进度回调 (processed: int, total: int)
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"无法打开视频: {video_path}")

    if object_model:
        engine = get_engine(model_path=object_model.get("model_path", settings.yolo_model_path))
    else:
        engine = get_engine(model_path=settings.yolo_model_path)
        if not engine.is_loaded:
            # 默认检测模型损坏时，退回到可工作的 pose 模型，至少保证人体/姿态链路可运行
            engine = get_engine(model_path="yolov8n-pose.pt")
    original_threshold = engine.confidence_threshold
    engine.confidence_threshold = min_confidence

    results: list[AnalyzedFrame] = []
    focus_classes = focus_classes or []
    prev_frame = None
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frame_idx = 0

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % sample_rate == 0:
                timestamp = frame_idx / fps

                # YOLO检测
                frame_dets = engine.predict(frame)
                det_dicts = [_detection_to_dict(d) for d in frame_dets.detections]
                if object_model:
                    for det in det_dicts:
                        det["model_source"] = "custom_object"
                        det["model_id"] = object_model.get("id")
                        det["model_name"] = object_model.get("name")
                if focus_classes:
                    det_dicts = [d for d in det_dicts if d["class_name"] in focus_classes]
                pose_keypoints = _extract_pose_keypoints(frame) if learning_mode in ("action_only", "action_and_object") else []
                interaction_summary = _estimate_interaction(det_dicts, pose_keypoints)
                if learning_mode == "action_only":
                    # 第一阶段: 用对象检测统计 + 时间变化近似动作学习，保留接口以便后续接 pose
                    pass
                elif learning_mode == "object_only":
                    # 仅保留对象学习时，不额外处理动作特征
                    pass

                # 场景变化计算
                scene_score = 0.0
                if prev_frame is not None:
                    scene_score = compute_scene_change(prev_frame, frame)

                is_boundary = scene_score > scene_threshold

                # 保存关键帧（边界帧或有检测结果的帧）
                image_path = None
                if is_boundary or len(det_dicts) > 0:
                    image_path = save_keyframe(frame, template_id, session_id, frame_idx)

                af = AnalyzedFrame(
                    frame_number=frame_idx,
                    timestamp=round(timestamp, 3),
                    detections=det_dicts,
                    pose_keypoints=pose_keypoints,
                    interaction_summary=interaction_summary,
                    scene_change_score=scene_score,
                    is_boundary=is_boundary,
                    image_path=image_path,
                )
                results.append(af)
                prev_frame = frame.copy()

                if progress_callback:
                    progress_callback(frame_idx, total_frames)

            frame_idx += 1
    finally:
        cap.release()
        engine.confidence_threshold = original_threshold

    return results


def extract_actions(
    analyzed_frames: list[AnalyzedFrame],
    fps: float,
    min_action_duration_seconds: float = 0.0,
    object_change_sensitivity: str = "medium",
) -> list[DetectedAction]:
    """
    从分析帧中提取动作序列

    使用场景边界和检测物体变化来划分动作段
    """
    if not analyzed_frames:
        return []

    sensitivity_threshold = {
        "low": 2,
        "medium": 1,
        "high": 0,
    }.get(object_change_sensitivity, 1)

    # 找到所有边界帧的索引
    boundary_indices = [0]  # 视频开始即为第一个边界
    previous_objects = {
        det["class_name"]
        for det in analyzed_frames[0].detections
    }
    for i, af in enumerate(analyzed_frames):
        if af.is_boundary and i > 0:
            boundary_indices.append(i)
            previous_objects = {
                det["class_name"]
                for det in af.detections
            }
            continue
        if i > 0:
            current_objects = {
                det["class_name"]
                for det in af.detections
            }
            symmetric_diff = len(current_objects.symmetric_difference(previous_objects))
            if current_objects and previous_objects and symmetric_diff > sensitivity_threshold:
                boundary_indices.append(i)
            if current_objects:
                previous_objects = current_objects
    boundary_indices.append(len(analyzed_frames))  # 视频结束
    boundary_indices = sorted(set(boundary_indices))

    actions: list[DetectedAction] = []
    for seq_idx in range(len(boundary_indices) - 1):
        start_idx = boundary_indices[seq_idx]
        end_idx = boundary_indices[seq_idx + 1] - 1
        if end_idx < start_idx:
            end_idx = start_idx

        segment = analyzed_frames[start_idx: end_idx + 1]
        if not segment:
            continue

        start_af = segment[0]
        end_af = segment[-1]

        # 收集此段中出现的所有对象
        all_objects = set()
        object_frequency: dict[str, int] = {}
        all_confidences = []
        for af in segment:
            for det in af.detections:
                all_objects.add(det["class_name"])
                object_frequency[det["class_name"]] = object_frequency.get(det["class_name"], 0) + 1
                all_confidences.append(det["confidence"])

        avg_conf = sum(all_confidences) / len(all_confidences) if all_confidences else 0.0
        objects_list = sorted(all_objects)

        # 动作命名：基于检测到的主要对象
        primary_object = max(object_frequency, key=object_frequency.get) if object_frequency else None
        if objects_list:
            action_name = f"操作阶段{seq_idx + 1}: {primary_object}相关操作"
            description = f"检测到对象: {', '.join(objects_list)}。" \
                          f"帧范围: {start_af.frame_number}-{end_af.frame_number}"
        else:
            action_name = f"操作阶段{seq_idx + 1}: 常规操作"
            description = f"帧范围: {start_af.frame_number}-{end_af.frame_number}，" \
                          "未检测到特定对象"

        # 选最佳关键帧
        keyframe_path = None
        for af in segment:
            if af.image_path:
                keyframe_path = af.image_path
                break

        duration = end_af.timestamp - start_af.timestamp
        pose_summary = _summarize_pose(segment)
        interaction_summary = {
            "total_interactions": sum(af.interaction_summary.get("interaction_count", 0) for af in segment),
            "frames_with_interaction": sum(1 for af in segment if af.interaction_summary.get("interaction_count", 0) > 0),
        }

        avg_scene_change = round(
            sum(af.scene_change_score for af in segment) / len(segment), 2
        ) if segment else 0
        smoothed_object_frequency = _smooth_object_frequency(object_frequency, len(segment))
        suggested_action_name = _suggest_action_name(primary_object, interaction_summary, seq_idx + 1)
        quality_score = _compute_quality_score(
            avg_conf=avg_conf,
            pose_summary=pose_summary,
            interaction_summary=interaction_summary,
            avg_scene_change=avg_scene_change,
            frame_count=len(segment),
        )
        suggestions = _build_action_suggestions(
            suggested_action_name=suggested_action_name,
            quality_score=quality_score,
            interaction_summary=interaction_summary,
            avg_scene_change=avg_scene_change,
        )

        pose_motion_result = compute_pose_motion_score(segment)
        detection_score = round(avg_conf, 3) if avg_conf else 0.0
        pose_score = round(
            pose_motion_result["frames_with_pose"] / max(len(segment), 1) if len(segment) > 0 else 0.0, 3
        )
        interaction_score = round(
            interaction_summary.get("frames_with_interaction", 0) / max(len(segment), 1) if len(segment) > 0 else 0.0, 3
        )
        stability_score = pose_motion_result.get("stability_score", 0.0)
        boundary_score_for_segment = round(avg_scene_change / 100, 3) if avg_scene_change else 0.0
        boundary_reasons_for_segment: list[str] = []
        if avg_scene_change >= 40:
            boundary_reasons_for_segment.append("scene_jump")

        actions.append(DetectedAction(
            step_order=seq_idx + 1,
            action_name=action_name,
            description=description,
            start_frame=start_af.frame_number,
            end_frame=end_af.frame_number,
            start_time=round(start_af.timestamp, 3),
            end_time=round(end_af.timestamp, 3),
            duration=round(duration, 3),
            confidence=round(avg_conf, 3),
            keyframe_path=keyframe_path,
            objects_in_scene=objects_list,
            pose_summary=pose_summary,
            interaction_summary=interaction_summary,
            features={
                "frame_count": len(segment),
                "detections_total": sum(len(af.detections) for af in segment),
                "unique_objects": len(objects_list),
                "primary_object": primary_object,
                "object_frequency": object_frequency,
                "smoothed_object_frequency": smoothed_object_frequency,
                "pose_summary": pose_summary,
                "interaction_summary": interaction_summary,
                "avg_scene_change": avg_scene_change,
                "quality_score": quality_score,
                "suggested_action_name": suggested_action_name,
                "suggestions": suggestions,
                "skeleton_summary": {
                    "format": "coco17",
                    "frames": [
                        {
                            "frame_number": af.frame_number,
                            "timestamp": af.timestamp,
                            "keypoints": [
                                point
                                for person in af.pose_keypoints
                                for point in person.get("points", [])
                            ],
                        }
                        for af in segment
                    ],
                },
                "boundary_score": boundary_score_for_segment,
                "boundary_reasons": boundary_reasons_for_segment,
                "detection_score": detection_score,
                "pose_score": pose_score,
                "interaction_score": interaction_score,
                "stability_score": stability_score,
                "primary_objects": [primary_object] if primary_object else [],
            },
        ))

    if min_action_duration_seconds <= 0 or len(actions) <= 1:
        return merge_similar_actions(actions, min_duration_threshold=0.5)

    merged_actions: list[DetectedAction] = []

    def merge_action_pair(target: DetectedAction, source: DetectedAction) -> DetectedAction:
        target.start_frame = min(target.start_frame, source.start_frame)
        target.end_frame = max(target.end_frame, source.end_frame)
        target.start_time = round(min(target.start_time, source.start_time), 3)
        target.end_time = round(max(target.end_time, source.end_time), 3)
        target.duration = round((target.end_time or 0) - (target.start_time or 0), 3)
        target.objects_in_scene = sorted(set((target.objects_in_scene or []) + (source.objects_in_scene or [])))
        target.features = {
            **(target.features or {}),
            "merged_short_segment": True,
        }
        if not target.keyframe_path:
            target.keyframe_path = source.keyframe_path
        return target

    for action in actions:
        if (action.duration or 0) < min_action_duration_seconds:
            if merged_actions:
                merge_action_pair(merged_actions[-1], action)
                continue
            merged_actions.append(action)
            continue

        if merged_actions and (merged_actions[-1].duration or 0) < min_action_duration_seconds:
            merge_action_pair(action, merged_actions.pop())
        merged_actions.append(action)

    for idx, action in enumerate(merged_actions, start=1):
        action.step_order = idx

    return merge_similar_actions(merged_actions, min_duration_threshold=0.5)


def generate_analysis_summary(
    meta: VideoMeta,
    analyzed_frames: list[AnalyzedFrame],
    actions: list[DetectedAction],
) -> dict:
    """生成分析结果摘要"""
    all_objects = set()
    object_frequency: dict[str, int] = {}
    total_detections = 0
    for af in analyzed_frames:
        for det in af.detections:
            all_objects.add(det["class_name"])
            object_frequency[det["class_name"]] = object_frequency.get(det["class_name"], 0) + 1
            total_detections += 1

    boundary_count = sum(1 for af in analyzed_frames if af.is_boundary)

    workflow_summary, workflow_suggestions = _build_workflow_summary(actions)

    return {
        "video": {
            "duration_seconds": meta.duration_seconds,
            "fps": meta.fps,
            "frame_count": meta.frame_count,
            "resolution": meta.resolution,
        },
        "analysis": {
            "sampled_frames": len(analyzed_frames),
            "total_detections": total_detections,
            "unique_objects": sorted(all_objects),
            "object_frequency": object_frequency,
            "frames_with_pose": sum(1 for af in analyzed_frames if af.pose_keypoints),
            "frames_with_interaction": sum(1 for af in analyzed_frames if af.interaction_summary.get("interaction_count", 0) > 0),
            "scene_boundaries": boundary_count,
            "actions_identified": len(actions),
        },
        "actions_summary": [
            {
                "step": a.step_order,
                "name": a.action_name,
                "duration": a.duration,
                "objects": a.objects_in_scene,
                "quality_score": a.features.get("quality_score", 0.0),
                "suggested_action_name": a.features.get("suggested_action_name") or a.action_name,
            }
            for a in actions
        ],
        "workflow_summary": workflow_summary,
        "workflow_suggestions": workflow_suggestions,
    }

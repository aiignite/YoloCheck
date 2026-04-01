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
    score = cv2.compareHist(prev_hist, curr_hist, cv2.HISTCOMP_BHATTACHARYYA)
    return round(score * 100, 2)


def _detection_to_dict(det) -> dict:
    return {
        "class_id": det.class_id,
        "class_name": det.class_name,
        "confidence": round(det.confidence, 3),
        "bbox": det.bbox,
    }


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

    engine = get_engine()
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
) -> list[DetectedAction]:
    """
    从分析帧中提取动作序列

    使用场景边界和检测物体变化来划分动作段
    """
    if not analyzed_frames:
        return []

    # 找到所有边界帧的索引
    boundary_indices = [0]  # 视频开始即为第一个边界
    for i, af in enumerate(analyzed_frames):
        if af.is_boundary and i > 0:
            boundary_indices.append(i)
    boundary_indices.append(len(analyzed_frames))  # 视频结束

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
                "pose_summary": pose_summary,
                "interaction_summary": interaction_summary,
                "avg_scene_change": round(
                    sum(af.scene_change_score for af in segment) / len(segment), 2
                ) if segment else 0,
            },
        ))

    return actions


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
            }
            for a in actions
        ],
    }

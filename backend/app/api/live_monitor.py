"""实时监控API - MJPEG视频流 + YOLO姿态检测"""

import asyncio
import io
import json
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Optional
from urllib.parse import unquote

import cv2
import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends
from fastapi.responses import StreamingResponse

from app.config import get_settings
from app.core.auth import require_auth, require_role
from app.models.models import User

logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_settings()

# 线程池用于CPU密集型YOLO推理
_executor = ThreadPoolExecutor(max_workers=2)

# ============================================================
# 摄像头管理（本地设备 + RTSP）
# ============================================================

_camera_caps: dict[str, cv2.VideoCapture] = {}
_camera_lock = asyncio.Lock()


def _enumerate_local_cameras(max_check: int = 5) -> list[dict]:
    """枚举本地可用摄像头设备"""
    cameras = []
    for idx in range(max_check):
        cap = cv2.VideoCapture(idx)
        if cap.isOpened():
            w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            fps = cap.get(cv2.CAP_PROP_FPS) or 30
            cameras.append({
                "index": idx,
                "device_id": f"local_{idx}",
                "name": f"本地摄像头 {idx}",
                "resolution": f"{w}x{h}",
                "fps": round(fps),
            })
            cap.release()
        else:
            cap.release()
    return cameras


@router.get("/local-cameras")
async def list_local_cameras(user: User = Depends(require_auth)):
    """列举本地可用摄像头"""
    loop = asyncio.get_running_loop()
    cameras = await loop.run_in_executor(_executor, _enumerate_local_cameras)
    return {"cameras": cameras}


def _get_or_open_capture(source: str | int) -> Optional[cv2.VideoCapture]:
    """获取或打开视频捕获对象（同步）"""
    key = str(source)
    if key in _camera_caps:
        cap = _camera_caps[key]
        if cap.isOpened():
            return cap
        cap.release()
        del _camera_caps[key]

    cap = cv2.VideoCapture(source)
    if cap.isOpened():
        _camera_caps[key] = cap
        return cap
    cap.release()
    return None


def _release_capture(source: str | int):
    """释放视频捕获对象"""
    key = str(source)
    cap = _camera_caps.pop(key, None)
    if cap:
        cap.release()


# ============================================================
# YOLO姿态检测
# ============================================================

_pose_model = None
_detect_model = None


def _get_pose_model():
    """懒加载YOLO姿态检测模型"""
    global _pose_model
    if _pose_model is None:
        try:
            from ultralytics import YOLO
            _pose_model = YOLO("yolov8n-pose.pt")
            logger.info("YOLO姿态检测模型加载成功: yolov8n-pose.pt")
        except Exception as e:
            logger.warning(f"姿态检测模型加载失败: {e}，将使用目标检测模型替代")
    return _pose_model


def _get_detect_model():
    """懒加载YOLO目标检测模型"""
    global _detect_model
    if _detect_model is None:
        try:
            from ultralytics import YOLO
            model_path = settings.yolo_model_path
            _detect_model = YOLO(model_path)
            logger.info(f"YOLO目标检测模型加载成功: {model_path}")
        except Exception as e:
            logger.warning(f"目标检测模型加载失败: {e}")
    return _detect_model


# COCO骨骼连接关系 (keypoint pairs)
SKELETON_CONNECTIONS = [
    (0, 1), (0, 2), (1, 3), (2, 4),  # 头部
    (5, 6), (5, 7), (7, 9), (6, 8), (8, 10),  # 上肢
    (5, 11), (6, 12), (11, 12),  # 躯干
    (11, 13), (13, 15), (12, 14), (14, 16),  # 下肢
]

KEYPOINT_NAMES = [
    "nose", "left_eye", "right_eye", "left_ear", "right_ear",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_hip", "right_hip",
    "left_knee", "right_knee", "left_ankle", "right_ankle"
]

# 骨骼线颜色（BGR）
SKELETON_COLORS = [
    (255, 0, 0), (255, 85, 0), (255, 170, 0), (255, 255, 0),
    (170, 255, 0), (85, 255, 0), (0, 255, 0), (0, 255, 85),
    (0, 255, 170), (0, 255, 255), (0, 170, 255), (0, 85, 255),
    (0, 0, 255), (85, 0, 255), (170, 0, 255), (255, 0, 255),
]


def _draw_pose_results(frame: np.ndarray, results) -> tuple[np.ndarray, list[dict]]:
    """在帧上绘制姿态检测结果，返回标注帧和检测数据"""
    annotated = frame.copy()
    detections_data = []

    for result in results:
        # 绘制检测框
        if result.boxes is not None:
            for i, box in enumerate(result.boxes):
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                conf = float(box.conf[0])
                cls_id = int(box.cls[0])
                cls_name = result.names[cls_id]

                # 检测框
                color = (0, 255, 0) if conf > 0.7 else (0, 255, 255)
                cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)

                # 标签
                label = f"{cls_name} {conf:.1%}"
                (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 1)
                cv2.rectangle(annotated, (x1, y1 - th - 8), (x1 + tw, y1), color, -1)
                cv2.putText(annotated, label, (x1, y1 - 4),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1, cv2.LINE_AA)

                detection = {
                    "class_name": cls_name,
                    "confidence": round(conf, 3),
                    "bbox": [x1, y1, x2, y2],
                    "keypoints": [],
                }
                detections_data.append(detection)

        # 绘制骨骼关键点
        if hasattr(result, 'keypoints') and result.keypoints is not None:
            kpts_data = result.keypoints.data  # shape: [N, 17, 3]
            for person_idx, kpts in enumerate(kpts_data):
                kpts_np = kpts.cpu().numpy()
                valid_kpts = []

                # 绘制关键点
                for kp_idx, (x, y, kp_conf) in enumerate(kpts_np):
                    if kp_conf > 0.3:
                        px, py = int(x), int(y)
                        cv2.circle(annotated, (px, py), 4, (0, 0, 255), -1)
                        valid_kpts.append({"name": KEYPOINT_NAMES[kp_idx], "x": px, "y": py, "conf": round(float(kp_conf), 3)})

                # 绘制骨骼连接线
                for idx, (start, end) in enumerate(SKELETON_CONNECTIONS):
                    if kpts_np[start][2] > 0.3 and kpts_np[end][2] > 0.3:
                        pt1 = (int(kpts_np[start][0]), int(kpts_np[start][1]))
                        pt2 = (int(kpts_np[end][0]), int(kpts_np[end][1]))
                        line_color = SKELETON_COLORS[idx % len(SKELETON_COLORS)]
                        cv2.line(annotated, pt1, pt2, line_color, 2, cv2.LINE_AA)

                if person_idx < len(detections_data):
                    detections_data[person_idx]["keypoints"] = valid_kpts

    return annotated, detections_data


def _draw_detect_results(frame: np.ndarray, results) -> tuple[np.ndarray, list[dict]]:
    """在帧上绘制目标检测结果"""
    annotated = frame.copy()
    detections_data = []

    for result in results:
        if result.boxes is None:
            continue
        for box in result.boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            conf = float(box.conf[0])
            cls_id = int(box.cls[0])
            cls_name = result.names[cls_id]

            color = (0, 255, 0) if conf > 0.7 else (0, 255, 255)
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)

            label = f"{cls_name} {conf:.1%}"
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 1)
            cv2.rectangle(annotated, (x1, y1 - th - 8), (x1 + tw, y1), color, -1)
            cv2.putText(annotated, label, (x1, y1 - 4),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1, cv2.LINE_AA)

            detections_data.append({
                "class_name": cls_name,
                "confidence": round(conf, 3),
                "bbox": [x1, y1, x2, y2],
            })

    return annotated, detections_data


def _process_frame_sync(frame: np.ndarray, mode: str = "pose", conf: float = 0.5) -> tuple[np.ndarray, list[dict], float]:
    """同步处理单帧（在线程池中运行）"""
    start = time.perf_counter()

    if mode == "pose":
        model = _get_pose_model()
        if model is None:
            # fallback to detect
            model = _get_detect_model()
            mode = "detect"
    else:
        model = _get_detect_model()

    if model is None:
        return frame, [], 0.0

    results = model.predict(source=frame, conf=conf, device="cpu", verbose=False)
    elapsed_ms = (time.perf_counter() - start) * 1000

    if mode == "pose":
        annotated, detections = _draw_pose_results(frame, results)
    else:
        annotated, detections = _draw_detect_results(frame, results)

    return annotated, detections, round(elapsed_ms, 1)


# ============================================================
# MJPEG流端点
# ============================================================

async def _generate_mjpeg(source: str | int, mode: str = "pose", conf: float = 0.5, fps: int = 10):
    """生成MJPEG流"""
    loop = asyncio.get_running_loop()
    interval = 1.0 / fps

    cap = await loop.run_in_executor(_executor, _get_or_open_capture, source)
    if cap is None:
        # 发送一帧错误画面
        error_frame = np.zeros((480, 640, 3), dtype=np.uint8)
        cv2.putText(error_frame, "Camera Unavailable", (100, 240),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 0, 255), 3)
        _, buf = cv2.imencode('.jpg', error_frame)
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + buf.tobytes() + b'\r\n')
        return

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                await asyncio.sleep(0.5)
                # 尝试重连
                cap = await loop.run_in_executor(_executor, _get_or_open_capture, source)
                if cap is None:
                    break
                continue

            # 在线程池中运行YOLO推理
            annotated, _, _ = await loop.run_in_executor(
                _executor, _process_frame_sync, frame, mode, conf
            )

            # 编码为JPEG
            _, buf = cv2.imencode('.jpg', annotated, [cv2.IMWRITE_JPEG_QUALITY, 75])
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + buf.tobytes() + b'\r\n')

            await asyncio.sleep(interval)
    finally:
        pass  # 保持capture open以便复用


@router.get("/stream/{camera_source}")
async def mjpeg_stream(
    camera_source: str,
    mode: str = Query("pose", description="检测模式: pose|detect"),
    conf: float = Query(0.5, ge=0.1, le=1.0),
    fps: int = Query(8, ge=1, le=30),
    user: User = Depends(require_auth),
):
    """MJPEG视频流（带YOLO检测叠加）

    camera_source: 'local_0' 表示本地摄像头0，或传入RTSP URL（URL编码）
    """
    camera_source = unquote(camera_source)
    # 解析摄像头源
    if camera_source.startswith("local_"):
        source: str | int = int(camera_source.replace("local_", ""))
    else:
        source = camera_source

    return StreamingResponse(
        _generate_mjpeg(source, mode, conf, fps),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@router.get("/snapshot/{camera_source}")
async def take_snapshot(
    camera_source: str,
    mode: str = Query("pose", description="检测模式: pose|detect"),
    conf: float = Query(0.5, ge=0.1, le=1.0),
    user: User = Depends(require_auth),
):
    """拍摄单帧快照（带检测标注）"""
    loop = asyncio.get_running_loop()

    if camera_source.startswith("local_"):
        source: str | int = int(camera_source.replace("local_", ""))
    else:
        source = camera_source

    cap = await loop.run_in_executor(_executor, _get_or_open_capture, source)
    if cap is None:
        return {"error": "无法打开摄像头"}

    ret, frame = cap.read()
    if not ret:
        return {"error": "无法读取帧"}

    annotated, detections, inference_ms = await loop.run_in_executor(
        _executor, _process_frame_sync, frame, mode, conf
    )

    # 保存快照
    import os
    from datetime import datetime
    snap_dir = os.path.join(settings.upload_dir, "snapshots")
    os.makedirs(snap_dir, exist_ok=True)
    filename = f"snapshot_{camera_source}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
    filepath = os.path.join(snap_dir, filename)
    cv2.imwrite(filepath, annotated)

    return {
        "snapshot_url": f"/uploads/snapshots/{filename}",
        "detections": detections,
        "inference_ms": inference_ms,
        "timestamp": datetime.now().isoformat(),
    }


# ============================================================
# WebSocket实时检测数据推送
# ============================================================

@router.websocket("/ws/{camera_source}")
async def ws_live_detection(
    websocket: WebSocket,
    camera_source: str,
):
    """WebSocket实时检测数据推送

    推送格式: {"type": "frame_detection", "detections": [...], "inference_ms": 0.0, "fps": 0, "timestamp": "..."}
    """
    camera_source = unquote(camera_source)

    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return
    try:
        from app.core.auth import verify_jwt_token
        verify_jwt_token(token)
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return
    await websocket.accept()
    loop = asyncio.get_running_loop()

    if camera_source.startswith("local_"):
        source: str | int = int(camera_source.replace("local_", ""))
    else:
        source = camera_source

    cap = await loop.run_in_executor(_executor, _get_or_open_capture, source)
    if cap is None:
        await websocket.send_json({"type": "error", "message": "无法打开摄像头"})
        await websocket.close()
        return

    mode = "pose"
    conf = 0.5
    fps_target = 5
    frame_count = 0
    fps_start = time.time()

    try:
        while True:
            # 检查客户端消息（非阻塞）
            try:
                msg = await asyncio.wait_for(websocket.receive_text(), timeout=0.01)
                data = json.loads(msg)
                if data.get("type") == "config":
                    mode = data.get("mode", mode)
                    conf = data.get("confidence", conf)
                    fps_target = data.get("fps", fps_target)
                elif data.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except asyncio.TimeoutError:
                pass

            ret, frame = cap.read()
            if not ret:
                await asyncio.sleep(0.5)
                continue

            # YOLO推理
            _, detections, inference_ms = await loop.run_in_executor(
                _executor, _process_frame_sync, frame, mode, conf
            )

            frame_count += 1
            elapsed = time.time() - fps_start
            actual_fps = frame_count / elapsed if elapsed > 0 else 0

            await websocket.send_json({
                "type": "frame_detection",
                "detections": detections,
                "inference_ms": inference_ms,
                "fps": round(actual_fps, 1),
                "frame_count": frame_count,
                "timestamp": time.time(),
            })

            if elapsed > 5:
                frame_count = 0
                fps_start = time.time()

            await asyncio.sleep(1.0 / fps_target)

    except WebSocketDisconnect:
        logger.info(f"实时检测WebSocket断开: {camera_source}")
    except Exception as e:
        logger.error(f"实时检测WebSocket错误: {e}")


@router.post("/stream/{camera_source}/stop")
async def stop_stream(camera_source: str, _user: User = Depends(require_role("manager"))):
    """停止指定摄像头的流"""
    camera_source = unquote(camera_source)
    if camera_source.startswith("local_"):
        source: str | int = int(camera_source.replace("local_", ""))
    else:
        source = camera_source
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(_executor, _release_capture, source)
    return {"status": "stopped", "camera": camera_source}

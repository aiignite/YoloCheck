"""批量视频分析任务管理器"""
import asyncio
import logging
import os
import uuid
from datetime import datetime
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

logger = logging.getLogger(__name__)


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class AnalysisTask:
    id: str
    filename: str
    file_path: str
    status: TaskStatus = TaskStatus.PENDING
    progress: float = 0.0  # 0-100
    current_step: str = "等待中"
    total_frames: int = 0
    processed_frames: int = 0
    detections_count: int = 0
    result_summary: dict = field(default_factory=dict)
    error_message: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class TaskQueue:
    """轻量级异步任务队列"""

    def __init__(self, max_concurrent: int = 2):
        self.tasks: dict[str, AnalysisTask] = {}
        self.queue: asyncio.Queue = asyncio.Queue()
        self.max_concurrent = max_concurrent
        self._workers_started = False

    def add_task(self, filename: str, file_path: str) -> AnalysisTask:
        task = AnalysisTask(
            id=str(uuid.uuid4())[:8],
            filename=filename,
            file_path=file_path,
        )
        self.tasks[task.id] = task
        self.queue.put_nowait(task.id)
        if not self._workers_started:
            self._start_workers()
        return task

    def _start_workers(self):
        self._workers_started = True
        for i in range(self.max_concurrent):
            asyncio.create_task(self._worker(i))

    async def _worker(self, worker_id: int):
        while True:
            task_id = await self.queue.get()
            task = self.tasks.get(task_id)
            if not task:
                self.queue.task_done()
                continue
            try:
                await self._run_analysis(task)
            except Exception as e:
                task.status = TaskStatus.FAILED
                task.error_message = str(e)
                logger.error(f"Worker {worker_id}: Task {task_id} failed: {e}")
            finally:
                self.queue.task_done()

    async def _run_analysis(self, task: AnalysisTask):
        import cv2
        task.status = TaskStatus.RUNNING
        task.started_at = datetime.utcnow()
        task.current_step = "读取视频"

        cap = cv2.VideoCapture(task.file_path)
        if not cap.isOpened():
            task.status = TaskStatus.FAILED
            task.error_message = "无法打开视频文件"
            return

        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        duration = total_frames / fps if fps > 0 else 0
        task.total_frames = total_frames

        # Sample every N frames (1 fps analysis)
        sample_interval = max(1, int(fps))
        task.current_step = "YOLO检测分析"

        try:
            from ultralytics import YOLO
            model = YOLO("yolov8n.pt")
        except Exception:
            model = None

        detections_all = []
        scene_scores = []
        prev_hist = None
        frame_idx = 0
        keyframes = []

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % sample_interval == 0:
                det_count = 0
                if model:
                    try:
                        results = model.predict(source=frame, conf=0.4, device="cpu", verbose=False)
                        for r in results:
                            if r.boxes:
                                det_count = len(r.boxes)
                                for i in range(len(r.boxes)):
                                    cls_name = r.names[int(r.boxes[i].cls[0])]
                                    conf = float(r.boxes[i].conf[0])
                                    detections_all.append({
                                        "frame": frame_idx,
                                        "class": cls_name,
                                        "confidence": round(conf, 3),
                                    })
                    except Exception:
                        pass

                # Scene change detection
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                hist = cv2.calcHist([gray], [0], None, [64], [0, 256])
                cv2.normalize(hist, hist)
                if prev_hist is not None:
                    score = cv2.compareHist(prev_hist, hist, cv2.HISTCMP_BHATTACHARYYA)
                    scene_scores.append({"frame": frame_idx, "score": round(score, 4)})
                    if score > 0.4:
                        keyframes.append(frame_idx)
                prev_hist = hist

                task.processed_frames += 1
                task.detections_count = len(detections_all)

            frame_idx += 1
            task.progress = round(frame_idx / total_frames * 100, 1)

            # Yield control to event loop periodically
            if frame_idx % (sample_interval * 10) == 0:
                await asyncio.sleep(0)

        cap.release()

        # Build summary
        class_counts = {}
        for d in detections_all:
            c = d["class"]
            class_counts[c] = class_counts.get(c, 0) + 1

        avg_scene_score = sum(s["score"] for s in scene_scores) / len(scene_scores) if scene_scores else 0

        task.result_summary = {
            "video_info": {
                "fps": round(fps, 1),
                "duration_seconds": round(duration, 1),
                "resolution": f"{width}x{height}",
                "total_frames": total_frames,
                "sampled_frames": task.processed_frames,
            },
            "detection_summary": {
                "total_detections": len(detections_all),
                "class_counts": class_counts,
            },
            "scene_analysis": {
                "scene_changes": len(keyframes),
                "avg_change_score": round(avg_scene_score, 4),
                "keyframe_positions": keyframes[:20],
            },
        }

        task.status = TaskStatus.COMPLETED
        task.completed_at = datetime.utcnow()
        task.progress = 100.0
        task.current_step = "分析完成"
        logger.info(f"Task {task.id} completed: {len(detections_all)} detections, {len(keyframes)} keyframes")

    def get_task(self, task_id: str) -> Optional[AnalysisTask]:
        return self.tasks.get(task_id)

    def list_tasks(self) -> list[AnalysisTask]:
        return sorted(self.tasks.values(), key=lambda t: t.created_at, reverse=True)

    def cancel_task(self, task_id: str) -> bool:
        task = self.tasks.get(task_id)
        if task and task.status == TaskStatus.PENDING:
            task.status = TaskStatus.CANCELLED
            return True
        return False

    def remove_task(self, task_id: str) -> bool:
        task = self.tasks.get(task_id)
        if task and task.status in (TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED):
            # Clean up file
            if task.file_path and os.path.exists(task.file_path):
                os.remove(task.file_path)
            del self.tasks[task_id]
            return True
        return False


# Global singleton
_task_queue: Optional[TaskQueue] = None


def get_task_queue() -> TaskQueue:
    global _task_queue
    if _task_queue is None:
        _task_queue = TaskQueue(max_concurrent=2)
    return _task_queue

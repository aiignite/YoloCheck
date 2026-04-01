"""批量视频分析 API"""
import os
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.config import get_settings
from app.core.batch_analysis import get_task_queue, TaskStatus
from app.core.auth import require_auth, require_role
from app.models.models import User

router = APIRouter()
settings = get_settings()

BATCH_DIR = os.path.join(settings.upload_dir, "batch_videos")
os.makedirs(BATCH_DIR, exist_ok=True)


class TaskResponse(BaseModel):
    id: str
    filename: str
    status: str
    progress: float
    current_step: str
    total_frames: int
    processed_frames: int
    detections_count: int
    result_summary: dict
    error_message: str
    created_at: Optional[datetime]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]


class TaskListResponse(BaseModel):
    tasks: list[TaskResponse]
    queue_size: int
    running_count: int


def _task_to_response(task) -> TaskResponse:
    return TaskResponse(
        id=task.id,
        filename=task.filename,
        status=task.status.value,
        progress=task.progress,
        current_step=task.current_step,
        total_frames=task.total_frames,
        processed_frames=task.processed_frames,
        detections_count=task.detections_count,
        result_summary=task.result_summary,
        error_message=task.error_message,
        created_at=task.created_at,
        started_at=task.started_at,
        completed_at=task.completed_at,
    )


@router.post("/upload", response_model=TaskResponse)
async def upload_video(file: UploadFile = File(...), _user: User = Depends(require_role("manager"))):
    """上传视频文件并加入分析队列"""
    if not file.filename:
        raise HTTPException(400, "文件名为空")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in (".mp4", ".avi", ".mov", ".mkv", ".flv", ".wmv"):
        raise HTTPException(400, "仅支持视频文件 (.mp4/.avi/.mov/.mkv/.flv/.wmv)")

    # Save file
    safe_name = f"{os.urandom(8).hex()}{ext}"
    save_path = os.path.join(BATCH_DIR, safe_name)
    content = await file.read()
    with open(save_path, "wb") as f:
        f.write(content)

    # Add to queue
    queue = get_task_queue()
    task = queue.add_task(filename=file.filename, file_path=save_path)
    return _task_to_response(task)


@router.get("", response_model=TaskListResponse)
async def list_tasks(user: User = Depends(require_auth)):
    """获取所有分析任务"""
    queue = get_task_queue()
    tasks = queue.list_tasks()
    running = sum(1 for t in tasks if t.status == TaskStatus.RUNNING)
    return TaskListResponse(
        tasks=[_task_to_response(t) for t in tasks],
        queue_size=queue.queue.qsize(),
        running_count=running,
    )


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str, user: User = Depends(require_auth)):
    """获取单个任务详情"""
    queue = get_task_queue()
    task = queue.get_task(task_id)
    if not task:
        raise HTTPException(404, "任务不存在")
    return _task_to_response(task)


@router.post("/{task_id}/cancel")
async def cancel_task(task_id: str, _user: User = Depends(require_role("manager"))):
    """取消排队中的任务"""
    queue = get_task_queue()
    if queue.cancel_task(task_id):
        return {"message": "已取消"}
    raise HTTPException(400, "仅可取消排队中的任务")


@router.delete("/{task_id}")
async def remove_task(task_id: str, _user: User = Depends(require_role("manager"))):
    """删除已完成/失败/取消的任务"""
    queue = get_task_queue()
    if queue.remove_task(task_id):
        return {"message": "已删除"}
    raise HTTPException(400, "仅可删除已完成/失败/取消的任务")

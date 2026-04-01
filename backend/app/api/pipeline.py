from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.core.pipeline import pipeline
from app.core.stream_manager import stream_manager
from app.core.auth import require_auth, require_role
from app.models.models import User

router = APIRouter()


class PipelineStartRequest(BaseModel):
    camera_id: Optional[str] = None
    detection_interval: float = 1.0


class CameraStatus(BaseModel):
    camera_id: str
    stream_status: str


class PipelineStatus(BaseModel):
    running: bool
    cameras: list[CameraStatus]
    stats: dict


@router.get("/status", response_model=PipelineStatus)
async def get_pipeline_status(user: User = Depends(require_auth)):
    all_status = stream_manager.get_all_status()
    return PipelineStatus(
        running=pipeline._running,
        cameras=[CameraStatus(camera_id=cid, stream_status=status) for cid, status in all_status.items()],
        stats=pipeline.stats,
    )


@router.post("/start")
async def start_pipeline(data: PipelineStartRequest = PipelineStartRequest(), _user: User = Depends(require_role("manager"))):
    if pipeline._running:
        raise HTTPException(400, "流水线已在运行中")

    if data.camera_id:
        from app.crud import camera as camera_crud
        from app.database import async_session
        async with async_session() as db:
            cam = await camera_crud.get_camera_by_camera_id(db, data.camera_id)
            if not cam:
                raise HTTPException(404, "摄像头不存在")
            if cam.stream_url:
                stream_manager.add_stream(cam.camera_id, cam.stream_url)
        if not stream_manager.active_cameras:
            raise HTTPException(400, "无法启动指定摄像头的视频流")

    import asyncio
    asyncio.create_task(pipeline.run())
    return {"message": "流水线已启动", "active_cameras": stream_manager.active_cameras}


@router.post("/stop")
async def stop_pipeline(_user: User = Depends(require_role("manager"))):
    pipeline.stop()
    stream_manager.stop_all()
    return {"message": "流水线已停止"}

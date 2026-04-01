from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.camera import CameraCreate, CameraUpdate, CameraResponse
from app.crud import camera as camera_crud
from app.core.auth import require_auth, require_role
from app.models.models import User

router = APIRouter()


@router.get("/", response_model=List[CameraResponse])
async def list_cameras(skip: int = 0, limit: int = 100, user: User = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    return await camera_crud.get_cameras(db, skip=skip, limit=limit)


@router.get("/{camera_id}", response_model=CameraResponse)
async def get_camera(camera_id: int, user: User = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    camera = await camera_crud.get_camera_by_id(db, camera_id)
    if not camera:
        raise HTTPException(status_code=404, detail="摄像头不存在")
    return camera


@router.post("/", response_model=CameraResponse, status_code=201)
async def create_camera(camera_in: CameraCreate, _user: User = Depends(require_role("manager")), db: AsyncSession = Depends(get_db)):
    existing = await camera_crud.get_camera_by_camera_id(db, camera_in.camera_id)
    if existing:
        raise HTTPException(status_code=409, detail="摄像头ID已存在")
    return await camera_crud.create_camera(db, camera_in)


@router.put("/{camera_id}", response_model=CameraResponse)
async def update_camera(camera_id: int, camera_in: CameraUpdate, _user: User = Depends(require_role("manager")), db: AsyncSession = Depends(get_db)):
    camera = await camera_crud.get_camera_by_id(db, camera_id)
    if not camera:
        raise HTTPException(status_code=404, detail="摄像头不存在")
    return await camera_crud.update_camera(db, camera, camera_in)


@router.delete("/{camera_id}", status_code=204)
async def delete_camera(camera_id: int, _user: User = Depends(require_role("manager")), db: AsyncSession = Depends(get_db)):
    camera = await camera_crud.get_camera_by_id(db, camera_id)
    if not camera:
        raise HTTPException(status_code=404, detail="摄像头不存在")
    await camera_crud.delete_camera(db, camera)

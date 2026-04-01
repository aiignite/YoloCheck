from typing import Optional, Sequence
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Camera
from app.schemas.camera import CameraCreate, CameraUpdate


async def get_cameras(db: AsyncSession, skip: int = 0, limit: int = 100) -> Sequence[Camera]:
    result = await db.execute(select(Camera).offset(skip).limit(limit))
    return result.scalars().all()


async def get_camera_by_id(db: AsyncSession, camera_db_id: int) -> Optional[Camera]:
    result = await db.execute(select(Camera).where(Camera.id == camera_db_id))
    return result.scalar_one_or_none()


async def get_camera_by_camera_id(db: AsyncSession, camera_id: str) -> Optional[Camera]:
    result = await db.execute(select(Camera).where(Camera.camera_id == camera_id))
    return result.scalar_one_or_none()


async def create_camera(db: AsyncSession, camera_in: CameraCreate) -> Camera:
    camera = Camera(**camera_in.model_dump())
    db.add(camera)
    await db.commit()
    await db.refresh(camera)
    return camera


async def update_camera(db: AsyncSession, camera: Camera, camera_in: CameraUpdate) -> Camera:
    update_data = camera_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(camera, field, value)
    await db.commit()
    await db.refresh(camera)
    return camera


async def delete_camera(db: AsyncSession, camera: Camera) -> None:
    await db.delete(camera)
    await db.commit()

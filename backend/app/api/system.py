"""系统设置 & 摄像头驱动管理 API"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.system import (
    CameraDriverCreate, CameraDriverUpdate, CameraDriverResponse,
    SystemConfigCreate, SystemConfigResponse,
)
from app.crud import system as crud
from app.core.auth import require_auth, require_role
from app.models.models import User

router = APIRouter()


# ── 摄像头驱动 ──

@router.post("/drivers", response_model=CameraDriverResponse, status_code=201)
async def create_driver(data: CameraDriverCreate, _user: User = Depends(require_role("manager")), db: AsyncSession = Depends(get_db)):
    return await crud.create_driver(db, **data.model_dump())


@router.get("/drivers", response_model=list[CameraDriverResponse])
async def list_drivers(protocol: str = None, user: User = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    return await crud.list_drivers(db, protocol=protocol)


@router.put("/drivers/{driver_id}", response_model=CameraDriverResponse)
async def update_driver(driver_id: int, data: CameraDriverUpdate, _user: User = Depends(require_role("manager")), db: AsyncSession = Depends(get_db)):
    drv = await crud.update_driver(db, driver_id, **data.model_dump(exclude_unset=True))
    if not drv:
        raise HTTPException(404, "驱动不存在")
    return drv


@router.delete("/drivers/{driver_id}", status_code=204)
async def delete_driver(driver_id: int, _user: User = Depends(require_role("manager")), db: AsyncSession = Depends(get_db)):
    if not await crud.delete_driver(db, driver_id):
        raise HTTPException(404, "驱动不存在")


# ── 系统配置 ──

@router.post("/configs", response_model=SystemConfigResponse)
async def set_config(data: SystemConfigCreate, _user: User = Depends(require_role("manager")), db: AsyncSession = Depends(get_db)):
    return await crud.set_config(db, data.category, data.key, data.value, data.description)


@router.get("/configs", response_model=list[SystemConfigResponse])
async def list_configs(category: str = None, user: User = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    return await crud.list_configs(db, category=category)


@router.delete("/configs/{config_id}", status_code=204)
async def delete_config(config_id: int, _user: User = Depends(require_role("manager")), db: AsyncSession = Depends(get_db)):
    if not await crud.delete_config(db, config_id):
        raise HTTPException(404, "配置项不存在")

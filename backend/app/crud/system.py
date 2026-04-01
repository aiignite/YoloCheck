from typing import Optional, Sequence
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import CameraDriver, SystemConfig


# ── CameraDriver ──

async def create_driver(db: AsyncSession, **kwargs) -> CameraDriver:
    drv = CameraDriver(**kwargs)
    db.add(drv)
    await db.commit()
    await db.refresh(drv)
    return drv


async def get_driver(db: AsyncSession, driver_id: int) -> Optional[CameraDriver]:
    result = await db.execute(select(CameraDriver).where(CameraDriver.id == driver_id))
    return result.scalar_one_or_none()


async def list_drivers(db: AsyncSession, protocol: Optional[str] = None) -> Sequence[CameraDriver]:
    query = select(CameraDriver).order_by(CameraDriver.name)
    if protocol:
        query = query.where(CameraDriver.protocol == protocol)
    result = await db.execute(query)
    return result.scalars().all()


async def update_driver(db: AsyncSession, driver_id: int, **kwargs) -> Optional[CameraDriver]:
    drv = await get_driver(db, driver_id)
    if not drv:
        return None
    for k, v in kwargs.items():
        if v is not None:
            setattr(drv, k, v)
    await db.commit()
    await db.refresh(drv)
    return drv


async def delete_driver(db: AsyncSession, driver_id: int) -> bool:
    drv = await get_driver(db, driver_id)
    if not drv:
        return False
    await db.delete(drv)
    await db.commit()
    return True


# ── SystemConfig ──

async def set_config(db: AsyncSession, category: str, key: str, value: str, description: str = None) -> SystemConfig:
    result = await db.execute(
        select(SystemConfig).where(SystemConfig.category == category, SystemConfig.key == key)
    )
    cfg = result.scalar_one_or_none()
    if cfg:
        cfg.value = value
        if description is not None:
            cfg.description = description
    else:
        cfg = SystemConfig(category=category, key=key, value=value, description=description)
        db.add(cfg)
    await db.commit()
    await db.refresh(cfg)
    return cfg


async def get_config(db: AsyncSession, category: str, key: str) -> Optional[SystemConfig]:
    result = await db.execute(
        select(SystemConfig).where(SystemConfig.category == category, SystemConfig.key == key)
    )
    return result.scalar_one_or_none()


async def list_configs(db: AsyncSession, category: Optional[str] = None) -> Sequence[SystemConfig]:
    query = select(SystemConfig).order_by(SystemConfig.category, SystemConfig.key)
    if category:
        query = query.where(SystemConfig.category == category)
    result = await db.execute(query)
    return result.scalars().all()


async def delete_config(db: AsyncSession, config_id: int) -> bool:
    result = await db.execute(select(SystemConfig).where(SystemConfig.id == config_id))
    cfg = result.scalar_one_or_none()
    if not cfg:
        return False
    await db.delete(cfg)
    await db.commit()
    return True

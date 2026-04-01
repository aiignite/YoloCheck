"""模型版本管理 CRUD"""
from datetime import datetime
from typing import Optional, Sequence

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Model


async def list_models(
    db: AsyncSession,
    model_type: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> Sequence[Model]:
    q = select(Model)
    if model_type:
        q = q.where(Model.model_type == model_type)
    if status:
        q = q.where(Model.status == status)
    q = q.order_by(Model.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


async def get_model(db: AsyncSession, model_id: int) -> Optional[Model]:
    result = await db.execute(select(Model).where(Model.id == model_id))
    return result.scalar_one_or_none()


async def create_model(db: AsyncSession, **kwargs) -> Model:
    model = Model(**kwargs)
    db.add(model)
    await db.commit()
    await db.refresh(model)
    return model


async def update_model(db: AsyncSession, model_id: int, **kwargs) -> Optional[Model]:
    m = await get_model(db, model_id)
    if not m:
        return None
    for k, v in kwargs.items():
        if v is not None:
            setattr(m, k, v)
    await db.commit()
    await db.refresh(m)
    return m


async def delete_model(db: AsyncSession, model_id: int) -> bool:
    m = await get_model(db, model_id)
    if not m:
        return False
    await db.delete(m)
    await db.commit()
    return True


async def deploy_model(db: AsyncSession, model_id: int) -> Optional[Model]:
    """部署模型：先取消同类型的其他活跃模型，再激活目标模型"""
    m = await get_model(db, model_id)
    if not m:
        return None

    # 取消同类模型的活跃状态
    await db.execute(
        update(Model)
        .where(Model.model_type == m.model_type, Model.is_active == True)
        .values(is_active=False, status="ready")
    )

    # 激活目标模型
    m.is_active = True
    m.status = "deployed"
    m.deployed_at = datetime.utcnow()
    await db.commit()
    await db.refresh(m)
    return m


async def rollback_model(db: AsyncSession, model_id: int) -> Optional[Model]:
    """回滚：取消部署"""
    m = await get_model(db, model_id)
    if not m:
        return None
    m.is_active = False
    m.status = "ready"
    m.deployed_at = None
    await db.commit()
    await db.refresh(m)
    return m


async def get_active_model(db: AsyncSession, model_type: str) -> Optional[Model]:
    """获取某类型当前激活的模型"""
    result = await db.execute(
        select(Model).where(Model.model_type == model_type, Model.is_active == True)
    )
    return result.scalar_one_or_none()

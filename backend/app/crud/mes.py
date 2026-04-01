from typing import Optional, Sequence
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import MESOrder


async def create_order(db: AsyncSession, **kwargs) -> MESOrder:
    order = MESOrder(**kwargs)
    db.add(order)
    await db.commit()
    await db.refresh(order)
    return order


async def get_order(db: AsyncSession, order_id: int) -> Optional[MESOrder]:
    result = await db.execute(select(MESOrder).where(MESOrder.id == order_id))
    return result.scalar_one_or_none()


async def get_order_by_no(db: AsyncSession, order_no: str) -> Optional[MESOrder]:
    result = await db.execute(select(MESOrder).where(MESOrder.order_no == order_no))
    return result.scalar_one_or_none()


async def list_orders(
    db: AsyncSession,
    status: Optional[str] = None,
    station_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
) -> Sequence[MESOrder]:
    query = select(MESOrder)
    if status:
        query = query.where(MESOrder.status == status)
    if station_id:
        query = query.where(MESOrder.station_id == station_id)
    query = query.order_by(MESOrder.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


async def update_order(db: AsyncSession, order_id: int, **kwargs) -> Optional[MESOrder]:
    order = await get_order(db, order_id)
    if not order:
        return None
    for k, v in kwargs.items():
        if v is not None:
            setattr(order, k, v)
    await db.commit()
    await db.refresh(order)
    return order


async def delete_order(db: AsyncSession, order_id: int) -> bool:
    order = await get_order(db, order_id)
    if not order:
        return False
    await db.delete(order)
    await db.commit()
    return True


async def get_quality_report(db: AsyncSession, order_id: int) -> Optional[dict]:
    order = await get_order(db, order_id)
    if not order:
        return None
    completed = order.completed_quantity or 0
    defects = order.defect_quantity or 0
    target = order.target_quantity or 0
    yield_rate = ((completed - defects) / completed * 100) if completed > 0 else 0
    defect_rate = (defects / completed * 100) if completed > 0 else 0
    return {
        "order_no": order.order_no,
        "product_name": order.product_name,
        "target_quantity": target,
        "completed_quantity": completed,
        "defect_quantity": defects,
        "yield_rate": round(yield_rate, 2),
        "defect_rate": round(defect_rate, 2),
    }

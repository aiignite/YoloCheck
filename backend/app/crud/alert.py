from typing import Optional, Sequence
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Alert
from app.schemas.alert import AlertCreate


async def create_alert(db: AsyncSession, alert_in: AlertCreate) -> Alert:
    alert = Alert(**alert_in.model_dump())
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    return alert


async def get_alerts(
    db: AsyncSession,
    severity: Optional[str] = None,
    acknowledged: Optional[bool] = None,
    skip: int = 0,
    limit: int = 50,
) -> Sequence[Alert]:
    query = select(Alert)
    if severity:
        query = query.where(Alert.severity == severity)
    if acknowledged is not None:
        query = query.where(Alert.acknowledged == acknowledged)
    query = query.order_by(Alert.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


async def get_alert_by_id(db: AsyncSession, alert_id: int) -> Optional[Alert]:
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    return result.scalar_one_or_none()


async def acknowledge_alert(db: AsyncSession, alert: Alert, acknowledged_by: str) -> Alert:
    alert.acknowledged = True
    alert.acknowledged_by = acknowledged_by
    await db.commit()
    await db.refresh(alert)
    return alert


async def get_alert_stats(db: AsyncSession) -> dict:
    total = await db.execute(select(func.count(Alert.id)))
    critical = await db.execute(select(func.count(Alert.id)).where(Alert.severity == "critical"))
    warning = await db.execute(select(func.count(Alert.id)).where(Alert.severity == "warning"))
    info = await db.execute(select(func.count(Alert.id)).where(Alert.severity == "info"))
    unack = await db.execute(select(func.count(Alert.id)).where(Alert.acknowledged == False))
    return {
        "total": total.scalar() or 0,
        "critical": critical.scalar() or 0,
        "warning": warning.scalar() or 0,
        "info": info.scalar() or 0,
        "unacknowledged": unack.scalar() or 0,
    }

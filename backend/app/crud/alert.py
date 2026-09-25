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
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
) -> Sequence[Alert]:
    query = select(Alert)
    if severity:
        query = query.where(Alert.severity == severity)
    if acknowledged is not None:
        query = query.where(Alert.acknowledged == acknowledged)
    if status:
        query = query.where(Alert.status == status)
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


async def claim_alert(db: AsyncSession, alert: Alert, assigned_to: str) -> Alert:
    """认领告警进入排查中"""
    alert.status = "investigating"
    alert.assigned_to = assigned_to
    await db.commit()
    await db.refresh(alert)
    return alert


async def resolve_alert(db: AsyncSession, alert: Alert, resolved_by: str) -> Alert:
    """闭环告警，同步确认状态"""
    from datetime import datetime, timezone

    alert.status = "resolved"
    alert.assigned_to = resolved_by
    alert.resolved_at = datetime.now(timezone.utc).replace(tzinfo=None)
    alert.acknowledged = True
    alert.acknowledged_by = resolved_by
    await db.commit()
    await db.refresh(alert)
    return alert


async def batch_claim_pending(db: AsyncSession, assigned_to: str) -> int:
    """一键认领全部待处理告警"""
    result = await db.execute(select(Alert).where(Alert.status == "pending"))
    alerts = result.scalars().all()
    for alert in alerts:
        alert.status = "investigating"
        alert.assigned_to = assigned_to
    if alerts:
        await db.commit()
    return len(alerts)


async def get_alert_stats(db: AsyncSession) -> dict:
    total = await db.execute(select(func.count(Alert.id)))
    critical = await db.execute(select(func.count(Alert.id)).where(Alert.severity == "critical"))
    warning = await db.execute(select(func.count(Alert.id)).where(Alert.severity == "warning"))
    info = await db.execute(select(func.count(Alert.id)).where(Alert.severity == "info"))
    unack = await db.execute(select(func.count(Alert.id)).where(Alert.acknowledged == False))
    pending = await db.execute(select(func.count(Alert.id)).where(Alert.status == "pending"))
    investigating = await db.execute(select(func.count(Alert.id)).where(Alert.status == "investigating"))
    resolved = await db.execute(select(func.count(Alert.id)).where(Alert.status == "resolved"))
    return {
        "total": total.scalar() or 0,
        "critical": critical.scalar() or 0,
        "warning": warning.scalar() or 0,
        "info": info.scalar() or 0,
        "unacknowledged": unack.scalar() or 0,
        "pending": pending.scalar() or 0,
        "investigating": investigating.scalar() or 0,
        "resolved": resolved.scalar() or 0,
    }

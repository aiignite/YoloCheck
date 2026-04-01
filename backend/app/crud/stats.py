from datetime import date, datetime, timedelta
from typing import Optional, Sequence
from sqlalchemy import select, func, case, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import ProductionStats, DetectionEvent, Camera, Alert


async def get_production_stats(
    db: AsyncSession,
    station_id: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> Sequence[ProductionStats]:
    query = select(ProductionStats)
    if station_id:
        query = query.where(ProductionStats.station_id == station_id)
    if start_date:
        query = query.where(ProductionStats.date >= start_date)
    if end_date:
        query = query.where(ProductionStats.date <= end_date)
    query = query.order_by(ProductionStats.date.desc(), ProductionStats.hour)
    result = await db.execute(query)
    return result.scalars().all()


async def get_dashboard_summary(db: AsyncSession) -> dict:
    today = date.today()

    # 产量统计
    prod_result = await db.execute(
        select(
            func.coalesce(func.sum(ProductionStats.total_count), 0),
            func.coalesce(func.sum(ProductionStats.defect_count), 0),
        ).where(ProductionStats.date == today)
    )
    row = prod_result.one()
    total_production = row[0]
    total_defects = row[1]
    yield_rate = ((total_production - total_defects) / total_production * 100) if total_production > 0 else 100.0

    # 摄像头统计
    cam_total = await db.execute(select(func.count(Camera.id)))
    cam_active = await db.execute(select(func.count(Camera.id)).where(Camera.status == "online"))

    # 告警统计
    unack = await db.execute(select(func.count(Alert.id)).where(Alert.acknowledged == False))
    critical = await db.execute(
        select(func.count(Alert.id)).where(Alert.severity == "critical", Alert.acknowledged == False)
    )

    return {
        "total_production": total_production,
        "total_defects": total_defects,
        "yield_rate": round(yield_rate, 2),
        "oee": round(yield_rate * 0.85, 2),  # 简化OEE计算
        "active_cameras": cam_active.scalar() or 0,
        "total_cameras": cam_total.scalar() or 0,
        "unacknowledged_alerts": unack.scalar() or 0,
        "critical_alerts": critical.scalar() or 0,
    }


async def get_defect_stats(
    db: AsyncSession,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> list[dict]:
    query = select(
        DetectionEvent.event_type,
        func.count(DetectionEvent.id).label("count"),
    ).where(DetectionEvent.event_type == "defect")

    if start_date:
        query = query.where(func.date(DetectionEvent.event_time) >= start_date)
    if end_date:
        query = query.where(func.date(DetectionEvent.event_time) <= end_date)

    query = query.group_by(DetectionEvent.event_type)
    result = await db.execute(query)
    rows = result.all()
    total = sum(r.count for r in rows) or 1
    return [
        {"event_type": r.event_type, "count": r.count, "percentage": round(r.count / total * 100, 2)}
        for r in rows
    ]


async def get_efficiency_trend(
    db: AsyncSession,
    station_id: Optional[str] = None,
    days: int = 7,
) -> list[dict]:
    start_date = date.today() - timedelta(days=days)
    query = select(
        ProductionStats.date,
        func.avg(ProductionStats.avg_cycle_time).label("avg_cycle_time"),
        func.sum(ProductionStats.total_count).label("total_count"),
        func.sum(ProductionStats.defect_count).label("defect_count"),
    ).where(ProductionStats.date >= start_date)

    if station_id:
        query = query.where(ProductionStats.station_id == station_id)

    query = query.group_by(ProductionStats.date).order_by(ProductionStats.date)
    result = await db.execute(query)
    rows = result.all()

    return [
        {
            "date": str(r.date),
            "avg_cycle_time": round(float(r.avg_cycle_time or 0), 2),
            "total_count": r.total_count or 0,
            "yield_rate": round(
                ((r.total_count - r.defect_count) / r.total_count * 100) if r.total_count else 100, 2
            ),
        }
        for r in rows
    ]

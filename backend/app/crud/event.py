from typing import Optional, Sequence
from datetime import datetime
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import DetectionEvent
from app.schemas.event import EventCreate


async def create_event(db: AsyncSession, event_in: EventCreate) -> DetectionEvent:
    event = DetectionEvent(**event_in.model_dump())
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event


async def get_events(
    db: AsyncSession,
    camera_id: Optional[str] = None,
    event_type: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 50,
) -> Sequence[DetectionEvent]:
    query = select(DetectionEvent)
    if camera_id:
        query = query.where(DetectionEvent.camera_id == camera_id)
    if event_type:
        query = query.where(DetectionEvent.event_type == event_type)
    if start_time:
        query = query.where(DetectionEvent.event_time >= start_time)
    if end_time:
        query = query.where(DetectionEvent.event_time <= end_time)
    query = query.order_by(DetectionEvent.event_time.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


async def count_events(
    db: AsyncSession,
    camera_id: Optional[str] = None,
    event_type: Optional[str] = None,
) -> int:
    query = select(func.count(DetectionEvent.id))
    if camera_id:
        query = query.where(DetectionEvent.camera_id == camera_id)
    if event_type:
        query = query.where(DetectionEvent.event_type == event_type)
    result = await db.execute(query)
    return result.scalar() or 0

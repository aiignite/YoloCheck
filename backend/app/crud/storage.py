from typing import Optional, Sequence
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import StorageRecord


async def get_storage_records(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100,
    file_type: Optional[str] = None,
) -> Sequence[StorageRecord]:
    query = select(StorageRecord).order_by(StorageRecord.created_at.desc())
    if file_type:
        query = query.where(StorageRecord.file_type == file_type)
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


async def get_storage_by_id(db: AsyncSession, storage_id: int) -> Optional[StorageRecord]:
    result = await db.execute(select(StorageRecord).where(StorageRecord.id == storage_id))
    return result.scalar_one_or_none()


async def get_storage_stats(db: AsyncSession) -> list[dict]:
    query = (
        select(
            StorageRecord.file_type,
            func.count(StorageRecord.id).label("count"),
            func.coalesce(func.sum(StorageRecord.file_size), 0).label("total_size"),
        )
        .group_by(StorageRecord.file_type)
    )
    result = await db.execute(query)
    return [
        {"file_type": row.file_type, "count": row.count, "total_size": row.total_size}
        for row in result.all()
    ]


async def delete_storage_record(db: AsyncSession, record: StorageRecord) -> None:
    await db.delete(record)
    await db.commit()

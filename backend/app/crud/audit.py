"""审计日志CRUD操作"""

from typing import Optional, Sequence
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import AuditLog


async def create_audit_log(
    db: AsyncSession,
    action: str,
    resource_type: str = "",
    resource_id: str = "",
    detail: str = "",
    user_id: Optional[int] = None,
    username: str = "",
    ip_address: str = "",
    user_agent: str = "",
    status: str = "success",
) -> AuditLog:
    log = AuditLog(
        user_id=user_id,
        username=username,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        detail=detail,
        ip_address=ip_address,
        user_agent=user_agent,
        status=status,
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return log


async def list_audit_logs(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 50,
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
) -> Sequence[AuditLog]:
    query = select(AuditLog).order_by(desc(AuditLog.created_at))
    if user_id is not None:
        query = query.where(AuditLog.user_id == user_id)
    if action:
        query = query.where(AuditLog.action == action)
    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

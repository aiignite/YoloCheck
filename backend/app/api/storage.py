from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.storage import StorageResponse, StorageStats, StorageStatsSummary
from app.crud import storage as storage_crud
from app.core.auth import require_auth, require_role
from app.models.models import User

router = APIRouter()


@router.get("/", response_model=List[StorageResponse])
async def list_storage(
    skip: int = 0,
    limit: int = 100,
    file_type: Optional[str] = Query(None, description="文件类型筛选: image/video/model/keyframe"),
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    return await storage_crud.get_storage_records(db, skip=skip, limit=limit, file_type=file_type)


@router.get("/stats", response_model=StorageStatsSummary)
async def storage_stats(user: User = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    rows = await storage_crud.get_storage_stats(db)
    by_type = [StorageStats(**r) for r in rows]
    total_files = sum(r["count"] for r in rows)
    total_size = sum(r["total_size"] for r in rows)
    return StorageStatsSummary(total_files=total_files, total_size=total_size, by_type=by_type)


@router.get("/{storage_id}", response_model=StorageResponse)
async def get_storage(storage_id: int, user: User = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    record = await storage_crud.get_storage_by_id(db, storage_id)
    if not record:
        raise HTTPException(status_code=404, detail="存储记录不存在")
    return record


@router.delete("/{storage_id}", status_code=204)
async def delete_storage(storage_id: int, _user: User = Depends(require_role("manager")), db: AsyncSession = Depends(get_db)):
    record = await storage_crud.get_storage_by_id(db, storage_id)
    if not record:
        raise HTTPException(status_code=404, detail="存储记录不存在")
    await storage_crud.delete_storage_record(db, record)

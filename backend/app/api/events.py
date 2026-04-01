from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.event import EventCreate, EventResponse
from app.crud import event as event_crud
from app.core.auth import require_auth, require_role
from app.models.models import User

router = APIRouter()


@router.get("/", response_model=List[EventResponse])
async def list_events(
    camera_id: Optional[str] = None,
    event_type: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    return await event_crud.get_events(
        db, camera_id=camera_id, event_type=event_type,
        start_time=start_time, end_time=end_time, skip=skip, limit=limit,
    )


@router.post("/", response_model=EventResponse, status_code=201)
async def create_event(event_in: EventCreate, _user: User = Depends(require_role("manager")), db: AsyncSession = Depends(get_db)):
    return await event_crud.create_event(db, event_in)

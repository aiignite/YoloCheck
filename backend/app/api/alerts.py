from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.alert import AlertCreate, AlertResponse, AlertAcknowledge, AlertStats
from app.crud import alert as alert_crud
from app.core.auth import require_auth, require_role
from app.models.models import User

router = APIRouter()


@router.get("/", response_model=List[AlertResponse])
async def list_alerts(
    severity: Optional[str] = None,
    acknowledged: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    return await alert_crud.get_alerts(db, severity=severity, acknowledged=acknowledged, skip=skip, limit=limit)


@router.post("/", response_model=AlertResponse, status_code=201)
async def create_alert(alert_in: AlertCreate, _user: User = Depends(require_role("manager")), db: AsyncSession = Depends(get_db)):
    return await alert_crud.create_alert(db, alert_in)


@router.put("/{alert_id}/acknowledge", response_model=AlertResponse)
async def acknowledge_alert(alert_id: int, body: AlertAcknowledge, _user: User = Depends(require_role("manager")), db: AsyncSession = Depends(get_db)):
    alert = await alert_crud.get_alert_by_id(db, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="告警不存在")
    return await alert_crud.acknowledge_alert(db, alert, body.acknowledged_by)


@router.get("/stats", response_model=AlertStats)
async def alert_stats(user: User = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    return await alert_crud.get_alert_stats(db)

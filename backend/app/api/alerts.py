import csv
import io
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.alert import (
    AlertCreate, AlertResponse, AlertAcknowledge, AlertClaim, AlertResolve,
    AlertStats, BatchClaimResponse,
)
from app.crud import alert as alert_crud
from app.core.auth import require_auth, require_role
from app.models.models import User

router = APIRouter()


@router.get("/", response_model=List[AlertResponse])
async def list_alerts(
    severity: Optional[str] = None,
    acknowledged: Optional[bool] = None,
    status: Optional[str] = Query(None, pattern=r"^(pending|investigating|resolved)$"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    return await alert_crud.get_alerts(
        db, severity=severity, acknowledged=acknowledged, status=status, skip=skip, limit=limit
    )


@router.post("/", response_model=AlertResponse, status_code=201)
async def create_alert(alert_in: AlertCreate, _user: User = Depends(require_role("manager")), db: AsyncSession = Depends(get_db)):
    return await alert_crud.create_alert(db, alert_in)


@router.put("/{alert_id}/acknowledge", response_model=AlertResponse)
async def acknowledge_alert(alert_id: int, body: AlertAcknowledge, _user: User = Depends(require_role("manager")), db: AsyncSession = Depends(get_db)):
    alert = await alert_crud.get_alert_by_id(db, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="告警不存在")
    return await alert_crud.acknowledge_alert(db, alert, body.acknowledged_by)


@router.put("/{alert_id}/claim", response_model=AlertResponse)
async def claim_alert(alert_id: int, body: AlertClaim, user: User = Depends(require_role("manager")), db: AsyncSession = Depends(get_db)):
    """认领告警进入排查中"""
    alert = await alert_crud.get_alert_by_id(db, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="告警不存在")
    if alert.status == "resolved":
        raise HTTPException(status_code=400, detail="告警已闭环，无法认领")
    return await alert_crud.claim_alert(db, alert, body.assigned_to)


@router.put("/{alert_id}/resolve", response_model=AlertResponse)
async def resolve_alert(alert_id: int, body: AlertResolve, user: User = Depends(require_role("manager")), db: AsyncSession = Depends(get_db)):
    """闭环告警"""
    alert = await alert_crud.get_alert_by_id(db, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="告警不存在")
    return await alert_crud.resolve_alert(db, alert, body.resolved_by)


@router.post("/claim-all", response_model=BatchClaimResponse)
async def claim_all_pending(user: User = Depends(require_role("manager")), db: AsyncSession = Depends(get_db)):
    """一键认领全部待处理告警"""
    count = await alert_crud.batch_claim_pending(db, user.username)
    return BatchClaimResponse(claimed_count=count)


@router.get("/export/csv")
async def export_alerts_csv(
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """导出告警工单 CSV（标题/详情含引号转义）"""
    alerts = await alert_crud.get_alerts(db, limit=200)
    buf = io.StringIO()
    writer = csv.writer(buf, quoting=csv.QUOTE_MINIMAL)
    writer.writerow(["id", "severity", "message", "camera_id", "status", "assigned_to", "resolved_at", "created_at"])
    for a in alerts:
        writer.writerow([
            a.id, a.severity, a.message, a.camera_id or "",
            a.status or "pending", a.assigned_to or "",
            (a.resolved_at or "").isoformat() if a.resolved_at else "",
            a.created_at.isoformat() if a.created_at else "",
        ])
    buf.seek(0)
    filename = f"alerts_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/stats", response_model=AlertStats)
async def alert_stats(user: User = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    return await alert_crud.get_alert_stats(db)

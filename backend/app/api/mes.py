"""MES工单接口 API"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.mes import MESOrderCreate, MESOrderUpdate, MESOrderResponse, QualityReport
from app.crud import mes as crud
from app.core.auth import require_auth, require_role
from app.models.models import User

router = APIRouter()


@router.post("/orders", response_model=MESOrderResponse, status_code=201)
async def create_order(data: MESOrderCreate, _user: User = Depends(require_role("manager")), db: AsyncSession = Depends(get_db)):
    existing = await crud.get_order_by_no(db, data.order_no)
    if existing:
        raise HTTPException(409, "工单编号已存在")
    return await crud.create_order(db, **data.model_dump())


@router.get("/orders", response_model=list[MESOrderResponse])
async def list_orders(
    status: str = None,
    station_id: str = None,
    skip: int = 0,
    limit: int = 50,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    return await crud.list_orders(db, status=status, station_id=station_id, skip=skip, limit=limit)


@router.get("/orders/{order_id}", response_model=MESOrderResponse)
async def get_order(order_id: int, user: User = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    order = await crud.get_order(db, order_id)
    if not order:
        raise HTTPException(404, "工单不存在")
    return order


@router.put("/orders/{order_id}", response_model=MESOrderResponse)
async def update_order(order_id: int, data: MESOrderUpdate, _user: User = Depends(require_role("manager")), db: AsyncSession = Depends(get_db)):
    order = await crud.update_order(db, order_id, **data.model_dump(exclude_unset=True))
    if not order:
        raise HTTPException(404, "工单不存在")
    return order


@router.delete("/orders/{order_id}", status_code=204)
async def delete_order(order_id: int, _user: User = Depends(require_role("manager")), db: AsyncSession = Depends(get_db)):
    if not await crud.delete_order(db, order_id):
        raise HTTPException(404, "工单不存在")


@router.get("/orders/{order_id}/quality-report", response_model=QualityReport)
async def quality_report(order_id: int, user: User = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    report = await crud.get_quality_report(db, order_id)
    if not report:
        raise HTTPException(404, "工单不存在")
    return report

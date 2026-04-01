from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.schemas.stats import ProductionStatsResponse, DashboardSummary, DefectStats, EfficiencyTrend
from app.crud import stats as stats_crud
from app.core.auth import require_auth
from app.core.cache import cache_get, cache_set
from app.models.models import User

router = APIRouter()


class HealthResponse(BaseModel):
    redis: str
    status: str


@router.get("/dashboard", response_model=DashboardSummary)
async def dashboard_summary(user: User = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    cached = await cache_get("stats:dashboard")
    if cached:
        return DashboardSummary(**cached)
    result = await stats_crud.get_dashboard_summary(db)
    if hasattr(result, 'model_dump'):
        await cache_set("stats:dashboard", result.model_dump(), ttl=30)
    else:
        await cache_set("stats:dashboard", result if isinstance(result, dict) else {}, ttl=30)
    return result


@router.get("/production", response_model=List[ProductionStatsResponse])
async def production_stats(
    station_id: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    return await stats_crud.get_production_stats(db, station_id=station_id, start_date=start_date, end_date=end_date)


@router.get("/defects", response_model=List[DefectStats])
async def defect_stats(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    return await stats_crud.get_defect_stats(db, start_date=start_date, end_date=end_date)


@router.get("/efficiency", response_model=List[EfficiencyTrend])
async def efficiency_trend(
    station_id: Optional[str] = None,
    days: int = Query(7, ge=1, le=90),
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    return await stats_crud.get_efficiency_trend(db, station_id=station_id, days=days)

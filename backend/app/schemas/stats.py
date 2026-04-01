from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field


class ProductionStatsResponse(BaseModel):
    station_id: str
    date: date
    hour: Optional[int]
    total_count: int
    defect_count: int
    avg_cycle_time: Optional[float]
    yield_rate: Optional[float] = None  # 良率

    model_config = {"from_attributes": True}


class DashboardSummary(BaseModel):
    total_production: int
    total_defects: int
    yield_rate: float
    oee: float
    active_cameras: int
    total_cameras: int
    unacknowledged_alerts: int
    critical_alerts: int


class DefectStats(BaseModel):
    event_type: str
    count: int
    percentage: float


class EfficiencyTrend(BaseModel):
    date: str
    avg_cycle_time: float
    total_count: int
    yield_rate: float

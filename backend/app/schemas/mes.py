from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class MESOrderCreate(BaseModel):
    order_no: str = Field(..., min_length=1, max_length=50)
    product_name: Optional[str] = None
    product_code: Optional[str] = None
    target_quantity: int = Field(..., ge=1)
    station_id: Optional[str] = None
    planned_start: Optional[datetime] = None
    planned_end: Optional[datetime] = None


class MESOrderUpdate(BaseModel):
    completed_quantity: Optional[int] = None
    defect_quantity: Optional[int] = None
    status: Optional[str] = Field(default=None, pattern=r"^(pending|in_progress|completed|cancelled)$")
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None


class MESOrderResponse(BaseModel):
    id: int
    order_no: str
    product_name: Optional[str]
    product_code: Optional[str]
    target_quantity: Optional[int]
    completed_quantity: int
    defect_quantity: int
    station_id: Optional[str]
    status: str
    planned_start: Optional[datetime]
    planned_end: Optional[datetime]
    actual_start: Optional[datetime]
    actual_end: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class QualityReport(BaseModel):
    """质量报告"""
    order_no: str
    product_name: Optional[str]
    target_quantity: int
    completed_quantity: int
    defect_quantity: int
    yield_rate: float
    defect_rate: float

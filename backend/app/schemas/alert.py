from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class AlertCreate(BaseModel):
    severity: str = Field(..., pattern=r"^(critical|warning|info)$")
    message: str
    camera_id: Optional[str] = Field(None, max_length=50)


class AlertResponse(AlertCreate):
    id: int
    acknowledged: bool
    acknowledged_by: Optional[str]
    status: str = "pending"
    assigned_to: Optional[str]
    resolved_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class AlertAcknowledge(BaseModel):
    acknowledged_by: str = Field(..., max_length=50)


class AlertClaim(BaseModel):
    assigned_to: str = Field(..., max_length=50)


class AlertResolve(BaseModel):
    resolved_by: str = Field(..., max_length=50)


class BatchClaimResponse(BaseModel):
    claimed_count: int


class AlertStats(BaseModel):
    total: int
    critical: int
    warning: int
    info: int
    unacknowledged: int
    pending: int = 0
    investigating: int = 0
    resolved: int = 0

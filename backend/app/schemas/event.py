from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, Field


class EventCreate(BaseModel):
    camera_id: str = Field(..., max_length=50)
    event_type: str = Field(..., pattern=r"^(defect|safety|efficiency)$")
    event_time: datetime
    confidence: Optional[float] = Field(None, ge=0, le=1)
    image_path: Optional[str] = None
    extra_data: Optional[dict[str, Any]] = None


class EventResponse(EventCreate):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class EventQuery(BaseModel):
    camera_id: Optional[str] = None
    event_type: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    skip: int = 0
    limit: int = 50

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class StorageResponse(BaseModel):
    id: int
    file_type: Optional[str] = None
    file_path: str
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    related_type: Optional[str] = None
    related_id: Optional[int] = None
    description: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class StorageStats(BaseModel):
    file_type: str
    count: int
    total_size: int


class StorageStatsSummary(BaseModel):
    total_files: int
    total_size: int
    by_type: list[StorageStats]

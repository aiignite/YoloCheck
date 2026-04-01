from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class CameraDriverCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    protocol: str = Field(..., pattern=r"^(rtsp|gigE|usb|http)$")
    description: Optional[str] = None
    config_schema: Optional[dict] = None
    default_params: Optional[dict] = None


class CameraDriverUpdate(BaseModel):
    description: Optional[str] = None
    config_schema: Optional[dict] = None
    default_params: Optional[dict] = None
    is_active: Optional[bool] = None


class CameraDriverResponse(BaseModel):
    id: int
    name: str
    protocol: str
    description: Optional[str]
    config_schema: Optional[dict]
    default_params: Optional[dict]
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class SystemConfigCreate(BaseModel):
    category: str = Field(..., max_length=50)
    key: str = Field(..., max_length=100)
    value: Optional[str] = None
    description: Optional[str] = None


class SystemConfigResponse(BaseModel):
    id: int
    category: str
    key: str
    value: Optional[str]
    description: Optional[str]

    model_config = {"from_attributes": True}

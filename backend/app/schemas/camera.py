from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class CameraBase(BaseModel):
    camera_id: str = Field(..., max_length=50, description="摄像头唯一标识")
    name: Optional[str] = Field(None, max_length=100, description="摄像头名称")
    location: Optional[str] = Field(None, max_length=100, description="安装位置")
    type: str = Field(..., pattern=r"^(gigE|rtsp|local|usb|http)$", description="摄像头类型")
    stream_url: Optional[str] = Field(None, max_length=255, description="视频流地址")


class CameraCreate(CameraBase):
    pass


class CameraUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    location: Optional[str] = Field(None, max_length=100)
    type: Optional[str] = Field(None, pattern=r"^(gigE|rtsp|local|usb|http)$")
    stream_url: Optional[str] = Field(None, max_length=255)
    status: Optional[str] = Field(None, pattern=r"^(online|offline)$")


class CameraResponse(CameraBase):
    id: int
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}

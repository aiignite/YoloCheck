from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    display_name: Optional[str] = None
    email: Optional[str] = None
    password: str = Field(..., min_length=6)
    role: str = Field(default="operator", pattern=r"^(admin|manager|operator)$")


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = Field(default=None, pattern=r"^(admin|manager|operator)$")
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    id: int
    username: str
    display_name: Optional[str]
    email: Optional[str]
    role: str
    is_active: bool
    last_login: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=6)

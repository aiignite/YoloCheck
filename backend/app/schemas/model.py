"""模型版本管理 Schema"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class ModelCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    version: str = Field(..., min_length=1, max_length=20)
    model_type: str = Field(..., pattern=r"^(defect|safety|efficiency|pose)$")
    description: str = ""
    model_path: str = ""
    file_size: int = 0
    accuracy: Optional[float] = None
    precision: Optional[float] = None
    recall: Optional[float] = None
    map50: Optional[float] = None
    map50_95: Optional[float] = None
    inference_speed: Optional[float] = None


class ModelUpdate(BaseModel):
    name: Optional[str] = None
    version: Optional[str] = None
    description: Optional[str] = None
    accuracy: Optional[float] = None
    precision: Optional[float] = None
    recall: Optional[float] = None
    map50: Optional[float] = None
    map50_95: Optional[float] = None
    inference_speed: Optional[float] = None
    status: Optional[str] = None


class ModelResponse(BaseModel):
    id: int
    name: str
    version: Optional[str]
    model_path: Optional[str]
    model_type: Optional[str]
    description: Optional[str]
    file_size: int
    accuracy: Optional[float]
    precision: Optional[float]
    recall: Optional[float]
    map50: Optional[float]
    map50_95: Optional[float]
    inference_speed: Optional[float]
    is_active: bool
    status: Optional[str]
    deployed_at: Optional[datetime]
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


class ModelCompare(BaseModel):
    """模型对比结果"""
    model_a: ModelResponse
    model_b: ModelResponse
    metrics_diff: dict  # accuracy, precision, recall, mAP, speed 差值

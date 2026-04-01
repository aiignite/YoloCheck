from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


# ── VideoTemplate ──

class VideoTemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    business_type: str = Field(..., pattern=r"^(assembly|welding|inspection|packaging|custom)$")
    station_id: Optional[str] = None


class VideoTemplateResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    video_path: str
    duration_seconds: Optional[float]
    fps: Optional[float]
    frame_count: Optional[int]
    resolution: Optional[str]
    business_type: str
    station_id: Optional[str]
    learning_config: Optional[dict]
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── LearningSession ──

class LearningSessionResponse(BaseModel):
    id: int
    template_id: int
    status: str
    progress: float
    total_frames: int
    processed_frames: int
    objects_detected: int
    actions_identified: int
    learning_mode: Optional[str]
    focus_classes: Optional[list]
    sample_rate: Optional[int]
    min_confidence: Optional[float]
    scene_threshold: Optional[float]
    error_message: Optional[str]
    analysis_result: Optional[dict]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class StartLearningRequest(BaseModel):
    learning_mode: str = Field(default="action_and_object", pattern=r"^(action_only|object_only|action_and_object)$")
    focus_classes: list[str] = Field(default_factory=list)
    sample_rate: int = Field(default=5, ge=1, le=30, description="每N帧采样一次")
    min_confidence: float = Field(default=0.4, ge=0.1, le=1.0)
    scene_threshold: float = Field(default=30.0, ge=5.0, le=100.0, description="场景变化阈值")


class VideoLearningConfigUpdate(BaseModel):
    learning_config: dict = Field(default_factory=dict)


class ActionSequenceUpdate(BaseModel):
    user_defined_name: Optional[str] = None
    note: Optional[str] = None
    is_kept: Optional[bool] = None


class ActionSplitRequest(BaseModel):
    target_frame: int = Field(..., ge=0)


class ActionMergeRequest(BaseModel):
    with_previous: bool = True


class TemplateCompareResponse(BaseModel):
    source_template_id: int
    target_template_id: int
    source_action_count: int
    target_action_count: int
    common_objects: list[str]
    avg_duration_gap: float


# ── ActionSequence ──

class ActionSequenceResponse(BaseModel):
    id: int
    session_id: int
    template_id: int
    step_order: int
    action_name: str
    description: Optional[str]
    start_frame: Optional[int]
    end_frame: Optional[int]
    start_time: Optional[float]
    end_time: Optional[float]
    duration: Optional[float]
    confidence: Optional[float]
    keyframe_path: Optional[str]
    objects_in_scene: Optional[list]
    features: Optional[dict]
    user_defined_name: Optional[str]
    note: Optional[str]
    is_kept: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── KeyFrame ──

class KeyFrameResponse(BaseModel):
    id: int
    session_id: int
    template_id: int
    frame_number: int
    timestamp: float
    image_path: Optional[str]
    detections: Optional[list]
    scene_change_score: Optional[float]
    is_action_boundary: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── 学习结果汇总 ──

class LearningSummary(BaseModel):
    template: VideoTemplateResponse
    session: LearningSessionResponse
    actions: list[ActionSequenceResponse]
    compare_summary: Optional[dict] = None
    key_frames_count: int
    action_boundaries_count: int

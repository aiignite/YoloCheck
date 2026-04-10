from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class VideoLearningSchemaBase(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())


# ── VideoTemplate ──

class VideoTemplateCreate(VideoLearningSchemaBase):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    business_type: str = Field(..., pattern=r"^(assembly|welding|inspection|packaging|custom)$")
    station_id: Optional[str] = None


class VideoTemplateResponse(VideoLearningSchemaBase):
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
    sop_content: Optional[dict]
    workflow_summary: Optional[dict]
    status: str
    created_at: datetime

# ── LearningSession ──

class LearningSessionResponse(VideoLearningSchemaBase):
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
    min_action_duration_seconds: Optional[float] = None
    object_change_sensitivity: Optional[str] = None
    object_model_id: Optional[int] = None
    action_model_id: Optional[int] = None
    error_message: Optional[str]
    analysis_result: Optional[dict]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime

class StartLearningRequest(VideoLearningSchemaBase):
    learning_mode: str = Field(default="action_and_object", pattern=r"^(action_only|object_only|action_and_object)$")
    focus_classes: list[str] = Field(default_factory=list)
    sample_rate: int = Field(default=5, ge=1, le=30, description="每N帧采样一次")
    min_confidence: float = Field(default=0.4, ge=0.1, le=1.0)
    scene_threshold: float = Field(default=30.0, ge=5.0, le=100.0, description="场景变化阈值")
    min_action_duration_seconds: float = Field(default=1.0, ge=0.1, le=10.0)
    object_change_sensitivity: str = Field(default="medium", pattern=r"^(low|medium|high)$")
    object_model_id: Optional[int] = None
    action_model_id: Optional[int] = None
    object_category_ids: list[int] = Field(default_factory=list)


class VideoLearningConfigUpdate(VideoLearningSchemaBase):
    learning_config: dict = Field(default_factory=dict)


class ObjectCategoryCreate(VideoLearningSchemaBase):
    name: str = Field(..., min_length=1, max_length=100)
    display_name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    color: str = Field(default="#1677ff", max_length=20)
    icon: Optional[str] = None


class ObjectCategoryResponse(VideoLearningSchemaBase):
    id: int
    name: str
    display_name: str
    description: Optional[str]
    color: Optional[str]
    icon: Optional[str]
    is_builtin: bool
    is_active: bool
    created_at: datetime

class ObjectAnnotationSetCreate(VideoLearningSchemaBase):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    source_type: str = Field(..., pattern=r"^(video_frame|image_upload|imported)$")


class ObjectAnnotationSetResponse(VideoLearningSchemaBase):
    id: int
    name: str
    description: Optional[str]
    source_type: str
    status: str
    created_by: Optional[int]
    created_at: datetime

class ObjectAnnotationCreate(VideoLearningSchemaBase):
    image_path: str = Field(..., min_length=1)
    frame_number: Optional[int] = None
    source_video_template_id: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None
    annotations_json: list[dict] = Field(default_factory=list)


class ObjectAnnotationFromSessionRequest(VideoLearningSchemaBase):
    session_id: int = Field(..., ge=1)
    min_confidence: float = Field(default=0.3, ge=0.0, le=1.0)


class ActionCategoryCreate(VideoLearningSchemaBase):
    name: str = Field(..., min_length=1, max_length=100)
    display_name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None


class ActionCategoryResponse(VideoLearningSchemaBase):
    id: int
    name: str
    display_name: str
    description: Optional[str]
    is_active: bool
    created_at: datetime

class ActionSampleSetCreate(VideoLearningSchemaBase):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    source_type: str = Field(..., pattern=r"^(pose_json|video_pose_extract)$")


class ActionSampleSetResponse(VideoLearningSchemaBase):
    id: int
    name: str
    description: Optional[str]
    source_type: str
    status: str
    created_by: Optional[int]
    created_at: datetime

class ActionSampleImportItem(VideoLearningSchemaBase):
    action_category_id: int
    start_frame: Optional[int] = None
    end_frame: Optional[int] = None
    duration: Optional[float] = None
    source_session_id: Optional[int] = None
    skeleton_sequence_json: dict = Field(default_factory=dict)
    metadata_json: dict = Field(default_factory=dict)


class ActionSampleImportRequest(VideoLearningSchemaBase):
    samples: list[ActionSampleImportItem] = Field(default_factory=list)


class ActionSampleFromSessionRequest(VideoLearningSchemaBase):
    session_id: int = Field(..., ge=1)
    action_category_id: Optional[int] = Field(default=None, ge=1)


class BatchCreateResponse(VideoLearningSchemaBase):
    created_count: int


class TrainingJobCreateBase(VideoLearningSchemaBase):
    name: str = Field(..., min_length=1, max_length=200)
    dataset_id: int = Field(..., ge=1)


class ObjectTrainingJobCreate(TrainingJobCreateBase):
    epochs: int = Field(default=10, ge=1, le=500)
    image_size: int = Field(default=640, ge=64, le=2048)


class ActionTrainingJobCreate(TrainingJobCreateBase):
    sequence_length: int = Field(default=32, ge=1, le=512)


class TrainingJobResponse(VideoLearningSchemaBase):
    id: int
    name: str
    job_type: str
    dataset_type: str
    dataset_id: int
    model_id: Optional[int]
    status: str
    progress: float
    config_json: Optional[dict]
    metrics_json: Optional[dict]
    log_path: Optional[str]
    error_message: Optional[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime


class TrainingJobTimelineItemResponse(VideoLearningSchemaBase):
    status: str
    label: Optional[str] = None
    timestamp: Optional[datetime] = None


class TrainingJobArtifactSummaryResponse(VideoLearningSchemaBase):
    file_name: Optional[str] = None
    file_path: Optional[str] = None
    relative_path: Optional[str] = None
    file_size: Optional[int] = None
    exists: bool = False
    download_url: Optional[str] = None


class TrainingJobLogSummaryResponse(VideoLearningSchemaBase):
    file_path: Optional[str] = None
    relative_path: Optional[str] = None
    exists: bool = False
    line_count: int = 0
    tail_lines: list[str] = Field(default_factory=list)
    view_url: Optional[str] = None


class TrainingJobRuntimeSummaryResponse(VideoLearningSchemaBase):
    epochs: Optional[int] = None
    image_size: Optional[int] = None
    sequence_length: Optional[int] = None
    class_count: Optional[int] = None
    accuracy: Optional[float] = None
    precision: Optional[float] = None
    recall: Optional[float] = None
    map50: Optional[float] = None
    map50_95: Optional[float] = None
    inference_speed: Optional[float] = None


class TrainingJobDetailResponse(VideoLearningSchemaBase):
    job: TrainingJobResponse
    model: dict = Field(default_factory=dict)
    runtime_summary: TrainingJobRuntimeSummaryResponse
    dataset_summary: dict = Field(default_factory=dict)
    artifact_summary: TrainingJobArtifactSummaryResponse
    log_summary: TrainingJobLogSummaryResponse
    status_timeline: list[TrainingJobTimelineItemResponse] = Field(default_factory=list)


class TrainingEvaluationJobResponse(VideoLearningSchemaBase):
    id: int
    name: str
    job_type: str
    dataset_type: str
    dataset_id: int
    status: str
    progress: float
    metrics_json: Optional[dict]
    log_path: Optional[str]
    completed_at: Optional[datetime]
    created_at: datetime


class TrainingEvaluationItemResponse(VideoLearningSchemaBase):
    model: dict = Field(default_factory=dict)
    job: Optional[TrainingEvaluationJobResponse] = None

class ActionSequenceUpdate(VideoLearningSchemaBase):
    user_defined_name: Optional[str] = None
    start_time: Optional[float] = Field(default=None, ge=0)
    end_time: Optional[float] = Field(default=None, ge=0)
    note: Optional[str] = None
    is_kept: Optional[bool] = None


class ActionSplitRequest(VideoLearningSchemaBase):
    target_frame: int = Field(..., ge=0)


class ActionMergeRequest(VideoLearningSchemaBase):
    with_previous: bool = True


class ActionSuggestionApplyRequest(VideoLearningSchemaBase):
    suggestion_type: str = Field(..., pattern=r"^(rename|keep)$")


class SOPPreviewResponse(VideoLearningSchemaBase):
    template_id: int
    title: str
    business_type: str
    station_id: Optional[str] = None
    workflow_summary: dict = Field(default_factory=dict)
    steps: list[dict] = Field(default_factory=list)


class TemplateSOPUpdate(VideoLearningSchemaBase):
    sop_content: dict = Field(default_factory=dict)
    workflow_summary: dict = Field(default_factory=dict)


class TemplateCompareResponse(VideoLearningSchemaBase):
    source_template_id: int
    target_template_id: int
    source_action_count: int
    target_action_count: int
    common_objects: list[str]
    avg_duration_gap: float


class FrameOverlayObjectResponse(VideoLearningSchemaBase):
    class_name: str
    confidence: Optional[float] = None
    bbox: list[float] = Field(default_factory=list)
    model_source: Optional[str] = None
    model_id: Optional[int] = None
    model_name: Optional[str] = None


class FrameOverlayPosePointResponse(VideoLearningSchemaBase):
    index: int
    x: float
    y: float
    conf: Optional[float] = None


class FrameOverlayPoseResponse(VideoLearningSchemaBase):
    person_index: int
    points: list[FrameOverlayPosePointResponse] = Field(default_factory=list)


class FrameOverlayResponse(VideoLearningSchemaBase):
    frame_number: int
    timestamp: float
    image_path: Optional[str] = None
    objects: list[FrameOverlayObjectResponse] = Field(default_factory=list)
    pose_keypoints: list[FrameOverlayPoseResponse] = Field(default_factory=list)
    interaction_summary: dict = Field(default_factory=dict)
    scene_change_score: Optional[float] = None
    is_action_boundary: bool = False


# ── ActionSequence ──

class ActionSequenceResponse(VideoLearningSchemaBase):
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
    suggestions: list[dict] = Field(default_factory=list)
    user_defined_name: Optional[str]
    note: Optional[str]
    is_kept: bool
    created_at: datetime

# ── KeyFrame ──

class KeyFrameResponse(VideoLearningSchemaBase):
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

# ── 学习结果汇总 ──

class LearningSummary(VideoLearningSchemaBase):
    template: VideoTemplateResponse
    session: LearningSessionResponse
    actions: list[ActionSequenceResponse]
    compare_summary: Optional[dict] = None
    workflow_summary: dict = Field(default_factory=dict)
    workflow_suggestions: list[dict] = Field(default_factory=list)
    sop_preview: dict = Field(default_factory=dict)
    key_frames_count: int
    action_boundaries_count: int

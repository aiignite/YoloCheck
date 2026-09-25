from datetime import datetime, date
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, Text, Date, SmallInteger,
    DateTime, UniqueConstraint, Index, JSON, ForeignKey, func,
)
from sqlalchemy.dialects.postgresql import JSONB

from app.database import Base


class Camera(Base):
    __tablename__ = "cameras"

    id = Column(Integer, primary_key=True, autoincrement=True)
    camera_id = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100))
    location = Column(String(100))
    type = Column(String(20))  # gigE / rtsp
    stream_url = Column(String(255))
    status = Column(String(20), default="offline")
    created_at = Column(DateTime, default=func.now())


class DetectionEvent(Base):
    __tablename__ = "detection_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    camera_id = Column(String(50), nullable=False, index=True)
    event_type = Column(String(50), index=True)  # defect / safety / efficiency
    event_time = Column(DateTime, nullable=False, index=True)
    confidence = Column(Float)
    image_path = Column(String(255))
    extra_data = Column("metadata", JSON)
    created_at = Column(DateTime, default=func.now())


class ProductionStats(Base):
    __tablename__ = "production_stats"

    id = Column(Integer, primary_key=True, autoincrement=True)
    station_id = Column(String(50), nullable=False, index=True)
    date = Column(Date, nullable=False)
    hour = Column(SmallInteger)
    total_count = Column(Integer, default=0)
    defect_count = Column(Integer, default=0)
    avg_cycle_time = Column(Float)

    __table_args__ = (
        UniqueConstraint("station_id", "date", "hour", name="uq_station_date_hour"),
    )


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    severity = Column(String(20), index=True)  # critical / warning / info
    message = Column(Text)
    camera_id = Column(String(50), index=True)
    acknowledged = Column(Boolean, default=False)
    acknowledged_by = Column(String(50))
    status = Column(String(20), default="pending", index=True)  # pending / investigating / resolved
    assigned_to = Column(String(50))
    resolved_at = Column(DateTime)
    escalated = Column(Boolean, default=False)
    escalation_level = Column(SmallInteger, default=0)
    notification_sent = Column(Boolean, default=False)
    notification_channels = Column(Text, default="")  # comma-separated: email,dingtalk,wechat
    created_at = Column(DateTime, default=func.now())


class AlertRule(Base):
    """告警规则配置"""
    __tablename__ = "alert_rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, default="")
    severity = Column(String(20), default="warning")  # critical / warning / info
    condition_type = Column(String(50))  # threshold / pattern / frequency
    condition_config = Column(Text, default="{}")  # JSON: {metric, operator, value}
    notification_channels = Column(Text, default="")  # email,dingtalk,wechat,sms
    escalation_minutes = Column(Integer, default=30)  # 升级时间(分钟)
    escalation_target = Column(String(100), default="")  # 升级通知目标
    is_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())


class Model(Base):
    __tablename__ = "models"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    version = Column(String(20))
    model_path = Column(String(255))
    model_type = Column(String(50))  # defect / safety / efficiency / pose
    description = Column(Text, default="")
    file_size = Column(Integer, default=0)  # bytes
    accuracy = Column(Float)
    precision = Column(Float)
    recall = Column(Float)
    map50 = Column(Float)  # mAP@0.5
    map50_95 = Column(Float)  # mAP@0.5:0.95
    inference_speed = Column(Float)  # ms per frame
    is_active = Column(Boolean, default=False)  # 当前是否部署激活
    status = Column(String(20), default="uploaded")  # uploaded / validating / ready / deployed / archived
    deployed_at = Column(DateTime)
    created_at = Column(DateTime, default=func.now())


# ── 视频学习模块 ──

class VideoTemplate(Base):
    """标准操作模板视频"""
    __tablename__ = "video_templates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    video_path = Column(String(500), nullable=False)
    duration_seconds = Column(Float)
    fps = Column(Float)
    frame_count = Column(Integer)
    resolution = Column(String(20))  # e.g. "1920x1080"
    business_type = Column(String(50), index=True)  # assembly / welding / inspection / packaging
    station_id = Column(String(50), index=True)
    learning_config = Column(JSON)  # 默认学习配置
    sop_content = Column(JSON)  # 结构化SOP内容
    workflow_summary = Column(JSON)  # 模板级流程摘要
    status = Column(String(20), default="pending")  # pending / analyzing / completed / failed
    created_at = Column(DateTime, default=func.now())


class LearningSession(Base):
    """视频学习会话"""
    __tablename__ = "learning_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    template_id = Column(Integer, ForeignKey("video_templates.id"), nullable=False)
    status = Column(String(20), default="pending")  # pending / running / completed / failed
    progress = Column(Float, default=0.0)  # 0.0 ~ 100.0
    total_frames = Column(Integer, default=0)
    processed_frames = Column(Integer, default=0)
    objects_detected = Column(Integer, default=0)
    actions_identified = Column(Integer, default=0)
    learning_mode = Column(String(30), default="action_and_object")  # action_only / object_only / action_and_object
    focus_classes = Column(JSON)  # 关注对象类别快照
    sample_rate = Column(Integer, default=5)
    min_confidence = Column(Float, default=0.4)
    scene_threshold = Column(Float, default=30.0)
    min_action_duration_seconds = Column(Float, default=1.0)
    object_change_sensitivity = Column(String(20), default="medium")
    object_model_id = Column(Integer, ForeignKey("models.id"))
    action_model_id = Column(Integer, ForeignKey("models.id"))
    error_message = Column(Text)
    analysis_result = Column(JSON)  # 学习结果摘要
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=func.now())


class ActionSequence(Base):
    """从视频中学习到的动作序列"""
    __tablename__ = "action_sequences"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("learning_sessions.id"), nullable=False)
    template_id = Column(Integer, ForeignKey("video_templates.id"), nullable=False)
    step_order = Column(Integer, nullable=False)
    action_name = Column(String(200), nullable=False)
    description = Column(Text)
    start_frame = Column(Integer)
    end_frame = Column(Integer)
    start_time = Column(Float)  # seconds
    end_time = Column(Float)
    duration = Column(Float)
    confidence = Column(Float)
    keyframe_path = Column(String(500))  # 关键帧截图
    objects_in_scene = Column(JSON)  # 场景中检测到的对象列表
    features = Column(JSON)  # 提取的特征向量/属性
    user_defined_name = Column(String(200))  # 人工修正动作名
    note = Column(Text)  # 人工备注
    is_kept = Column(Boolean, default=True)  # 是否保留为标准动作
    created_at = Column(DateTime, default=func.now())


class KeyFrame(Base):
    """关键帧数据"""
    __tablename__ = "key_frames"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("learning_sessions.id"), nullable=False)
    template_id = Column(Integer, ForeignKey("video_templates.id"), nullable=False)
    frame_number = Column(Integer, nullable=False)
    timestamp = Column(Float, nullable=False)  # seconds
    image_path = Column(String(500))
    detections = Column(JSON)  # YOLO检测结果列表
    scene_change_score = Column(Float)  # 场景变化分数
    is_action_boundary = Column(Boolean, default=False)  # 是否为动作边界帧
    created_at = Column(DateTime, default=func.now())


class ObjectCategory(Base):
    """自定义物体类别"""
    __tablename__ = "object_categories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True, index=True)
    display_name = Column(String(100), nullable=False)
    description = Column(Text)
    color = Column(String(20), default="#1677ff")
    icon = Column(String(100))
    is_builtin = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())


class ObjectAnnotationSet(Base):
    """物体标注集"""
    __tablename__ = "object_annotation_sets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    source_type = Column(String(30), nullable=False)  # video_frame / image_upload / imported
    status = Column(String(20), default="draft")
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=func.now())


class ObjectAnnotation(Base):
    """物体标注样本"""
    __tablename__ = "object_annotations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    annotation_set_id = Column(Integer, ForeignKey("object_annotation_sets.id"), nullable=False)
    image_path = Column(String(500), nullable=False)
    frame_number = Column(Integer)
    source_video_template_id = Column(Integer, ForeignKey("video_templates.id"))
    width = Column(Integer)
    height = Column(Integer)
    annotations_json = Column(JSON)
    created_at = Column(DateTime, default=func.now())


class ActionCategory(Base):
    """自定义动作类别"""
    __tablename__ = "action_categories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True, index=True)
    display_name = Column(String(100), nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())


class ActionSampleSet(Base):
    """动作样本集"""
    __tablename__ = "action_sample_sets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    source_type = Column(String(30), nullable=False)  # pose_json / video_pose_extract
    status = Column(String(20), default="draft")
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=func.now())


class ActionSample(Base):
    """动作样本"""
    __tablename__ = "action_samples"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sample_set_id = Column(Integer, ForeignKey("action_sample_sets.id"), nullable=False)
    action_category_id = Column(Integer, ForeignKey("action_categories.id"), nullable=False)
    source_session_id = Column(Integer, ForeignKey("learning_sessions.id"))
    start_frame = Column(Integer)
    end_frame = Column(Integer)
    duration = Column(Float)
    skeleton_sequence_json = Column(JSON, nullable=False)
    metadata_json = Column(JSON)
    created_at = Column(DateTime, default=func.now())


class TrainingJob(Base):
    """统一训练任务"""
    __tablename__ = "training_jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    job_type = Column(String(50), nullable=False)  # object_detection / action_recognition
    dataset_type = Column(String(50), nullable=False)  # object_annotation_set / action_sample_set
    dataset_id = Column(Integer, nullable=False)
    model_id = Column(Integer, ForeignKey("models.id"))
    status = Column(String(20), default="pending")
    progress = Column(Float, default=0.0)
    config_json = Column(JSON)
    metrics_json = Column(JSON)
    log_path = Column(String(500))
    error_message = Column(Text)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=func.now())


# ── 用户管理 ──

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    display_name = Column(String(100))
    email = Column(String(200))
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default="operator")  # admin / manager / operator
    is_active = Column(Boolean, default=True)
    is_locked_until = Column(DateTime)
    failed_login_count = Column(Integer, default=0)
    last_login = Column(DateTime)
    created_at = Column(DateTime, default=func.now())


class LoginAttempt(Base):
    __tablename__ = "login_attempts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), nullable=False, index=True)
    ip_address = Column(String(45))
    user_agent = Column(String(300))
    attempted_at = Column(DateTime, default=func.now(), index=True)


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    jti = Column(String(64), unique=True, nullable=False, index=True)
    ip_address = Column(String(45))
    user_agent = Column(String(300))
    device_info = Column(String(200))
    created_at = Column(DateTime, default=func.now())
    last_accessed_at = Column(DateTime, default=func.now())


class PasswordHistory(Base):
    __tablename__ = "password_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=func.now())


# ── 摄像头类型与驱动 ──

class CameraDriver(Base):
    """摄像头驱动配置"""
    __tablename__ = "camera_drivers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)
    protocol = Column(String(20), nullable=False)  # rtsp / gigE / usb / http
    description = Column(Text)
    config_schema = Column(JSON)  # 驱动配置JSON Schema
    default_params = Column(JSON)  # 默认参数
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())


# ── 系统设置 ──

class SystemConfig(Base):
    """系统配置键值对"""
    __tablename__ = "system_configs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    category = Column(String(50), nullable=False, index=True)
    key = Column(String(100), nullable=False)
    value = Column(Text)
    description = Column(String(200))

    __table_args__ = (
        UniqueConstraint("category", "key", name="uq_config_category_key"),
    )


# ── MES接口 ──

class MESOrder(Base):
    """MES生产工单"""
    __tablename__ = "mes_orders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_no = Column(String(50), unique=True, nullable=False, index=True)
    product_name = Column(String(200))
    product_code = Column(String(50))
    target_quantity = Column(Integer)
    completed_quantity = Column(Integer, default=0)
    defect_quantity = Column(Integer, default=0)
    station_id = Column(String(50), index=True)
    status = Column(String(20), default="pending")  # pending / in_progress / completed / cancelled
    planned_start = Column(DateTime)
    planned_end = Column(DateTime)
    actual_start = Column(DateTime)
    actual_end = Column(DateTime)
    created_at = Column(DateTime, default=func.now())


# ── 存储管理 ──

class StorageRecord(Base):
    """文件存储记录"""
    __tablename__ = "storage_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    file_type = Column(String(30), index=True)  # image / video / model / keyframe
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer)  # bytes
    mime_type = Column(String(100))
    related_type = Column(String(50))  # camera / event / template / session
    related_id = Column(Integer)
    description = Column(String(200))
    created_at = Column(DateTime, default=func.now())


class AuditLog(Base):
    """操作审计日志"""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, index=True)
    username = Column(String(50))
    action = Column(String(50), nullable=False, index=True)  # login / logout / create / update / delete
    resource_type = Column(String(50), index=True)  # user / camera / alert / system ...
    resource_id = Column(String(100))
    detail = Column(Text)
    ip_address = Column(String(45))
    user_agent = Column(String(300))
    status = Column(String(20), default="success")  # success / failure
    created_at = Column(DateTime, default=func.now(), index=True)

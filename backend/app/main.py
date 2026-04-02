from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

import logging

from app.config import get_settings
from app.database import engine, Base
from app.models.models import Camera, DetectionEvent, ProductionStats, Alert, Model  # noqa: ensure models registered
from app.models.models import VideoTemplate, LearningSession, ActionSequence, KeyFrame  # noqa
from app.models.models import ObjectCategory, ObjectAnnotationSet, ObjectAnnotation  # noqa
from app.models.models import ActionCategory, ActionSampleSet, ActionSample, TrainingJob  # noqa
from app.models.models import User, CameraDriver, SystemConfig, MESOrder, StorageRecord, AuditLog, AlertRule  # noqa
from app.api import cameras, events, alerts, stats, websocket, video_learning, video_training
from app.api import users, system, mes, reports, live_monitor, auth, models, batch_analysis, alert_workflow, pipeline, storage
from app.core.rate_limit import RateLimitMiddleware
from app.core.metrics_middleware import MetricsMiddleware
from app.core import monitoring

settings = get_settings()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.core.mqtt_client import get_mqtt_client
    from app.core.batch_analysis import get_task_queue
    from app.core.stream_manager import stream_manager
    from app.core.pipeline import pipeline

    mqtt_client = None
    try:
        mqtt_client = get_mqtt_client()
        mqtt_client.connect()
        logger.info("MQTT 客户端已启动")
    except Exception as e:
        logger.warning(f"MQTT 客户端启动失败（非致命）: {e}")

    app.state.mqtt_client = mqtt_client
    app.state.stream_manager = stream_manager
    app.state.pipeline = pipeline
    app.state.task_queue = get_task_queue()

    yield

    if mqtt_client:
        try:
            mqtt_client.disconnect()
            logger.info("MQTT 客户端已断开")
        except Exception:
            pass


def create_app() -> FastAPI:
    app = FastAPI(
        title="YoloCheck - YOLO生产过程学习监控系统",
        version="0.1.0",
        description="基于YOLO视觉识别的生产过程监控系统API",
        lifespan=lifespan,
    )

    # 中间件（按添加的反序执行）
    cors_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RateLimitMiddleware, rate=60.0, burst=120)
    app.add_middleware(MetricsMiddleware)

    # 注册路由
    app.include_router(cameras.router, prefix="/api/cameras", tags=["摄像头管理"])
    app.include_router(events.router, prefix="/api/events", tags=["检测事件"])
    app.include_router(alerts.router, prefix="/api/alerts", tags=["告警管理"])
    app.include_router(stats.router, prefix="/api/stats", tags=["统计分析"])
    app.include_router(websocket.router, prefix="/ws", tags=["WebSocket"])
    app.include_router(video_learning.router, prefix="/api/video-learning", tags=["视频学习"])
    app.include_router(video_training.router, prefix="/api/video-training", tags=["视频训练"])
    app.include_router(users.router, prefix="/api/users", tags=["用户管理"])
    app.include_router(system.router, prefix="/api/system", tags=["系统设置"])
    app.include_router(mes.router, prefix="/api/mes", tags=["MES接口"])
    app.include_router(reports.router, prefix="/api/reports", tags=["报表导出"])
    app.include_router(live_monitor.router, prefix="/api/live", tags=["实时监控"])
    app.include_router(auth.router, prefix="/api/auth", tags=["认证与审计"])
    app.include_router(models.router, prefix="/api/models", tags=["模型管理"])
    app.include_router(batch_analysis.router, prefix="/api/batch", tags=["批量分析"])
    app.include_router(alert_workflow.router, prefix="/api/alert-workflow", tags=["告警工作流"])
    app.include_router(pipeline.router, prefix="/api/pipeline", tags=["检测流水线"])
    app.include_router(storage.router, prefix="/api/storage", tags=["存储管理"])
    app.include_router(monitoring.router, prefix="/api", tags=["系统监控"])

    # 静态文件
    os.makedirs(settings.upload_dir, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

    return app


app = create_app()

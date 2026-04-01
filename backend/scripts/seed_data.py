"""
数据库初始化与种子数据脚本
用法: python -m scripts.seed_data [--reset]
  --reset: 重置数据库（删除所有数据后重新插入）
"""
import asyncio
import sys
import random
from datetime import datetime, date, timedelta
from pathlib import Path

# 支持从 backend/ 目录运行
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy.ext.asyncio import AsyncSession
from app.database import engine, async_session, Base
from app.models.models import (
    Camera, DetectionEvent, ProductionStats, Alert, Model,
    VideoTemplate, LearningSession, ActionSequence, KeyFrame,
    User, CameraDriver, SystemConfig, MESOrder, StorageRecord, AuditLog,
)


# ── 种子数据定义 ──

CAMERAS = [
    {"camera_id": "cam_smt_01", "name": "SMT-1号贴片机", "location": "A区SMT产线", "type": "gigE", "stream_url": "gigE://192.168.1.101", "status": "online"},
    {"camera_id": "cam_smt_02", "name": "SMT-2号回流焊", "location": "A区SMT产线", "type": "gigE", "stream_url": "gigE://192.168.1.102", "status": "online"},
    {"camera_id": "cam_asm_01", "name": "组装工位1号", "location": "B区组装线", "type": "rtsp", "stream_url": "rtsp://192.168.1.201:554/stream1", "status": "online"},
    {"camera_id": "cam_asm_02", "name": "组装工位2号", "location": "B区组装线", "type": "rtsp", "stream_url": "rtsp://192.168.1.202:554/stream1", "status": "online"},
    {"camera_id": "cam_qc_01", "name": "QC检测站", "location": "C区品质检验", "type": "gigE", "stream_url": "gigE://192.168.1.301", "status": "online"},
    {"camera_id": "cam_pkg_01", "name": "包装线监控", "location": "D区包装线", "type": "rtsp", "stream_url": "rtsp://192.168.1.401:554/stream1", "status": "offline"},
    {"camera_id": "cam_wh_01", "name": "仓库入口", "location": "E区仓库", "type": "rtsp", "stream_url": "rtsp://192.168.1.501:554/stream1", "status": "online"},
    {"camera_id": "cam_safe_01", "name": "安全区域监控", "location": "F区安全通道", "type": "rtsp", "stream_url": "rtsp://192.168.1.601:554/stream1", "status": "online"},
]

MODELS_DATA = [
    {"name": "YOLOv8-Defect", "version": "1.2.0", "model_path": "models/yolov8_defect.pt", "model_type": "defect", "accuracy": 0.945, "precision": 0.932, "recall": 0.918, "map50": 0.941, "map50_95": 0.823, "inference_speed": 12.5, "is_active": True, "status": "deployed", "file_size": 6200000},
    {"name": "YOLOv8-Safety", "version": "1.0.1", "model_path": "models/yolov8_safety.pt", "model_type": "safety", "accuracy": 0.923, "precision": 0.911, "recall": 0.897, "map50": 0.919, "map50_95": 0.795, "inference_speed": 14.2, "is_active": True, "status": "deployed", "file_size": 6100000},
    {"name": "YOLOv8-Efficiency", "version": "0.9.3", "model_path": "models/yolov8_efficiency.pt", "model_type": "efficiency", "accuracy": 0.887, "precision": 0.873, "recall": 0.862, "map50": 0.881, "map50_95": 0.751, "inference_speed": 11.8, "is_active": True, "status": "deployed", "file_size": 5900000},
    {"name": "YOLOv8n-Pose", "version": "1.0.0", "model_path": "yolov8n-pose.pt", "model_type": "pose", "accuracy": 0.912, "precision": 0.901, "recall": 0.889, "map50": 0.908, "map50_95": 0.782, "inference_speed": 15.3, "is_active": True, "status": "deployed", "file_size": 6400000},
    {"name": "YOLOv8-Defect", "version": "1.1.0", "model_path": "models/yolov8_defect_v1.1.pt", "model_type": "defect", "accuracy": 0.921, "precision": 0.908, "recall": 0.895, "map50": 0.917, "map50_95": 0.798, "inference_speed": 13.1, "is_active": False, "status": "ready", "file_size": 6000000},
    {"name": "YOLOv8-Safety", "version": "0.9.0", "model_path": "models/yolov8_safety_v0.9.pt", "model_type": "safety", "accuracy": 0.891, "precision": 0.878, "recall": 0.865, "map50": 0.887, "map50_95": 0.763, "inference_speed": 14.8, "is_active": False, "status": "archived", "file_size": 5800000},
]

STATIONS = ["station_smt_01", "station_smt_02", "station_asm_01", "station_asm_02", "station_qc_01"]

EVENT_TYPES = ["defect", "safety", "efficiency"]

DEFECT_MESSAGES = [
    "焊点缺陷：虚焊", "焊点缺陷：连锡", "元件偏移", "元件缺失",
    "PCB划痕", "针孔缺陷", "锡膏不足", "元件翘起",
]

SAFETY_MESSAGES = [
    "未佩戴安全帽", "闯入危险区域", "未穿防静电服", "操作不规范",
    "通道堵塞", "消防通道被占", "灭火器缺失",
]

EFFICIENCY_MESSAGES = [
    "产线停机超时", "节拍异常偏高", "换线时间过长", "物料等待超时",
]

ALERT_SEVERITIES = ["critical", "warning", "info"]


async def create_tables():
    """创建所有数据库表"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ 数据库表已创建")


async def drop_tables():
    """删除所有数据库表"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    print("⚠️  数据库表已删除")


async def seed_cameras(session: AsyncSession):
    """插入摄像头数据"""
    for cam in CAMERAS:
        session.add(Camera(**cam))
    await session.commit()
    print(f"  📷 插入 {len(CAMERAS)} 个摄像头")


async def seed_models(session: AsyncSession):
    """插入模型数据"""
    for m in MODELS_DATA:
        session.add(Model(**m, deployed_at=datetime.utcnow()))
    await session.commit()
    print(f"  🧠 插入 {len(MODELS_DATA)} 个模型")


async def seed_production_stats(session: AsyncSession, days: int = 7):
    """插入生产统计数据（最近N天，逐小时）"""
    count = 0
    today = date.today()
    for day_offset in range(days):
        d = today - timedelta(days=day_offset)
        for station in STATIONS:
            hours = range(8, 20) if day_offset > 0 else range(8, min(20, datetime.now().hour + 1))
            for hour in hours:
                total = random.randint(80, 150)
                defect = random.randint(0, max(1, int(total * 0.08)))
                cycle_time = round(random.uniform(12.0, 25.0), 2)
                session.add(ProductionStats(
                    station_id=station,
                    date=d,
                    hour=hour,
                    total_count=total,
                    defect_count=defect,
                    avg_cycle_time=cycle_time,
                ))
                count += 1
    await session.commit()
    print(f"  📊 插入 {count} 条生产统计记录")


async def seed_detection_events(session: AsyncSession, days: int = 7):
    """插入检测事件"""
    count = 0
    today = datetime.utcnow()
    camera_ids = [c["camera_id"] for c in CAMERAS]

    for day_offset in range(days):
        events_per_day = random.randint(15, 40)
        for _ in range(events_per_day):
            event_type = random.choice(EVENT_TYPES)
            cam = random.choice(camera_ids)
            event_time = today - timedelta(
                days=day_offset,
                hours=random.randint(0, 12),
                minutes=random.randint(0, 59),
            )
            confidence = round(random.uniform(0.55, 0.99), 3)
            session.add(DetectionEvent(
                camera_id=cam,
                event_type=event_type,
                event_time=event_time,
                confidence=confidence,
                image_path=f"uploads/detections/{cam}_{event_time.strftime('%Y%m%d_%H%M%S')}.jpg",
                extra_data={"model": "YOLOv8", "source": "seed"},
            ))
            count += 1
    await session.commit()
    print(f"  🔍 插入 {count} 条检测事件")


async def seed_alerts(session: AsyncSession, days: int = 7):
    """插入告警数据"""
    count = 0
    today = datetime.utcnow()
    camera_ids = [c["camera_id"] for c in CAMERAS]

    for day_offset in range(days):
        alerts_per_day = random.randint(5, 15)
        for _ in range(alerts_per_day):
            severity = random.choices(ALERT_SEVERITIES, weights=[1, 3, 6])[0]
            cam = random.choice(camera_ids)
            created_at = today - timedelta(
                days=day_offset,
                hours=random.randint(0, 12),
                minutes=random.randint(0, 59),
            )
            # 选消息
            if severity == "critical":
                msg = random.choice(DEFECT_MESSAGES[:4] + SAFETY_MESSAGES[:2])
            elif severity == "warning":
                msg = random.choice(DEFECT_MESSAGES + SAFETY_MESSAGES)
            else:
                msg = random.choice(EFFICIENCY_MESSAGES + SAFETY_MESSAGES[-2:])
            # 旧告警大部分已确认
            acked = day_offset > 1 or random.random() < 0.3
            session.add(Alert(
                severity=severity,
                message=msg,
                camera_id=cam,
                acknowledged=acked,
                acknowledged_by="admin" if acked else None,
                created_at=created_at,
            ))
            count += 1
    await session.commit()
    print(f"  🚨 插入 {count} 条告警记录")


async def seed_all(reset: bool = False):
    """执行完整的数据库初始化"""
    print("=" * 50)
    print("YoloCheck 数据库初始化")
    print("=" * 50)

    if reset:
        await drop_tables()

    await create_tables()

    print("\n📦 插入种子数据...")
    async with async_session() as session:
        await seed_cameras(session)
        await seed_models(session)
        await seed_production_stats(session)
        await seed_detection_events(session)
        await seed_alerts(session)

    print("\n✅ 数据库初始化完成！")
    print("  运行后端: uvicorn app.main:app --reload")
    print("  运行前端: cd ../frontend && npm run dev")


if __name__ == "__main__":
    reset = "--reset" in sys.argv
    asyncio.run(seed_all(reset=reset))

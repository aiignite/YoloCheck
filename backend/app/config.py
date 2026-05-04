from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # 数据库
    database_url: str = "postgresql+asyncpg://yolocheck:yolocheck123@localhost:5432/yolocheck"
    database_url_sync: str = "postgresql://yolocheck:yolocheck123@localhost:5432/yolocheck"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # MQTT
    mqtt_broker: str = "localhost"
    mqtt_port: int = 1883
    mqtt_username: str = ""
    mqtt_password: str = ""

    # YOLO
    yolo_model_path: str = "models/yolov8n.pt"
    yolo_confidence_threshold: float = 0.5
    yolo_device: str = "cpu"

    # 存储
    upload_dir: str = "uploads"
    image_save_dir: str = "uploads/detections"

    # 服务
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000

    # JWT
    jwt_secret_key: str = "yolocheck-jwt-secret-key-change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_expire_minutes: int = 480
    jwt_refresh_expire_days: int = 7

    # 安全策略
    password_min_length: int = 8
    password_history_count: int = 5
    login_max_attempts: int = 5
    login_lockout_minutes: int = 15

    # CORS
    cors_origins: str = "http://localhost:3270,http://localhost:5173,http://localhost:3260,http://localhost:8000"

    # 文件上传
    max_upload_size_mb: int = 50

    # 日志
    log_level: str = "INFO"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()

"""系统监控：Prometheus 指标 + 健康检查 + 数据库连接池监控"""
import time
import platform
import psutil
from collections import defaultdict
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.database import get_db, engine
from app.core.auth import require_auth
from app.models.models import User

router = APIRouter()

# ── 简易指标收集器（不依赖 prometheus_client 库） ──

_metrics: dict[str, float] = defaultdict(float)
_request_counts: dict[str, int] = defaultdict(int)
_request_durations: dict[str, float] = defaultdict(float)
_start_time = time.time()


def record_request(method: str, path: str, status_code: int, duration: float):
    """记录一次请求的指标"""
    key = f"{method}:{path}:{status_code}"
    _request_counts[key] += 1
    _request_durations[key] += duration


# ── /api/health — 健康检查（增强版） ──

@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    """系统健康检查，包含数据库连通性验证"""
    db_ok = False
    try:
        await db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        pass

    status = "ok" if db_ok else "degraded"
    return {
        "status": status,
        "service": "yolocheck",
        "uptime_seconds": round(time.time() - _start_time, 1),
        "database": "connected" if db_ok else "disconnected",
    }


# ── /api/metrics — Prometheus 格式的指标暴露 ──

@router.get("/metrics", response_class=None)
async def prometheus_metrics(db: AsyncSession = Depends(get_db)):
    """以 Prometheus text 格式暴露指标"""
    from starlette.responses import Response

    lines = []
    lines.append("# HELP yolocheck_uptime_seconds Service uptime in seconds")
    lines.append("# TYPE yolocheck_uptime_seconds gauge")
    lines.append(f"yolocheck_uptime_seconds {round(time.time() - _start_time, 1)}")

    # 请求统计
    lines.append("# HELP yolocheck_http_requests_total Total HTTP requests")
    lines.append("# TYPE yolocheck_http_requests_total counter")
    for key, count in _request_counts.items():
        method, path, code = key.split(":", 2)
        lines.append(f'yolocheck_http_requests_total{{method="{method}",path="{path}",status="{code}"}} {count}')

    lines.append("# HELP yolocheck_http_request_duration_seconds Total request durations")
    lines.append("# TYPE yolocheck_http_request_duration_seconds counter")
    for key, dur in _request_durations.items():
        method, path, code = key.split(":", 2)
        lines.append(f'yolocheck_http_request_duration_seconds{{method="{method}",path="{path}",status="{code}"}} {dur:.4f}')

    # 系统指标
    lines.append("# HELP yolocheck_cpu_percent CPU usage percent")
    lines.append("# TYPE yolocheck_cpu_percent gauge")
    lines.append(f"yolocheck_cpu_percent {psutil.cpu_percent()}")

    lines.append("# HELP yolocheck_memory_percent Memory usage percent")
    lines.append("# TYPE yolocheck_memory_percent gauge")
    lines.append(f"yolocheck_memory_percent {psutil.virtual_memory().percent}")

    # 数据库连接池
    pool = engine.pool
    pool_size = getattr(pool, "size", lambda: 0)
    checked_in = getattr(pool, "checkedin", lambda: 0)
    checked_out = getattr(pool, "checkedout", lambda: 0)
    overflow = getattr(pool, "overflow", lambda: 0)

    lines.append("# HELP yolocheck_db_pool_size Database pool size")
    lines.append("# TYPE yolocheck_db_pool_size gauge")
    lines.append(f"yolocheck_db_pool_size {pool_size() if callable(pool_size) else pool_size}")

    lines.append("# HELP yolocheck_db_pool_checkedin Idle connections")
    lines.append("# TYPE yolocheck_db_pool_checkedin gauge")
    lines.append(f"yolocheck_db_pool_checkedin {checked_in() if callable(checked_in) else checked_in}")

    lines.append("# HELP yolocheck_db_pool_checkedout Active connections")
    lines.append("# TYPE yolocheck_db_pool_checkedout gauge")
    lines.append(f"yolocheck_db_pool_checkedout {checked_out() if callable(checked_out) else checked_out}")

    lines.append("# HELP yolocheck_db_pool_overflow Overflow connections")
    lines.append("# TYPE yolocheck_db_pool_overflow gauge")
    lines.append(f"yolocheck_db_pool_overflow {overflow() if callable(overflow) else overflow}")

    return Response(content="\n".join(lines) + "\n", media_type="text/plain; version=0.0.4; charset=utf-8")


# ── /api/system/monitor — 系统监控看板数据 ──

@router.get("/system/monitor")
async def system_monitor(user: User = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    """获取系统监控数据（供前端看板使用）"""
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")

    # 数据库连接池状态
    pool = engine.pool
    pool_status = {
        "size": getattr(pool, "size", lambda: 0)() if callable(getattr(pool, "size", 0)) else 0,
        "checked_in": getattr(pool, "checkedin", lambda: 0)() if callable(getattr(pool, "checkedin", 0)) else 0,
        "checked_out": getattr(pool, "checkedout", lambda: 0)() if callable(getattr(pool, "checkedout", 0)) else 0,
        "overflow": getattr(pool, "overflow", lambda: 0)() if callable(getattr(pool, "overflow", 0)) else 0,
    }

    # 请求统计摘要
    total_requests = sum(_request_counts.values())
    error_requests = sum(v for k, v in _request_counts.items() if k.split(":")[2].startswith(("4", "5")))

    return {
        "uptime_seconds": round(time.time() - _start_time, 1),
        "python_version": platform.python_version(),
        "system": {
            "cpu_percent": psutil.cpu_percent(),
            "cpu_count": psutil.cpu_count(),
            "memory_total_mb": round(mem.total / 1024 / 1024),
            "memory_used_mb": round(mem.used / 1024 / 1024),
            "memory_percent": mem.percent,
            "disk_total_gb": round(disk.total / 1024 / 1024 / 1024, 1),
            "disk_used_gb": round(disk.used / 1024 / 1024 / 1024, 1),
            "disk_percent": round(disk.used / disk.total * 100, 1),
        },
        "database": pool_status,
        "requests": {
            "total": total_requests,
            "errors": error_requests,
            "error_rate": round(error_requests / max(total_requests, 1) * 100, 2),
        },
    }

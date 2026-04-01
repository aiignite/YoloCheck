"""请求指标采集中间件"""
import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from app.core.monitoring import record_request


class MetricsMiddleware(BaseHTTPMiddleware):
    """记录每个请求的方法、路径、状态码和耗时"""

    async def dispatch(self, request: Request, call_next):
        start = time.monotonic()
        response = await call_next(request)
        duration = time.monotonic() - start

        # 简化路径（去掉 ID 参数）避免指标爆炸
        path = request.url.path
        parts = path.split("/")
        simplified = "/".join(
            p if not p.isdigit() else "{id}" for p in parts
        )

        record_request(request.method, simplified, response.status_code, duration)
        return response

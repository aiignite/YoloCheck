"""API 请求频率限制中间件"""
import time
import asyncio
from collections import defaultdict
from dataclasses import dataclass, field
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


@dataclass
class _Bucket:
    tokens: float
    last_refill: float = field(default_factory=time.monotonic)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """令牌桶算法限流中间件"""

    def __init__(self, app, rate: float = 60.0, burst: int = 120, cleanup_interval: int = 300):
        """
        Args:
            rate: 每秒补充的令牌数
            burst: 桶的最大容量（突发上限）
            cleanup_interval: 清理过期桶的间隔秒数
        """
        super().__init__(app)
        self.rate = rate
        self.burst = burst
        self.cleanup_interval = cleanup_interval
        self._buckets: dict[str, _Bucket] = defaultdict(lambda: _Bucket(tokens=float(burst)))
        self._lock = asyncio.Lock()
        self._last_cleanup = time.monotonic()

    def _get_client_key(self, request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def _refill(self, bucket: _Bucket) -> None:
        now = time.monotonic()
        elapsed = now - bucket.last_refill
        bucket.tokens = min(self.burst, bucket.tokens + elapsed * self.rate)
        bucket.last_refill = now

    async def _cleanup(self) -> None:
        now = time.monotonic()
        if now - self._last_cleanup < self.cleanup_interval:
            return
        self._last_cleanup = now
        stale = [k for k, v in self._buckets.items() if now - v.last_refill > self.cleanup_interval]
        for k in stale:
            del self._buckets[k]

    async def dispatch(self, request: Request, call_next):
        # 跳过健康检查和文档
        if request.url.path in ("/api/health", "/docs", "/openapi.json", "/redoc"):
            return await call_next(request)

        client_key = self._get_client_key(request)

        async with self._lock:
            await self._cleanup()
            bucket = self._buckets[client_key]
            self._refill(bucket)

            if bucket.tokens < 1:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "请求过于频繁，请稍后再试"},
                    headers={"Retry-After": str(int(1 / self.rate) + 1)},
                )
            bucket.tokens -= 1

        response = await call_next(request)
        return response

import json
import logging
from typing import Optional

import redis

from app.config import get_settings

logger = logging.getLogger(__name__)

_redis: Optional[redis.Redis] = None


def get_redis() -> redis.Redis:
    global _redis
    if _redis is None:
        settings = get_settings()
        _redis = redis.from_url(settings.redis_url, decode_responses=True)
    return _redis


async def cache_get(key: str) -> Optional[dict]:
    try:
        r = get_redis()
        data = r.get(key)
        if data:
            return json.loads(data)
    except Exception as e:
        logger.warning(f"Redis cache_get failed: {e}")
    return None


async def cache_set(key: str, value: dict, ttl: int = 30) -> bool:
    try:
        r = get_redis()
        r.setex(key, ttl, json.dumps(value, default=str, ensure_ascii=False))
        return True
    except Exception as e:
        logger.warning(f"Redis cache_set failed: {e}")
    return False


async def cache_delete(key: str) -> bool:
    try:
        r = get_redis()
        r.delete(key)
        return True
    except Exception as e:
        logger.warning(f"Redis cache_delete failed: {e}")
    return False


async def cache_ping() -> bool:
    try:
        r = get_redis()
        return r.ping()
    except Exception:
        return False

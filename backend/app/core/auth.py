"""JWT认证与RBAC权限控制"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import User
from app.crud.user import get_user, get_user_by_username, verify_password
from app.config import get_settings

logger = logging.getLogger(__name__)

_settings = get_settings()
SECRET_KEY = _settings.jwt_secret_key
ALGORITHM = _settings.jwt_algorithm
ACCESS_TOKEN_EXPIRE_MINUTES = _settings.jwt_access_expire_minutes
REFRESH_TOKEN_EXPIRE_DAYS = _settings.jwt_refresh_expire_days

security = HTTPBearer(auto_error=False)

# 角色权限层级: admin > manager > operator
ROLE_HIERARCHY = {"admin": 3, "manager": 2, "operator": 1}


def create_access_token(user_id: int, username: str, role: str) -> str:
    """创建访问令牌"""
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "username": username,
        "role": role,
        "type": "access",
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(user_id: int) -> str:
    """创建刷新令牌"""
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    """解析JWT令牌"""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="令牌已过期")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="无效的令牌")


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """获取当前用户（可选认证，未登录返回None）"""
    if credentials is None:
        return None

    payload = decode_token(credentials.credentials)
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="无效的令牌类型")

    user_id = int(payload["sub"])
    user = await get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="用户已被禁用")
    return user


async def require_auth(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """强制认证（必须登录）"""
    if credentials is None:
        raise HTTPException(status_code=401, detail="未提供认证令牌")
    user = await get_current_user(credentials, db)
    if user is None:
        raise HTTPException(status_code=401, detail="认证失败")
    return user


def require_role(min_role: str):
    """角色权限检查装饰器工厂"""
    min_level = ROLE_HIERARCHY.get(min_role, 0)

    async def role_checker(user: User = Depends(require_auth)) -> User:
        user_level = ROLE_HIERARCHY.get(user.role, 0)
        if user_level < min_level:
            raise HTTPException(
                status_code=403,
                detail=f"需要 {min_role} 及以上权限",
            )
        return user

    return role_checker

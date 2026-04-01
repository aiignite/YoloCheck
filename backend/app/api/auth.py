"""认证与审计日志API"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.crud.user import get_user_by_username, get_user, verify_password, needs_rehash, _hash_password
from app.crud.audit import create_audit_log, list_audit_logs
from app.core.auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    require_auth,
    require_role,
)
from app.core.i18n import t
from app.models.models import User

router = APIRouter()


def _lang(request: Request) -> str:
    """从 Accept-Language 头提取语言偏好"""
    accept = request.headers.get("accept-language", "")
    return "en" if accept.lower().startswith("en") else "zh"


# ============================================================
# Schemas
# ============================================================

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict


class RefreshRequest(BaseModel):
    refresh_token: str


class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int]
    username: Optional[str]
    action: str
    resource_type: Optional[str]
    resource_id: Optional[str]
    detail: Optional[str]
    ip_address: Optional[str]
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ============================================================
# Auth API
# ============================================================

@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """用户登录"""
    ip = request.client.host if request.client else ""
    ua = request.headers.get("user-agent", "")

    user = await get_user_by_username(db, data.username)
    if not user or not verify_password(data.password, user.hashed_password):
        await create_audit_log(
            db, action="login", detail="登录失败：用户名或密码错误",
            username=data.username, ip_address=ip, user_agent=ua, status="failure",
        )
        raise HTTPException(status_code=401, detail=t("auth.invalid_credentials", _lang(request)))

    if not user.is_active:
        await create_audit_log(
            db, action="login", detail="登录失败：账户已禁用",
            user_id=user.id, username=user.username, ip_address=ip, user_agent=ua, status="failure",
        )
        raise HTTPException(status_code=403, detail="账户已被禁用")

    # 自动重哈希：如果旧密码使用 SHA-256，升级为 bcrypt
    from app.crud.user import needs_rehash, _hash_password as bcrypt_hash
    if needs_rehash(user.hashed_password):
        user.hashed_password = bcrypt_hash(data.password)

    # 更新最后登录时间
    user.last_login = datetime.now(timezone.utc)
    await db.commit()

    access_token = create_access_token(user.id, user.username, user.role)
    refresh_token = create_refresh_token(user.id)

    await create_audit_log(
        db, action="login", detail="登录成功",
        user_id=user.id, username=user.username, ip_address=ip, user_agent=ua,
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user={
            "id": user.id,
            "username": user.username,
            "display_name": user.display_name,
            "role": user.role,
        },
    )


@router.post("/refresh", response_model=dict)
async def refresh_token(data: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """刷新访问令牌"""
    payload = decode_token(data.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="无效的刷新令牌")

    user_id = int(payload["sub"])
    user = await get_user(db, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="用户不存在或已禁用")

    access_token = create_access_token(user.id, user.username, user.role)
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me")
async def get_current_user_info(user: User = Depends(require_auth)):
    """获取当前登录用户"""
    return {
        "id": user.id,
        "username": user.username,
        "display_name": user.display_name,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
        "last_login": user.last_login,
    }


@router.post("/logout")
async def logout(request: Request, user: User = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    """用户登出（记录审计日志）"""
    ip = request.client.host if request.client else ""
    ua = request.headers.get("user-agent", "")
    await create_audit_log(
        db, action="logout", detail="用户登出",
        user_id=user.id, username=user.username, ip_address=ip, user_agent=ua,
    )
    return {"message": "登出成功"}


# ============================================================
# Audit Log API
# ============================================================

@router.get("/audit-logs", response_model=list[AuditLogResponse])
async def get_audit_logs(
    skip: int = 0,
    limit: int = 50,
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    _user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """获取审计日志（仅管理员）"""
    return await list_audit_logs(db, skip=skip, limit=limit, user_id=user_id, action=action, resource_type=resource_type)

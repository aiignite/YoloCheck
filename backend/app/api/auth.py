import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.database import get_db
from app.crud.user import get_user_by_username, get_user, verify_password, needs_rehash, _hash_password
from app.crud.audit import create_audit_log, list_audit_logs
from app.core.auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    require_auth,
    require_role,
    validate_password_strength,
    check_password_history,
    save_password_history,
)
from app.core.captcha import create_captcha, validate_captcha
from app.core.i18n import t
from app.config import get_settings
from app.models.models import User, UserSession, LoginAttempt, AuditLog

router = APIRouter()
settings = get_settings()

LOGIN_MAX_ATTEMPTS = getattr(settings, 'login_max_attempts', 5)
LOGIN_LOCKOUT_MINUTES = getattr(settings, 'login_lockout_minutes', 15)


def _lang(request: Request) -> str:
    accept = request.headers.get("accept-language", "")
    return "en" if accept.lower().startswith("en") else "zh"


async def is_account_locked(db: AsyncSession, username: str) -> bool:
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user or user.role == "admin":
        return False
    if user.is_locked_until and user.is_locked_until > datetime.now(timezone.utc).replace(tzinfo=None):
        return True
    return False


async def record_login_attempt(db: AsyncSession, username: str, ip: str, ua: str):
    db.add(LoginAttempt(username=username, ip_address=ip, user_agent=ua))
    await db.commit()

    cutoff = datetime.now(timezone.utc).timestamp() - LOGIN_LOCKOUT_MINUTES * 60
    cutoff_dt = datetime.fromtimestamp(cutoff, tz=timezone.utc)
    result = await db.execute(
        select(LoginAttempt)
        .where(LoginAttempt.username == username)
        .where(LoginAttempt.attempted_at > cutoff_dt)
    )
    recent = result.scalars().all()
    if len(recent) >= LOGIN_MAX_ATTEMPTS:
        user_result = await db.execute(select(User).where(User.username == username))
        user = user_result.scalar_one_or_none()
        if user and user.role != "admin":
            lock_until = datetime.now(timezone.utc).timestamp() + LOGIN_LOCKOUT_MINUTES * 60
            user.is_locked_until = datetime.fromtimestamp(lock_until, tz=timezone.utc).replace(tzinfo=None)
            user.failed_login_count = len(recent)
            await db.commit()


async def reset_login_attempts(db: AsyncSession, username: str):
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if user:
        user.is_locked_until = None
        user.failed_login_count = 0
        await db.commit()


async def create_session(db: AsyncSession, user_id: int, ip: str, ua: str, device_info: str = ""):
    session = UserSession(
        user_id=user_id,
        jti=uuid.uuid4().hex,
        ip_address=ip,
        user_agent=ua,
        device_info=device_info,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


class CaptchaResponse(BaseModel):
    captcha_key: str
    svg: str


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)
    captcha_key: Optional[str] = None
    captcha_code: Optional[str] = None
    remember_me: bool = False


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


class SessionResponse(BaseModel):
    id: int
    jti: str
    ip_address: Optional[str]
    user_agent: Optional[str]
    device_info: Optional[str]
    created_at: datetime
    last_accessed_at: datetime
    is_current: bool = False

    model_config = {"from_attributes": True}


class LoginHistoryResponse(BaseModel):
    id: int
    username: Optional[str]
    action: str
    detail: Optional[str]
    ip_address: Optional[str]
    user_agent: Optional[str]
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


# Auth API

@router.get("/captcha", response_model=CaptchaResponse)
async def get_captcha():
    key, svg = create_captcha()
    return CaptchaResponse(captcha_key=key, svg=svg)


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    ip = request.client.host if request.client else ""
    ua = request.headers.get("user-agent", "")
    device = request.headers.get("sec-ch-ua-platform", "")

    if data.captcha_key and data.captcha_code:
        if not validate_captcha(data.captcha_key, data.captcha_code):
            raise HTTPException(status_code=400, detail="验证码错误")

    if await is_account_locked(db, data.username):
        await create_audit_log(
            db, action="login", detail="登录失败：账户已锁定",
            username=data.username, ip_address=ip, user_agent=ua, status="failure",
        )
        raise HTTPException(status_code=423, detail="账户已被锁定，请稍后再试")

    user = await get_user_by_username(db, data.username)
    if not user or not verify_password(data.password, user.hashed_password):
        await record_login_attempt(db, data.username, ip, ua)
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

    if needs_rehash(user.hashed_password):
        user.hashed_password = _hash_password(data.password)

    await reset_login_attempts(db, data.username)

    session = await create_session(db, user.id, ip, ua, device)
    user.last_login = datetime.now(timezone.utc)
    await db.commit()

    access_token = create_access_token(user.id, user.username, user.role)
    refresh_token = create_refresh_token(user.id, jti=session.jti, remember_me=data.remember_me)

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
    payload = decode_token(data.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="无效的刷新令牌")

    user_id = int(payload["sub"])
    jti = payload.get("jti", "")

    if jti:
        session_result = await db.execute(
            select(UserSession).where(UserSession.jti == jti).where(UserSession.user_id == user_id)
        )
        session = session_result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=401, detail="会话已过期，请重新登录")
        session.last_accessed_at = datetime.now(timezone.utc)
        await db.commit()

    user = await get_user(db, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="用户不存在或已禁用")

    access_token = create_access_token(user.id, user.username, user.role)
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me")
async def get_current_user_info(user: User = Depends(require_auth)):
    return {
        "id": user.id,
        "username": user.username,
        "display_name": user.display_name,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
        "last_login": user.last_login,
        "is_locked": user.is_locked_until is not None and user.is_locked_until > datetime.now(timezone.utc).replace(tzinfo=None),
    }


@router.post("/logout")
async def logout(request: Request, user: User = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    ip = request.client.host if request.client else ""
    ua = request.headers.get("user-agent", "")
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        payload = decode_token(token)
        if payload.get("jti"):
            await db.execute(
                select(UserSession).where(UserSession.jti == payload["jti"])
            )
    await create_audit_log(
        db, action="logout", detail="用户登出",
        user_id=user.id, username=user.username, ip_address=ip, user_agent=ua,
    )
    return {"message": "登出成功"}


@router.get("/sessions", response_model=list[SessionResponse])
async def list_sessions(request: Request, user: User = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    current_jti = ""
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        payload = decode_token(auth_header[7:])
        current_jti = payload.get("jti", "")

    cutoff = datetime.now(timezone.utc).timestamp() - 30 * 86400
    cutoff_dt = datetime.fromtimestamp(cutoff, tz=timezone.utc).replace(tzinfo=None)
    expired = await db.execute(
        select(UserSession)
        .where(UserSession.user_id == user.id)
        .where(UserSession.created_at < cutoff_dt)
    )
    for s in expired.scalars().all():
        await db.delete(s)
    await db.commit()

    result = await db.execute(
        select(UserSession)
        .where(UserSession.user_id == user.id)
        .order_by(desc(UserSession.last_accessed_at))
    )
    sessions = result.scalars().all()
    return [
        SessionResponse(
            id=s.id, jti=s.jti, ip_address=s.ip_address,
            user_agent=s.user_agent, device_info=s.device_info,
            created_at=s.created_at, last_accessed_at=s.last_accessed_at,
            is_current=(s.jti == current_jti),
        )
        for s in sessions
    ]


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(session_id: int, user: User = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(UserSession).where(UserSession.id == session_id).where(UserSession.user_id == user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    await db.delete(session)
    await db.commit()


@router.get("/login-history", response_model=list[LoginHistoryResponse])
async def get_login_history(
    skip: int = 0, limit: int = 20,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.user_id == user.id)
        .where(AuditLog.action.in_(["login", "logout"]))
        .order_by(desc(AuditLog.created_at))
        .offset(skip).limit(limit)
    )
    return result.scalars().all()


@router.get("/login-history/{target_user_id}", response_model=list[LoginHistoryResponse])
async def get_user_login_history(
    target_user_id: int,
    skip: int = 0, limit: int = 20,
    _admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.user_id == target_user_id)
        .where(AuditLog.action.in_(["login", "logout"]))
        .order_by(desc(AuditLog.created_at))
        .offset(skip).limit(limit)
    )
    return result.scalars().all()


@router.post("/unlock/{user_id}")
async def unlock_user(user_id: int, _admin: User = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    user.is_locked_until = None
    user.failed_login_count = 0
    await db.commit()
    return {"message": f"用户 {user.username} 已解锁"}


# Audit Log API

@router.get("/audit-logs", response_model=list[AuditLogResponse])
async def get_audit_logs(
    skip: int = 0, limit: int = 50,
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    _user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    return await list_audit_logs(db, skip=skip, limit=limit, user_id=user_id, action=action, resource_type=resource_type)

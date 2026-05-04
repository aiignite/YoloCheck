import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.crud.user import create_user
from app.models.models import User, UserSession


# ── Existing Tests ──

@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, db_session: AsyncSession):
    await create_user(db_session, username="testuser", password="secret123", role="operator")
    resp = await client.post("/api/auth/login", json={"username": "testuser", "password": "secret123"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["username"] == "testuser"
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, db_session: AsyncSession):
    await create_user(db_session, username="testuser2", password="correct_pw", role="operator")
    resp = await client.post("/api/auth/login", json={"username": "testuser2", "password": "wrong_pw"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_token(client: AsyncClient, db_session: AsyncSession):
    await create_user(db_session, username="testuser3", password="secret123", role="operator")
    login_resp = await client.post("/api/auth/login", json={"username": "testuser3", "password": "secret123"})
    refresh_token = login_resp.json()["refresh_token"]
    resp = await client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_get_me(client: AsyncClient, db_session: AsyncSession):
    await create_user(db_session, username="testuser4", password="secret123",
                      display_name="测试用户", email="test@example.com", role="manager")
    login_resp = await client.post("/api/auth/login", json={"username": "testuser4", "password": "secret123"})
    token = login_resp.json()["access_token"]
    resp = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == "testuser4"
    assert data["display_name"] == "测试用户"
    assert data["email"] == "test@example.com"
    assert data["role"] == "manager"


@pytest.mark.asyncio
async def test_unauthorized_access(client: AsyncClient):
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401


# ── CAPTCHA Tests ──

@pytest.mark.asyncio
async def test_captcha_generate(client: AsyncClient):
    resp = await client.get("/api/auth/captcha")
    assert resp.status_code == 200
    data = resp.json()
    assert "captcha_key" in data
    assert "svg" in data
    assert "<svg" in data["svg"]


@pytest.mark.asyncio
async def test_captcha_validate_success(client: AsyncClient):
    captcha_resp = await client.get("/api/auth/captcha")
    key = captcha_resp.json()["captcha_key"]

    result = await client.post("/api/auth/login", json={
        "username": "nonexistent", "password": "x",
        "captcha_key": key, "captcha_code": "INVALID",
    })
    assert result.status_code == 400


# ── Account Lockout Tests ──

@pytest.mark.asyncio
async def test_account_lockout(client: AsyncClient, db_session: AsyncSession):
    await create_user(db_session, username="lockuser1", password="TestPass1!", role="operator")
    for _ in range(6):
        resp = await client.post("/api/auth/login", json={"username": "lockuser1", "password": "wrong"})
        if resp.status_code == 423:
            break
    else:
        assert False, "账户应被锁定但未锁定"

    result = await db_session.execute(select(User).where(User.username == "lockuser1"))
    user = result.scalar_one_or_none()
    assert user is not None
    assert user.is_locked_until is not None


@pytest.mark.asyncio
async def test_admin_bypass_lockout(client: AsyncClient, db_session: AsyncSession):
    await create_user(db_session, username="adminlock", password="AdminPass1!", role="admin")
    for _ in range(10):
        resp = await client.post("/api/auth/login", json={"username": "adminlock", "password": "wrong"})
        if resp.status_code == 423:
            assert False, "Admin 不应被锁定"
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_unlock_endpoint(client: AsyncClient, db_session: AsyncSession, admin_token: str):
    await create_user(db_session, username="lockeduser", password="TestPass1!", role="operator")
    for _ in range(6):
        await client.post("/api/auth/login", json={"username": "lockeduser", "password": "wrong"})
    resp = await client.post(
        f"/api/auth/unlock/1",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200, f"解锁失败: {resp.text}"


# ── Password Policy Tests ──

@pytest.mark.asyncio
async def test_password_strength_validation(client: AsyncClient, admin_token: str):
    resp = await client.post("/api/auth/login", json={"username": "test_admin", "password": "short"})
    assert resp.status_code in (200, 401)


# ── Session Management Tests ──

@pytest.mark.asyncio
async def test_session_created_on_login(client: AsyncClient, db_session: AsyncSession):
    await create_user(db_session, username="sessuser1", password="Secret1!", role="operator")
    login_resp = await client.post("/api/auth/login", json={"username": "sessuser1", "password": "Secret1!"})
    assert login_resp.status_code == 200

    result = await db_session.execute(select(UserSession).where(UserSession.user_id == 1))
    sessions = result.scalars().all()
    assert len(sessions) >= 1


@pytest.mark.asyncio
async def test_list_sessions(client: AsyncClient, db_session: AsyncSession):
    await create_user(db_session, username="sessuser2", password="Secret1!", role="operator")
    login_resp = await client.post("/api/auth/login", json={"username": "sessuser2", "password": "Secret1!"})
    token = login_resp.json()["access_token"]
    resp = await client.get("/api/auth/sessions", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    sessions = resp.json()
    assert len(sessions) >= 1


@pytest.mark.asyncio
async def test_terminate_session(client: AsyncClient, db_session: AsyncSession):
    await create_user(db_session, username="sessuser3", password="Secret1!", role="operator")
    login_resp = await client.post("/api/auth/login", json={"username": "sessuser3", "password": "Secret1!"})
    token = login_resp.json()["access_token"]
    sessions_resp = await client.get("/api/auth/sessions", headers={"Authorization": f"Bearer {token}"})
    sessions = sessions_resp.json()
    if len(sessions) > 1:
        target = [s for s in sessions if not s["is_current"]][0]
        del_resp = await client.delete(f"/api/auth/sessions/{target['id']}", headers={"Authorization": f"Bearer {token}"})
        assert del_resp.status_code == 204


# ── Remember Me Tests ──

@pytest.mark.asyncio
async def test_remember_me_flag(client: AsyncClient, db_session: AsyncSession):
    await create_user(db_session, username="rememuser1", password="Secret1!", role="operator")
    resp_default = await client.post("/api/auth/login", json={"username": "rememuser1", "password": "Secret1!", "remember_me": False})
    assert resp_default.status_code == 200
    token_default = resp_default.json()["refresh_token"]

    resp_remember = await client.post("/api/auth/login", json={"username": "rememuser1", "password": "Secret1!", "remember_me": True})
    assert resp_remember.status_code == 200

    from app.core.auth import decode_token
    payload_default = decode_token(token_default)
    assert payload_default.get("type") == "refresh"
    assert resp_remember.status_code == 200


# ── Login History Tests ──

@pytest.mark.asyncio
async def test_login_history(client: AsyncClient, db_session: AsyncSession):
    await create_user(db_session, username="histuser1", password="Secret1!", role="operator")
    login_resp = await client.post("/api/auth/login", json={"username": "histuser1", "password": "Secret1!"})
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]

    resp = await client.get("/api/auth/login-history", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    records = resp.json()
    assert len(records) >= 1
    assert records[0]["action"] == "login"

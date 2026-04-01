"""认证API测试"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.user import create_user


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

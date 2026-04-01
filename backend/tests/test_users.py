"""用户管理API测试"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.user import create_user as crud_create_user


@pytest.mark.asyncio
async def test_create_user(client: AsyncClient, db_session: AsyncSession, admin_token: str):
    resp = await client.post(
        "/api/users/",
        json={"username": "newuser", "password": "pass123456", "display_name": "新用户", "role": "operator"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["username"] == "newuser"
    assert data["display_name"] == "新用户"
    assert data["role"] == "operator"


@pytest.mark.asyncio
async def test_list_users(client: AsyncClient, db_session: AsyncSession, admin_token: str):
    await crud_create_user(db_session, username="user_a", password="pw123456")
    await crud_create_user(db_session, username="user_b", password="pw123456")

    resp = await client.get("/api/users/", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 2
    usernames = [u["username"] for u in data]
    assert "user_a" in usernames
    assert "user_b" in usernames


@pytest.mark.asyncio
async def test_update_user(client: AsyncClient, db_session: AsyncSession, admin_token: str):
    user = await crud_create_user(db_session, username="user_update", password="pw123456",
                                  display_name="旧名称")

    resp = await client.put(
        f"/api/users/{user.id}",
        json={"display_name": "新名称", "email": "updated@example.com"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["display_name"] == "新名称"
    assert data["email"] == "updated@example.com"


@pytest.mark.asyncio
async def test_delete_user(client: AsyncClient, db_session: AsyncSession, admin_token: str):
    user = await crud_create_user(db_session, username="user_delete", password="pw123456")

    resp = await client.delete(
        f"/api/users/{user.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 204

    resp2 = await client.get(f"/api/users/{user.id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp2.status_code == 404


@pytest.mark.asyncio
async def test_operator_cannot_create_user(client: AsyncClient, db_session: AsyncSession, operator_token: str):
    resp = await client.post(
        "/api/users/",
        json={"username": "forbidden", "password": "pw123456", "role": "operator"},
        headers={"Authorization": f"Bearer {operator_token}"},
    )
    assert resp.status_code == 403

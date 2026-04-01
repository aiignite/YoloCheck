"""视频学习API测试"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_templates_empty(client: AsyncClient, admin_token: str):
    resp = await client.get("/api/video-learning/templates",
                            headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_get_nonexistent_template(client: AsyncClient, admin_token: str):
    resp = await client.get("/api/video-learning/templates/99999",
                            headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_template_requires_auth(client: AsyncClient):
    resp = await client.post("/api/video-learning/templates")
    assert resp.status_code == 401

"""统计API测试"""

import pytest
from httpx import AsyncClient


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_dashboard_summary(client: AsyncClient, admin_token: str):
    resp = await client.get("/api/stats/dashboard", headers=_h(admin_token))
    assert resp.status_code == 200
    data = resp.json()
    assert "total_production" in data
    assert "yield_rate" in data
    assert "active_cameras" in data
    assert "unacknowledged_alerts" in data


@pytest.mark.asyncio
async def test_production_stats(client: AsyncClient, admin_token: str):
    resp = await client.get("/api/stats/production", headers=_h(admin_token))
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_defect_stats(client: AsyncClient, admin_token: str):
    resp = await client.get("/api/stats/defects", headers=_h(admin_token))
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_efficiency_trend(client: AsyncClient, admin_token: str):
    resp = await client.get("/api/stats/efficiency", params={"days": 7}, headers=_h(admin_token))
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)

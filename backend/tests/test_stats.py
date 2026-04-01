"""统计API测试"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_dashboard_summary(client: AsyncClient):
    resp = await client.get("/api/stats/dashboard")
    assert resp.status_code == 200
    data = resp.json()
    assert "total_production" in data
    assert "yield_rate" in data
    assert "active_cameras" in data
    assert "unacknowledged_alerts" in data


@pytest.mark.asyncio
async def test_production_stats(client: AsyncClient):
    resp = await client.get("/api/stats/production")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_defect_stats(client: AsyncClient):
    resp = await client.get("/api/stats/defects")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_efficiency_trend(client: AsyncClient):
    resp = await client.get("/api/stats/efficiency", params={"days": 7})
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)

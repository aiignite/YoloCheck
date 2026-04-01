"""告警API测试"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_alert(client: AsyncClient):
    payload = {
        "severity": "critical",
        "message": "人员进入危险区域",
        "camera_id": "cam_001",
    }
    resp = await client.post("/api/alerts/", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["severity"] == "critical"
    assert data["acknowledged"] is False


@pytest.mark.asyncio
async def test_list_alerts(client: AsyncClient):
    for sev in ["critical", "warning", "info"]:
        await client.post("/api/alerts/", json={"severity": sev, "message": f"Test {sev}"})

    resp = await client.get("/api/alerts/")
    assert resp.status_code == 200
    assert len(resp.json()) == 3


@pytest.mark.asyncio
async def test_acknowledge_alert(client: AsyncClient):
    create_resp = await client.post("/api/alerts/", json={
        "severity": "warning",
        "message": "Test ack",
    })
    alert_id = create_resp.json()["id"]

    resp = await client.put(f"/api/alerts/{alert_id}/acknowledge", json={"acknowledged_by": "admin"})
    assert resp.status_code == 200
    assert resp.json()["acknowledged"] is True
    assert resp.json()["acknowledged_by"] == "admin"


@pytest.mark.asyncio
async def test_acknowledge_not_found(client: AsyncClient):
    resp = await client.put("/api/alerts/99999/acknowledge", json={"acknowledged_by": "admin"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_alert_stats(client: AsyncClient):
    await client.post("/api/alerts/", json={"severity": "critical", "message": "c1"})
    await client.post("/api/alerts/", json={"severity": "warning", "message": "w1"})
    await client.post("/api/alerts/", json={"severity": "info", "message": "i1"})

    resp = await client.get("/api/alerts/stats")
    assert resp.status_code == 200
    stats = resp.json()
    assert stats["total"] == 3
    assert stats["critical"] == 1
    assert stats["warning"] == 1
    assert stats["info"] == 1
    assert stats["unacknowledged"] == 3

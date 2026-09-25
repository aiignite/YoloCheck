"""告警API测试"""

import pytest
from httpx import AsyncClient

AUTH = "Authorization"


def _headers(token: str) -> dict:
    return {AUTH: f"Bearer {token}"}


@pytest.mark.asyncio
async def test_create_alert(client: AsyncClient, manager_token: str):
    payload = {
        "severity": "critical",
        "message": "人员进入危险区域",
        "camera_id": "cam_001",
    }
    resp = await client.post("/api/alerts/", json=payload, headers=_headers(manager_token))
    assert resp.status_code == 201
    data = resp.json()
    assert data["severity"] == "critical"
    assert data["acknowledged"] is False


@pytest.mark.asyncio
async def test_list_alerts(client: AsyncClient, manager_token: str):
    for sev in ["critical", "warning", "info"]:
        await client.post("/api/alerts/", json={"severity": sev, "message": f"Test {sev}"},
                          headers=_headers(manager_token))

    resp = await client.get("/api/alerts/", headers=_headers(manager_token))
    assert resp.status_code == 200
    assert len(resp.json()) == 3


@pytest.mark.asyncio
async def test_acknowledge_alert(client: AsyncClient, manager_token: str):
    create_resp = await client.post("/api/alerts/", json={"severity": "warning", "message": "Test ack"},
                                    headers=_headers(manager_token))
    alert_id = create_resp.json()["id"]

    resp = await client.put(f"/api/alerts/{alert_id}/acknowledge", json={"acknowledged_by": "admin"},
                            headers=_headers(manager_token))
    assert resp.status_code == 200
    assert resp.json()["acknowledged"] is True
    assert resp.json()["acknowledged_by"] == "admin"


@pytest.mark.asyncio
async def test_acknowledge_not_found(client: AsyncClient, manager_token: str):
    resp = await client.put("/api/alerts/99999/acknowledge", json={"acknowledged_by": "admin"},
                            headers=_headers(manager_token))
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_alert_stats(client: AsyncClient, manager_token: str):
    await client.post("/api/alerts/", json={"severity": "critical", "message": "c1"}, headers=_headers(manager_token))
    await client.post("/api/alerts/", json={"severity": "warning", "message": "w1"}, headers=_headers(manager_token))
    await client.post("/api/alerts/", json={"severity": "info", "message": "i1"}, headers=_headers(manager_token))

    resp = await client.get("/api/alerts/stats", headers=_headers(manager_token))
    assert resp.status_code == 200
    stats = resp.json()
    assert stats["total"] == 3
    assert stats["critical"] == 1
    assert stats["warning"] == 1
    assert stats["info"] == 1
    assert stats["unacknowledged"] == 3

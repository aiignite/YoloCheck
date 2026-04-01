"""检测事件API测试"""

import pytest
from httpx import AsyncClient
from datetime import datetime


@pytest.mark.asyncio
async def test_create_event(client: AsyncClient):
    payload = {
        "camera_id": "cam_001",
        "event_type": "defect",
        "event_time": datetime.utcnow().isoformat(),
        "confidence": 0.92,
    }
    resp = await client.post("/api/events/", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["camera_id"] == "cam_001"
    assert data["event_type"] == "defect"


@pytest.mark.asyncio
async def test_list_events(client: AsyncClient):
    # 创建几个事件
    for i in range(3):
        await client.post("/api/events/", json={
            "camera_id": f"cam_{i}",
            "event_type": "safety",
            "event_time": datetime.utcnow().isoformat(),
            "confidence": 0.8,
        })

    resp = await client.get("/api/events/")
    assert resp.status_code == 200
    assert len(resp.json()) == 3


@pytest.mark.asyncio
async def test_filter_events_by_type(client: AsyncClient):
    await client.post("/api/events/", json={
        "camera_id": "cam_a",
        "event_type": "defect",
        "event_time": datetime.utcnow().isoformat(),
        "confidence": 0.9,
    })
    await client.post("/api/events/", json={
        "camera_id": "cam_b",
        "event_type": "safety",
        "event_time": datetime.utcnow().isoformat(),
        "confidence": 0.85,
    })

    resp = await client.get("/api/events/", params={"event_type": "defect"})
    assert resp.status_code == 200
    events = resp.json()
    assert all(e["event_type"] == "defect" for e in events)

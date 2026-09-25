"""摄像头API测试"""

import pytest
from httpx import AsyncClient

_h_auth = "Authorization"


def _h(token: str) -> dict:
    return {_h_auth: f"Bearer {token}"}


@pytest.mark.asyncio
async def test_list_cameras_empty(client: AsyncClient, manager_token: str):
    resp = await client.get("/api/cameras/", headers=_h(manager_token))
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_create_camera(client: AsyncClient, manager_token: str):
    payload = {
        "camera_id": "cam_001",
        "name": "SMT工位1号",
        "location": "A区SMT产线",
        "type": "rtsp",
        "stream_url": "rtsp://192.168.1.100:554/stream",
    }
    resp = await client.post("/api/cameras/", json=payload, headers=_h(manager_token))
    assert resp.status_code == 201
    data = resp.json()
    assert data["camera_id"] == "cam_001"
    assert data["status"] == "offline"
    assert data["id"] > 0


@pytest.mark.asyncio
async def test_create_camera_duplicate(client: AsyncClient, manager_token: str):
    payload = {
        "camera_id": "cam_dup",
        "name": "Test",
        "type": "rtsp",
    }
    resp1 = await client.post("/api/cameras/", json=payload, headers=_h(manager_token))
    assert resp1.status_code == 201
    resp2 = await client.post("/api/cameras/", json=payload, headers=_h(manager_token))
    assert resp2.status_code == 409


@pytest.mark.asyncio
async def test_get_camera(client: AsyncClient, manager_token: str):
    payload = {"camera_id": "cam_get", "name": "Get Test", "type": "gigE"}
    create_resp = await client.post("/api/cameras/", json=payload, headers=_h(manager_token))
    camera_id = create_resp.json()["id"]

    resp = await client.get(f"/api/cameras/{camera_id}", headers=_h(manager_token))
    assert resp.status_code == 200
    assert resp.json()["camera_id"] == "cam_get"


@pytest.mark.asyncio
async def test_get_camera_not_found(client: AsyncClient, manager_token: str):
    resp = await client.get("/api/cameras/99999", headers=_h(manager_token))
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_camera(client: AsyncClient, manager_token: str):
    payload = {"camera_id": "cam_update", "name": "Before", "type": "rtsp"}
    create_resp = await client.post("/api/cameras/", json=payload, headers=_h(manager_token))
    camera_id = create_resp.json()["id"]

    resp = await client.put(f"/api/cameras/{camera_id}", json={"name": "After", "status": "online"}, headers=_h(manager_token))
    assert resp.status_code == 200
    assert resp.json()["name"] == "After"
    assert resp.json()["status"] == "online"


@pytest.mark.asyncio
async def test_delete_camera(client: AsyncClient, manager_token: str):
    payload = {"camera_id": "cam_delete", "name": "Delete Me", "type": "rtsp"}
    create_resp = await client.post("/api/cameras/", json=payload, headers=_h(manager_token))
    camera_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/cameras/{camera_id}", headers=_h(manager_token))
    assert resp.status_code == 204

    resp2 = await client.get(f"/api/cameras/{camera_id}", headers=_h(manager_token))
    assert resp2.status_code == 404

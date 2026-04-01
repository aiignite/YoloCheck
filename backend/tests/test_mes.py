"""MES工单API测试"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_create_order(client: AsyncClient, db_session: AsyncSession, manager_token: str):
    payload = {
        "order_no": "WO-20260331-001",
        "product_name": "主板A",
        "product_code": "PCB-A001",
        "target_quantity": 1000,
        "station_id": "ST-01",
    }
    resp = await client.post("/api/mes/orders", json=payload,
                             headers={"Authorization": f"Bearer {manager_token}"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["order_no"] == "WO-20260331-001"
    assert data["product_name"] == "主板A"
    assert data["target_quantity"] == 1000
    assert data["status"] == "pending"


@pytest.mark.asyncio
async def test_list_orders(client: AsyncClient, db_session: AsyncSession, manager_token: str):
    for i in range(3):
        payload = {"order_no": f"WO-LIST-{i:03d}", "target_quantity": 100}
        await client.post("/api/mes/orders", json=payload,
                          headers={"Authorization": f"Bearer {manager_token}"})

    resp = await client.get("/api/mes/orders", headers={"Authorization": f"Bearer {manager_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 3


@pytest.mark.asyncio
async def test_get_order(client: AsyncClient, db_session: AsyncSession, manager_token: str):
    payload = {"order_no": "WO-GET-001", "target_quantity": 500}
    create_resp = await client.post("/api/mes/orders", json=payload,
                                    headers={"Authorization": f"Bearer {manager_token}"})
    order_id = create_resp.json()["id"]

    resp = await client.get(f"/api/mes/orders/{order_id}",
                            headers={"Authorization": f"Bearer {manager_token}"})
    assert resp.status_code == 200
    assert resp.json()["order_no"] == "WO-GET-001"


@pytest.mark.asyncio
async def test_update_order(client: AsyncClient, db_session: AsyncSession, manager_token: str):
    payload = {"order_no": "WO-UPD-001", "target_quantity": 500}
    create_resp = await client.post("/api/mes/orders", json=payload,
                                    headers={"Authorization": f"Bearer {manager_token}"})
    order_id = create_resp.json()["id"]

    resp = await client.put(
        f"/api/mes/orders/{order_id}",
        json={"status": "in_progress", "completed_quantity": 200},
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "in_progress"
    assert data["completed_quantity"] == 200


@pytest.mark.asyncio
async def test_delete_order(client: AsyncClient, db_session: AsyncSession, manager_token: str):
    payload = {"order_no": "WO-DEL-001", "target_quantity": 100}
    create_resp = await client.post("/api/mes/orders", json=payload,
                                    headers={"Authorization": f"Bearer {manager_token}"})
    order_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/mes/orders/{order_id}",
                               headers={"Authorization": f"Bearer {manager_token}"})
    assert resp.status_code == 204

    resp2 = await client.get(f"/api/mes/orders/{order_id}",
                             headers={"Authorization": f"Bearer {manager_token}"})
    assert resp2.status_code == 404


@pytest.mark.asyncio
async def test_duplicate_order_no(client: AsyncClient, db_session: AsyncSession, manager_token: str):
    payload = {"order_no": "WO-DUP-001", "target_quantity": 100}
    resp1 = await client.post("/api/mes/orders", json=payload,
                              headers={"Authorization": f"Bearer {manager_token}"})
    assert resp1.status_code == 201

    resp2 = await client.post("/api/mes/orders", json=payload,
                              headers={"Authorization": f"Bearer {manager_token}"})
    assert resp2.status_code == 409

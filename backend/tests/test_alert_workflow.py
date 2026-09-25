"""告警工单状态机测试（pending → investigating → resolved）"""

import pytest
from httpx import AsyncClient

AUTH = "Authorization"


async def _create(client: AsyncClient, token: str, message: str, severity: str = "warning") -> dict:
    resp = await client.post(
        "/api/alerts/",
        json={"severity": severity, "message": message},
        headers={AUTH: f"Bearer {token}"},
    )
    assert resp.status_code == 201
    return resp.json()


@pytest.mark.asyncio
async def test_new_alert_defaults_to_pending(client: AsyncClient, manager_token: str):
    alert = await _create(client, manager_token, "状态机默认值")
    assert alert["status"] == "pending"
    assert alert["assigned_to"] is None


@pytest.mark.asyncio
async def test_claim_and_resolve_flow(client: AsyncClient, manager_token: str):
    alert = await _create(client, manager_token, "完整流转")
    alert_id = alert["id"]
    headers = {AUTH: f"Bearer {manager_token}"}

    resp = await client.put(f"/api/alerts/{alert_id}/claim", json={"assigned_to": "alice"}, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "investigating"
    assert data["assigned_to"] == "alice"

    resp = await client.put(f"/api/alerts/{alert_id}/resolve", json={"resolved_by": "alice"}, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "resolved"
    assert data["resolved_at"] is not None
    # 闭环同步确认状态
    assert data["acknowledged"] is True


@pytest.mark.asyncio
async def test_claim_resolved_alert_rejected(client: AsyncClient, manager_token: str):
    headers = {AUTH: f"Bearer {manager_token}"}
    alert = await _create(client, manager_token, "已闭环不可认领")
    await client.put(f"/api/alerts/{alert['id']}/resolve", json={"resolved_by": "bob"}, headers=headers)

    resp = await client.put(f"/api/alerts/{alert['id']}/claim", json={"assigned_to": "bob"}, headers=headers)
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_batch_claim_pending_only(client: AsyncClient, manager_token: str):
    headers = {AUTH: f"Bearer {manager_token}"}
    a1 = await _create(client, manager_token, "待处理1")
    a2 = await _create(client, manager_token, "待处理2")
    a3 = await _create(client, manager_token, "已认领")
    await client.put(f"/api/alerts/{a3['id']}/claim", json={"assigned_to": "carol"}, headers=headers)

    resp = await client.post("/api/alerts/claim-all", headers=headers)
    assert resp.status_code == 200
    # a1、a2 待处理被认领；a3 已是 investigating 不重复计入
    assert resp.json()["claimed_count"] == 2

    listing = (await client.get("/api/alerts/?status=investigating", headers=headers)).json()
    assert {a["id"] for a in listing} >= {a1["id"], a2["id"], a3["id"]}


@pytest.mark.asyncio
async def test_status_filter(client: AsyncClient, manager_token: str):
    headers = {AUTH: f"Bearer {manager_token}"}
    alert = await _create(client, manager_token, "状态筛选")
    await client.put(f"/api/alerts/{alert['id']}/resolve", json={"resolved_by": "dave"}, headers=headers)

    resp = await client.get("/api/alerts/?status=resolved", headers=headers)
    assert resp.status_code == 200
    assert all(a["status"] == "resolved" for a in resp.json())
    assert any(a["id"] == alert["id"] for a in resp.json())


@pytest.mark.asyncio
async def test_stats_include_workflow_counts(client: AsyncClient, manager_token: str):
    headers = {AUTH: f"Bearer {manager_token}"}
    a1 = await _create(client, manager_token, "统计1")
    await _create(client, manager_token, "统计2")
    await client.put(f"/api/alerts/{a1['id']}/claim", json={"assigned_to": "eve"}, headers=headers)

    resp = await client.get("/api/alerts/stats", headers=headers)
    assert resp.status_code == 200
    stats = resp.json()
    assert stats["pending"] == 1
    assert stats["investigating"] == 1


@pytest.mark.asyncio
async def test_export_csv(client: AsyncClient, manager_token: str):
    headers = {AUTH: f"Bearer {manager_token}"}
    await _create(client, manager_token, '带"引号"的消息,含逗号')

    resp = await client.get("/api/alerts/export/csv", headers=headers)
    assert resp.status_code == 200
    assert "attachment" in resp.headers["content-disposition"]
    body = resp.content.decode("utf-8")
    assert '带""引号""的消息,含逗号' in body

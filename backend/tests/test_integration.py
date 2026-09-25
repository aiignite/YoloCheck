"""集成测试 - 完整业务流程验证"""

import pytest
from datetime import datetime, timezone
from httpx import AsyncClient


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}



class TestFullWorkflow:
    """完整业务流程测试：摄像头 → 检测事件 → 告警 → 统计"""

    async def test_full_detection_workflow(self, client: AsyncClient, manager_token: str):
        """测试完整检测流程"""
        # 1. 创建摄像头
        cam_resp = await client.post("/api/cameras", headers=_h(manager_token), json={
            "camera_id": "INT_CAM001",
            "name": "集成测试摄像头",
            "location": "测试区",
            "type": "rtsp",
            "stream_url": "rtsp://test:554/stream1",
        })
        assert cam_resp.status_code == 201
        camera = cam_resp.json()
        assert camera["camera_id"] == "INT_CAM001"

        # 2. 创建检测事件（模拟检测到缺陷）
        event_resp = await client.post("/api/events", headers=_h(manager_token), json={
            "camera_id": "INT_CAM001",
            "event_type": "defect",
            "event_time": datetime.now(timezone.utc).isoformat(),
            "confidence": 0.92,
            "image_path": "/images/test_defect.jpg",
            "extra_data": {"defect_type": "scratch", "location": "surface"},
        })
        assert event_resp.status_code == 201
        event = event_resp.json()
        assert event["event_type"] == "defect"
        assert event["confidence"] == 0.92

        # 3. 创建告警（由缺陷触发）
        alert_resp = await client.post("/api/alerts", headers=_h(manager_token), json={
            "severity": "warning",
            "message": "检测到表面划伤缺陷 (置信度: 92%)",
            "camera_id": "INT_CAM001",
        })
        assert alert_resp.status_code == 201
        alert = alert_resp.json()
        assert alert["severity"] == "warning"
        assert alert["acknowledged"] is False

        # 4. 验证事件列表包含此事件
        events_list = await client.get("/api/events", headers=_h(manager_token), params={"camera_id": "INT_CAM001"})
        assert events_list.status_code == 200
        assert len(events_list.json()) >= 1

        # 5. 验证告警列表
        alerts_list = await client.get("/api/alerts", headers=_h(manager_token))
        assert alerts_list.status_code == 200
        assert len(alerts_list.json()) >= 1

        # 6. 确认告警
        ack_resp = await client.put(f"/api/alerts/{alert['id']}/acknowledge", headers=_h(manager_token), json={
            "acknowledged_by": "测试工程师",
        })
        assert ack_resp.status_code == 200
        assert ack_resp.json()["acknowledged"] is True

        # 7. 查看看板汇总
        dash = await client.get("/api/stats/dashboard", headers=_h(manager_token))
        assert dash.status_code == 200

    async def test_multi_camera_events(self, client: AsyncClient, manager_token: str):
        """多摄像头并发检测事件"""
        # 创建两个摄像头
        for cam_id in ["MULTI_CAM01", "MULTI_CAM02"]:
            resp = await client.post("/api/cameras", headers=_h(manager_token), json={
                "camera_id": cam_id,
                "name": f"摄像头{cam_id}",
                "location": "多路测试区",
                "type": "rtsp",
                "stream_url": f"rtsp://test:554/{cam_id}",
            })
            assert resp.status_code == 201

        # 各创建检测事件
        for cam_id, ev_type in [("MULTI_CAM01", "safety"), ("MULTI_CAM02", "defect")]:
            resp = await client.post("/api/events", headers=_h(manager_token), json={
                "camera_id": cam_id,
                "event_type": ev_type,
                "event_time": datetime.now(timezone.utc).isoformat(),
                "confidence": 0.85,
            })
            assert resp.status_code == 201

        # 按类型过滤
        safety = await client.get("/api/events", headers=_h(manager_token), params={"event_type": "safety"})
        assert safety.status_code == 200
        assert all(e["event_type"] == "safety" for e in safety.json())

    async def test_camera_lifecycle(self, client: AsyncClient, manager_token: str):
        """摄像头完整生命周期"""
        # 创建
        resp = await client.post("/api/cameras", headers=_h(manager_token), json={
            "camera_id": "LIFE_CAM01",
            "name": "生命周期测试",
            "location": "A区",
            "type": "gigE",
            "stream_url": "rtsp://test:554/life",
        })
        assert resp.status_code == 201
        cam_id = resp.json()["id"]

        # 更新
        up = await client.put(f"/api/cameras/{cam_id}", headers=_h(manager_token), json={
            "name": "已更新摄像头",
            "status": "offline",
        })
        assert up.status_code == 200
        assert up.json()["name"] == "已更新摄像头"
        assert up.json()["status"] == "offline"

        # 删除
        dl = await client.delete(f"/api/cameras/{cam_id}", headers=_h(manager_token))
        assert dl.status_code == 204

        # 验证已删除
        get = await client.get(f"/api/cameras/{cam_id}", headers=_h(manager_token))
        assert get.status_code == 404

    async def test_alert_stats_accuracy(self, client: AsyncClient, manager_token: str):
        """告警统计准确性"""
        # 创建不同级别告警
        for sev in ["critical", "critical", "warning", "info"]:
            resp = await client.post("/api/alerts", headers=_h(manager_token), json={
                "severity": sev,
                "message": f"{sev}级别测试告警",
                "camera_id": "STATS_CAM",
            })
            assert resp.status_code == 201

        # 确认一个告警
        alerts = await client.get("/api/alerts", headers=_h(manager_token))
        first_id = alerts.json()[0]["id"]
        await client.put(f"/api/alerts/{first_id}/acknowledge", headers=_h(manager_token), json={
            "acknowledged_by": "admin",
        })

        # 验证统计
        stats = await client.get("/api/alerts/stats", headers=_h(manager_token))
        assert stats.status_code == 200
        data = stats.json()
        assert data["total"] == 4
        assert data["unacknowledged"] <= 4

    async def test_health_check(self, client: AsyncClient, manager_token: str):
        """健康检查端点"""
        resp = await client.get("/api/health", headers=_h(manager_token))
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

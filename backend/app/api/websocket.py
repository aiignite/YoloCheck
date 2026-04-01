import asyncio
import json
import logging
from typing import Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)
router = APIRouter()


class ConnectionManager:
    """WebSocket连接管理器"""

    def __init__(self):
        self._connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self._connections.add(websocket)
        logger.info(f"WebSocket连接: {len(self._connections)}个活跃连接")

    def disconnect(self, websocket: WebSocket):
        self._connections.discard(websocket)
        logger.info(f"WebSocket断开: {len(self._connections)}个活跃连接")

    async def broadcast(self, message: dict):
        """广播消息到所有连接"""
        data = json.dumps(message, default=str, ensure_ascii=False)
        disconnected = set()
        for connection in self._connections:
            try:
                await connection.send_text(data)
            except Exception:
                disconnected.add(connection)
        self._connections -= disconnected

    @property
    def active_count(self) -> int:
        return len(self._connections)


manager = ConnectionManager()


@router.websocket("/live")
async def websocket_live(websocket: WebSocket):
    """实时数据推送WebSocket端点"""
    await manager.connect(websocket)
    try:
        while True:
            # 保持连接，接收客户端心跳
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        manager.disconnect(websocket)


async def broadcast_detection(camera_id: str, detections: list[dict]):
    """广播检测结果"""
    await manager.broadcast({
        "type": "detection",
        "camera_id": camera_id,
        "detections": detections,
    })


async def broadcast_alert(alert: dict):
    """广播告警"""
    await manager.broadcast({
        "type": "alert",
        "data": alert,
    })

"""多路视频流管理器"""

import logging
from typing import Optional

import numpy as np

from app.core.frame_grabber import FrameGrabber

logger = logging.getLogger(__name__)


class StreamManager:
    """管理多路视频流"""

    def __init__(self):
        self._grabbers: dict[str, FrameGrabber] = {}

    def add_stream(self, camera_id: str, stream_url: str, target_fps: int = 5) -> bool:
        """添加视频流"""
        if camera_id in self._grabbers:
            logger.warning(f"摄像头 {camera_id} 已存在，先移除旧流")
            self.remove_stream(camera_id)

        grabber = FrameGrabber(camera_id, stream_url, target_fps)
        self._grabbers[camera_id] = grabber
        grabber.start()
        return True

    def remove_stream(self, camera_id: str):
        """移除视频流"""
        grabber = self._grabbers.pop(camera_id, None)
        if grabber:
            grabber.stop()

    def get_frame(self, camera_id: str) -> Optional[np.ndarray]:
        """获取最新帧"""
        grabber = self._grabbers.get(camera_id)
        if not grabber:
            return None
        return grabber.latest_frame

    def get_status(self, camera_id: str) -> str:
        """获取摄像头状态"""
        grabber = self._grabbers.get(camera_id)
        if not grabber:
            return "not_registered"
        return "online" if grabber.is_connected else "offline"

    def get_all_status(self) -> dict[str, str]:
        """获取所有摄像头状态"""
        return {cid: self.get_status(cid) for cid in self._grabbers}

    @property
    def active_cameras(self) -> list[str]:
        return [cid for cid, g in self._grabbers.items() if g.is_connected]

    def stop_all(self):
        """停止所有视频流"""
        for grabber in self._grabbers.values():
            grabber.stop()
        self._grabbers.clear()


# 全局实例
stream_manager = StreamManager()

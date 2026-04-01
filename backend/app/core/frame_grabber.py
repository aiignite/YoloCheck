"""多路视频流采集与帧提取"""

import logging
import threading
import time
from typing import Optional

import cv2
import numpy as np

logger = logging.getLogger(__name__)


class FrameGrabber:
    """单路视频流帧采集器"""

    def __init__(self, camera_id: str, stream_url: str, target_fps: int = 5):
        self.camera_id = camera_id
        self.stream_url = stream_url
        self.target_fps = target_fps
        self._cap: Optional[cv2.VideoCapture] = None
        self._latest_frame: Optional[np.ndarray] = None
        self._lock = threading.Lock()
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._consecutive_failures = 0
        self._max_failures = 10

    @property
    def is_connected(self) -> bool:
        return self._cap is not None and self._cap.isOpened()

    @property
    def latest_frame(self) -> Optional[np.ndarray]:
        with self._lock:
            return self._latest_frame.copy() if self._latest_frame is not None else None

    def connect(self) -> bool:
        """连接视频源"""
        try:
            self._cap = cv2.VideoCapture(self.stream_url)
            if not self._cap.isOpened():
                logger.error(f"[{self.camera_id}] 无法打开视频流: {self.stream_url}")
                return False
            self._consecutive_failures = 0
            logger.info(f"[{self.camera_id}] 视频流连接成功")
            return True
        except Exception as e:
            logger.error(f"[{self.camera_id}] 连接异常: {e}")
            return False

    def _reconnect(self) -> bool:
        """重连"""
        logger.warning(f"[{self.camera_id}] 尝试重连...")
        if self._cap:
            self._cap.release()
        time.sleep(2)
        return self.connect()

    def _grab_loop(self):
        """帧采集循环（在独立线程运行）"""
        interval = 1.0 / self.target_fps
        while self._running:
            if not self.is_connected:
                if not self._reconnect():
                    self._consecutive_failures += 1
                    if self._consecutive_failures >= self._max_failures:
                        logger.error(f"[{self.camera_id}] 连续失败{self._max_failures}次，停止采集")
                        break
                    time.sleep(5)
                    continue

            ret, frame = self._cap.read()
            if not ret:
                self._consecutive_failures += 1
                if self._consecutive_failures >= self._max_failures:
                    if not self._reconnect():
                        break
                continue

            self._consecutive_failures = 0
            with self._lock:
                self._latest_frame = frame

            time.sleep(interval)

    def start(self):
        """开始采集"""
        if self._running:
            return
        if not self.is_connected:
            self.connect()
        self._running = True
        self._thread = threading.Thread(target=self._grab_loop, daemon=True)
        self._thread.start()
        logger.info(f"[{self.camera_id}] 采集已启动, target_fps={self.target_fps}")

    def stop(self):
        """停止采集"""
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)
        if self._cap:
            self._cap.release()
        logger.info(f"[{self.camera_id}] 采集已停止")

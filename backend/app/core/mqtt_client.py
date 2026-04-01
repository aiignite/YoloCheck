"""MQTT客户端封装"""

import json
import logging
import threading
from typing import Callable, Optional

import paho.mqtt.client as mqtt

from app.config import get_settings

logger = logging.getLogger(__name__)


class MQTTClient:
    """MQTT消息客户端"""

    def __init__(
        self,
        broker: Optional[str] = None,
        port: Optional[int] = None,
        client_id: str = "yolocheck-backend",
    ):
        settings = get_settings()
        self.broker = broker or settings.mqtt_broker
        self.port = port or settings.mqtt_port
        self._client = mqtt.Client(client_id=client_id, protocol=mqtt.MQTTv5)
        self._client.on_connect = self._on_connect
        self._client.on_disconnect = self._on_disconnect
        self._client.on_message = self._on_message
        self._handlers: dict[str, Callable] = {}
        self._connected = False

        username = settings.mqtt_username
        password = settings.mqtt_password
        if username:
            self._client.username_pw_set(username, password)

    @property
    def is_connected(self) -> bool:
        return self._connected

    def _on_connect(self, client, userdata, flags, rc, properties=None):
        if rc == 0:
            self._connected = True
            logger.info("MQTT已连接")
            # 重新订阅
            for topic in self._handlers:
                self._client.subscribe(topic)
        else:
            logger.error(f"MQTT连接失败, rc={rc}")

    def _on_disconnect(self, client, userdata, rc, properties=None):
        self._connected = False
        logger.warning(f"MQTT断开连接, rc={rc}")

    def _on_message(self, client, userdata, msg):
        topic = msg.topic
        try:
            payload = json.loads(msg.payload.decode())
        except (json.JSONDecodeError, UnicodeDecodeError):
            logger.warning(f"无法解析消息: topic={topic}")
            return

        # 匹配处理器
        for pattern, handler in self._handlers.items():
            if mqtt.topic_matches_sub(pattern, topic):
                try:
                    handler(topic, payload)
                except Exception as e:
                    logger.error(f"消息处理异常: topic={topic}, error={e}")

    def connect(self) -> bool:
        """连接MQTT Broker"""
        try:
            self._client.connect(self.broker, self.port, keepalive=60)
            self._client.loop_start()
            logger.info(f"MQTT连接中: {self.broker}:{self.port}")
            return True
        except Exception as e:
            logger.error(f"MQTT连接失败: {e}")
            return False

    def disconnect(self):
        """断开连接"""
        self._client.loop_stop()
        self._client.disconnect()

    def publish(self, topic: str, payload: dict) -> bool:
        """发布消息"""
        try:
            message = json.dumps(payload, default=str, ensure_ascii=False)
            result = self._client.publish(topic, message, qos=1)
            return result.rc == mqtt.MQTT_ERR_SUCCESS
        except Exception as e:
            logger.error(f"发布失败: topic={topic}, error={e}")
            return False

    def subscribe(self, topic: str, handler: Callable):
        """订阅主题"""
        self._handlers[topic] = handler
        if self._connected:
            self._client.subscribe(topic)
        logger.info(f"订阅主题: {topic}")


# 全局实例
_mqtt_client: Optional[MQTTClient] = None


def get_mqtt_client() -> MQTTClient:
    global _mqtt_client
    if _mqtt_client is None:
        _mqtt_client = MQTTClient()
    return _mqtt_client

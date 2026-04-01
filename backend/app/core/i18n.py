"""后端错误消息国际化"""
from typing import Optional

_MESSAGES = {
    "auth.invalid_credentials": {
        "zh": "用户名或密码错误",
        "en": "Invalid username or password",
    },
    "auth.token_expired": {
        "zh": "登录已过期，请重新登录",
        "en": "Session expired, please login again",
    },
    "auth.token_invalid": {
        "zh": "无效的认证令牌",
        "en": "Invalid authentication token",
    },
    "auth.unauthorized": {
        "zh": "未授权的访问",
        "en": "Unauthorized access",
    },
    "auth.forbidden": {
        "zh": "权限不足",
        "en": "Insufficient permissions",
    },
    "user.password_wrong": {
        "zh": "原密码错误或用户不存在",
        "en": "Current password is incorrect or user not found",
    },
    "user.not_found": {
        "zh": "用户不存在",
        "en": "User not found",
    },
    "camera.not_found": {
        "zh": "摄像头不存在",
        "en": "Camera not found",
    },
    "model.not_found": {
        "zh": "模型不存在",
        "en": "Model not found",
    },
    "rule.not_found": {
        "zh": "规则不存在",
        "en": "Rule not found",
    },
    "common.not_found": {
        "zh": "资源不存在",
        "en": "Resource not found",
    },
    "common.server_error": {
        "zh": "服务器内部错误",
        "en": "Internal server error",
    },
}


def t(key: str, lang: Optional[str] = None) -> str:
    """获取国际化消息。lang 为 'en' 或 'zh'，默认 'zh'。"""
    if lang is None:
        lang = "zh"
    msg = _MESSAGES.get(key, {})
    return msg.get(lang, msg.get("zh", key))

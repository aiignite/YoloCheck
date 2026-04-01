"""告警规则与通知工作流 API"""
import json
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta

from app.database import get_db
from app.models.models import Alert, AlertRule
from app.core.i18n import t
from app.core.auth import require_auth, require_role
from app.models.models import User

router = APIRouter()
logger = logging.getLogger(__name__)


def _lang(request: Request) -> str:
    accept = request.headers.get("accept-language", "")
    return "en" if accept.lower().startswith("en") else "zh"


# ── Schemas ──

class AlertRuleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = ""
    severity: str = Field("warning", pattern=r"^(critical|warning|info)$")
    condition_type: str = Field(..., pattern=r"^(threshold|pattern|frequency)$")
    condition_config: dict = {}
    notification_channels: str = ""
    escalation_minutes: int = Field(30, ge=1)
    escalation_target: str = ""
    is_enabled: bool = True


class AlertRuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[str] = None
    condition_config: Optional[dict] = None
    notification_channels: Optional[str] = None
    escalation_minutes: Optional[int] = None
    escalation_target: Optional[str] = None
    is_enabled: Optional[bool] = None


class AlertRuleResponse(BaseModel):
    id: int
    name: str
    description: str
    severity: str
    condition_type: str
    condition_config: dict
    notification_channels: str
    escalation_minutes: int
    escalation_target: str
    is_enabled: bool
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


class NotificationTest(BaseModel):
    channel: str = Field(..., pattern=r"^(email|dingtalk|wechat|sms)$")
    target: str = ""
    message: str = "YoloCheck 测试通知"


class AlertTrend(BaseModel):
    date: str
    critical: int
    warning: int
    info: int


# ── 告警规则 CRUD ──

@router.get("/rules", response_model=list[AlertRuleResponse])
async def list_rules(user: User = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AlertRule).order_by(AlertRule.created_at.desc()))
    rows = result.scalars().all()
    out = []
    for r in rows:
        resp = AlertRuleResponse.model_validate(r)
        try:
            resp.condition_config = json.loads(r.condition_config) if isinstance(r.condition_config, str) else r.condition_config
        except (json.JSONDecodeError, TypeError):
            resp.condition_config = {}
        out.append(resp)
    return out


@router.post("/rules", response_model=AlertRuleResponse, status_code=201)
async def create_rule(data: AlertRuleCreate, _user: User = Depends(require_role("manager")), db: AsyncSession = Depends(get_db)):
    rule = AlertRule(
        name=data.name,
        description=data.description,
        severity=data.severity,
        condition_type=data.condition_type,
        condition_config=json.dumps(data.condition_config),
        notification_channels=data.notification_channels,
        escalation_minutes=data.escalation_minutes,
        escalation_target=data.escalation_target,
        is_enabled=data.is_enabled,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    resp = AlertRuleResponse.model_validate(rule)
    resp.condition_config = data.condition_config
    return resp


@router.put("/rules/{rule_id}", response_model=AlertRuleResponse)
async def update_rule(rule_id: int, data: AlertRuleUpdate, request: Request, _user: User = Depends(require_role("manager")), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AlertRule).where(AlertRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(404, t("rule.not_found", _lang(request)))

    for k, v in data.model_dump(exclude_unset=True).items():
        if k == "condition_config" and v is not None:
            setattr(rule, k, json.dumps(v))
        elif v is not None:
            setattr(rule, k, v)
    await db.commit()
    await db.refresh(rule)
    resp = AlertRuleResponse.model_validate(rule)
    try:
        resp.condition_config = json.loads(rule.condition_config)
    except (json.JSONDecodeError, TypeError):
        resp.condition_config = {}
    return resp


@router.delete("/rules/{rule_id}", status_code=204)
async def delete_rule(rule_id: int, request: Request, _user: User = Depends(require_role("manager")), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AlertRule).where(AlertRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(404, t("rule.not_found", _lang(request)))
    await db.delete(rule)
    await db.commit()


@router.post("/rules/{rule_id}/toggle", response_model=AlertRuleResponse)
async def toggle_rule(rule_id: int, request: Request, _user: User = Depends(require_role("manager")), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AlertRule).where(AlertRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(404, t("rule.not_found", _lang(request)))
    rule.is_enabled = not rule.is_enabled
    await db.commit()
    await db.refresh(rule)
    resp = AlertRuleResponse.model_validate(rule)
    try:
        resp.condition_config = json.loads(rule.condition_config)
    except (json.JSONDecodeError, TypeError):
        resp.condition_config = {}
    return resp


# ── 通知测试 ──

@router.post("/notify/test")
async def test_notification(data: NotificationTest, _user: User = Depends(require_role("manager"))):
    """模拟发送测试通知（实际集成需配置对应服务）"""
    logger.info(f"Test notification via {data.channel}: {data.message} → {data.target}")
    return {
        "success": True,
        "channel": data.channel,
        "message": f"已模拟发送{data.channel}通知",
        "detail": f"目标: {data.target or '默认'}, 内容: {data.message}",
    }


# ── 告警趋势统计 ──

@router.get("/trends", response_model=list[AlertTrend])
async def alert_trends(days: int = 7, user: User = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    """获取最近N天的告警趋势"""
    from sqlalchemy import func
    today = datetime.utcnow().date()
    start = today - timedelta(days=days - 1)

    date_col = func.date(Alert.created_at).label("d")
    result = await db.execute(
        select(
            date_col,
            Alert.severity,
            func.count(Alert.id).label("cnt"),
        )
        .where(Alert.created_at >= datetime.combine(start, datetime.min.time()))
        .group_by(date_col, Alert.severity)
    )
    rows = result.all()

    # Build date → severity → count mapping
    data = {}
    for d in (start + timedelta(days=i) for i in range(days)):
        ds = d.isoformat()
        data[ds] = {"date": ds, "critical": 0, "warning": 0, "info": 0}
    for row in rows:
        ds = str(row.d)
        if ds in data and row.severity in data[ds]:
            data[ds][row.severity] = row.cnt

    return list(data.values())


# ── 升级检查 ──

@router.post("/check-escalation")
async def check_escalation(_user: User = Depends(require_role("manager")), db: AsyncSession = Depends(get_db)):
    """检查超时未处理的告警并标记升级"""
    rules_result = await db.execute(
        select(AlertRule).where(AlertRule.is_enabled == True)
    )
    rules = rules_result.scalars().all()

    escalated_count = 0
    for rule in rules:
        cutoff = datetime.utcnow() - timedelta(minutes=rule.escalation_minutes)
        alerts_result = await db.execute(
            select(Alert).where(
                Alert.severity == rule.severity,
                Alert.acknowledged == False,
                Alert.escalated == False,
                Alert.created_at <= cutoff,
            )
        )
        alerts = alerts_result.scalars().all()
        for alert in alerts:
            alert.escalated = True
            alert.escalation_level = (alert.escalation_level or 0) + 1
            escalated_count += 1

    if escalated_count > 0:
        await db.commit()

    return {"escalated_count": escalated_count, "message": f"已升级 {escalated_count} 条告警"}

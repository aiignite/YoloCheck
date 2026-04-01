from datetime import datetime
from typing import Optional, Sequence
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import VideoTemplate, LearningSession, ActionSequence, KeyFrame


# ── VideoTemplate ──

async def create_template(db: AsyncSession, **kwargs) -> VideoTemplate:
    tpl = VideoTemplate(**kwargs)
    db.add(tpl)
    await db.commit()
    await db.refresh(tpl)
    return tpl


async def get_template(db: AsyncSession, template_id: int) -> Optional[VideoTemplate]:
    result = await db.execute(select(VideoTemplate).where(VideoTemplate.id == template_id))
    return result.scalar_one_or_none()


async def list_templates(
    db: AsyncSession,
    business_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
) -> Sequence[VideoTemplate]:
    query = select(VideoTemplate)
    if business_type:
        query = query.where(VideoTemplate.business_type == business_type)
    query = query.order_by(VideoTemplate.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


async def update_template(db: AsyncSession, template_id: int, **kwargs) -> Optional[VideoTemplate]:
    tpl = await get_template(db, template_id)
    if not tpl:
        return None
    for k, v in kwargs.items():
        if v is not None:
            setattr(tpl, k, v)
    await db.commit()
    await db.refresh(tpl)
    return tpl


async def delete_template(db: AsyncSession, template_id: int) -> bool:
    tpl = await get_template(db, template_id)
    if not tpl:
        return False
    await db.delete(tpl)
    await db.commit()
    return True


# ── LearningSession ──

async def create_session(db: AsyncSession, template_id: int) -> LearningSession:
    session = LearningSession(template_id=template_id)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def get_session(db: AsyncSession, session_id: int) -> Optional[LearningSession]:
    result = await db.execute(select(LearningSession).where(LearningSession.id == session_id))
    return result.scalar_one_or_none()


async def get_sessions_by_template(
    db: AsyncSession, template_id: int
) -> Sequence[LearningSession]:
    result = await db.execute(
        select(LearningSession)
        .where(LearningSession.template_id == template_id)
        .order_by(LearningSession.created_at.desc())
    )
    return result.scalars().all()


async def update_session(db: AsyncSession, session_id: int, **kwargs) -> Optional[LearningSession]:
    session = await get_session(db, session_id)
    if not session:
        return None
    for k, v in kwargs.items():
        if v is not None:
            setattr(session, k, v)
    await db.commit()
    await db.refresh(session)
    return session


# ── ActionSequence ──

async def create_action(db: AsyncSession, **kwargs) -> ActionSequence:
    action = ActionSequence(**kwargs)
    db.add(action)
    await db.commit()
    await db.refresh(action)
    return action


async def get_actions_by_session(
    db: AsyncSession, session_id: int
) -> Sequence[ActionSequence]:
    result = await db.execute(
        select(ActionSequence)
        .where(ActionSequence.session_id == session_id)
        .order_by(ActionSequence.step_order)
    )
    return result.scalars().all()


async def get_actions_by_template(
    db: AsyncSession, template_id: int
) -> Sequence[ActionSequence]:
    """获取某模板最新会话的动作序列"""
    # 优先取最新已完成会话
    latest = await db.execute(
        select(LearningSession)
        .where(
            LearningSession.template_id == template_id,
            LearningSession.status == "completed",
        )
        .order_by(LearningSession.completed_at.desc())
        .limit(1)
    )
    session = latest.scalar_one_or_none()
    if not session:
        return []
    return await get_actions_by_session(db, session.id)


async def update_action(db: AsyncSession, action_id: int, **kwargs) -> Optional[ActionSequence]:
    result = await db.execute(select(ActionSequence).where(ActionSequence.id == action_id))
    action = result.scalar_one_or_none()
    if not action:
        return None
    for k, v in kwargs.items():
        if v is not None:
            setattr(action, k, v)
    await db.commit()
    await db.refresh(action)
    return action


async def apply_action_suggestion(
    db: AsyncSession,
    action_id: int,
    suggestion_type: str,
) -> Optional[ActionSequence]:
    result = await db.execute(select(ActionSequence).where(ActionSequence.id == action_id))
    action = result.scalar_one_or_none()
    if not action:
        return None

    features = action.features or {}
    if suggestion_type == "rename":
        suggested_name = features.get("suggested_action_name")
        if not suggested_name:
            return None
        action.user_defined_name = suggested_name
    elif suggestion_type == "keep":
        action.is_kept = True
    else:
        return None

    await db.commit()
    await db.refresh(action)
    return action


async def _reorder_actions(db: AsyncSession, session_id: int):
    actions = await get_actions_by_session(db, session_id)
    for idx, action in enumerate(actions, start=1):
        action.step_order = idx
    await db.commit()


async def split_action(db: AsyncSession, action_id: int, target_frame: int) -> Sequence[ActionSequence]:
    result = await db.execute(select(ActionSequence).where(ActionSequence.id == action_id))
    action = result.scalar_one_or_none()
    if not action or action.start_frame is None or action.end_frame is None:
        return []
    if target_frame <= action.start_frame or target_frame >= action.end_frame:
        return []

    new_action = ActionSequence(
        session_id=action.session_id,
        template_id=action.template_id,
        step_order=action.step_order + 1,
        action_name=action.action_name,
        description=action.description,
        start_frame=target_frame,
        end_frame=action.end_frame,
        start_time=action.start_time,
        end_time=action.end_time,
        duration=action.duration,
        confidence=action.confidence,
        keyframe_path=action.keyframe_path,
        objects_in_scene=action.objects_in_scene,
        features=action.features,
        user_defined_name=action.user_defined_name,
        note=action.note,
        is_kept=action.is_kept,
    )
    action.end_frame = target_frame - 1
    db.add(new_action)
    await db.commit()
    await _reorder_actions(db, action.session_id)
    return await get_actions_by_session(db, action.session_id)


async def merge_action_with_previous(db: AsyncSession, action_id: int) -> Sequence[ActionSequence]:
    result = await db.execute(select(ActionSequence).where(ActionSequence.id == action_id))
    action = result.scalar_one_or_none()
    if not action:
        return []
    actions = list(await get_actions_by_session(db, action.session_id))
    idx = next((i for i, a in enumerate(actions) if a.id == action.id), -1)
    if idx <= 0:
        return []
    prev = actions[idx - 1]
    prev.end_frame = action.end_frame
    prev.end_time = action.end_time
    prev.duration = (prev.end_time or 0) - (prev.start_time or 0)
    prev.objects_in_scene = sorted(set((prev.objects_in_scene or []) + (action.objects_in_scene or [])))
    await db.delete(action)
    await db.commit()
    await _reorder_actions(db, prev.session_id)
    return await get_actions_by_session(db, prev.session_id)


# ── KeyFrame ──

async def create_keyframe(db: AsyncSession, **kwargs) -> KeyFrame:
    kf = KeyFrame(**kwargs)
    db.add(kf)
    await db.commit()
    await db.refresh(kf)
    return kf


async def batch_create_keyframes(db: AsyncSession, keyframes: list[dict]) -> int:
    """批量插入关键帧"""
    count = 0
    for kf_data in keyframes:
        db.add(KeyFrame(**kf_data))
        count += 1
    await db.commit()
    return count


async def get_keyframes_by_session(
    db: AsyncSession, session_id: int, boundaries_only: bool = False
) -> Sequence[KeyFrame]:
    query = select(KeyFrame).where(KeyFrame.session_id == session_id)
    if boundaries_only:
        query = query.where(KeyFrame.is_action_boundary == True)
    query = query.order_by(KeyFrame.frame_number)
    result = await db.execute(query)
    return result.scalars().all()


async def get_frame_overlays_by_session(
    db: AsyncSession,
    session_id: int,
    start_time: Optional[float] = None,
    end_time: Optional[float] = None,
    stride: int = 1,
    limit: int = 300,
) -> Sequence[KeyFrame]:
    query = select(KeyFrame).where(KeyFrame.session_id == session_id)
    if start_time is not None:
        query = query.where(KeyFrame.timestamp >= start_time)
    if end_time is not None:
        query = query.where(KeyFrame.timestamp <= end_time)
    query = query.order_by(KeyFrame.frame_number)
    result = await db.execute(query)
    frames = list(result.scalars().all())
    if stride > 1:
        frames = frames[::stride]
    if limit > 0:
        frames = frames[:limit]
    return frames


async def get_keyframe_count(db: AsyncSession, session_id: int) -> int:
    result = await db.execute(
        select(func.count(KeyFrame.id)).where(KeyFrame.session_id == session_id)
    )
    return result.scalar() or 0


async def get_boundary_count(db: AsyncSession, session_id: int) -> int:
    result = await db.execute(
        select(func.count(KeyFrame.id)).where(
            KeyFrame.session_id == session_id,
            KeyFrame.is_action_boundary == True,
        )
    )
    return result.scalar() or 0

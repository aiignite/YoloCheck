"""视频学习API端点"""
import os
import asyncio
from datetime import UTC, datetime
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.database import get_db
from app.config import get_settings
from app.schemas.video_learning import (
    VideoTemplateResponse,
    LearningSessionResponse,
    StartLearningRequest,
    ActionSequenceResponse,
    FrameOverlayResponse,
    KeyFrameResponse,
    LearningSummary,
    VideoLearningConfigUpdate,
    ActionSequenceUpdate,
    ActionSplitRequest,
    ActionMergeRequest,
    ActionSuggestionApplyRequest,
    SOPPreviewResponse,
    TemplateSOPUpdate,
    TemplateCompareResponse,
)
from app.crud import video_learning as crud
from app.crud import model as model_crud
from app.core.video_learning import (
    apply_custom_action_model,
    get_video_metadata,
    analyze_video_frames,
    extract_actions,
    generate_analysis_summary,
)
from app.core.auth import require_auth, require_role
from app.models.models import User

router = APIRouter()
settings = get_settings()
_executor = ThreadPoolExecutor(max_workers=2)


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _serialize_action_with_suggestions(action) -> ActionSequenceResponse:
    response = ActionSequenceResponse.model_validate(action)
    return response.model_copy(update={
        "suggestions": (action.features or {}).get("suggestions", []),
    })


def _serialize_frame_overlay(frame) -> FrameOverlayResponse:
    detections = frame.detections or {}
    if isinstance(detections, list):
        detections = {"objects": detections}
    return FrameOverlayResponse(
        frame_number=frame.frame_number,
        timestamp=frame.timestamp,
        image_path=frame.image_path,
        objects=detections.get("objects", []),
        pose_keypoints=detections.get("pose_keypoints", []),
        interaction_summary=detections.get("interaction_summary", {}),
        scene_change_score=frame.scene_change_score,
        is_action_boundary=frame.is_action_boundary,
    )


def _build_sop_preview(template, actions, workflow_summary: dict) -> dict:
    steps = []
    for action in actions:
        features = action.features or {}
        steps.append({
            "step_order": action.step_order,
            "name": action.user_defined_name or features.get("suggested_action_name") or action.action_name,
            "description": action.note or action.description,
            "duration": action.duration,
            "keyframe_path": action.keyframe_path,
            "objects": action.objects_in_scene or [],
        })

    return {
        "template_id": template.id,
        "title": template.name,
        "business_type": template.business_type,
        "station_id": template.station_id,
        "workflow_summary": workflow_summary or {},
        "steps": steps,
    }


# ── 模板管理 ──

@router.post("/templates", response_model=VideoTemplateResponse, status_code=201)
async def upload_template(
    name: str = Form(...),
    business_type: str = Form(...),
    description: str = Form(None),
    station_id: str = Form(None),
    file: UploadFile = File(...),
    _user: User = Depends(require_role("manager")),
    db: AsyncSession = Depends(get_db),
):
    """上传标准操作视频模板"""
    if not file.filename:
        raise HTTPException(400, "缺少文件")

    allowed_ext = {".mp4", ".avi", ".mov", ".mkv", ".flv", ".wmv"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_ext:
        raise HTTPException(400, f"不支持的视频格式: {ext}")

    # 保存视频文件
    save_dir = os.path.join(settings.upload_dir, "videos")
    os.makedirs(save_dir, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    safe_name = f"{timestamp}_{file.filename}"
    video_path = os.path.join(save_dir, safe_name)

    content = await file.read()
    with open(video_path, "wb") as f:
        f.write(content)

    # 获取视频元数据
    try:
        meta = get_video_metadata(video_path)
    except ValueError as e:
        os.remove(video_path)
        raise HTTPException(400, str(e))

    tpl = await crud.create_template(
        db,
        name=name,
        description=description,
        video_path=video_path,
        duration_seconds=meta.duration_seconds,
        fps=meta.fps,
        frame_count=meta.frame_count,
        resolution=meta.resolution,
        business_type=business_type,
        station_id=station_id,
    )
    return tpl


@router.get("/templates", response_model=list[VideoTemplateResponse])
async def list_templates(
    business_type: str = None,
    skip: int = 0,
    limit: int = 50,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    return await crud.list_templates(db, business_type=business_type, skip=skip, limit=limit)


@router.get("/templates/{template_id}", response_model=VideoTemplateResponse)
async def get_template(template_id: int, user: User = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    tpl = await crud.get_template(db, template_id)
    if not tpl:
        raise HTTPException(404, "模板不存在")
    return tpl


@router.put("/templates/{template_id}/config", response_model=VideoTemplateResponse)
async def update_template_config(
    template_id: int,
    payload: VideoLearningConfigUpdate,
    _user: User = Depends(require_role("manager")),
    db: AsyncSession = Depends(get_db),
):
    tpl = await crud.update_template(db, template_id, learning_config=payload.learning_config)
    if not tpl:
        raise HTTPException(404, "模板不存在")
    return tpl


@router.delete("/templates/{template_id}", status_code=204)
async def delete_template(template_id: int, _user: User = Depends(require_role("manager")), db: AsyncSession = Depends(get_db)):
    if not await crud.delete_template(db, template_id):
        raise HTTPException(404, "模板不存在")


# ── 学习会话 ──

async def _run_learning(
    session_id: int,
    template_id: int,
    video_path: str,
    params: dict,
    session_factory: async_sessionmaker[AsyncSession],
):
    """后台学习任务"""
    async with session_factory() as db:
        try:
            object_model = None
            action_model = None
            if params.get("object_model_id"):
                model = await model_crud.get_model(db, params["object_model_id"])
                if model:
                    object_model = {"id": model.id, "name": model.name, "model_path": model.model_path}
            if params.get("action_model_id"):
                model = await model_crud.get_model(db, params["action_model_id"])
                if model:
                    action_model = {"id": model.id, "name": model.name, "model_path": model.model_path}

            await crud.update_session(
                db, session_id,
                status="running",
                started_at=_utc_now(),
            )

            meta = get_video_metadata(video_path)

            # 进度回调
            async def update_progress(processed: int, total: int):
                progress = min(round(processed / total * 100, 1), 99.0) if total > 0 else 0
                await crud.update_session(
                    db, session_id,
                    progress=progress,
                    processed_frames=processed,
                    total_frames=total,
                )

            # 在线程池中运行同步的视频分析
            loop = asyncio.get_running_loop()

            def sync_analyze():
                return analyze_video_frames(
                    video_path=video_path,
                    template_id=template_id,
                    session_id=session_id,
                    learning_mode=params.get("learning_mode", "action_and_object"),
                    focus_classes=params.get("focus_classes", []),
                    sample_rate=params.get("sample_rate", 5),
                    min_confidence=params.get("min_confidence", 0.4),
                    scene_threshold=params.get("scene_threshold", 30.0),
                    object_model=object_model,
                )

            analyzed_frames = await loop.run_in_executor(_executor, sync_analyze)
            if object_model:
                for frame in analyzed_frames:
                    for det in frame.detections:
                        det.setdefault("model_source", "custom_object")
                        det.setdefault("model_id", object_model.get("id"))
                        det.setdefault("model_name", object_model.get("name"))

            # 提取动作序列
            actions = extract_actions(analyzed_frames, meta.fps)
            actions = apply_custom_action_model(actions, action_model)

            # 保存关键帧到数据库
            keyframe_data = []
            for af in analyzed_frames:
                keyframe_data.append({
                    "session_id": session_id,
                    "template_id": template_id,
                    "frame_number": af.frame_number,
                    "timestamp": af.timestamp,
                    "image_path": af.image_path,
                    "detections": {
                        "objects": af.detections,
                        "pose_keypoints": af.pose_keypoints,
                        "interaction_summary": af.interaction_summary,
                    },
                    "scene_change_score": af.scene_change_score,
                    "is_action_boundary": af.is_boundary,
                })
            await crud.batch_create_keyframes(db, keyframe_data)

            # 保存动作序列
            for action in actions:
                await crud.create_action(
                    db,
                    session_id=session_id,
                    template_id=template_id,
                    step_order=action.step_order,
                    action_name=action.action_name,
                    description=action.description,
                    start_frame=action.start_frame,
                    end_frame=action.end_frame,
                    start_time=action.start_time,
                    end_time=action.end_time,
                    duration=action.duration,
                    confidence=action.confidence,
                    keyframe_path=action.keyframe_path,
                    objects_in_scene=action.objects_in_scene,
                    features=action.features,
                )

            # 生成分析摘要
            summary = generate_analysis_summary(meta, analyzed_frames, actions)

            await crud.update_session(
                db, session_id,
                status="completed",
                progress=100.0,
                processed_frames=meta.frame_count,
                total_frames=meta.frame_count,
                objects_detected=summary["analysis"]["total_detections"],
                actions_identified=len(actions),
                analysis_result=summary,
                completed_at=_utc_now(),
            )

            # 更新模板状态
            await crud.update_template(db, template_id, status="completed")

        except Exception as e:
            await crud.update_session(
                db, session_id,
                status="failed",
                error_message=str(e),
            )
            await crud.update_template(db, template_id, status="failed")


@router.post(
    "/templates/{template_id}/learn",
    response_model=LearningSessionResponse,
    status_code=201,
)
async def start_learning(
    template_id: int,
    params: StartLearningRequest = None,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    _user: User = Depends(require_role("manager")),
    db: AsyncSession = Depends(get_db),
):
    """开始视频学习分析"""
    tpl = await crud.get_template(db, template_id)
    if not tpl:
        raise HTTPException(404, "模板不存在")
    if not os.path.isfile(tpl.video_path):
        raise HTTPException(400, f"视频文件不存在: {tpl.video_path}")

    if params is None:
        params = StartLearningRequest()

    # 创建学习会话
    session = await crud.create_session(db, template_id)
    await crud.update_session(
        db,
        session.id,
        learning_mode=params.learning_mode,
        focus_classes=params.focus_classes,
        sample_rate=params.sample_rate,
        min_confidence=params.min_confidence,
        scene_threshold=params.scene_threshold,
        object_model_id=params.object_model_id,
        action_model_id=params.action_model_id,
    )

    # 更新模板状态
    await crud.update_template(db, template_id, status="analyzing")

    # 后台运行学习任务
    background_tasks.add_task(
        _run_learning,
        session.id,
        template_id,
        tpl.video_path,
        params.model_dump(),
        async_sessionmaker(db.bind, class_=AsyncSession, expire_on_commit=False),
    )

    return session


@router.get(
    "/templates/{template_id}/sessions",
    response_model=list[LearningSessionResponse],
)
async def list_sessions(template_id: int, user: User = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    return await crud.get_sessions_by_template(db, template_id)


@router.get("/sessions/{session_id}", response_model=LearningSessionResponse)
async def get_session(session_id: int, user: User = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    session = await crud.get_session(db, session_id)
    if not session:
        raise HTTPException(404, "会话不存在")
    return session


@router.get("/sessions/{session_id}/actions", response_model=list[ActionSequenceResponse])
async def get_session_actions(session_id: int, user: User = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    actions = await crud.get_actions_by_session(db, session_id)
    return [_serialize_action_with_suggestions(action) for action in actions]


@router.get("/sessions/{session_id}/frame-overlays", response_model=list[FrameOverlayResponse])
async def get_session_frame_overlays(
    session_id: int,
    start_time: float | None = None,
    end_time: float | None = None,
    stride: int = 1,
    limit: int = 300,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    session = await crud.get_session(db, session_id)
    if not session:
        raise HTTPException(404, "会话不存在")
    frames = await crud.get_frame_overlays_by_session(
        db,
        session_id,
        start_time=start_time,
        end_time=end_time,
        stride=max(stride, 1),
        limit=max(limit, 1),
    )
    return [_serialize_frame_overlay(frame) for frame in frames]


@router.put("/actions/{action_id}", response_model=ActionSequenceResponse)
async def update_action_sequence(
    action_id: int,
    payload: ActionSequenceUpdate,
    _user: User = Depends(require_role("manager")),
    db: AsyncSession = Depends(get_db),
):
    action = await crud.update_action(db, action_id, **payload.model_dump())
    if not action:
        raise HTTPException(404, "动作段不存在")
    return action


@router.post("/actions/{action_id}/split", response_model=list[ActionSequenceResponse])
async def split_action_sequence(
    action_id: int,
    payload: ActionSplitRequest,
    _user: User = Depends(require_role("manager")),
    db: AsyncSession = Depends(get_db),
):
    actions = await crud.split_action(db, action_id, payload.target_frame)
    if not actions:
        raise HTTPException(400, "动作段拆分失败")
    return list(actions)


@router.post("/actions/{action_id}/merge", response_model=list[ActionSequenceResponse])
async def merge_action_sequence(
    action_id: int,
    payload: ActionMergeRequest,
    _user: User = Depends(require_role("manager")),
    db: AsyncSession = Depends(get_db),
):
    if not payload.with_previous:
        raise HTTPException(400, "当前仅支持与前一段合并")
    actions = await crud.merge_action_with_previous(db, action_id)
    if not actions:
        raise HTTPException(400, "动作段合并失败")
    return list(actions)


@router.post("/actions/{action_id}/apply-suggestion", response_model=ActionSequenceResponse)
async def apply_action_sequence_suggestion(
    action_id: int,
    payload: ActionSuggestionApplyRequest,
    _user: User = Depends(require_role("manager")),
    db: AsyncSession = Depends(get_db),
):
    action = await crud.apply_action_suggestion(db, action_id, payload.suggestion_type)
    if not action:
        raise HTTPException(400, "动作建议采纳失败")
    return _serialize_action_with_suggestions(action)


@router.get("/sessions/{session_id}/keyframes", response_model=list[KeyFrameResponse])
async def get_session_keyframes(
    session_id: int,
    boundaries_only: bool = False,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    return await crud.get_keyframes_by_session(db, session_id, boundaries_only=boundaries_only)


# ── 汇总查询 ──

@router.get("/templates/{template_id}/summary", response_model=LearningSummary)
async def get_learning_summary(template_id: int, user: User = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    """获取模板的完整学习结果"""
    tpl = await crud.get_template(db, template_id)
    if not tpl:
        raise HTTPException(404, "模板不存在")

    sessions = await crud.get_sessions_by_template(db, template_id)
    completed = [s for s in sessions if s.status == "completed"]
    if not completed:
        raise HTTPException(404, "没有已完成的学习会话")

    latest = completed[0]
    actions = await crud.get_actions_by_session(db, latest.id)
    kf_count = await crud.get_keyframe_count(db, latest.id)
    boundary_count = await crud.get_boundary_count(db, latest.id)
    analysis_result = latest.analysis_result or {}
    action_responses = [_serialize_action_with_suggestions(action) for action in actions]

    return LearningSummary(
        template=tpl,
        session=latest,
        actions=action_responses,
        workflow_summary=analysis_result.get("workflow_summary", {}),
        workflow_suggestions=analysis_result.get("workflow_suggestions", []),
        sop_preview=tpl.sop_content or analysis_result.get("sop_preview", {}),
        key_frames_count=kf_count,
        action_boundaries_count=boundary_count,
    )


@router.post("/templates/{template_id}/sop-preview", response_model=SOPPreviewResponse)
async def preview_template_sop(
    template_id: int,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    tpl = await crud.get_template(db, template_id)
    if not tpl:
        raise HTTPException(404, "模板不存在")

    actions = list(await crud.get_actions_by_template(db, template_id))
    sessions = await crud.get_sessions_by_template(db, template_id)
    completed = [s for s in sessions if s.status == "completed"]
    latest = completed[0] if completed else None
    workflow_summary = (latest.analysis_result or {}).get("workflow_summary", {}) if latest else {}
    return _build_sop_preview(tpl, actions, workflow_summary)


@router.put("/templates/{template_id}/sop", response_model=VideoTemplateResponse)
async def save_template_sop(
    template_id: int,
    payload: TemplateSOPUpdate,
    _user: User = Depends(require_role("manager")),
    db: AsyncSession = Depends(get_db),
):
    tpl = await crud.update_template(
        db,
        template_id,
        sop_content=payload.sop_content,
        workflow_summary=payload.workflow_summary,
    )
    if not tpl:
        raise HTTPException(404, "模板不存在")
    return tpl


@router.get("/templates/{template_id}/compare/{target_template_id}", response_model=TemplateCompareResponse)
async def compare_templates(
    template_id: int,
    target_template_id: int,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    source_actions = list(await crud.get_actions_by_template(db, template_id))
    target_actions = list(await crud.get_actions_by_template(db, target_template_id))
    source_objects = {obj for a in source_actions for obj in (a.objects_in_scene or [])}
    target_objects = {obj for a in target_actions for obj in (a.objects_in_scene or [])}
    common_objects = sorted(source_objects & target_objects)
    source_avg = sum((a.duration or 0) for a in source_actions) / len(source_actions) if source_actions else 0
    target_avg = sum((a.duration or 0) for a in target_actions) / len(target_actions) if target_actions else 0
    return TemplateCompareResponse(
        source_template_id=template_id,
        target_template_id=target_template_id,
        source_action_count=len(source_actions),
        target_action_count=len(target_actions),
        common_objects=common_objects,
        avg_duration_gap=round(abs(source_avg - target_avg), 3),
    )

"""视频训练 API"""

import os
from datetime import UTC, datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import FileResponse, PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.video_training import (
    build_training_job_detail,
    ensure_safe_upload_file,
    log_exception,
    resolve_training_artifact_path,
    sanitize_metrics_paths,
    serialize_training_job,
    to_upload_relative_path,
    run_action_training_pipeline,
    run_object_training_pipeline,
)
from app.crud import model as model_crud
from app.crud import video_training as crud
from app.config import get_settings
from app.database import get_db
from app.models.models import User
from app.core.auth import require_auth, require_role
from app.schemas.model import TrainingModelActivateResponse
from app.schemas.video_learning import (
    ActionCategoryCreate,
    ActionCategoryResponse,
    ActionSampleFromSessionRequest,
    ActionSampleImportRequest,
    ObjectAnnotationFromSessionRequest,
    ActionSampleSetCreate,
    ActionSampleSetResponse,
    BatchCreateResponse,
    ObjectAnnotationCreate,
    ObjectAnnotationSetCreate,
    ObjectAnnotationSetResponse,
    ObjectCategoryCreate,
    ObjectCategoryResponse,
    ObjectTrainingJobCreate,
    ActionTrainingJobCreate,
    TrainingJobDetailResponse,
    TrainingEvaluationItemResponse,
    TrainingJobResponse,
)

router = APIRouter()
settings = get_settings()


def _utc_now() -> datetime:
    return datetime.now(UTC)


async def _complete_job_with_model(db: AsyncSession, job, model_type: str):
    if model_type == "custom_object":
        execution = await run_object_training_pipeline(db, job)
    else:
        execution = await run_action_training_pipeline(db, job)

    model = await model_crud.create_model(
        db,
        name=job.name,
        version=f"job-{job.id}",
        model_type=model_type,
        description=f"Generated from training job {job.id}",
        model_path=execution.artifact_path,
        file_size=os.path.getsize(execution.artifact_path),
        accuracy=execution.metrics.get("accuracy"),
        precision=execution.metrics.get("precision"),
        recall=execution.metrics.get("recall"),
        map50=execution.metrics.get("map50"),
        map50_95=execution.metrics.get("map50_95"),
        inference_speed=execution.metrics.get("inference_speed"),
        status="ready",
    )
    return await crud.update_training_job(
        db,
        job.id,
        model_id=model.id,
        status="completed",
        progress=100.0,
        metrics_json=execution.metrics,
        log_path=execution.log_path,
        completed_at=_utc_now(),
    )


async def _run_training_job(job_id: int, model_type: str, session_factory: async_sessionmaker[AsyncSession]) -> None:
    async with session_factory() as db:
        job = await crud.get_training_job(db, job_id)
        if not job:
            return

        log_path = os.path.join(settings.upload_dir, "training_logs", f"{'object' if model_type == 'custom_object' else 'action'}_job_{job_id}.log")

        try:
            job = await crud.update_training_job(
                db,
                job_id,
                status="running",
                progress=10.0,
                started_at=_utc_now(),
                error_message="",
            )
            if not job:
                return
            await _complete_job_with_model(db, job, model_type)
        except Exception as exc:
            log_exception(log_path, exc)
            await crud.update_training_job(
                db,
                job_id,
                status="failed",
                log_path=log_path,
                error_message=str(exc),
                completed_at=_utc_now(),
            )


@router.get("/object-categories", response_model=list[ObjectCategoryResponse])
async def list_object_categories(user: User = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    return await crud.list_object_categories(db)


@router.post("/object-categories", response_model=ObjectCategoryResponse, status_code=201)
async def create_object_category(
    payload: ObjectCategoryCreate,
    user: User = Depends(require_role("manager")),
    db: AsyncSession = Depends(get_db),
):
    return await crud.create_object_category(db, **payload.model_dump())


@router.get("/object-annotation-sets", response_model=list[ObjectAnnotationSetResponse])
async def list_object_annotation_sets(user: User = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    return await crud.list_object_annotation_sets(db)


@router.post("/object-annotation-sets", response_model=ObjectAnnotationSetResponse, status_code=201)
async def create_object_annotation_set(
    payload: ObjectAnnotationSetCreate,
    user: User = Depends(require_role("manager")),
    db: AsyncSession = Depends(get_db),
):
    data = payload.model_dump()
    data["created_by"] = user.id
    return await crud.create_object_annotation_set(db, **data)


@router.post("/object-annotation-sets/{set_id}/annotations", response_model=ObjectAnnotationSetResponse)
async def create_object_annotation(
    set_id: int,
    payload: ObjectAnnotationCreate,
    user: User = Depends(require_role("manager")),
    db: AsyncSession = Depends(get_db),
):
    annotation_set = await crud.get_object_annotation_set(db, set_id)
    if not annotation_set:
        raise HTTPException(404, "标注集不存在")
    await crud.create_object_annotation(db, annotation_set_id=set_id, **payload.model_dump())
    updated = await crud.get_object_annotation_set(db, set_id)
    return updated


@router.post("/object-annotation-sets/{set_id}/annotations/from-session", response_model=BatchCreateResponse, status_code=201)
async def import_object_annotations_from_session(
    set_id: int,
    payload: ObjectAnnotationFromSessionRequest,
    user: User = Depends(require_role("manager")),
    db: AsyncSession = Depends(get_db),
):
    annotation_set = await crud.get_object_annotation_set(db, set_id)
    if not annotation_set:
        raise HTTPException(404, "标注集不存在")

    keyframes = await crud.get_session_keyframes_with_detections(db, payload.session_id)
    if not keyframes:
        raise HTTPException(404, "该学习会话没有检测到物体的帧数据")

    annotation_items = []
    for kf in keyframes:
        detections = kf.detections or []
        filtered = [d for d in detections if d.get("confidence", 0) >= payload.min_confidence]
        if not filtered:
            continue
        annotation_items.append({
            "annotation_set_id": set_id,
            "image_path": kf.image_path or "",
            "frame_number": kf.frame_number,
            "source_video_template_id": kf.template_id,
            "width": None,
            "height": None,
            "annotations_json": filtered,
        })

    if not annotation_items:
        raise HTTPException(400, "没有满足置信度要求的检测结果")

    count = await crud.batch_create_object_annotations(db, annotation_items)
    return BatchCreateResponse(created_count=count)


@router.get("/action-categories", response_model=list[ActionCategoryResponse])
async def list_action_categories(user: User = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    return await crud.list_action_categories(db)


@router.post("/action-categories", response_model=ActionCategoryResponse, status_code=201)
async def create_action_category(
    payload: ActionCategoryCreate,
    user: User = Depends(require_role("manager")),
    db: AsyncSession = Depends(get_db),
):
    return await crud.create_action_category(db, **payload.model_dump())


@router.get("/action-sample-sets", response_model=list[ActionSampleSetResponse])
async def list_action_sample_sets(user: User = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    return await crud.list_action_sample_sets(db)


@router.post("/action-sample-sets", response_model=ActionSampleSetResponse, status_code=201)
async def create_action_sample_set(
    payload: ActionSampleSetCreate,
    user: User = Depends(require_role("manager")),
    db: AsyncSession = Depends(get_db),
):
    data = payload.model_dump()
    data["created_by"] = user.id
    return await crud.create_action_sample_set(db, **data)


@router.post("/action-sample-sets/{set_id}/samples/import-json", response_model=BatchCreateResponse, status_code=201)
async def import_action_samples(
    set_id: int,
    payload: ActionSampleImportRequest,
    user: User = Depends(require_role("manager")),
    db: AsyncSession = Depends(get_db),
):
    sample_set = await crud.get_action_sample_set(db, set_id)
    if not sample_set:
        raise HTTPException(404, "动作样本集不存在")
    count = await crud.batch_create_action_samples(
        db,
        [
            {
                "sample_set_id": set_id,
                **sample.model_dump(),
            }
            for sample in payload.samples
        ],
    )
    return BatchCreateResponse(created_count=count)


@router.post("/action-sample-sets/{set_id}/samples/from-session", response_model=BatchCreateResponse, status_code=201)
async def import_action_samples_from_session(
    set_id: int,
    payload: ActionSampleFromSessionRequest,
    user: User = Depends(require_role("manager")),
    db: AsyncSession = Depends(get_db),
):
    sample_set = await crud.get_action_sample_set(db, set_id)
    if not sample_set:
        raise HTTPException(404, "动作样本集不存在")
    if payload.action_category_id is not None:
        category = await crud.get_action_category(db, payload.action_category_id)
        if not category:
            raise HTTPException(404, "动作类别不存在")

    session_actions = await crud.list_session_actions(db, payload.session_id)
    if not session_actions:
        raise HTTPException(404, "学习会话动作段不存在")

    sample_items = []
    for action in session_actions:
        features = action.features or {}
        skeleton_summary = features.get("skeleton_summary") or {}
        frames = skeleton_summary.get("frames") or []
        if not frames:
            continue
        sample_items.append({
            "sample_set_id": set_id,
            "action_category_id": payload.action_category_id,
            "source_session_id": payload.session_id,
            "start_frame": action.start_frame,
            "end_frame": action.end_frame,
            "duration": action.duration,
            "skeleton_sequence_json": {
                "format": skeleton_summary.get("format", "coco17"),
                "frames": frames,
            },
            "metadata_json": {
                "action_name": action.action_name,
                "predicted_action_category": features.get("predicted_action_category"),
                "objects_in_scene": action.objects_in_scene or [],
            },
        })

    count = await crud.batch_create_action_samples(db, sample_items)
    return BatchCreateResponse(created_count=count)


@router.get("/training-jobs", response_model=list[TrainingJobResponse])
async def list_training_jobs(user: User = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    return await crud.list_training_jobs(db)


@router.get("/training-jobs/{job_id}", response_model=TrainingJobDetailResponse)
async def get_training_job_detail(
    job_id: int,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    job = await crud.get_training_job_with_model(db, job_id)
    if not job:
        raise HTTPException(404, "训练任务不存在")

    model = await model_crud.get_model(db, job.model_id) if job.model_id else None
    return build_training_job_detail(job, model=model)


@router.get("/training-jobs/{job_id}/log")
async def get_training_job_log(
    job_id: int,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    job = await crud.get_training_job(db, job_id)
    if not job:
        raise HTTPException(404, "训练任务不存在")
    if not job.log_path:
        raise HTTPException(404, "训练日志不存在")

    try:
        log_path = ensure_safe_upload_file(job.log_path)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    if not log_path or not log_path.exists() or not log_path.is_file():
        raise HTTPException(404, "训练日志不存在")
    return PlainTextResponse(log_path.read_text(encoding="utf-8"))


@router.get("/training-jobs/{job_id}/artifact")
async def download_training_job_artifact(
    job_id: int,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    job = await crud.get_training_job(db, job_id)
    if not job:
        raise HTTPException(404, "训练任务不存在")

    model = await model_crud.get_model(db, job.model_id) if job.model_id else None
    try:
        artifact_path = resolve_training_artifact_path(job, model=model)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    if not artifact_path or not artifact_path.exists() or not artifact_path.is_file():
        raise HTTPException(404, "训练产物不存在")

    return FileResponse(path=artifact_path, filename=artifact_path.name, media_type="application/octet-stream")


@router.get("/models/{model_type}/evaluations", response_model=list[TrainingEvaluationItemResponse])
async def list_training_model_evaluations(
    model_type: str,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    if model_type not in {"custom_object", "custom_action"}:
        raise HTTPException(400, "仅支持自定义训练模型评估")

    models = await model_crud.list_models(db, model_type=model_type, limit=100)
    items = []
    for model in models:
        job = await crud.get_training_job_by_model_id(db, model.id)
        items.append({
            "model": {
                "id": model.id,
                "name": model.name,
                "version": model.version,
                "model_type": model.model_type,
                "accuracy": model.accuracy,
                "precision": model.precision,
                "recall": model.recall,
                "map50": model.map50,
                "map50_95": model.map50_95,
                "inference_speed": model.inference_speed,
                "is_active": model.is_active,
                "status": model.status,
            },
            "job": None if job is None else serialize_training_job(job),
        })
    return items


@router.get("/models/compare/{id_a}/{id_b}")
async def compare_training_models(
    id_a: int,
    id_b: int,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    model_a = await model_crud.get_model(db, id_a)
    model_b = await model_crud.get_model(db, id_b)
    if not model_a or not model_b:
        raise HTTPException(404, "模型不存在")

    job_a = await crud.get_training_job_by_model_id(db, id_a)
    job_b = await crud.get_training_job_by_model_id(db, id_b)

    metrics_a = job_a.metrics_json if job_a else {}
    metrics_b = job_b.metrics_json if job_b else {}
    metrics_a = sanitize_metrics_paths(metrics_a)
    metrics_b = sanitize_metrics_paths(metrics_b)
    dataset_a = metrics_a.get("dataset_export", {})
    dataset_b = metrics_b.get("dataset_export", {})
    class_metrics_a = metrics_a.get("class_metrics", {})
    class_metrics_b = metrics_b.get("class_metrics", {})

    class_metrics_diff = {}
    for class_name in sorted(set(class_metrics_a.keys()) | set(class_metrics_b.keys())):
        class_metrics_diff[class_name] = {
            "precision_diff": round(float((class_metrics_a.get(class_name) or {}).get("precision", 0.0)) - float((class_metrics_b.get(class_name) or {}).get("precision", 0.0)), 4),
            "recall_diff": round(float((class_metrics_a.get(class_name) or {}).get("recall", 0.0)) - float((class_metrics_b.get(class_name) or {}).get("recall", 0.0)), 4),
            "sample_count_diff": int((class_metrics_a.get(class_name) or {}).get("sample_count", 0)) - int((class_metrics_b.get(class_name) or {}).get("sample_count", 0)),
        }

    return {
        "model_a": {
            "id": model_a.id,
            "name": model_a.name,
            "model_type": model_a.model_type,
            "accuracy": model_a.accuracy,
            "precision": model_a.precision,
            "recall": model_a.recall,
            "map50": model_a.map50,
            "map50_95": model_a.map50_95,
            "inference_speed": model_a.inference_speed,
        },
        "model_b": {
            "id": model_b.id,
            "name": model_b.name,
            "model_type": model_b.model_type,
            "accuracy": model_b.accuracy,
            "precision": model_b.precision,
            "recall": model_b.recall,
            "map50": model_b.map50,
            "map50_95": model_b.map50_95,
            "inference_speed": model_b.inference_speed,
        },
        "job_a": {
            "id": job_a.id,
            "name": job_a.name,
            "log_path": to_upload_relative_path(job_a.log_path),
            "metrics_json": metrics_a,
        } if job_a else None,
        "job_b": {
            "id": job_b.id,
            "name": job_b.name,
            "log_path": to_upload_relative_path(job_b.log_path),
            "metrics_json": metrics_b,
        } if job_b else None,
        "dataset_diff": {
            "annotation_count_diff": int(dataset_a.get("annotation_count", 0)) - int(dataset_b.get("annotation_count", 0)),
            "class_count_diff": len(dataset_a.get("class_names", [])) - len(dataset_b.get("class_names", [])),
        },
        "class_metrics_diff": class_metrics_diff,
    }


@router.post("/training-jobs/object-detection", response_model=TrainingJobResponse, status_code=201)
async def create_object_training_job(
    payload: ObjectTrainingJobCreate,
    background_tasks: BackgroundTasks,
    user: User = Depends(require_role("manager")),
    db: AsyncSession = Depends(get_db),
):
    dataset = await crud.get_object_annotation_set(db, payload.dataset_id)
    if not dataset:
        raise HTTPException(404, "物体标注集不存在")
    job = await crud.create_training_job(
        db,
        name=payload.name,
        job_type="object_detection",
        dataset_type="object_annotation_set",
        dataset_id=payload.dataset_id,
        status="pending",
        progress=0.0,
        config_json=payload.model_dump(exclude={"name", "dataset_id"}),
    )
    session_factory = async_sessionmaker(db.bind, class_=AsyncSession, expire_on_commit=False)
    background_tasks.add_task(_run_training_job, job.id, "custom_object", session_factory)
    return job


@router.post("/training-jobs/action-recognition", response_model=TrainingJobResponse, status_code=201)
async def create_action_training_job(
    payload: ActionTrainingJobCreate,
    background_tasks: BackgroundTasks,
    user: User = Depends(require_role("manager")),
    db: AsyncSession = Depends(get_db),
):
    dataset = await crud.get_action_sample_set(db, payload.dataset_id)
    if not dataset:
        raise HTTPException(404, "动作样本集不存在")
    job = await crud.create_training_job(
        db,
        name=payload.name,
        job_type="action_recognition",
        dataset_type="action_sample_set",
        dataset_id=payload.dataset_id,
        status="pending",
        progress=0.0,
        config_json=payload.model_dump(exclude={"name", "dataset_id"}),
    )
    session_factory = async_sessionmaker(db.bind, class_=AsyncSession, expire_on_commit=False)
    background_tasks.add_task(_run_training_job, job.id, "custom_action", session_factory)
    return job


@router.post("/training-jobs/{job_id}/activate-model", response_model=TrainingModelActivateResponse)
async def activate_training_job_model(
    job_id: int,
    user: User = Depends(require_role("manager")),
    db: AsyncSession = Depends(get_db),
):
    job = await crud.get_training_job(db, job_id)
    if not job or not job.model_id:
        raise HTTPException(404, "训练模型不存在")
    model = await model_crud.deploy_model(db, job.model_id)
    if not model:
        raise HTTPException(404, "模型不存在")
    return TrainingModelActivateResponse(
        job_id=job.id,
        model_id=model.id,
        model_type=model.model_type or "",
        status=model.status or "",
    )

"""视频训练 API"""

import os
from datetime import UTC, datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.video_training import (
    build_action_sample_summary,
    create_action_training_artifact,
    create_object_training_artifact,
    export_object_dataset,
)
from app.crud import model as model_crud
from app.crud import video_training as crud
from app.database import get_db
from app.models.models import User
from app.core.auth import require_auth, require_role
from app.schemas.model import TrainingModelActivateResponse
from app.schemas.video_learning import (
    ActionCategoryCreate,
    ActionCategoryResponse,
    ActionSampleFromSessionRequest,
    ActionSampleImportRequest,
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
    TrainingJobResponse,
)

router = APIRouter()


def _utc_now() -> datetime:
    return datetime.now(UTC)


async def _complete_job_with_model(db: AsyncSession, job, model_type: str):
    if model_type == "custom_object":
        dataset_export = await export_object_dataset(db, job.dataset_id, job.id)
        artifact_path, metrics = create_object_training_artifact(job.id, job.name, dataset_export=dataset_export)
    else:
        artifact_path, metrics = create_action_training_artifact(job.id, job.name)
        metrics.update(await build_action_sample_summary(db, job.dataset_id))

    model = await model_crud.create_model(
        db,
        name=job.name,
        version=f"job-{job.id}",
        model_type=model_type,
        description=f"Generated from training job {job.id}",
        model_path=artifact_path,
        file_size=os.path.getsize(artifact_path),
        accuracy=metrics.get("accuracy"),
        precision=metrics.get("precision"),
        recall=metrics.get("recall"),
        map50=metrics.get("map50"),
        map50_95=metrics.get("map50_95"),
        inference_speed=metrics.get("inference_speed"),
        status="ready",
    )
    return await crud.update_training_job(
        db,
        job.id,
        model_id=model.id,
        status="completed",
        progress=100.0,
        metrics_json=metrics,
        completed_at=_utc_now(),
    )


async def _run_training_job(job_id: int, model_type: str, session_factory: async_sessionmaker[AsyncSession]) -> None:
    async with session_factory() as db:
        job = await crud.get_training_job(db, job_id)
        if not job:
            return

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
            await crud.update_training_job(
                db,
                job_id,
                status="failed",
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

"""视频训练 API 测试"""

import json
import subprocess
import sys
import asyncio
import types
from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.video_training import create_action_training_artifact, create_object_training_artifact, run_object_training_pipeline
from app.models.models import ActionSequence, LearningSession, Model, VideoTemplate


@pytest.mark.asyncio
async def test_list_object_categories_empty(client: AsyncClient, admin_token: str):
    resp = await client.get(
        "/api/video-training/object-categories",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_create_object_category(client: AsyncClient, manager_token: str):
    resp = await client.post(
        "/api/video-training/object-categories",
        json={
            "name": "book",
            "display_name": "书本",
            "description": "训练识别书本",
            "color": "#1677ff",
        },
        headers={"Authorization": f"Bearer {manager_token}"},
    )

    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "book"
    assert data["display_name"] == "书本"


@pytest.mark.asyncio
async def test_create_action_sample_set_and_import_skeleton_json(client: AsyncClient, manager_token: str):
    create_set = await client.post(
        "/api/video-training/action-sample-sets",
        json={
            "name": "阅读动作样本",
            "description": "骨骼动作训练集",
            "source_type": "pose_json",
        },
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert create_set.status_code == 201
    sample_set_id = create_set.json()["id"]

    create_category = await client.post(
        "/api/video-training/action-categories",
        json={
            "name": "read_book",
            "display_name": "阅读书本",
            "description": "拿起并阅读书本",
        },
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert create_category.status_code == 201
    category_id = create_category.json()["id"]

    resp = await client.post(
        f"/api/video-training/action-sample-sets/{sample_set_id}/samples/import-json",
        json={
            "samples": [
                {
                    "action_category_id": category_id,
                    "start_frame": 10,
                    "end_frame": 20,
                    "duration": 1.0,
                    "skeleton_sequence_json": {
                        "format": "coco17",
                        "frames": [
                            {
                                "frame_number": 10,
                                "timestamp": 0.4,
                                "keypoints": [[10, 20, 0.9], [30, 40, 0.8]],
                            }
                        ],
                    },
                }
            ]
        },
        headers={"Authorization": f"Bearer {manager_token}"},
    )

    assert resp.status_code == 201
    data = resp.json()
    assert data["created_count"] == 1


@pytest.mark.asyncio
async def test_create_object_and_action_training_jobs(client: AsyncClient, manager_token: str):
    object_set = await client.post(
        "/api/video-training/object-annotation-sets",
        json={
            "name": "书本标注集",
            "description": "图片标注集",
            "source_type": "image_upload",
        },
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert object_set.status_code == 201
    object_set_id = object_set.json()["id"]

    action_set = await client.post(
        "/api/video-training/action-sample-sets",
        json={
            "name": "动作样本集",
            "description": "动作训练",
            "source_type": "pose_json",
        },
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert action_set.status_code == 201
    action_set_id = action_set.json()["id"]

    object_job = await client.post(
        "/api/video-training/training-jobs/object-detection",
        json={
            "name": "书本检测训练",
            "dataset_id": object_set_id,
            "epochs": 5,
            "image_size": 640,
        },
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert object_job.status_code == 201
    assert object_job.json()["job_type"] == "object_detection"

    action_job = await client.post(
        "/api/video-training/training-jobs/action-recognition",
        json={
            "name": "阅读动作训练",
            "dataset_id": action_set_id,
            "sequence_length": 32,
        },
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert action_job.status_code == 201
    assert action_job.json()["job_type"] == "action_recognition"


@pytest.mark.asyncio
async def test_create_training_job_runs_in_background_and_updates_status(
    client: AsyncClient,
    manager_token: str,
):
    object_set = await client.post(
        "/api/video-training/object-annotation-sets",
        json={
            "name": "异步书本标注集",
            "description": "异步任务测试",
            "source_type": "image_upload",
        },
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert object_set.status_code == 201

    create_job = await client.post(
        "/api/video-training/training-jobs/object-detection",
        json={
            "name": "异步书本检测训练",
            "dataset_id": object_set.json()["id"],
            "epochs": 5,
            "image_size": 640,
        },
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert create_job.status_code == 201

    created_job = create_job.json()
    assert created_job["status"] == "pending"
    assert created_job["progress"] == 0.0
    assert created_job["model_id"] is None
    assert created_job["started_at"] is None
    assert created_job["completed_at"] is None

    completed_job = None
    for _ in range(20):
        await asyncio.sleep(0.05)
        jobs_resp = await client.get(
            "/api/video-training/training-jobs",
            headers={"Authorization": f"Bearer {manager_token}"},
        )
        assert jobs_resp.status_code == 200
        jobs = jobs_resp.json()
        completed_job = next(job for job in jobs if job["id"] == created_job["id"])
        if completed_job["status"] == "completed":
            break

    assert completed_job is not None
    assert completed_job["status"] == "completed"
    assert completed_job["progress"] == 100.0
    assert completed_job["model_id"] is not None
    assert completed_job["started_at"] is not None
    assert completed_job["completed_at"] is not None


@pytest.mark.asyncio
async def test_object_training_job_exports_dataset_and_metrics(
    client: AsyncClient,
    manager_token: str,
):
    create_category = await client.post(
        "/api/video-training/object-categories",
        json={
            "name": "book_dataset",
            "display_name": "书本数据集类别",
            "description": "用于导出测试",
            "color": "#1677ff",
        },
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert create_category.status_code == 201
    category_id = create_category.json()["id"]

    object_set = await client.post(
        "/api/video-training/object-annotation-sets",
        json={
            "name": "书本导出标注集",
            "description": "导出目录测试",
            "source_type": "image_upload",
        },
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert object_set.status_code == 201
    set_id = object_set.json()["id"]

    add_annotation = await client.post(
        f"/api/video-training/object-annotation-sets/{set_id}/annotations",
        json={
            "image_path": "/uploads/mock/book-1.jpg",
            "width": 640,
            "height": 480,
            "annotations_json": [
                {
                    "category_id": category_id,
                    "bbox": [64, 48, 320, 240],
                }
            ],
        },
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert add_annotation.status_code == 200

    create_job = await client.post(
        "/api/video-training/training-jobs/object-detection",
        json={
            "name": "书本数据集导出训练",
            "dataset_id": set_id,
            "epochs": 3,
            "image_size": 640,
        },
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert create_job.status_code == 201
    job_id = create_job.json()["id"]

    completed_job = None
    for _ in range(20):
        await asyncio.sleep(0.05)
        jobs_resp = await client.get(
            "/api/video-training/training-jobs",
            headers={"Authorization": f"Bearer {manager_token}"},
        )
        assert jobs_resp.status_code == 200
        jobs = jobs_resp.json()
        completed_job = next(job for job in jobs if job["id"] == job_id)
        if completed_job["status"] == "completed":
            break

    assert completed_job is not None
    assert completed_job["status"] == "completed"
    metrics = completed_job["metrics_json"]
    assert metrics["dataset_export"]["annotation_count"] == 1
    assert metrics["dataset_export"]["class_names"] == ["book_dataset"]
    assert metrics["dataset_export"]["export_dir"].endswith(f"object_job_{job_id}")
    assert metrics["dataset_export"]["data_yaml_path"].endswith("data.yaml")
    assert metrics["dataset_export"]["label_files"] == 1
    assert metrics["dataset_export"]["image_entries"] == 1
    assert completed_job["log_path"]
    assert completed_job["log_path"].endswith(f"object_job_{job_id}.log")
    assert metrics["training_summary"]["artifact_path"].endswith("best.pt")
    assert metrics["training_summary"]["epochs"] == 3


@pytest.mark.asyncio
async def test_import_action_samples_from_learning_session_and_action_metrics(
    client: AsyncClient,
    db_session: AsyncSession,
    manager_token: str,
):
    template = VideoTemplate(
        name="动作提取模板",
        description="动作样本提取",
        video_path="/tmp/action-session.mp4",
        business_type="assembly",
        status="completed",
    )
    db_session.add(template)
    await db_session.flush()

    session = LearningSession(
        template_id=template.id,
        status="completed",
        progress=100.0,
    )
    db_session.add(session)
    await db_session.flush()

    db_session.add(
        ActionSequence(
            session_id=session.id,
            template_id=template.id,
            step_order=1,
            action_name="read_book",
            description="拿起书本阅读",
            start_frame=10,
            end_frame=20,
            start_time=1.0,
            end_time=2.0,
            duration=1.0,
            confidence=0.9,
            objects_in_scene=["book", "hand"],
            features={
                "predicted_action_category": "read_book",
                "skeleton_summary": {
                    "format": "coco17",
                    "frames": [
                        {
                            "frame_number": 10,
                            "timestamp": 1.0,
                            "keypoints": [[10, 20, 0.9], [30, 40, 0.8]],
                        }
                    ],
                },
            },
        )
    )
    await db_session.commit()

    category_resp = await client.post(
        "/api/video-training/action-categories",
        json={
            "name": "read_book",
            "display_name": "阅读书本",
            "description": "从会话导入",
        },
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert category_resp.status_code == 201
    category_id = category_resp.json()["id"]

    sample_set_resp = await client.post(
        "/api/video-training/action-sample-sets",
        json={
            "name": "会话提取动作样本",
            "description": "从学习会话生成",
            "source_type": "video_pose_extract",
        },
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert sample_set_resp.status_code == 201
    sample_set_id = sample_set_resp.json()["id"]

    import_resp = await client.post(
        f"/api/video-training/action-sample-sets/{sample_set_id}/samples/from-session",
        json={
            "session_id": session.id,
            "action_category_id": category_id,
        },
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert import_resp.status_code == 201
    assert import_resp.json()["created_count"] == 1

    create_job = await client.post(
        "/api/video-training/training-jobs/action-recognition",
        json={
            "name": "会话动作训练",
            "dataset_id": sample_set_id,
            "sequence_length": 32,
        },
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert create_job.status_code == 201
    job_id = create_job.json()["id"]

    completed_job = None
    for _ in range(20):
        await asyncio.sleep(0.05)
        jobs_resp = await client.get(
            "/api/video-training/training-jobs",
            headers={"Authorization": f"Bearer {manager_token}"},
        )
        assert jobs_resp.status_code == 200
        jobs = jobs_resp.json()
        completed_job = next(job for job in jobs if job["id"] == job_id)
        if completed_job["status"] == "completed":
            break

    assert completed_job is not None
    assert completed_job["status"] == "completed"
    metrics = completed_job["metrics_json"]
    assert metrics["sample_summary"]["sample_count"] == 1
    assert metrics["sample_summary"]["class_names"] == ["read_book"]
    assert metrics["prototype_summary"]["prototype_count"] == 1
    assert metrics["prototype_summary"]["sequence_count"] == 1
    assert completed_job["log_path"]
    assert completed_job["log_path"].endswith(f"action_job_{job_id}.log")
    assert metrics["class_metrics"]["read_book"]["sample_count"] == 1
    assert metrics["class_metrics"]["read_book"]["feature_dimension"] > 0


@pytest.mark.asyncio
async def test_activate_training_job_model_after_object_training(
    client: AsyncClient,
    manager_token: str,
):
    object_set = await client.post(
        "/api/video-training/object-annotation-sets",
        json={
            "name": "电视标注集",
            "description": "电视训练样本",
            "source_type": "image_upload",
        },
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert object_set.status_code == 201

    create_job = await client.post(
        "/api/video-training/training-jobs/object-detection",
        json={
            "name": "电视检测训练",
            "dataset_id": object_set.json()["id"],
            "epochs": 3,
            "image_size": 640,
        },
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert create_job.status_code == 201

    activate = await client.post(
        f"/api/video-training/training-jobs/{create_job.json()['id']}/activate-model",
        headers={"Authorization": f"Bearer {manager_token}"},
    )

    assert activate.status_code == 200
    data = activate.json()
    assert data["job_id"] == create_job.json()["id"]
    assert data["model_type"] == "custom_object"
    assert data["status"] == "deployed"


def test_training_artifacts_use_timezone_aware_utc_timestamps(tmp_path, monkeypatch):
    monkeypatch.setattr("app.core.video_training.settings.upload_dir", str(tmp_path))

    object_path, _ = create_object_training_artifact(1, "book-detector")
    action_path, _ = create_action_training_artifact(2, "read-book")

    object_payload = open(object_path, "rb").read().decode("utf-8")
    object_timestamp = object_payload.removeprefix("object-model:book-detector:")
    assert datetime.fromisoformat(object_timestamp).tzinfo == UTC

    action_payload = json.loads(open(action_path, "r", encoding="utf-8").read())
    assert datetime.fromisoformat(action_payload["created_at"]).tzinfo == UTC


def test_model_api_import_has_no_model_namespace_warning():
    command = [
        sys.executable,
        "-W",
        "error",
        "-c",
        "import app.api.models",
    ]

    completed = subprocess.run(
        command,
        cwd="/Users/wyh/Documents/MyOpenCode/YoloCheck/backend",
        capture_output=True,
        text=True,
    )

    assert completed.returncode == 0, completed.stderr or completed.stdout


@pytest.mark.asyncio
async def test_compare_custom_training_models_returns_richer_metrics(
    client: AsyncClient,
    db_session: AsyncSession,
    admin_token: str,
):
    object_model_a = Model(
        name="custom-object-a",
        version="job-1",
        model_type="custom_object",
        model_path="/tmp/object-a/best.pt",
        file_size=123,
        accuracy=0.91,
        precision=0.87,
        recall=0.86,
        map50=0.89,
        map50_95=0.71,
        inference_speed=11.2,
        status="ready",
    )
    object_model_b = Model(
        name="custom-object-b",
        version="job-2",
        model_type="custom_object",
        model_path="/tmp/object-b/best.pt",
        file_size=125,
        accuracy=0.88,
        precision=0.83,
        recall=0.81,
        map50=0.84,
        map50_95=0.69,
        inference_speed=10.5,
        status="ready",
    )
    db_session.add_all([object_model_a, object_model_b])
    await db_session.flush()

    from app.models.models import TrainingJob

    db_session.add_all([
        TrainingJob(
            name="对象模型A训练",
            job_type="object_detection",
            dataset_type="object_annotation_set",
            dataset_id=1,
            model_id=object_model_a.id,
            status="completed",
            progress=100.0,
            log_path="/tmp/object-a.log",
            metrics_json={
                "dataset_export": {
                    "annotation_count": 12,
                    "class_names": ["book", "hand"],
                },
                "class_metrics": {
                    "book": {"precision": 0.9, "recall": 0.88},
                    "hand": {"precision": 0.82, "recall": 0.8},
                },
            },
        ),
        TrainingJob(
            name="对象模型B训练",
            job_type="object_detection",
            dataset_type="object_annotation_set",
            dataset_id=2,
            model_id=object_model_b.id,
            status="completed",
            progress=100.0,
            log_path="/tmp/object-b.log",
            metrics_json={
                "dataset_export": {
                    "annotation_count": 8,
                    "class_names": ["book"],
                },
                "class_metrics": {
                    "book": {"precision": 0.84, "recall": 0.81},
                },
            },
        ),
    ])
    await db_session.commit()

    compare_resp = await client.get(
        f"/api/video-training/models/compare/{object_model_a.id}/{object_model_b.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert compare_resp.status_code == 200
    data = compare_resp.json()
    assert data["model_a"]["id"] == object_model_a.id
    assert data["model_b"]["id"] == object_model_b.id
    assert data["job_a"]["log_path"] is None
    assert data["job_b"]["metrics_json"]["dataset_export"]["annotation_count"] == 8
    assert data["dataset_diff"]["annotation_count_diff"] == 4
    assert data["class_metrics_diff"]["book"]["precision_diff"] == pytest.approx(0.06)


@pytest.mark.asyncio
async def test_get_training_job_detail_returns_runtime_log_and_artifact_summary(
    client: AsyncClient,
    db_session: AsyncSession,
    admin_token: str,
    tmp_path,
    monkeypatch,
):
    monkeypatch.setattr("app.core.video_training.settings.upload_dir", str(tmp_path))

    log_dir = tmp_path / "training_logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    log_path = log_dir / "object_job_301.log"
    log_path.write_text("line1\nline2\nline3\n", encoding="utf-8")

    artifact_dir = tmp_path / "training_runs" / "object_job_301" / "weights"
    artifact_dir.mkdir(parents=True, exist_ok=True)
    artifact_path = artifact_dir / "best.pt"
    artifact_path.write_bytes(b"fake-model")

    model = Model(
        name="observable-object-model",
        version="job-301",
        model_type="custom_object",
        model_path=str(artifact_path),
        file_size=artifact_path.stat().st_size,
        accuracy=0.91,
        precision=0.87,
        recall=0.85,
        map50=0.9,
        map50_95=0.74,
        inference_speed=12.4,
        status="ready",
    )
    db_session.add(model)
    await db_session.flush()

    from app.models.models import TrainingJob

    db_session.add(
        TrainingJob(
            name="可观测对象训练",
            job_type="object_detection",
            dataset_type="object_annotation_set",
            dataset_id=11,
            model_id=model.id,
            status="completed",
            progress=100.0,
            config_json={"epochs": 3, "image_size": 640},
            metrics_json={
                "accuracy": 0.91,
                "precision": 0.87,
                "recall": 0.85,
                "dataset_export": {
                    "annotation_count": 12,
                    "class_names": ["book", "hand"],
                },
                "training_summary": {
                    "artifact_path": str(artifact_path),
                    "epochs": 3,
                    "image_size": 640,
                },
            },
            log_path=str(log_path),
            started_at=datetime(2026, 4, 2, 3, 0, tzinfo=UTC),
            completed_at=datetime(2026, 4, 2, 3, 5, tzinfo=UTC),
        )
    )
    await db_session.commit()

    job = (await db_session.execute(select(TrainingJob).where(TrainingJob.name == "可观测对象训练"))).scalar_one()

    detail_resp = await client.get(
        f"/api/video-training/training-jobs/{job.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert detail_resp.status_code == 200
    data = detail_resp.json()
    assert data["job"]["name"] == "可观测对象训练"
    assert data["job"]["log_path"] == "training_logs/object_job_301.log"
    assert data["job"]["metrics_json"]["training_summary"]["artifact_path"] == "training_runs/object_job_301/weights/best.pt"
    assert data["runtime_summary"]["epochs"] == 3
    assert data["artifact_summary"]["file_name"] == "best.pt"
    assert data["artifact_summary"]["exists"] is True
    assert data["artifact_summary"]["file_path"] == "training_runs/object_job_301/weights/best.pt"
    assert data["log_summary"]["exists"] is True
    assert data["log_summary"]["file_path"] == "training_logs/object_job_301.log"
    assert data["log_summary"]["tail_lines"][-1].endswith("line3")
    assert data["status_timeline"][0]["status"] == "created"
    assert data["status_timeline"][-1]["status"] == "completed"


@pytest.mark.asyncio
async def test_object_training_pipeline_raises_when_real_training_fails(
    db_session: AsyncSession,
    tmp_path,
    monkeypatch,
):
    monkeypatch.setattr("app.core.video_training.settings.upload_dir", str(tmp_path))
    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)

    from app.models.models import ObjectAnnotation, ObjectAnnotationSet, ObjectCategory

    category = ObjectCategory(name="book_failure", display_name="书本失败类别")
    db_session.add(category)
    await db_session.flush()

    annotation_set = ObjectAnnotationSet(name="失败训练标注集", source_type="image_upload")
    db_session.add(annotation_set)
    await db_session.flush()

    db_session.add(
        ObjectAnnotation(
            annotation_set_id=annotation_set.id,
            image_path="/tmp/not-exist.jpg",
            width=640,
            height=480,
            annotations_json=[{"category_id": category.id, "bbox": [10, 10, 100, 100]}],
        )
    )
    await db_session.commit()

    class FakeYOLO:
        def __init__(self, *_args, **_kwargs):
            pass

        def train(self, **_kwargs):
            raise RuntimeError("yolo train boom")

    monkeypatch.setitem(sys.modules, "ultralytics", types.SimpleNamespace(YOLO=FakeYOLO))

    job = types.SimpleNamespace(
        id=999,
        dataset_id=annotation_set.id,
        name="失败对象训练",
        config_json={"epochs": 2, "image_size": 640},
    )

    with pytest.raises(RuntimeError, match="yolo train boom"):
        await run_object_training_pipeline(db_session, job)


@pytest.mark.asyncio
async def test_get_training_job_log_returns_plain_text(
    client: AsyncClient,
    db_session: AsyncSession,
    admin_token: str,
    tmp_path,
    monkeypatch,
):
    monkeypatch.setattr("app.core.video_training.settings.upload_dir", str(tmp_path))

    log_dir = tmp_path / "training_logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    log_path = log_dir / "action_job_401.log"
    log_path.write_text("alpha\nbeta\n", encoding="utf-8")

    from app.models.models import TrainingJob

    db_session.add(
        TrainingJob(
            name="动作日志训练",
            job_type="action_recognition",
            dataset_type="action_sample_set",
            dataset_id=4,
            status="failed",
            progress=45.0,
            log_path=str(log_path),
        )
    )
    await db_session.commit()

    job = (await db_session.execute(select(TrainingJob).where(TrainingJob.name == "动作日志训练"))).scalar_one()

    log_resp = await client.get(
        f"/api/video-training/training-jobs/{job.id}/log",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert log_resp.status_code == 200
    assert "text/plain" in log_resp.headers["content-type"]
    assert "alpha" in log_resp.text
    assert "beta" in log_resp.text


@pytest.mark.asyncio
async def test_download_training_job_artifact_returns_attachment(
    client: AsyncClient,
    db_session: AsyncSession,
    admin_token: str,
    tmp_path,
    monkeypatch,
):
    monkeypatch.setattr("app.core.video_training.settings.upload_dir", str(tmp_path))

    artifact_dir = tmp_path / "trained_models"
    artifact_dir.mkdir(parents=True, exist_ok=True)
    artifact_path = artifact_dir / "action_job_501.json"
    artifact_path.write_text('{"ok": true}', encoding="utf-8")

    model = Model(
        name="action-download-model",
        version="job-501",
        model_type="custom_action",
        model_path=str(artifact_path),
        file_size=artifact_path.stat().st_size,
        status="ready",
    )
    db_session.add(model)
    await db_session.flush()

    from app.models.models import TrainingJob

    db_session.add(
        TrainingJob(
            name="动作下载训练",
            job_type="action_recognition",
            dataset_type="action_sample_set",
            dataset_id=5,
            model_id=model.id,
            status="completed",
            progress=100.0,
            metrics_json={
                "training_summary": {
                    "artifact_path": str(artifact_path),
                }
            },
        )
    )
    await db_session.commit()

    job = (await db_session.execute(select(TrainingJob).where(TrainingJob.name == "动作下载训练"))).scalar_one()

    download_resp = await client.get(
        f"/api/video-training/training-jobs/{job.id}/artifact",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert download_resp.status_code == 200
    assert "attachment" in download_resp.headers["content-disposition"]
    assert "action_job_501.json" in download_resp.headers["content-disposition"]
    assert download_resp.text == '{"ok": true}'


@pytest.mark.asyncio
async def test_training_job_list_response_includes_model_activation_info(
    client: AsyncClient,
    db_session: AsyncSession,
    admin_token: str,
):
    from app.models.models import ObjectAnnotationSet
    from app.crud.video_training import create_training_job

    obj_set = ObjectAnnotationSet(
        name="Metrics Test Set",
        description="test",
        source_type="video_frame",
        status="ready",
        created_by=1,
    )
    db_session.add(obj_set)
    await db_session.flush()

    await create_training_job(
        db=db_session,
        name="Metrics Test Job",
        job_type="object_detection",
        dataset_id=obj_set.id,
        dataset_type="object_annotation_set",
        config_json={"epochs": 5, "image_size": 640},
    )

    resp = await client.get("/api/video-training/training-jobs", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    data = resp.json()
    job_data = next((j for j in data if j.get("name") == "Metrics Test Job"), None)
    assert job_data is not None
    assert "status" in job_data
    assert "progress" in job_data


@pytest.mark.asyncio
async def test_training_job_detail_includes_enriched_runtime_summary(
    client: AsyncClient,
    db_session: AsyncSession,
    admin_token: str,
):
    from app.models.models import ObjectAnnotationSet
    from app.crud.video_training import create_training_job

    obj_set = ObjectAnnotationSet(
        name="Runtime Summary Test Set",
        description="test",
        source_type="video_frame",
        status="ready",
        created_by=1,
    )
    db_session.add(obj_set)
    await db_session.flush()

    job = await create_training_job(
        db=db_session,
        name="Runtime Summary Test Job",
        job_type="object_detection",
        dataset_id=obj_set.id,
        dataset_type="object_annotation_set",
        config_json={"epochs": 10, "image_size": 640},
    )

    resp = await client.get(f"/api/video-training/training-jobs/{job.id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "runtime_summary" in data
    rs = data["runtime_summary"]
    assert "epochs" in rs
    assert "image_size" in rs


@pytest.mark.asyncio
async def test_training_job_detail_includes_dataset_summary_with_class_distribution(
    client: AsyncClient,
    db_session: AsyncSession,
    admin_token: str,
):
    from app.models.models import ObjectAnnotationSet
    from app.crud.video_training import create_training_job

    obj_set = ObjectAnnotationSet(
        name="Class Dist Test Set",
        description="test",
        source_type="video_frame",
        status="ready",
        created_by=1,
    )
    db_session.add(obj_set)
    await db_session.flush()

    job = await create_training_job(
        db=db_session,
        name="Class Dist Test Job",
        job_type="object_detection",
        dataset_id=obj_set.id,
        dataset_type="object_annotation_set",
        config_json={"epochs": 3, "image_size": 416},
    )

    resp = await client.get(f"/api/video-training/training-jobs/{job.id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "dataset_summary" in data
    assert "dataset_export" in data["dataset_summary"]

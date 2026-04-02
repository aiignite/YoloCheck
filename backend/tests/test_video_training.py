"""视频训练 API 测试"""

import json
import subprocess
import sys
import asyncio
from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.video_training import create_action_training_artifact, create_object_training_artifact
from app.models.models import ActionSequence, LearningSession, VideoTemplate


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

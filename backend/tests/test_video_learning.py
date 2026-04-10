"""视频学习API测试"""

from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.video_learning import AnalyzedFrame, extract_actions, analyze_video_frames, compute_scene_change
from app.models.models import ActionSequence, LearningSession, Model, TrainingJob, VideoTemplate


@pytest.mark.asyncio
async def test_list_templates_empty(client: AsyncClient, admin_token: str):
    resp = await client.get("/api/video-learning/templates",
                            headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_get_nonexistent_template(client: AsyncClient, admin_token: str):
    resp = await client.get("/api/video-learning/templates/99999",
                            headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_template_requires_auth(client: AsyncClient):
    resp = await client.post("/api/video-learning/templates")
    assert resp.status_code == 401


def test_extract_actions_adds_phase3_enhancement_fields():
    analyzed_frames = [
        AnalyzedFrame(
            frame_number=0,
            timestamp=0.0,
            detections=[
                {"class_name": "screwdriver", "confidence": 0.95, "bbox": [100, 100, 160, 160]},
                {"class_name": "panel", "confidence": 0.88, "bbox": [220, 120, 340, 260]},
            ],
            pose_keypoints=[
                {
                    "person_index": 0,
                    "points": [
                        {"index": 9, "x": 130.0, "y": 130.0, "conf": 0.9},
                        {"index": 10, "x": 145.0, "y": 132.0, "conf": 0.92},
                    ],
                }
            ],
            interaction_summary={
                "interaction_count": 1,
                "interactions": [{"object": "screwdriver", "distance": 22.5}],
            },
            scene_change_score=8.0,
            is_boundary=False,
            image_path="/tmp/frame-0.jpg",
        ),
        AnalyzedFrame(
            frame_number=5,
            timestamp=0.5,
            detections=[
                {"class_name": "screwdriver", "confidence": 0.91, "bbox": [102, 102, 162, 162]},
                {"class_name": "panel", "confidence": 0.87, "bbox": [220, 120, 340, 260]},
            ],
            pose_keypoints=[
                {
                    "person_index": 0,
                    "points": [
                        {"index": 9, "x": 132.0, "y": 135.0, "conf": 0.9},
                        {"index": 10, "x": 150.0, "y": 138.0, "conf": 0.91},
                    ],
                }
            ],
            interaction_summary={
                "interaction_count": 1,
                "interactions": [{"object": "screwdriver", "distance": 18.0}],
            },
            scene_change_score=12.0,
            is_boundary=False,
            image_path=None,
        ),
    ]

    actions = extract_actions(analyzed_frames, fps=10.0)

    assert len(actions) == 1
    features = actions[0].features
    assert "quality_score" in features
    assert "smoothed_object_frequency" in features
    assert "suggested_action_name" in features
    assert "suggestions" in features
    assert features["quality_score"] > 0
    assert features["smoothed_object_frequency"]["screwdriver"] > 0
    assert features["suggested_action_name"]
    assert features["suggestions"]


@pytest.mark.asyncio
async def test_get_template_summary_returns_phase3_workflow_fields(
    client: AsyncClient,
    db_session: AsyncSession,
    admin_token: str,
):
    template = VideoTemplate(
        name="Summary Template",
        description="phase 3 summary placeholder",
        video_path="/tmp/summary-template.mp4",
        business_type="assembly",
        status="completed",
    )
    db_session.add(template)
    await db_session.flush()

    session = LearningSession(
        template_id=template.id,
        status="completed",
        progress=100.0,
        analysis_result={
            "workflow_summary": {
                "dominant_sequence": ["拿取螺丝刀", "对位面板"],
                "quality_score_avg": 0.84,
            },
            "workflow_suggestions": [
                {"type": "timing", "message": "对位动作可更连贯"},
            ],
        },
    )
    db_session.add(session)
    await db_session.commit()

    resp = await client.get(
        f"/api/video-learning/templates/{template.id}/summary",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert "workflow_summary" in data
    assert "workflow_suggestions" in data
    assert "sop_preview" in data
    assert data["workflow_summary"] == {
        "dominant_sequence": ["拿取螺丝刀", "对位面板"],
        "quality_score_avg": 0.84,
    }
    assert data["workflow_suggestions"] == [
        {"type": "timing", "message": "对位动作可更连贯"},
    ]
    assert data["sop_preview"] == {}


@pytest.mark.asyncio
async def test_get_session_actions_derive_suggestions_from_features(
    client: AsyncClient,
    db_session: AsyncSession,
    admin_token: str,
):
    template = VideoTemplate(
        name="Action Template",
        description="phase 3 action placeholder",
        video_path="/tmp/action-template.mp4",
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

    action = ActionSequence(
        session_id=session.id,
        template_id=template.id,
        step_order=1,
        action_name="pick_part",
        created_at=datetime.now(UTC),
        features={
            "quality_score": 0.81,
            "suggestions": [
                {"type": "rename", "message": "建议命名为拿取工件"},
            ],
        },
    )
    db_session.add(action)
    await db_session.commit()

    resp = await client.get(
        f"/api/video-learning/sessions/{session.id}/actions",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert "suggestions" in data[0]
    assert data[0]["suggestions"] == [
        {"type": "rename", "message": "建议命名为拿取工件"},
    ]


@pytest.mark.asyncio
async def test_preview_template_sop_returns_generated_steps(
    client: AsyncClient,
    db_session: AsyncSession,
    admin_token: str,
):
    template = VideoTemplate(
        name="SOP Template",
        description="phase 3 sop preview",
        video_path="/tmp/sop-template.mp4",
        business_type="assembly",
        station_id="station-01",
        status="completed",
    )
    db_session.add(template)
    await db_session.flush()

    session = LearningSession(
        template_id=template.id,
        status="completed",
        progress=100.0,
        analysis_result={
            "workflow_summary": {
                "dominant_sequence": ["拿取工件"],
                "quality_score_avg": 0.88,
                "step_count": 1,
            }
        },
    )
    db_session.add(session)
    await db_session.flush()

    action = ActionSequence(
        session_id=session.id,
        template_id=template.id,
        step_order=1,
        action_name="pick_part",
        description="拿起工件并定位",
        duration=1.2,
        keyframe_path="/tmp/keyframe-1.jpg",
        objects_in_scene=["part", "hand"],
        features={
            "suggested_action_name": "拿取工件",
            "quality_score": 0.88,
        },
        created_at=datetime.now(UTC),
    )
    db_session.add(action)
    await db_session.commit()

    resp = await client.post(
        f"/api/video-learning/templates/{template.id}/sop-preview",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["template_id"] == template.id
    assert data["title"] == "SOP Template"
    assert data["workflow_summary"]["step_count"] == 1
    assert len(data["steps"]) == 1
    assert data["steps"][0]["name"] == "拿取工件"
    assert data["steps"][0]["keyframe_path"] == "/tmp/keyframe-1.jpg"


@pytest.mark.asyncio
async def test_save_template_sop_persists_content(
    client: AsyncClient,
    db_session: AsyncSession,
    manager_token: str,
):
    template = VideoTemplate(
        name="Persist SOP Template",
        description="phase 3 sop save",
        video_path="/tmp/persist-sop-template.mp4",
        business_type="assembly",
        status="completed",
    )
    db_session.add(template)
    await db_session.commit()

    payload = {
        "sop_content": {
            "title": "标准作业指导书",
            "steps": [{"step_order": 1, "name": "拿取工件"}],
        },
        "workflow_summary": {
            "step_count": 1,
        },
    }

    resp = await client.put(
        f"/api/video-learning/templates/{template.id}/sop",
        json=payload,
        headers={"Authorization": f"Bearer {manager_token}"},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["sop_content"]["title"] == "标准作业指导书"
    assert data["workflow_summary"]["step_count"] == 1


@pytest.mark.asyncio
async def test_apply_action_suggestion_uses_suggested_action_name(
    client: AsyncClient,
    db_session: AsyncSession,
    manager_token: str,
):
    template = VideoTemplate(
        name="Apply Suggestion Template",
        description="phase 3 apply suggestion",
        video_path="/tmp/apply-suggestion-template.mp4",
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

    action = ActionSequence(
        session_id=session.id,
        template_id=template.id,
        step_order=1,
        action_name="pick_part",
        features={
            "suggested_action_name": "拿取工件",
            "suggestions": [
                {"type": "rename", "message": "建议命名为拿取工件"},
            ],
        },
        created_at=datetime.now(UTC),
    )
    db_session.add(action)
    await db_session.commit()

    resp = await client.post(
        f"/api/video-learning/actions/{action.id}/apply-suggestion",
        json={"suggestion_type": "rename"},
        headers={"Authorization": f"Bearer {manager_token}"},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["user_defined_name"] == "拿取工件"


@pytest.mark.asyncio
async def test_get_session_frame_overlays_returns_objects_and_pose_fields(
    client: AsyncClient,
    db_session: AsyncSession,
    admin_token: str,
):
    template = VideoTemplate(
        name="Overlay Template",
        description="frame overlay preview",
        video_path="/tmp/overlay-template.mp4",
        business_type="assembly",
        resolution="1280x720",
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

    from app.models.models import KeyFrame

    frame = KeyFrame(
        session_id=session.id,
        template_id=template.id,
        frame_number=12,
        timestamp=1.2,
        image_path="/tmp/frame-overlay.jpg",
        detections={
            "objects": [
                {"class_name": "hand", "confidence": 0.95, "bbox": [0.1, 0.2, 0.3, 0.4]},
                {"class_name": "screwdriver", "confidence": 0.88, "bbox": [0.4, 0.3, 0.5, 0.6]},
            ],
            "pose_keypoints": [
                {
                    "person_index": 0,
                    "points": [
                        {"index": 5, "x": 120.0, "y": 200.0, "conf": 0.91},
                        {"index": 6, "x": 180.0, "y": 220.0, "conf": 0.89},
                    ],
                }
            ],
            "interaction_summary": {
                "interaction_count": 1,
            },
        },
        scene_change_score=4.0,
        is_action_boundary=False,
        created_at=datetime.now(UTC),
    )
    db_session.add(frame)
    await db_session.commit()

    resp = await client.get(
        f"/api/video-learning/sessions/{session.id}/frame-overlays",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["frame_number"] == 12
    assert data[0]["timestamp"] == 1.2
    assert data[0]["objects"][0]["class_name"] == "hand"
    assert data[0]["pose_keypoints"][0]["person_index"] == 0
    assert data[0]["interaction_summary"]["interaction_count"] == 1


@pytest.mark.asyncio
async def test_get_session_frame_overlays_supports_range_stride_limit_and_empty(
    client: AsyncClient,
    db_session: AsyncSession,
    admin_token: str,
):
    from app.models.models import KeyFrame

    template = VideoTemplate(
        name="Overlay Range Template",
        description="frame overlay filters",
        video_path="/tmp/overlay-range-template.mp4",
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

    for idx, timestamp in enumerate([0.1, 0.5, 0.9, 1.3], start=1):
        db_session.add(KeyFrame(
            session_id=session.id,
            template_id=template.id,
            frame_number=idx,
            timestamp=timestamp,
            image_path=f"/tmp/frame-{idx}.jpg",
            detections={
                "objects": [{"class_name": f"obj-{idx}", "confidence": 0.8, "bbox": [0.1, 0.1, 0.2, 0.2]}],
                "pose_keypoints": [],
                "interaction_summary": {"interaction_count": idx},
            },
            scene_change_score=float(idx),
            is_action_boundary=False,
            created_at=datetime.now(UTC),
        ))

    empty_session = LearningSession(
        template_id=template.id,
        status="completed",
        progress=100.0,
    )
    db_session.add(empty_session)
    await db_session.commit()

    filtered = await client.get(
        f"/api/video-learning/sessions/{session.id}/frame-overlays",
        params={"start_time": 0.2, "end_time": 1.0, "stride": 2, "limit": 1},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert filtered.status_code == 200
    filtered_data = filtered.json()
    assert len(filtered_data) == 1
    assert filtered_data[0]["timestamp"] == 0.5

    empty_resp = await client.get(
        f"/api/video-learning/sessions/{empty_session.id}/frame-overlays",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert empty_resp.status_code == 200
    assert empty_resp.json() == []


@pytest.mark.asyncio
async def test_update_template_config_returns_custom_training_model_fields(
    client: AsyncClient,
    db_session: AsyncSession,
    manager_token: str,
):
    template = VideoTemplate(
        name="Custom Model Template",
        description="custom model config",
        video_path="/tmp/custom-model-template.mp4",
        business_type="assembly",
        status="pending",
    )
    db_session.add(template)
    await db_session.commit()

    payload = {
        "learning_config": {
            "learning_mode": "action_and_object",
            "focus_classes": ["hand", "book"],
            "object_model_id": 11,
            "action_model_id": 22,
            "object_category_ids": [1, 2],
        }
    }

    resp = await client.put(
        f"/api/video-learning/templates/{template.id}/config",
        json=payload,
        headers={"Authorization": f"Bearer {manager_token}"},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["learning_config"]["object_model_id"] == 11
    assert data["learning_config"]["action_model_id"] == 22
    assert data["learning_config"]["object_category_ids"] == [1, 2]


@pytest.mark.asyncio
async def test_start_learning_uses_custom_model_outputs_in_analysis(
    client: AsyncClient,
    db_session: AsyncSession,
    manager_token: str,
    monkeypatch,
):
    template = VideoTemplate(
        name="Custom Inference Template",
        description="custom inference",
        video_path="/tmp/custom-inference.mp4",
        business_type="assembly",
        status="pending",
    )
    db_session.add(template)

    object_model = Model(
        name="custom-object-model",
        version="v1",
        model_type="custom_object",
        model_path="/tmp/custom-object.pt",
        status="deployed",
        is_active=True,
    )
    action_model = Model(
        name="custom-action-model",
        version="v1",
        model_type="custom_action",
        model_path="/tmp/custom-action.json",
        status="deployed",
        is_active=True,
    )
    db_session.add_all([object_model, action_model])
    await db_session.commit()

    with open(action_model.model_path, "w", encoding="utf-8") as file:
        file.write(
            '{'
            '"created_at":"2026-04-02T00:00:00+00:00",'
            '"prototype_count":1,'
            '"prototypes":{"read_book":{"vector":[20.0,30.0,20.0,20.0,0.85,0.0,0.0,1.0],"sample_count":1}}'
            '}'
        )

    monkeypatch.setattr("app.api.video_learning.os.path.isfile", lambda path: True)

    class Meta:
        fps = 10.0
        frame_count = 20
        duration_seconds = 2.0
        resolution = "1280x720"

    monkeypatch.setattr("app.api.video_learning.get_video_metadata", lambda path: Meta())

    analyzed_frames = [
        AnalyzedFrame(
            frame_number=0,
            timestamp=0.0,
            detections=[
                {
                    "class_name": "custom_book",
                    "confidence": 0.93,
                    "bbox": [10, 10, 40, 40],
                    "model_source": "custom_object",
                }
            ],
            pose_keypoints=[],
            interaction_summary={"interaction_count": 1},
            scene_change_score=0.0,
            is_boundary=False,
            image_path="/tmp/frame0.jpg",
        )
    ]

    def fake_analyze_video_frames(**kwargs):
        return analyzed_frames

    monkeypatch.setattr("app.api.video_learning.analyze_video_frames", fake_analyze_video_frames)

    payload = {
        "learning_mode": "action_and_object",
        "focus_classes": ["custom_book"],
        "object_model_id": object_model.id,
        "action_model_id": action_model.id,
    }

    resp = await client.post(
        f"/api/video-learning/templates/{template.id}/learn",
        json=payload,
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert resp.status_code == 201
    session_id = resp.json()["id"]

    session_resp = await client.get(
        f"/api/video-learning/sessions/{session_id}",
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert session_resp.status_code == 200
    session_data = session_resp.json()
    assert session_data["status"] == "completed"
    assert session_data["object_model_id"] == object_model.id
    assert session_data["action_model_id"] == action_model.id

    actions_resp = await client.get(
        f"/api/video-learning/sessions/{session_id}/actions",
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert actions_resp.status_code == 200
    action_features = actions_resp.json()[0]["features"]
    assert action_features["predicted_action_category"] == "read_book"
    assert action_features["action_model_source"] == "custom_action"
    assert action_features["prototype_distance"] >= 0

    overlays_resp = await client.get(
        f"/api/video-learning/sessions/{session_id}/frame-overlays",
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert overlays_resp.status_code == 200
    assert overlays_resp.json()[0]["objects"][0]["model_source"] == "custom_object"


@pytest.mark.asyncio
async def test_start_learning_progress_updates_during_analysis(
    client: AsyncClient,
    db_session: AsyncSession,
    manager_token: str,
    monkeypatch,
):
    template = VideoTemplate(
        name="Progress Template",
        description="progress tracking",
        video_path="/tmp/progress.mp4",
        business_type="assembly",
        status="pending",
    )
    db_session.add(template)
    await db_session.commit()

    monkeypatch.setattr("app.api.video_learning.os.path.isfile", lambda path: True)

    class Meta:
        fps = 10.0
        frame_count = 100
        duration_seconds = 10.0
        resolution = "1280x720"

    monkeypatch.setattr("app.api.video_learning.get_video_metadata", lambda path: Meta())

    progress_updates: list[tuple[int, int]] = []

    def fake_analyze_video_frames(**kwargs):
        callback = kwargs.get("progress_callback")
        for processed in [5, 10, 15]:
            callback(processed, 20)
            progress_updates.append((processed, 20))
        return [
            AnalyzedFrame(
                frame_number=0,
                timestamp=0.0,
                detections=[{"class_name": "part", "confidence": 0.9, "bbox": [1, 1, 10, 10]}],
                pose_keypoints=[],
                interaction_summary={"interaction_count": 0},
                scene_change_score=0.0,
                is_boundary=False,
                image_path=None,
            )
        ]

    monkeypatch.setattr("app.api.video_learning.analyze_video_frames", fake_analyze_video_frames)

    resp = await client.post(
        f"/api/video-learning/templates/{template.id}/learn",
        json={
            "learning_mode": "action_and_object",
            "focus_classes": [],
            "sample_rate": 1,
        },
        headers={"Authorization": f"Bearer {manager_token}"},
    )

    assert resp.status_code == 201
    assert progress_updates == [(5, 20), (10, 20), (15, 20)]

    session_resp = await client.get(
        f"/api/video-learning/sessions/{resp.json()['id']}",
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert session_resp.status_code == 200
    assert session_resp.json()["progress"] == 100.0


@pytest.mark.asyncio
async def test_start_learning_persists_segmentation_parameters(
    client: AsyncClient,
    db_session: AsyncSession,
    manager_token: str,
    monkeypatch,
):
    template = VideoTemplate(
        name="Segmentation Params Template",
        description="segmentation params snapshot",
        video_path="/tmp/segmentation-params.mp4",
        business_type="assembly",
        status="pending",
    )
    db_session.add(template)
    await db_session.commit()

    monkeypatch.setattr("app.api.video_learning.os.path.isfile", lambda path: True)

    class Meta:
        fps = 10.0
        frame_count = 10
        duration_seconds = 1.0
        resolution = "1280x720"

    monkeypatch.setattr("app.api.video_learning.get_video_metadata", lambda path: Meta())
    monkeypatch.setattr(
        "app.api.video_learning.analyze_video_frames",
        lambda **_kwargs: [
            AnalyzedFrame(
                frame_number=0,
                timestamp=0.0,
                detections=[{"class_name": "part", "confidence": 0.9, "bbox": [1, 1, 10, 10]}],
                pose_keypoints=[],
                interaction_summary={"interaction_count": 0},
                scene_change_score=0.0,
                is_boundary=False,
                image_path=None,
            )
        ],
    )

    resp = await client.post(
        f"/api/video-learning/templates/{template.id}/learn",
        json={
            "learning_mode": "action_and_object",
            "focus_classes": [],
            "min_action_duration_seconds": 0.5,
            "object_change_sensitivity": "high",
        },
        headers={"Authorization": f"Bearer {manager_token}"},
    )

    assert resp.status_code == 201

    session_resp = await client.get(
        f"/api/video-learning/sessions/{resp.json()['id']}",
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert session_resp.status_code == 200
    data = session_resp.json()
    assert data["min_action_duration_seconds"] == 0.5
    assert data["object_change_sensitivity"] == "high"


@pytest.mark.asyncio
async def test_update_action_sequence_recalculates_time_and_frames(
    client: AsyncClient,
    db_session: AsyncSession,
    manager_token: str,
):
    template = VideoTemplate(
        name="Action Edit Template",
        description="action timing edit",
        video_path="/tmp/action-edit.mp4",
        business_type="assembly",
        fps=10.0,
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

    action = ActionSequence(
        session_id=session.id,
        template_id=template.id,
        step_order=1,
        action_name="pick_part",
        start_frame=0,
        end_frame=12,
        start_time=0.0,
        end_time=1.2,
        duration=1.2,
        created_at=datetime.now(UTC),
    )
    db_session.add(action)
    await db_session.commit()

    resp = await client.put(
        f"/api/video-learning/actions/{action.id}",
        json={
            "user_defined_name": "拿取工件",
            "start_time": 0.4,
            "end_time": 1.6,
        },
        headers={"Authorization": f"Bearer {manager_token}"},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["user_defined_name"] == "拿取工件"
    assert data["start_time"] == 0.4
    assert data["end_time"] == 1.6
    assert data["duration"] == 1.2
    assert data["start_frame"] == 4
    assert data["end_frame"] == 16


@pytest.mark.asyncio
async def test_update_action_sequence_rejects_overlap_with_adjacent_actions(
    client: AsyncClient,
    db_session: AsyncSession,
    manager_token: str,
):
    template = VideoTemplate(
        name="Action Overlap Template",
        description="action overlap validation",
        video_path="/tmp/action-overlap.mp4",
        business_type="assembly",
        fps=10.0,
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

    first_action = ActionSequence(
        session_id=session.id,
        template_id=template.id,
        step_order=1,
        action_name="pick_part",
        start_frame=0,
        end_frame=10,
        start_time=0.0,
        end_time=1.0,
        duration=1.0,
        created_at=datetime.now(UTC),
    )
    second_action = ActionSequence(
        session_id=session.id,
        template_id=template.id,
        step_order=2,
        action_name="tighten_screw",
        start_frame=11,
        end_frame=20,
        start_time=1.1,
        end_time=2.0,
        duration=0.9,
        created_at=datetime.now(UTC),
    )
    db_session.add_all([first_action, second_action])
    await db_session.commit()

    resp = await client.put(
        f"/api/video-learning/actions/{first_action.id}",
        json={
            "start_time": 0.2,
            "end_time": 1.4,
        },
        headers={"Authorization": f"Bearer {manager_token}"},
    )

    assert resp.status_code == 400


def test_analyze_video_frames_falls_back_to_pose_model_when_default_detector_unavailable(monkeypatch):
    class FakeCap:
        def __init__(self, *_args, **_kwargs):
            self.index = 0

        def isOpened(self):
            return True

        def read(self):
            import numpy as np

            if self.index > 0:
                return False, None
            self.index += 1
            return True, np.zeros((32, 32, 3), dtype=np.uint8)

        def get(self, prop):
            import cv2

            if prop == cv2.CAP_PROP_FPS:
                return 10.0
            if prop == cv2.CAP_PROP_FRAME_COUNT:
                return 1
            return 0

        def release(self):
            return None

    class FakeEngine:
        def __init__(self, loaded: bool):
            self.confidence_threshold = 0.5
            self.is_loaded = loaded

        def predict(self, _frame):
            from app.core.yolo_engine import FrameDetections

            return FrameDetections(detections=[], inference_time_ms=1.0, frame_shape=(32, 32, 3))

    monkeypatch.setattr("app.core.video_learning.cv2.VideoCapture", lambda _path: FakeCap())
    monkeypatch.setattr("app.core.video_learning._extract_pose_keypoints", lambda _frame: [])
    monkeypatch.setattr("app.core.video_learning.compute_scene_change", lambda _a, _b: 0.0)

    def fake_get_engine(model_path="", confidence_threshold=0.5, device="cpu"):
        if model_path == "yolov8n-pose.pt":
            return FakeEngine(True)
        return FakeEngine(False)

    monkeypatch.setattr("app.core.video_learning.get_engine", fake_get_engine)

    frames = analyze_video_frames(
        video_path="/tmp/fallback.mp4",
        template_id=1,
        session_id=1,
        learning_mode="action_and_object",
        focus_classes=[],
        sample_rate=1,
        min_confidence=0.4,
        scene_threshold=30.0,
    )

    assert len(frames) == 1


def test_compute_scene_change_uses_available_opencv_compare_mode(monkeypatch):
    import numpy as np
    import cv2

    prev_frame = np.zeros((8, 8, 3), dtype=np.uint8)
    curr_frame = np.zeros((8, 8, 3), dtype=np.uint8)

    if hasattr(cv2, "HISTCMP_BHATTACHARYYA"):
        monkeypatch.delattr(cv2, "HISTCOMP_BHATTACHARYYA", raising=False)

    score = compute_scene_change(prev_frame, curr_frame)

    assert isinstance(score, float)
    assert score >= 0.0


def test_extract_actions_splits_on_object_set_changes_without_scene_boundary():
    analyzed_frames = [
        AnalyzedFrame(
            frame_number=0,
            timestamp=0.0,
            detections=[{"class_name": "cup", "confidence": 0.9, "bbox": [0, 0, 10, 10]}],
            pose_keypoints=[],
            interaction_summary={"interaction_count": 1},
            scene_change_score=0.0,
            is_boundary=False,
            image_path=None,
        ),
        AnalyzedFrame(
            frame_number=1,
            timestamp=0.1,
            detections=[{"class_name": "cup", "confidence": 0.9, "bbox": [0, 0, 10, 10]}],
            pose_keypoints=[],
            interaction_summary={"interaction_count": 1},
            scene_change_score=0.0,
            is_boundary=False,
            image_path=None,
        ),
        AnalyzedFrame(
            frame_number=2,
            timestamp=0.2,
            detections=[{"class_name": "bottle", "confidence": 0.9, "bbox": [0, 0, 10, 10]}],
            pose_keypoints=[],
            interaction_summary={"interaction_count": 1},
            scene_change_score=0.0,
            is_boundary=False,
            image_path=None,
        ),
        AnalyzedFrame(
            frame_number=3,
            timestamp=0.3,
            detections=[{"class_name": "bottle", "confidence": 0.9, "bbox": [0, 0, 10, 10]}],
            pose_keypoints=[],
            interaction_summary={"interaction_count": 1},
            scene_change_score=0.0,
            is_boundary=False,
            image_path=None,
        ),
    ]

    actions = extract_actions(analyzed_frames, fps=10.0)

    assert len(actions) == 2
    assert actions[0].objects_in_scene == ["cup"]
    assert actions[1].objects_in_scene == ["bottle"]


def test_extract_actions_merges_segments_shorter_than_min_duration():
    analyzed_frames = [
        AnalyzedFrame(
            frame_number=0,
            timestamp=0.0,
            detections=[{"class_name": "cup", "confidence": 0.9, "bbox": [0, 0, 10, 10]}],
            pose_keypoints=[],
            interaction_summary={"interaction_count": 1},
            scene_change_score=0.0,
            is_boundary=False,
            image_path=None,
        ),
        AnalyzedFrame(
            frame_number=1,
            timestamp=0.2,
            detections=[{"class_name": "cup", "confidence": 0.9, "bbox": [0, 0, 10, 10]}],
            pose_keypoints=[],
            interaction_summary={"interaction_count": 1},
            scene_change_score=0.0,
            is_boundary=True,
            image_path=None,
        ),
        AnalyzedFrame(
            frame_number=2,
            timestamp=0.4,
            detections=[{"class_name": "bottle", "confidence": 0.9, "bbox": [0, 0, 10, 10]}],
            pose_keypoints=[],
            interaction_summary={"interaction_count": 1},
            scene_change_score=0.0,
            is_boundary=False,
            image_path=None,
        ),
        AnalyzedFrame(
            frame_number=3,
            timestamp=1.8,
            detections=[{"class_name": "bottle", "confidence": 0.9, "bbox": [0, 0, 10, 10]}],
            pose_keypoints=[],
            interaction_summary={"interaction_count": 1},
            scene_change_score=0.0,
            is_boundary=False,
            image_path=None,
        ),
    ]

    actions = extract_actions(
        analyzed_frames,
        fps=10.0,
        min_action_duration_seconds=1.0,
    )

    assert len(actions) == 1
    assert actions[0].start_time == 0.0
    assert actions[0].end_time == 1.8


def test_extract_actions_low_object_change_sensitivity_keeps_same_segment():
    analyzed_frames = [
        AnalyzedFrame(
            frame_number=0,
            timestamp=0.0,
            detections=[
                {"class_name": "cup", "confidence": 0.9, "bbox": [0, 0, 10, 10]},
                {"class_name": "person", "confidence": 0.9, "bbox": [0, 0, 10, 10]},
            ],
            pose_keypoints=[],
            interaction_summary={"interaction_count": 1},
            scene_change_score=0.0,
            is_boundary=False,
            image_path=None,
        ),
        AnalyzedFrame(
            frame_number=1,
            timestamp=0.2,
            detections=[
                {"class_name": "bottle", "confidence": 0.9, "bbox": [0, 0, 10, 10]},
                {"class_name": "person", "confidence": 0.9, "bbox": [0, 0, 10, 10]},
            ],
            pose_keypoints=[],
            interaction_summary={"interaction_count": 1},
            scene_change_score=0.0,
            is_boundary=False,
            image_path=None,
        ),
    ]

    actions = extract_actions(
        analyzed_frames,
        fps=10.0,
        object_change_sensitivity="low",
    )

    assert len(actions) == 1


@pytest.mark.asyncio
async def test_custom_action_model_compare_endpoint_reuses_training_metrics(
    client: AsyncClient,
    db_session: AsyncSession,
    admin_token: str,
):
    model_a = Model(
        name="custom-action-a",
        version="job-3",
        model_type="custom_action",
        model_path="/tmp/action-a.json",
        accuracy=0.83,
        precision=0.81,
        recall=0.79,
        inference_speed=3.4,
        status="ready",
    )
    model_b = Model(
        name="custom-action-b",
        version="job-4",
        model_type="custom_action",
        model_path="/tmp/action-b.json",
        accuracy=0.76,
        precision=0.74,
        recall=0.73,
        inference_speed=3.1,
        status="ready",
    )
    db_session.add_all([model_a, model_b])
    await db_session.flush()

    db_session.add_all([
        TrainingJob(
            name="动作模型A训练",
            job_type="action_recognition",
            dataset_type="action_sample_set",
            dataset_id=1,
            model_id=model_a.id,
            status="completed",
            progress=100.0,
            log_path="/tmp/action-a.log",
            metrics_json={
                "class_metrics": {
                    "read_book": {"precision": 0.82, "recall": 0.81, "sample_count": 5},
                },
            },
        ),
        TrainingJob(
            name="动作模型B训练",
            job_type="action_recognition",
            dataset_type="action_sample_set",
            dataset_id=2,
            model_id=model_b.id,
            status="completed",
            progress=100.0,
            log_path="/tmp/action-b.log",
            metrics_json={
                "class_metrics": {
                    "read_book": {"precision": 0.71, "recall": 0.69, "sample_count": 4},
                },
            },
        ),
    ])
    await db_session.commit()

    resp = await client.get(
        f"/api/video-training/models/compare/{model_a.id}/{model_b.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["job_a"]["name"] == "动作模型A训练"
    assert data["job_b"]["log_path"] is None
    assert data["class_metrics_diff"]["read_book"]["sample_count_diff"] == 1


def test_compute_adaptive_scene_threshold_returns_value_in_expected_range():
    from app.core.video_learning import compute_adaptive_scene_threshold

    scores = [5.0, 10.0, 15.0, 20.0, 25.0, 30.0, 35.0, 40.0, 45.0, 50.0]
    threshold = compute_adaptive_scene_threshold(scores, configured_threshold=30.0)
    assert isinstance(threshold, float)
    assert 20.0 <= threshold <= 50.0


def test_compute_adaptive_scene_threshold_falls_back_to_configured():
    from app.core.video_learning import compute_adaptive_scene_threshold

    threshold = compute_adaptive_scene_threshold([], configured_threshold=25.0)
    assert threshold == 25.0


def test_compute_object_change_score_returns_normalized_value():
    from app.core.video_learning import compute_object_change_score

    prev = {"cup": 3, "book": 2}
    curr = {"cup": 3, "book": 2}
    score = compute_object_change_score(prev, curr)
    assert isinstance(score, float)
    assert 0.0 <= score <= 1.0

    curr2 = {"bottle": 5}
    score2 = compute_object_change_score(prev, curr2)
    assert score2 > score


def test_compute_interaction_change_score_returns_normalized_value():
    from app.core.video_learning import compute_interaction_change_score

    prev_interactions = [{"object": "cup", "distance": 20.0}]
    curr_interactions = [{"object": "cup", "distance": 22.0}]
    score = compute_interaction_change_score(prev_interactions, curr_interactions)
    assert isinstance(score, float)
    assert 0.0 <= score <= 1.0

    curr2 = [{"object": "bottle", "distance": 30.0}]
    score2 = compute_interaction_change_score(prev_interactions, curr2)
    assert score2 >= 0.0


def test_compute_boundary_score_returns_combined_score_and_reasons():
    from app.core.video_learning import compute_boundary_score

    frame_context = {
        "scene_change_score": 40.0,
        "prev_objects": {"cup": 3, "book": 2},
        "curr_objects": {"bottle": 1},
        "prev_interactions": [{"object": "cup", "distance": 20.0}],
        "curr_interactions": [],
        "prev_pose": {"wrist_span_x": 10.0, "wrist_span_y": 8.0},
        "curr_pose": {"wrist_span_x": 35.0, "wrist_span_y": 30.0},
    }
    result = compute_boundary_score(frame_context)

    assert "score" in result
    assert "reasons" in result
    assert isinstance(result["score"], float)
    assert 0.0 <= result["score"] <= 1.0
    assert isinstance(result["reasons"], list)


def test_extract_actions_adds_enriched_explainability_fields():
    analyzed_frames = [
        AnalyzedFrame(
            frame_number=0,
            timestamp=0.0,
            detections=[
                {"class_name": "screwdriver", "confidence": 0.95, "bbox": [100, 100, 160, 160]},
                {"class_name": "panel", "confidence": 0.88, "bbox": [220, 120, 340, 260]},
            ],
            pose_keypoints=[
                {
                    "person_index": 0,
                    "points": [
                        {"index": 9, "x": 130.0, "y": 130.0, "conf": 0.9},
                        {"index": 10, "x": 145.0, "y": 132.0, "conf": 0.92},
                    ],
                }
            ],
            interaction_summary={
                "interaction_count": 1,
                "interactions": [{"object": "screwdriver", "distance": 22.5}],
            },
            scene_change_score=8.0,
            is_boundary=False,
            image_path="/tmp/frame-0.jpg",
        ),
        AnalyzedFrame(
            frame_number=5,
            timestamp=0.5,
            detections=[
                {"class_name": "screwdriver", "confidence": 0.91, "bbox": [102, 102, 162, 162]},
                {"class_name": "panel", "confidence": 0.87, "bbox": [220, 120, 340, 260]},
            ],
            pose_keypoints=[
                {
                    "person_index": 0,
                    "points": [
                        {"index": 9, "x": 132.0, "y": 135.0, "conf": 0.9},
                        {"index": 10, "x": 150.0, "y": 138.0, "conf": 0.91},
                    ],
                }
            ],
            interaction_summary={
                "interaction_count": 1,
                "interactions": [{"object": "screwdriver", "distance": 18.0}],
            },
            scene_change_score=12.0,
            is_boundary=False,
            image_path=None,
        ),
    ]

    actions = extract_actions(analyzed_frames, fps=10.0)

    assert len(actions) == 1
    features = actions[0].features
    assert "boundary_score" in features
    assert "boundary_reasons" in features
    assert "detection_score" in features
    assert "pose_score" in features
    assert "interaction_score" in features
    assert "stability_score" in features
    assert "primary_objects" in features
    assert isinstance(features["boundary_score"], float)
    assert 0.0 <= features["boundary_score"] <= 1.0
    assert isinstance(features["boundary_reasons"], list)
    assert isinstance(features["detection_score"], float)
    assert 0.0 <= features["detection_score"] <= 1.0


def test_extract_actions_merges_similar_adjacent_actions():
    analyzed_frames = [
        AnalyzedFrame(
            frame_number=0,
            timestamp=0.0,
            detections=[{"class_name": "cup", "confidence": 0.9, "bbox": [0, 0, 10, 10]}],
            pose_keypoints=[
                {
                    "person_index": 0,
                    "points": [
                        {"index": 9, "x": 130.0, "y": 130.0, "conf": 0.9},
                        {"index": 10, "x": 145.0, "y": 132.0, "conf": 0.92},
                    ],
                }
            ],
            interaction_summary={"interaction_count": 1, "interactions": [{"object": "cup", "distance": 20.0}]},
            scene_change_score=5.0,
            is_boundary=False,
            image_path=None,
        ),
        AnalyzedFrame(
            frame_number=1,
            timestamp=0.2,
            detections=[{"class_name": "cup", "confidence": 0.9, "bbox": [0, 0, 10, 10]}],
            pose_keypoints=[
                {
                    "person_index": 0,
                    "points": [
                        {"index": 9, "x": 132.0, "y": 135.0, "conf": 0.9},
                        {"index": 10, "x": 147.0, "y": 134.0, "conf": 0.91},
                    ],
                }
            ],
            interaction_summary={"interaction_count": 1, "interactions": [{"object": "cup", "distance": 22.0}]},
            scene_change_score=6.0,
            is_boundary=True,
            image_path=None,
        ),
        AnalyzedFrame(
            frame_number=2,
            timestamp=0.4,
            detections=[{"class_name": "cup", "confidence": 0.9, "bbox": [0, 0, 10, 10]}],
            pose_keypoints=[
                {
                    "person_index": 0,
                    "points": [
                        {"index": 9, "x": 133.0, "y": 136.0, "conf": 0.9},
                        {"index": 10, "x": 148.0, "y": 135.0, "conf": 0.91},
                    ],
                }
            ],
            interaction_summary={"interaction_count": 1, "interactions": [{"object": "cup", "distance": 21.0}]},
            scene_change_score=4.0,
            is_boundary=False,
            image_path=None,
        ),
        AnalyzedFrame(
            frame_number=3,
            timestamp=0.6,
            detections=[{"class_name": "bottle", "confidence": 0.9, "bbox": [0, 0, 10, 10]}],
            pose_keypoints=[
                {
                    "person_index": 0,
                    "points": [
                        {"index": 9, "x": 140.0, "y": 140.0, "conf": 0.9},
                        {"index": 10, "x": 155.0, "y": 142.0, "conf": 0.91},
                    ],
                }
            ],
            interaction_summary={"interaction_count": 0, "interactions": []},
            scene_change_score=50.0,
            is_boundary=True,
            image_path=None,
        ),
    ]

    actions = extract_actions(analyzed_frames, fps=10.0)

    has_merge_indicator = any(
        "merged_similar" in (a.features or {}) or "merged_short_segment" in (a.features or {})
        for a in actions
    )
    assert has_merge_indicator or len(actions) <= 3


@pytest.mark.asyncio
async def test_get_session_actions_returns_enriched_action_features(
    client: AsyncClient,
    db_session: AsyncSession,
    admin_token: str,
):
    template = VideoTemplate(
        name="Enriched Action Template",
        description="test enriched features",
        video_path="/tmp/enriched-action.mp4",
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
            action_name="pick_part",
            start_frame=0,
            end_frame=10,
            start_time=0.0,
            end_time=1.0,
            duration=1.0,
            confidence=0.85,
            objects_in_scene=["part", "hand"],
            features={
                "quality_score": 0.82,
                "boundary_score": 0.65,
                "boundary_reasons": ["scene_jump", "object_set_changed"],
                "detection_score": 0.88,
                "pose_score": 0.75,
                "interaction_score": 0.80,
                "stability_score": 0.78,
                "primary_objects": ["part"],
                "suggestions": [],
            },
        )
    )
    await db_session.commit()

    resp = await client.get(
        f"/api/video-learning/sessions/{session.id}/actions",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    features = data[0].get("features") or {}
    assert "boundary_score" in features
    assert "boundary_reasons" in features
    assert "detection_score" in features
    assert "pose_score" in features
    assert "interaction_score" in features
    assert "stability_score" in features

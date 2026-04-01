"""视频学习API测试"""

from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.video_learning import AnalyzedFrame, extract_actions
from app.models.models import ActionSequence, LearningSession, VideoTemplate


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

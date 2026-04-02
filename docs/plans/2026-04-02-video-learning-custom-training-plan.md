# Video Learning Custom Training Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build custom object training and custom action training for video learning, including data management, training jobs, model activation, and integration with the existing video learning flow.

**Architecture:** Extend the existing backend with new dataset and training entities, reuse the current `models` table for deployed model versions, add a new `video_training` API surface, and add a frontend workbench for category, dataset, and training management. Keep the existing `video_learning` flow and wire in optional custom object and action model selection.

**Tech Stack:** FastAPI, SQLAlchemy async, SQLite/PostgreSQL, Ultralytics YOLO, NumPy, React, TypeScript, Ant Design, Vitest, Pytest

---

### Task 1: Add failing backend API tests for custom training

**Files:**
- Modify: `backend/tests/test_video_training.py`
- Modify: `backend/tests/test_video_learning.py`

**Step 1: Write failing tests**
- Add tests for listing and creating object categories.
- Add tests for creating action sample sets and importing skeleton JSON.
- Add tests for creating object/action training jobs.
- Add a video learning config test that expects custom model ids to round-trip.

**Step 2: Run tests to verify they fail**

Run: `cd backend && pytest tests/test_video_training.py tests/test_video_learning.py -q`

Expected: failures because routes, schemas, and tables do not exist yet.

**Step 3: No production code yet**

**Step 4: Re-run the same tests after every incremental backend change**

### Task 2: Add backend models and schemas for custom training

**Files:**
- Modify: `backend/app/models/models.py`
- Modify: `backend/app/schemas/model.py`
- Modify: `backend/app/schemas/video_learning.py`
- Modify: `backend/app/main.py`
- Modify: `backend/alembic/env.py`

**Step 1: Write minimal model classes**
- Add `ObjectCategory`, `ObjectAnnotationSet`, `ObjectAnnotation`, `ActionCategory`, `ActionSampleSet`, `ActionSample`, `TrainingJob`.

**Step 2: Extend existing model/schema types**
- Allow `custom_object` and `custom_action` in model type schema.
- Add response/request schemas for the new API.
- Extend video learning config/session response with custom model ids.

**Step 3: Register models for metadata discovery**

**Step 4: Run failing tests again**

Run: `cd backend && pytest tests/test_video_training.py tests/test_video_learning.py -q`

Expected: model errors gone, route/CRUD failures remain.

### Task 3: Add CRUD and API routes for custom training

**Files:**
- Create: `backend/app/crud/video_training.py`
- Create: `backend/app/api/video_training.py`
- Modify: `backend/app/main.py`

**Step 1: Implement CRUD for categories, sets, samples, and jobs**

**Step 2: Implement API endpoints**
- `GET/POST /api/video-training/object-categories`
- `GET/POST /api/video-training/action-categories`
- `GET/POST /api/video-training/object-annotation-sets`
- `POST /api/video-training/object-annotation-sets/{id}/annotations`
- `GET/POST /api/video-training/action-sample-sets`
- `POST /api/video-training/action-sample-sets/{id}/samples/import-json`
- `POST /api/video-training/action-sample-sets/{id}/samples/from-session`
- `GET /api/video-training/training-jobs`
- `POST /api/video-training/training-jobs/object-detection`
- `POST /api/video-training/training-jobs/action-recognition`

**Step 3: Run tests to verify the API passes**

Run: `cd backend && pytest tests/test_video_training.py tests/test_video_learning.py -q`

Expected: category, sample, and job tests pass.

### Task 4: Add minimal training service and model activation flow

**Files:**
- Create: `backend/app/core/video_training.py`
- Modify: `backend/app/api/video_training.py`
- Modify: `backend/app/crud/model.py`

**Step 1: Implement minimal object training stub**
- Create dataset export metadata and a fake trained model artifact path.

**Step 2: Implement minimal action training stub**
- Convert skeleton sequences into prototype statistics and persist JSON artifact.

**Step 3: Create model rows and mark training jobs completed**

**Step 4: Add model activation endpoint for training jobs**
- `POST /api/video-training/training-jobs/{id}/activate-model`

**Step 5: Run tests**

Run: `cd backend && pytest tests/test_video_training.py tests/test_video_learning.py -q`

Expected: activation flow passes.

### Task 5: Wire custom model ids into video learning config

**Files:**
- Modify: `backend/app/api/video_learning.py`
- Modify: `backend/app/crud/video_learning.py`
- Modify: `backend/app/schemas/video_learning.py`

**Step 1: Accept and return `object_model_id`, `action_model_id`, `object_category_ids` in learning config**

**Step 2: Persist model ids on `LearningSession`**

**Step 3: Run targeted tests**

Run: `cd backend && pytest tests/test_video_learning.py -q`

Expected: config round-trip tests pass.

### Task 6: Add failing frontend tests for the training workbench

**Files:**
- Create: `frontend/src/__tests__/pages/VideoTraining.test.tsx`
- Modify: `frontend/src/__tests__/pages/VideoLearning.test.tsx`

**Step 1: Write failing tests**
- Verify the page loads category and training job lists.
- Verify object category creation submits.
- Verify action sample set creation submits.
- Verify `VideoLearning` shows model selectors when config data exists.

**Step 2: Run tests to verify they fail**

Run: `cd frontend && npm run test -- src/__tests__/pages/VideoTraining.test.tsx src/__tests__/pages/VideoLearning.test.tsx`

Expected: failures because page and controls do not exist yet.

### Task 7: Implement frontend custom training page and routing

**Files:**
- Create: `frontend/src/pages/VideoTraining/index.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/layouts/MainLayout.tsx`
- Modify: `frontend/src/locales/zh.json`
- Modify: `frontend/src/locales/en.json`

**Step 1: Build the page skeleton with tabs**

**Step 2: Implement object category and action sample set forms**

**Step 3: Load and render training jobs and categories**

**Step 4: Add route and menu entry**

**Step 5: Run frontend tests**

Run: `cd frontend && npm run test -- src/__tests__/pages/VideoTraining.test.tsx src/__tests__/pages/VideoLearning.test.tsx`

Expected: page tests pass.

### Task 8: Extend VideoLearning page with custom model selectors

**Files:**
- Modify: `frontend/src/pages/VideoLearning/index.tsx`

**Step 1: Load available custom object/action models**

**Step 2: Add selector controls to learning config**

**Step 3: Send selected model ids in config save and learning start calls**

**Step 4: Re-run frontend tests**

Run: `cd frontend && npm run test -- src/__tests__/pages/VideoTraining.test.tsx src/__tests__/pages/VideoLearning.test.tsx`

Expected: all targeted tests pass.

### Task 9: Verify end-to-end build and test status

**Files:**
- Modify: `.tasks/tasks.md`

**Step 1: Run backend tests**

Run: `cd backend && pytest tests/test_video_training.py tests/test_video_learning.py -q`

**Step 2: Run frontend tests**

Run: `cd frontend && npm run test -- src/__tests__/pages/VideoTraining.test.tsx src/__tests__/pages/VideoLearning.test.tsx`

**Step 3: Run frontend build**

Run: `cd frontend && npm run build`

**Step 4: Update `.tasks/tasks.md` with completion details**

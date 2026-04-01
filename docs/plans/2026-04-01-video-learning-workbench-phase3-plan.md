# Video Learning Workbench Phase 3 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add recognition accuracy scoring, workflow intelligence, workbench suggestions, and SOP generation to the video learning workbench in one phase.

**Architecture:** Extend the existing video learning pipeline in place. Compute richer per-action features and workflow-level suggestions in the backend, expose them through summary and SOP APIs, then upgrade the frontend workbench to visualize, preview, and apply those suggestions without changing the core persistence model more than necessary.

**Tech Stack:** FastAPI, SQLAlchemy async, OpenCV, Ultralytics YOLO/YOLO pose, React, TypeScript, Ant Design, Vitest, Pytest

---

### Task 1: 准备第三阶段数据落点与响应结构

**Files:**
- Modify: `backend/app/schemas/video_learning.py`
- Modify: `backend/app/api/video_learning.py`
- Test: `backend/tests/test_video_learning.py`

**Step 1: Write the failing backend tests**

Add tests that expect template summary responses to include `workflow_summary`, `workflow_suggestions`, and `sop_preview` keys.

**Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_video_learning.py -k summary -v`
Expected: FAIL because the response shape does not include phase 3 fields yet.

**Step 3: Write minimal schema and API changes**

Extend the relevant response models and wire summary responses to include default empty values for the new fields.

**Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/test_video_learning.py -k summary -v`
Expected: PASS.

### Task 2: 实现识别增强与流程智能分析

**Files:**
- Modify: `backend/app/core/video_learning.py`
- Modify: `backend/app/api/video_learning.py`
- Test: `backend/tests/test_video_learning.py`

**Step 1: Write the failing backend tests**

Add tests for helper behavior that expect action features to contain `quality_score`, `suggested_action_name`, and action-level suggestions, and summary results to contain non-error workflow suggestion arrays.

**Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_video_learning.py -k workflow -v`
Expected: FAIL because enhanced analysis is not implemented.

**Step 3: Write minimal implementation**

Implement action enhancement helpers in `core/video_learning.py` that derive smoothed object stats, quality scores, suggested action names, and workflow suggestions from existing action / frame data.

**Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/test_video_learning.py -k workflow -v`
Expected: PASS.

### Task 3: 增加 SOP 预览与保存接口

**Files:**
- Modify: `backend/app/api/video_learning.py`
- Modify: `backend/app/crud/video_learning.py`
- Modify: `backend/app/models/models.py`
- Modify: `backend/app/schemas/video_learning.py`
- Test: `backend/tests/test_video_learning.py`

**Step 1: Write the failing backend tests**

Add tests for generating SOP preview from a completed template summary and saving SOP content back to the template.

**Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_video_learning.py -k sop -v`
Expected: FAIL because the endpoints do not exist yet.

**Step 3: Write minimal implementation**

Add SOP preview and save endpoints, keep SOP content in template JSON-friendly fields, and reuse current actions / keyframes for preview assembly.

**Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/test_video_learning.py -k sop -v`
Expected: PASS.

### Task 4: 增加建议采纳接口与动作段应用能力

**Files:**
- Modify: `backend/app/api/video_learning.py`
- Modify: `backend/app/crud/video_learning.py`
- Modify: `backend/app/schemas/video_learning.py`
- Test: `backend/tests/test_video_learning.py`

**Step 1: Write the failing backend tests**

Add tests that apply a suggested name or keep flag to an action and verify the stored action changes.

**Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_video_learning.py -k suggestion -v`
Expected: FAIL because suggestion apply endpoint does not exist yet.

**Step 3: Write minimal implementation**

Add an action suggestion apply endpoint and a CRUD helper that safely copies selected suggestion fields into the action record.

**Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/test_video_learning.py -k suggestion -v`
Expected: PASS.

### Task 5: 升级 VideoLearning 工作台并添加前端测试

**Files:**
- Create: `frontend/src/__tests__/pages/VideoLearning.test.tsx`
- Modify: `frontend/src/pages/VideoLearning/index.tsx`
- Test: `frontend/src/__tests__/pages/VideoLearning.test.tsx`

**Step 1: Write the failing frontend test**

Add a test that renders the workbench with mocked summary data and expects `智能建议` / `SOP 预览` content to appear.

**Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test -- src/__tests__/pages/VideoLearning.test.tsx`
Expected: FAIL because the new tabs and UI elements do not exist yet.

**Step 3: Write minimal implementation**

Add suggestion panels, workflow overview cards, SOP preview rendering, and a button to apply per-action suggestions.

**Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test -- src/__tests__/pages/VideoLearning.test.tsx`
Expected: PASS.

### Task 6: 补充国际化与做完整验证

**Files:**
- Modify: `frontend/src/locales/zh.json`
- Modify: `frontend/src/locales/en.json`
- Modify: `.tasks/tasks.md`

**Step 1: Add missing locale strings**

Add phase 3 strings for workflow suggestions, quality scores, SOP preview, save actions, and empty states.

**Step 2: Run frontend build**

Run: `cd frontend && npm run build`
Expected: PASS.

**Step 3: Run backend verification**

Run: `cd backend && pytest tests/test_video_learning.py -v && python -c "from app.api.video_learning import router; print('router import ok', len(router.routes))"`
Expected: PASS with router import success.

**Step 4: Fix any failures and re-run verification**

Repeat the exact commands until both checks pass cleanly.

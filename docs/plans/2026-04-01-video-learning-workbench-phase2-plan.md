# Video Learning Workbench Phase 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add YOLO pose-based motion features, hand-tool-product interaction analysis, manual split/merge controls, template comparison, and full verification.

**Architecture:** Build on the existing video learning pipeline. Extend analyzed frame data to include pose keypoints and interaction summaries, then expose richer backend APIs for segment editing and template comparison. Upgrade the frontend workbench to visualize pose summaries, compare templates, and support segment operations.

**Tech Stack:** FastAPI, SQLAlchemy async, OpenCV, Ultralytics YOLO/YOLO pose, React, TypeScript, Ant Design

---

### Task 1: 扩展 pose / interaction 数据结构

**Files:**
- Modify: `backend/app/core/video_learning.py`
- Modify: `backend/app/schemas/video_learning.py`
- Modify: `backend/app/models/models.py`

### Task 2: 实现 pose 特征与交互特征抽取

**Files:**
- Modify: `backend/app/core/video_learning.py`

### Task 3: 增加动作段拆分/合并与模板对比 API

**Files:**
- Modify: `backend/app/crud/video_learning.py`
- Modify: `backend/app/api/video_learning.py`

### Task 4: 升级 VideoLearning 工作台前端

**Files:**
- Modify: `frontend/src/pages/VideoLearning/index.tsx`

### Task 5: 补充翻译文案与验证

**Files:**
- Modify: `frontend/src/locales/zh.json`
- Modify: `frontend/src/locales/en.json`

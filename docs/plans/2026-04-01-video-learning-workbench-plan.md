# Video Learning Workbench Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a usable video learning workbench that supports action learning, object learning, timeline preview, and editable action segments.

**Architecture:** Extend the existing `video_learning` pipeline and keep current data flow, while adding configurable learning parameters, richer result structures, and a workbench-style frontend. The first stage emphasizes practical template learning rather than full supervised training.

**Tech Stack:** FastAPI, SQLAlchemy async, OpenCV, YOLO/YOLO pose, React, TypeScript, Ant Design

---

### Task 1: 扩展视频学习数据结构

**Files:**
- Modify: `backend/app/models/models.py`
- Modify: `backend/app/schemas/video_learning.py`
- Modify: `backend/app/crud/video_learning.py`

**Step 1:** 为模板和学习会话增加学习配置字段。
**Step 2:** 为 schema 增加学习配置与动作编辑字段。
**Step 3:** 为 CRUD 增加模板配置更新和动作编辑支持。
**Step 4:** 运行后端导入验证。

### Task 2: 增强后端视频分析结果

**Files:**
- Modify: `backend/app/core/video_learning.py`
- Modify: `backend/app/api/video_learning.py`

**Step 1:** 在分析过程中增加 pose/object 学习模式和关注对象类别参数。
**Step 2:** 扩展 `AnalyzedFrame` / `DetectedAction` 的特征结构。
**Step 3:** 输出动作段摘要、对象统计、关键帧列表。
**Step 4:** 增加动作段编辑接口。
**Step 5:** 运行 API 导入验证。

### Task 3: 重构 VideoLearning 页面为工作台

**Files:**
- Modify: `frontend/src/pages/VideoLearning/index.tsx`

**Step 1:** 增加工作台布局（模板列表 + 参数区 + 结果区）。
**Step 2:** 增加学习参数表单。
**Step 3:** 增加时间轴、动作段表格、对象统计卡片。
**Step 4:** 接入动作段详情与编辑接口。
**Step 5:** 运行前端构建验证。

### Task 4: 补充翻译与交互文案

**Files:**
- Modify: `frontend/src/locales/zh.json`
- Modify: `frontend/src/locales/en.json`

**Step 1:** 添加视频学习工作台文案。
**Step 2:** 运行前端构建验证。

### Task 5: 验证与收尾

**Files:**
- Modify: `.tasks/tasks.md`

**Step 1:** 运行 `npm run build`。
**Step 2:** 运行后端导入验证。
**Step 3:** 更新任务完成状态。

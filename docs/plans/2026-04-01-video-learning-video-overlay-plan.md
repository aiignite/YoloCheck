# Video Learning Video Overlay Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 VideoLearning 弹窗增加视频播放器与逐帧叠加分析能力，支持目标框、对象标签、人体骨骼和动作级联动展示。

**Architecture:** 后端新增会话逐帧 overlay 数据接口，直接复用关键帧 JSON 中已保存的 objects / pose_keypoints / interaction_summary。前端在现有工作台右侧顶部增加 video + canvas 双层播放器，用 `currentTime` 与逐帧数据和动作段同步，保留现有 phase3 工作台结构。

**Tech Stack:** React + TypeScript + Ant Design + FastAPI + SQLAlchemy + pytest + Vitest

---

### Task 1: 定义逐帧 overlay 响应模型与后端测试

**Files:**
- Modify: `backend/app/schemas/video_learning.py`
- Modify: `backend/tests/test_video_learning.py`

**Step 1: 写失败测试**
- 为 `/api/video-learning/sessions/{session_id}/frame-overlays` 增加测试
- 断言响应含 `frame_number`、`timestamp`、`objects`、`pose_keypoints`

**Step 2: 运行失败测试**
- Run: `cd backend && pytest tests/test_video_learning.py -k "frame_overlays" -v`

**Step 3: 增加 schema**
- 增加逐帧 overlay 响应模型与列表返回模型

**Step 4: 再跑测试**
- Run: `cd backend && pytest tests/test_video_learning.py -k "frame_overlays" -v`

### Task 2: 实现 frame overlays API

**Files:**
- Modify: `backend/app/api/video_learning.py`
- Modify: `backend/app/crud/video_learning.py`
- Test: `backend/tests/test_video_learning.py`

**Step 1: 补充失败测试场景**
- 覆盖时间范围、stride、limit、空数据返回

**Step 2: 在 CRUD 中新增查询方法**
- 读取会话关键帧记录并提取 `detections.objects`、`pose_keypoints`

**Step 3: 新增 API 路由**
- 增加 `/sessions/{session_id}/frame-overlays`

**Step 4: 运行后端测试**
- Run: `cd backend && pytest tests/test_video_learning.py -k "frame_overlays or video_learning" -q`

### Task 3: 为前端工作台增加播放器基础状态

**Files:**
- Modify: `frontend/src/pages/VideoLearning/index.tsx`
- Test: `frontend/src/__tests__/pages/VideoLearning.test.tsx`

**Step 1: 写失败测试**
- 断言打开 workbench 后出现播放器区域

**Step 2: 在页面内增加状态**
- `videoRef`
- `overlayCanvasRef`
- `currentTime`
- `isPlaying`
- `overlayFrames`
- `overlayOptions`

**Step 3: 接入 overlay 接口请求**
- workbench 打开时请求 overlay 数据

**Step 4: 跑前端测试**
- Run: `cd frontend && npm run test -- src/__tests__/pages/VideoLearning.test.tsx`

### Task 4: 渲染 video + canvas 双层播放器

**Files:**
- Modify: `frontend/src/pages/VideoLearning/index.tsx`
- Test: `frontend/src/__tests__/pages/VideoLearning.test.tsx`

**Step 1: 在右侧顶部插入播放器卡片**
- video 元素
- canvas 叠加层
- 播放/暂停按钮
- 时间轴 slider

**Step 2: 绑定时间同步逻辑**
- `timeupdate` 驱动当前帧查找与重绘

**Step 3: 跑测试**
- Run: `cd frontend && npm run test -- src/__tests__/pages/VideoLearning.test.tsx`

### Task 5: 绘制 objects 和 pose overlays

**Files:**
- Modify: `frontend/src/pages/VideoLearning/index.tsx`
- Test: `frontend/src/__tests__/pages/VideoLearning.test.tsx`

**Step 1: 实现 `drawOverlay(frame)`**
- 绘制 bbox
- 绘制 label + confidence
- 绘制 pose keypoints + skeleton lines

**Step 2: 增加显示开关**
- 目标框
- 骨骼
- 动作标签

**Step 3: 验证无数据降级**
- 没有 pose 或 bbox 时不报错

### Task 6: 动作列表与视频联动

**Files:**
- Modify: `frontend/src/pages/VideoLearning/index.tsx`
- Test: `frontend/src/__tests__/pages/VideoLearning.test.tsx`

**Step 1: 点击动作项跳转视频**
- `seekToAction(action)`

**Step 2: 当前动作高亮**
- 根据 `currentTime` 匹配动作段

**Step 3: 顶部摘要条显示当前步骤和对象**

### Task 7: 清理弃用告警与表单警告

**Files:**
- Modify: `frontend/src/pages/VideoLearning/index.tsx`

**Step 1: 去掉 `List` 用法**
- 改为普通 `div` / `Card` 列表

**Step 2: 去掉 `Space direction` 弃用写法**

**Step 3: 确保 `setFieldsValue` 在 Form 挂载后执行**

### Task 8: 完整验证与反馈

**Files:**
- Modify: `.tasks/tasks.md`
- Optional: `.tasks/archive/*`

**Step 1: 跑后端测试**
- Run: `cd backend && pytest tests/test_video_learning.py -q`

**Step 2: 跑前端测试**
- Run: `cd frontend && npm run test -- src/__tests__/pages/VideoLearning.test.tsx`

**Step 3: 跑前端构建**
- Run: `cd frontend && npm run build`

**Step 4: 通过 feedback MCP 反馈结果**

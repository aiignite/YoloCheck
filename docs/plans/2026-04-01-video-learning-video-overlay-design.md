# Video Learning Video Overlay Design

**目标**: 在视频学习弹窗中增加视频回放能力，并在播放过程中叠加展示识别结果，包括目标框、对象标签、人体骨骼和动作摘要。

**背景**:
- 现有 `frontend/src/pages/VideoLearning/index.tsx` 已具备模板列表、工作台、pose tab、object tab、SOP 预览、建议采纳等 phase2/phase3 能力。
- 后端已有动作级数据：`objects_in_scene`、`pose_summary`、`workflow_summary`、`workflow_suggestions`。
- 后端在关键帧保存阶段已经持有逐帧分析结果来源：`detections.objects`、`detections.pose_keypoints`、`interaction_summary`。
- 当前缺口是“视频回放 + 逐帧叠加可视化”。

**设计原则**:
- 最小侵入地扩展现有 VideoLearning 工作台，不推翻 phase3 UI。
- 逐帧可视化依赖后端已有分析产物，不在前端重新跑模型。
- 保持旧数据兼容：没有 pose 或 bbox 数据时仍能正常播放视频，只降级展示动作摘要。

## 方案选择

采用“新增后端逐帧结果接口 + 前端 video/canvas 双层叠加”的方案。

放弃方案：
- 仅关键帧叠加：不满足用户要求的播放中持续分析效果。
- 后端预渲染结果视频：交互性不足、生成成本高、调试困难。
- 前端本地重新分析：超出当前项目边界，性能和依赖成本过高。

## 前端设计

### 布局

在弹窗右侧顶部新增“视频分析回放”卡片，位于统计卡片组之前。

卡片包含：
- 原始视频播放器
- 覆盖在视频上的 canvas
- 播放控制栏：播放/暂停、时间轴、时间显示
- 显示开关：目标框、骨骼、动作标签
- 当前动作摘要条：当前步骤名、对象标签、pose 摘要

下方保留现有统计卡片、工作台 Tabs、SOP 预览、建议等内容。

### 交互

- 打开工作台时同步加载：sessions、actions、SOP preview、frame overlays
- `video.currentTime` 变化时，从逐帧结果中找最接近的 frame overlay
- 目标框绘制：bbox + 类名 + confidence
- 骨骼绘制：根据 `pose_keypoints` 连接关键点
- 动作列表点击后，视频跳到 `start_time`
- 当前动作时间段与视频时间联动高亮
- 若逐帧数据为空，播放器仍显示视频和动作级摘要

### 组件实现

继续在 `frontend/src/pages/VideoLearning/index.tsx` 内完成，避免无必要拆分。

新增状态：
- `videoRef`
- `overlayCanvasRef`
- `currentTime`
- `isPlaying`
- `overlayFrames`
- `overlayOptions`

新增辅助逻辑：
- `buildVideoUrl()`
- `findCurrentAction(currentTime)`
- `findClosestOverlayFrame(currentTime)`
- `drawOverlay(frame)`
- `seekToAction(action)`

### UI 兼容修正

- 去掉 antd `List` 依赖，改为普通 `div` / `Card` 列表渲染，避免弃用告警。
- 把 `Space direction="vertical"` 改成非弃用写法，优先使用 `Flex vertical` 或分层 `div`。
- `setFieldsValue` 保持在 Form 已挂载后执行，避免 `useForm` 警告。

## 后端设计

### 新增接口

新增接口示意：

`GET /api/video-learning/sessions/{session_id}/frame-overlays`

支持参数：
- `start_time`: 可选
- `end_time`: 可选
- `stride`: 默认 1 或 2，用于抽样
- `limit`: 默认合理上限，避免一次返回过大结果

返回字段：
- `frame_number`
- `timestamp`
- `objects`: `[{ class_name, confidence, bbox }]`
- `pose_keypoints`
- `interaction_summary`
- `is_boundary`
- `image_width`
- `image_height`

### 数据来源

复用 `key_frames.detections` 中已存的 JSON 结构，不新增表。

需要确认并统一 `detections` JSON 序列化格式：
- `objects`
- `pose_keypoints`
- `interaction_summary`

如缺少宽高，优先从视频分辨率中推导；如 bbox 已是归一化坐标，则前端按视频 DOM 尺寸缩放。

## 测试设计

### 后端

新增测试覆盖：
- frame overlay 接口能返回逐帧 objects/pose 数据
- 支持 stride / limit / 时间范围过滤
- 空会话或无关键帧时返回空数组

### 前端

新增测试覆盖：
- 打开工作台后请求 overlay 接口
- 播放器区域存在
- 点击动作列表触发 seek
- 开关关闭时不绘制对应 overlay 信息
- 无 overlay 数据时页面仍正常渲染

### 验证

- `cd backend && pytest tests/test_video_learning.py -q`
- `cd frontend && npm run test -- src/__tests__/pages/VideoLearning.test.tsx`
- `cd frontend && npm run build`

## 风险与处理

- 大视频逐帧数据过大：通过 `stride` 和 `limit` 控制
- 历史数据字段不全：前端按字段存在性降级
- bbox/pose 坐标系不一致：先统一后端输出约定，再在前端缩放
- canvas 重绘频繁：只在 `timeupdate` / seek / resize 时重绘，不额外启动轮询

## 完成标准

- 弹窗内可播放视频
- 视频上可叠加显示目标框、对象标签、骨骼
- 点击动作列表可跳转视频
- 当前动作摘要随播放变化
- 前后端测试与前端构建通过

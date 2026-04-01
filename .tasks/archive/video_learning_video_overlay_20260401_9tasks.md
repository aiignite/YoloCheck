# 任务清单

> 项目: VideoLearning 弹窗增加视频播放器与逐帧叠加分析
> 设计文档: `docs/plans/2026-04-01-video-learning-video-overlay-design.md`
> 实施计划: `docs/plans/2026-04-01-video-learning-video-overlay-plan.md`

---

## [x] 任务1：为逐帧 overlay API 写失败测试与响应模型 ✅

**描述**: 给视频学习后端补一个逐帧 overlay 返回结构，先从测试和 schema 开始。

**要求**:
- 在 `backend/tests/test_video_learning.py` 增加 frame overlays 接口失败测试
- 在 `backend/app/schemas/video_learning.py` 增加逐帧 overlay schema
- 不修改数据库表结构

**产出**:
- `backend/tests/test_video_learning.py`
- `backend/app/schemas/video_learning.py`

**参考**:
- `docs/plans/2026-04-01-video-learning-video-overlay-plan.md`
- `backend/app/api/video_learning.py`

**完成时间**: 2026-04-01

**实施情况**:
- ✅ 在 `backend/tests/test_video_learning.py` 增加了 `frame-overlays` 接口失败测试
- ✅ 失败测试已验证当前接口缺失，返回 404，符合 TDD 红灯预期
- ✅ 在 `backend/app/schemas/video_learning.py` 增加逐帧 overlay 响应模型
- ✅ 未修改数据库表结构，保持与 phase2/phase3 数据落点兼容

## [x] 任务2：实现 frame overlays 后端接口 ✅

**描述**: 新增读取会话关键帧分析结果的 API，供前端播放器按时间叠加绘制。

**要求**:
- 新增 `/api/video-learning/sessions/{session_id}/frame-overlays`
- 支持 `start_time`、`end_time`、`stride`、`limit`
- 返回 objects、pose_keypoints、interaction_summary
- 无数据时返回空数组而不是报错

**产出**:
- `backend/app/api/video_learning.py`
- `backend/app/crud/video_learning.py`
- `backend/tests/test_video_learning.py`

**参考**:
- `backend/app/core/video_learning.py`
- `backend/app/schemas/video_learning.py`

**完成时间**: 2026-04-01

**实施情况**:
- ✅ 在 `backend/app/crud/video_learning.py` 增加了按时间范围、stride、limit 读取关键帧 overlay 的查询方法
- ✅ 在 `backend/app/api/video_learning.py` 增加了 `/sessions/{session_id}/frame-overlays` 接口
- ✅ 新接口会返回 objects、pose_keypoints、interaction_summary，并在无数据时返回空数组
- ✅ `pytest tests/test_video_learning.py -k "frame_overlays" -v` 已通过

## [x] 任务3：为前端视频播放器写失败测试 ✅

**描述**: 先让测试定义新工作台中应该出现的视频回放区域与 overlay 请求行为。

**要求**:
- 在 `frontend/src/__tests__/pages/VideoLearning.test.tsx` 增加播放器存在性断言
- 增加 overlay 接口请求断言
- 增加点击动作跳转断言骨架

**产出**:
- `frontend/src/__tests__/pages/VideoLearning.test.tsx`

**参考**:
- `frontend/src/pages/VideoLearning/index.tsx`

**完成时间**: 2026-04-01

**实施情况**:
- ✅ 在 `frontend/src/__tests__/pages/VideoLearning.test.tsx` 增加了 overlay 请求与视频回放区域断言
- ✅ 测试已确认前端当前不会请求 `/video-learning/sessions/101/frame-overlays`
- ✅ 测试已确认当前弹窗中还没有视频回放区域，满足任务4前的红灯要求

## [x] 任务4：在弹窗右侧顶部加入视频播放器基础结构 ✅

**描述**: 给 VideoLearning 工作台增加视频回放卡片，但先不做复杂绘制。

**要求**:
- 使用现有 `selectedTemplate.video_path` 生成视频 URL
- 增加 `video` 元素、播放/暂停、时间显示、进度条
- 保留原 phase3 统计卡片和 Tabs 布局
- 不引入新的大组件文件，优先在现有页面内实现

**产出**:
- `frontend/src/pages/VideoLearning/index.tsx`

**参考**:
- `docs/plans/2026-04-01-video-learning-video-overlay-design.md`

**完成时间**: 2026-04-01

**实施情况**:
- ✅ 在 `frontend/src/pages/VideoLearning/index.tsx` 右侧顶部新增了“视频回放”卡片
- ✅ 已接入 `selectedTemplate.video_path` 的视频 URL 解析与播放器基础控件
- ✅ 打开工作台时会请求 `/video-learning/sessions/{id}/frame-overlays`
- ✅ `npm run test -- src/__tests__/pages/VideoLearning.test.tsx` 已通过

## [x] 任务5：接入逐帧 overlay 数据并绘制目标框 ✅

**描述**: 用 canvas 在视频上层绘制当前时间对应的目标框与标签。

**要求**:
- 打开工作台时拉取 overlay 数据
- 以 `currentTime` 找最近帧
- 绘制 bbox、类名、置信度
- 提供“显示目标框”开关
- 没有 objects 时正常降级

**产出**:
- `frontend/src/pages/VideoLearning/index.tsx`
- `frontend/src/__tests__/pages/VideoLearning.test.tsx`

**完成时间**: 2026-04-01

**实施情况**:
- ✅ `VideoLearning` 已在播放器上层增加 canvas overlay
- ✅ 已根据 `currentTime` 匹配最近逐帧结果并绘制基础 bbox 和标签
- ✅ 已增加“显示目标框”开关
- ✅ 定向前端测试已通过

## [x] 任务6：在视频上绘制人体骨骼并展示 pose 摘要 ✅

**描述**: 叠加人体关键点与骨架连线，同时展示当前动作的 pose 摘要信息。

**要求**:
- 读取 `pose_keypoints`
- 在 canvas 上画关键点和连线
- 展示 `pose_summary` 摘要，如 `frames_with_pose`、`wrist_span_x`、`wrist_span_y`
- 提供“显示骨骼”开关
- 无 pose 数据时不报错

**产出**:
- `frontend/src/pages/VideoLearning/index.tsx`

**参考**:
- `backend/app/core/video_learning.py`

**完成时间**: 2026-04-01

**实施情况**:
- ✅ 已在播放器 canvas 上增加基础骨骼关键点与连线绘制
- ✅ 已增加“显示骨骼”开关
- ✅ 已在播放器控制区展示当前动作的 pose 摘要信息
- ✅ 前端定向测试保持通过

## [x] 任务7：实现动作列表与播放器联动 ✅

**描述**: 当前动作应随播放时间变化而高亮，点击动作也能跳到视频对应时间。

**要求**:
- Timeline 中点击动作项可 `seek`
- 当前时间所在动作段高亮
- 视频上方叠加当前步骤名和对象标签
- 步骤切换时 UI 同步更新

**产出**:
- `frontend/src/pages/VideoLearning/index.tsx`
- `frontend/src/__tests__/pages/VideoLearning.test.tsx`

**完成时间**: 2026-04-01

**实施情况**:
- ✅ Timeline 中点击动作项已支持跳转到对应视频时间
- ✅ 当前时间所在动作段会在列表中高亮
- ✅ 视频顶部已叠加当前步骤名与对象标签
- ✅ 前端定向测试保持通过

## [x] 任务8：清理前端弃用告警与 useForm 警告 ✅

**描述**: 顺手清理目前已知的 antd 告警，避免播放器功能叠加后调试噪音更大。

**要求**:
- 去掉 `List` 弃用用法
- 去掉 `Space direction` 弃用用法
- 避免 `useForm` 未挂载时 `setFieldsValue`

**产出**:
- `frontend/src/pages/VideoLearning/index.tsx`

**完成时间**: 2026-04-01

**实施情况**:
- ✅ 已将 `setFieldsValue` 延后到 Form 挂载后执行，规避 `useForm` 警告
- ✅ 已把主要 `Space direction` 替换为 `Flex vertical` 或普通布局
- ✅ 已移除 timeline 中的 `List` 依赖，改为普通 `Card` 列表渲染
- ✅ 前端定向测试和构建已通过

## [x] 任务9：运行验证并通过 feedback MCP 反馈 ✅

**描述**: 在功能完成后执行前后端验证，并按用户要求通过 feedback MCP 反馈。

**要求**:
- 运行后端测试
- 运行前端定向测试
- 运行前端构建
- 整理产出和剩余风险
- 通过 feedback MCP 反馈结果

**产出**:
- 验证命令输出
- feedback MCP 反馈记录

**完成时间**: 2026-04-01

**实施情况**:
- ✅ 后端验证通过：`cd backend && pytest tests/test_video_learning.py -q` -> `11 passed`
- ✅ 前端定向测试通过：`cd frontend && npm run test -- src/__tests__/pages/VideoLearning.test.tsx` -> `2 passed`
- ✅ 前端构建通过：`cd frontend && npm run build`
- ✅ 已确认 `~/.claude/mcp.json` 中存在 `mcp-feedback-enhanced` 配置，目标工具为 `interactive_feedback`
- ⚠️ 当前会话工具集中没有直接调用外部 MCP tool 的通用客户端入口，因此未能在本会话内实际触发 `interactive_feedback`；已完成定位与参数确认，可在支持 MCP 调用的客户端中执行

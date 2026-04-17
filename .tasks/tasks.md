# 任务清单 — 视频训练工作流优化

> 目标：优化学习/训练的端到端操作体验，让用户能从视频学习结果快速生成自定义物体检测模型

## [x] 任务1：后端 — 添加从学习会话导入物体标注的 API ✅

**完成时间**: 2026-04-03

**实施情况**:
- ✅ 新增 `POST /object-annotation-sets/{set_id}/annotations/from-session` 端点
- ✅ 新增 `ObjectAnnotationFromSessionRequest` schema（session_id + min_confidence）
- ✅ 新增 `get_session_keyframes_with_detections` CRUD 方法
- ✅ 新增 `batch_create_object_annotations` 批量导入方法
- ✅ 新增 `get_annotation_count_by_set` 标注计数方法

## [x] 任务2：前端 — 物体标注集管理 UI + 从学习会话导入 ✅

**完成时间**: 2026-04-03

**实施情况**:
- ✅ 物体类别 tab 重命名为「物体检测训练」，整合类别+标注集+导入
- ✅ 新增标注集列表（名称、来源、状态）和「新建标注集」Modal
- ✅ 新增「从学习会话导入物体标注」卡片：选模板→选会话→选标注集→导入
- ✅ 独立的 objectSessionOptions 和 objectImportForm 状态管理

## [x] 任务3：前端 — 添加物体检测训练任务创建 UI ✅

**完成时间**: 2026-04-03

**实施情况**:
- ✅ 标注集列表每行增加「开始训练」按钮
- ✅ 训练任务创建 Modal：任务名称、标注集、epochs、image_size
- ✅ 训练任务状态 Tag 颜色区分（pending/running/completed/failed）
- ✅ 任务类型显示中文（物体检测/动作识别）

## [x] 任务4：前端 — 训练任务进度自动刷新 + 模型激活优化 ✅

**完成时间**: 2026-04-03

**实施情况**:
- ✅ running/pending 状态任务自动每5秒轮询刷新
- ✅ 训练任务表格进度列使用 Progress 组件显示进度条
- ✅ 模型激活后提示「可在视频学习中使用」
- ✅ 标注集导入后自动刷新列表

## [ ] 任务5：前端测试更新 + i18n + 构建验证

**描述**: 更新前端测试覆盖所有新增功能，添加 i18n 翻译，确保构建通过

**要求**:
- 更新 `VideoTraining.test.tsx`：测试标注集创建、会话导入、训练任务创建
- 新增 i18n key：videoTraining 下的标注集、导入、训练相关文本
- 确保 `npm run build` 和 `npm run test` 通过

**产出**:
- `frontend/src/__tests__/pages/VideoTraining.test.tsx` — 新测试
- `frontend/src/locales/zh.json` 和 `en.json` — 新翻译

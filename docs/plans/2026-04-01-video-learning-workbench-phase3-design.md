# Video Learning Workbench Phase 3 Design

**目标**: 在现有视频学习工作台基础上，一次性增强识别准确性、流程智能、工作台可用性，并直接生成 SOP / 标准作业模板。

## 现状

- 第一阶段已完成视频学习工作台基础能力：模板上传、学习配置、动作段查看、关键帧与对象统计。
- 第二阶段已完成 pose 特征、手-工具-产品交互特征、动作段拆分/合并、模板对比。
- 当前动作识别仍以场景变化和对象聚合为主，缺少时序平滑、质量评分、流程建议、批量采纳和 SOP 结构化输出。

## 设计原则

- 继续沿用现有 `video_learning` 链路渐进增强，不引入新的训练框架。
- 优先复用 `ActionSequence.features`、`KeyFrame.detections`、`LearningSession.analysis_result` 这些 JSON 数据落点，尽量避免数据库结构扩张。
- 后端先产出稳定、可解释的建议结果，前端以“预览 + 人工采纳”为主，不做黑箱式自动覆盖。
- 输出结果必须能回落到可保存的标准模板内容，便于后续沉淀和复用。

## 功能范围

### 1. 识别更准

- 为动作段增加时序平滑后的对象统计、边界质量评分、动作段质量评分。
- 基于对象频次、pose 活跃度、interaction 次数、场景变化均值对动作段置信度重评分。
- 增加“建议动作名称”与“建议关键对象”，让识别结果更可解释。
- 在模板对比基础上，增加参考模板相似度摘要，为动作命名和流程判断提供辅助。

### 2. 流程更智能

- 基于动作顺序、时长、对象组合和 pose / interaction 特征，生成流程建议。
- 输出可解释建议，包括：
  - 建议合并的相邻动作段
  - 建议拆分的低质量长动作段
  - 建议标准命名
  - 疑似异常步骤或缺失步骤
- 结果先以建议形式返回，不直接替代人工结果。

### 3. 工作台更好用

- 在 `VideoLearning` 增加智能建议视图。
- 增加流程概览卡片，展示步骤总览、低置信度步骤数、异常步骤数、可采纳建议数。
- 增加 SOP 预览页签，支持从当前动作段生成标准作业文稿预览。
- 增加一键采纳单条建议能力，减少人工逐条编辑成本。

### 4. 直接产出 SOP / 标准作业模板

- 基于动作段、关键帧、主要对象、建议说明，生成结构化 SOP。
- SOP 输出采用 JSON 结构，包含：标题、适用工位、步骤列表、每步目标、关键对象、注意事项、参考图。
- 模板支持保存 `sop_content` 和 `workflow_summary`，让模板不仅保存视频，也保存可复用的标准作业说明。

## 数据设计

- `VideoTemplate.learning_config` 继续保存学习参数。
- `ActionSequence.features` 增加第三阶段增强字段：
  - `quality_score`
  - `smoothed_object_frequency`
  - `suggested_action_name`
  - `suggested_objects`
  - `suggestions`
- `LearningSession.analysis_result` 增加：
  - `workflow_summary`
  - `workflow_suggestions`
  - `sop_preview`
- `KeyFrame.detections` 继续保留 enrich 后结构，不单独拆表。
- 如需模板级 SOP 持久化，优先在 `VideoTemplate` 增加 JSON 字段，避免拆新表。

## 后端设计

### 识别增强

- 在 `core/video_learning.py` 中增加动作段增强分析函数，对每个动作段计算：
  - 平滑后的对象频次
  - pose 活跃度
  - interaction 密度
  - 边界稳定性
  - 建议动作名
- 生成统一的 `workflow_suggestions`，作为会话摘要的一部分。

### 新增/增强 API

- 增强 `GET /video-learning/templates/{template_id}/summary`
  - 返回 `workflow_summary`、`workflow_suggestions`、`sop_preview`
- 新增 `POST /video-learning/templates/{template_id}/sop-preview`
  - 按当前动作段生成 SOP 预览
- 新增 `PUT /video-learning/templates/{template_id}/sop`
  - 保存 SOP 内容到模板
- 新增 `POST /video-learning/actions/{action_id}/apply-suggestion`
  - 采纳动作段命名或保留建议

## 前端设计

- 在现有工作台页签中新增：
  - `智能建议`
  - `流程概览`
  - `SOP 预览`
- 在动作段时间轴中展示：
  - 质量分
  - 建议动作名
  - 低质量标记
  - 一键采纳建议按钮
- SOP 预览展示：
  - 模板标题
  - 工位/业务类型
  - 步骤说明
  - 关键对象标签
  - 关键帧图片

## 错误处理

- 如果增强分析失败，不影响基础动作段输出，但会在会话摘要中给出降级提示。
- 如果没有关键帧或动作段，SOP 预览应返回空步骤结构，不直接报错。
- 如果模板对比数据不足，相关建议返回空数组而不是 500。

## 测试与验证

- 后端：补充 `backend/tests/test_video_learning.py`，覆盖 summary / SOP / 建议采纳接口。
- 前端：新增 `frontend/src/__tests__/pages/VideoLearning.test.tsx`，覆盖智能建议和 SOP 预览基本渲染。
- 构建验证：
  - `cd frontend && npm run build`
  - `cd backend && pytest tests/test_video_learning.py -v`
  - `cd backend && python -c "from app.api.video_learning import router; print('router import ok', len(router.routes))"`

## 边界

- 第三阶段仍不引入真正的训练型动作分类器。
- SOP 先提供结构化预览与模板保存，不做 Word/PDF 导出。
- 工作台仍以人工审核为主，建议仅作为辅助，不做全自动改写。

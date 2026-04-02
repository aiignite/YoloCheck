# Video Learning Custom Training Design

**目标**: 为视频学习模块增加自定义物体训练和自定义动作训练能力，支持数据标注、骨骼样本导入、训练任务管理、模型版本切换，以及在现有视频学习流程中的推理接入。

## 背景

现有视频学习模块基于 YOLO 检测和 YOLO pose 做逐帧分析，但存在三个结构性限制：

1. 物体类别依赖预训练模型，无法稳定支持用户自定义类别。
2. 动作识别主要依赖规则分段与对象聚合，没有动作训练数据闭环。
3. 页面只覆盖学习工作台，没有数据集、训练任务、模型切换的管理界面。

## 设计原则

1. 在现有 `video_learning` 链路上渐进增强，不推翻既有能力。
2. 复用现有 `models` 表作为模型版本管理表，避免重复建设。
3. 先交付可运行 MVP：数据集管理、训练任务、模型激活、视频学习接入。
4. 动作训练采用轻量骨骼序列分类方案，避免第一阶段引入重型训练框架。

## 范围

### 物体训练

- 维护自定义物体类别，如 `hand`、`tv`、`book`。
- 支持从图片、视频关键帧创建标注样本。
- 支持按标注集发起本机异步 YOLO 训练任务。
- 训练完成后生成可部署模型版本，并接入现有视频学习流程。

### 动作训练

- 维护动作类别，如 `pick_book`、`place_book`、`watch_screen`。
- 支持导入骨骼序列 JSON。
- 支持从已有视频学习会话中提取骨骼片段并人工标注动作。
- 支持按动作样本集发起本机异步训练任务。
- 训练完成后生成动作模型版本，并在视频学习中作为动作分类补充结果。

## 数据设计

### 新增表

1. `object_categories`
- 自定义物体类别
- 字段：`id`、`name`、`display_name`、`description`、`color`、`icon`、`is_builtin`、`is_active`、`created_at`

2. `object_annotation_sets`
- 物体标注集头表
- 字段：`id`、`name`、`description`、`source_type`、`status`、`created_by`、`created_at`

3. `object_annotations`
- 单张图片或单帧标注
- 字段：`id`、`annotation_set_id`、`image_path`、`frame_number`、`source_video_template_id`、`width`、`height`、`annotations_json`、`created_at`

4. `action_categories`
- 动作类别
- 字段：`id`、`name`、`display_name`、`description`、`is_active`、`created_at`

5. `action_sample_sets`
- 动作样本集头表
- 字段：`id`、`name`、`description`、`source_type`、`status`、`created_by`、`created_at`

6. `action_samples`
- 动作样本
- 字段：`id`、`sample_set_id`、`action_category_id`、`source_session_id`、`start_frame`、`end_frame`、`duration`、`skeleton_sequence_json`、`metadata_json`、`created_at`

7. `training_jobs`
- 统一训练任务
- 字段：`id`、`name`、`job_type`、`dataset_type`、`dataset_id`、`model_id`、`status`、`progress`、`config_json`、`metrics_json`、`log_path`、`error_message`、`started_at`、`completed_at`、`created_at`

### 复用现有表

复用 `models` 表记录训练产出的模型版本。

- `model_type` 扩展为：`custom_object`、`custom_action`
- `description`、`model_path`、`accuracy`、`precision`、`recall`、`map50`、`map50_95`、`inference_speed` 继续沿用

### 扩展现有视频学习表

1. `VideoTemplate.learning_config`
- 增加 `object_model_id`、`action_model_id`、`object_category_ids`

2. `LearningSession`
- 增加 `object_model_id`、`action_model_id`

3. `ActionSequence.features`
- 增加 `predicted_action_category`、`action_model_score`、`skeleton_summary`

## 后端设计

### API 分组

新增单独路由文件 `backend/app/api/video_training.py`，统一挂载到 `/api/video-training`。

核心接口：

1. 物体类别
- `GET /object-categories`
- `POST /object-categories`

2. 物体标注集
- `GET /object-annotation-sets`
- `POST /object-annotation-sets`
- `POST /object-annotation-sets/{id}/annotations`

3. 动作类别
- `GET /action-categories`
- `POST /action-categories`

4. 动作样本集
- `GET /action-sample-sets`
- `POST /action-sample-sets`
- `POST /action-sample-sets/{id}/samples/import-json`
- `POST /action-sample-sets/{id}/samples/from-session`

5. 训练任务
- `GET /training-jobs`
- `POST /training-jobs/object-detection`
- `POST /training-jobs/action-recognition`
- `POST /training-jobs/{id}/activate-model`

### 训练实现

1. 物体训练
- 使用标注集导出 YOLO 数据集目录结构
- 使用后台线程启动训练命令
- 训练结果写入 `models` 与 `training_jobs`

2. 动作训练
- 使用骨骼序列样本生成 numpy 训练集
- 第一阶段采用轻量 centroid/nearest-prototype 训练器，输出 JSON 权重文件
- 训练结果同样写入 `models` 与 `training_jobs`

3. 视频学习接入
- `video_learning` 启动学习时读取模板配置里的 `object_model_id`、`action_model_id`
- 物体检测优先使用激活的自定义物体模型，无法加载时回退到默认 YOLO 模型
- 动作识别结果写入 `ActionSequence.features`

## 前端设计

新增页面 `frontend/src/pages/VideoTraining/index.tsx`，作为训练管理工作台。

页面包含四个 Tab：

1. 物体类别
- 新建类别
- 颜色标签与说明管理

2. 物体标注
- 创建标注集
- 上传图片
- 从视频学习关键帧导入图片
- 录入标注框 JSON

3. 动作样本
- 创建动作类别
- 创建样本集
- 导入骨骼序列 JSON
- 从学习会话动作段生成样本

4. 训练与模型
- 创建训练任务
- 查看训练状态与进度
- 激活模型

同时在现有 `VideoLearning` 页面学习配置中增加：

- 选择物体模型
- 选择动作模型
- 选择对象类别

## 测试策略

1. 后端 API 测试先行
- 物体类别创建与列表
- 动作样本导入
- 训练任务创建
- 训练模型激活

2. 前端页面测试
- 新页面能加载训练任务与类别列表
- 能提交物体类别创建
- 能提交动作样本集创建

3. 验证命令
- `cd backend && pytest tests/test_video_learning.py tests/test_video_training.py -q`
- `cd frontend && npm run test -- src/__tests__/pages/VideoLearning.test.tsx src/__tests__/pages/VideoTraining.test.tsx`
- `cd frontend && npm run build`

## 风险与边界

1. 第一阶段不做浏览器内复杂框选器，标注先采用结构化 JSON 录入与图片上传结合方式。
2. 第一阶段动作训练器优先保证闭环可用，不追求高精度深度学习模型。
3. 训练任务采用本机异步执行，不引入独立 worker 与分布式队列。

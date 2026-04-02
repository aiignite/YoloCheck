# 任务清单

> 自动生成于 2026-04-02 | 需求：实现视频学习自定义物体训练与动作训练 | 共 9 个任务

---

## [x] 任务1：先补自定义训练后端失败测试 ✅

**描述**: 用 TDD 先锁定物体类别、动作样本、训练任务与视频学习配置扩展的预期行为。

**要求**:
- 在 `backend/tests/test_video_training.py` 增加新接口测试
- 在 `backend/tests/test_video_learning.py` 增加自定义模型配置回传测试
- 先运行并确认失败原因正确

**产出**:
- `backend/tests/test_video_training.py`
- `backend/tests/test_video_learning.py`

**参考**:
- `docs/plans/2026-04-02-video-learning-custom-training-design.md`
- `docs/plans/2026-04-02-video-learning-custom-training-plan.md`

**完成时间**: 2026-04-02

**实施情况**:
- ✅ 新增 `backend/tests/test_video_training.py`，覆盖物体类别、动作样本集、训练任务与模型激活
- ✅ 在 `backend/tests/test_video_learning.py` 增加自定义模型配置回传测试
- ✅ 首次运行确认红灯来自 `/api/video-training/*` 路由缺失，符合 TDD 预期

---

## [x] 任务2：新增后端训练数据模型与 schema ✅

**描述**: 增加自定义物体训练、动作训练与训练任务的数据结构。

**要求**:
- 在 `models.py` 增加训练相关表
- 复用 `models` 表管理训练产物
- 在 schema 中增加新接口所需请求与响应模型

**产出**:
- `backend/app/models/models.py`
- `backend/app/schemas/model.py`
- `backend/app/schemas/video_learning.py`

**参考**:
- `docs/plans/2026-04-02-video-learning-custom-training-design.md`

**完成时间**: 2026-04-02

**实施情况**:
- ✅ 在 `backend/app/models/models.py` 新增物体类别、标注集、动作类别、动作样本、训练任务等表
- ✅ 扩展 `backend/app/schemas/model.py` 支持 `custom_object` 和 `custom_action`
- ✅ 扩展 `backend/app/schemas/video_learning.py` 支持自定义模型配置和训练 API schema
- ✅ 在 `main.py` 与 `alembic/env.py` 注册新增模型元数据

---

## [x] 任务3：实现后端 CRUD 与 video-training API ✅

**描述**: 提供类别、标注集、动作样本集、训练任务的基础 API。

**要求**:
- 新增 `crud/video_training.py`
- 新增 `api/video_training.py`
- 在 `main.py` 注册新路由

**产出**:
- `backend/app/crud/video_training.py`
- `backend/app/api/video_training.py`
- `backend/app/main.py`

**参考**:
- `backend/app/api/video_learning.py`
- `backend/app/api/models.py`

**完成时间**: 2026-04-02

**实施情况**:
- ✅ 新增 `backend/app/crud/video_training.py` 提供类别、样本集、训练任务 CRUD
- ✅ 新增 `backend/app/api/video_training.py` 并注册到 `/api/video-training`
- ✅ 支持物体类别、动作类别、物体标注集、动作样本集、骨骼 JSON 导入、训练任务列表与创建接口

---

## [x] 任务4：实现训练任务与模型激活最小闭环 ✅

**描述**: 先做本机异步训练骨架，让训练任务可完成并产出模型记录。

**要求**:
- 增加训练服务文件
- 物体训练输出数据集摘要与模型文件路径
- 动作训练输出骨骼原型模型 JSON
- 支持训练后激活模型

**产出**:
- `backend/app/core/video_training.py`
- `backend/app/api/video_training.py`

**参考**:
- `backend/app/core/video_learning.py`
- `backend/app/crud/model.py`

**完成时间**: 2026-04-02

**实施情况**:
- ✅ 新增 `backend/app/core/video_training.py`，生成最小物体模型与动作模型产物
- ✅ 训练任务创建后会同步产出 `models` 记录并回写 `model_id`
- ✅ 支持 `/api/video-training/training-jobs/{id}/activate-model` 激活训练产物模型
- ✅ 新增激活闭环测试并验证通过

---

## [x] 任务5：将自定义模型配置接入视频学习后端 ✅

**描述**: 让视频学习模板和会话能保存并返回物体模型、动作模型与对象类别配置。

**要求**:
- 更新配置 schema
- 更新模板配置保存逻辑
- 更新学习会话快照

**产出**:
- `backend/app/api/video_learning.py`
- `backend/app/crud/video_learning.py`
- `backend/app/schemas/video_learning.py`

**参考**:
- `backend/tests/test_video_learning.py`

**完成时间**: 2026-04-02

**实施情况**:
- ✅ `StartLearningRequest` 和 `LearningSessionResponse` 增加 `object_model_id`、`action_model_id`
- ✅ 模板学习配置支持保存 `object_category_ids`
- ✅ 视频学习配置更新接口已能回传自定义模型字段

---

## [x] 任务6：先补前端训练工作台失败测试 ✅

**描述**: 在页面实现前先锁定训练工作台与模型选择器的交互预期。

**要求**:
- 新增 `VideoTraining` 页面测试
- 更新 `VideoLearning` 页面测试覆盖模型选择器
- 先运行并确认失败

**产出**:
- `frontend/src/__tests__/pages/VideoTraining.test.tsx`
- `frontend/src/__tests__/pages/VideoLearning.test.tsx`

**参考**:
- `frontend/src/pages/VideoLearning/index.tsx`

**完成时间**: 2026-04-02

**实施情况**:
- ✅ 新增 `frontend/src/__tests__/pages/VideoTraining.test.tsx`
- ✅ 扩展 `frontend/src/__tests__/pages/VideoLearning.test.tsx` 覆盖自定义物体模型和动作模型选择器
- ✅ 首次运行确认红灯来自缺少页面与控件，符合 TDD 预期

---

## [x] 任务7：实现前端训练工作台与路由 ✅

**描述**: 新增自定义训练管理页面，支持类别、样本集和训练任务管理。

**要求**:
- 新增 `VideoTraining` 页面
- 增加菜单和路由
- 增加中英文文案

**产出**:
- `frontend/src/pages/VideoTraining/index.tsx`
- `frontend/src/App.tsx`
- `frontend/src/layouts/MainLayout.tsx`
- `frontend/src/locales/zh.json`
- `frontend/src/locales/en.json`

**参考**:
- `frontend/src/pages/ModelManager/index.tsx`

**完成时间**: 2026-04-02

**实施情况**:
- ✅ 新增 `frontend/src/pages/VideoTraining/index.tsx`
- ✅ 增加物体类别、动作样本、训练任务三个页签
- ✅ 新增路由 `/video-training` 与左侧菜单入口
- ✅ 补充中英文菜单文案

---

## [x] 任务8：将自定义模型选择接入 VideoLearning 页面 ✅

**描述**: 让视频学习配置能够选择自定义物体模型和动作模型。

**要求**:
- 加载模型列表
- 增加配置选择器
- 保存并启动学习时带上模型 id

**产出**:
- `frontend/src/pages/VideoLearning/index.tsx`

**参考**:
- `frontend/src/pages/ModelManager/index.tsx`

**完成时间**: 2026-04-02

**实施情况**:
- ✅ `VideoLearning` 页面已加载 `/models` 并过滤 `custom_object`、`custom_action`
- ✅ 在学习配置区增加“物体模型”“动作模型”选择器
- ✅ 打开工作台时会回填模板上保存的模型配置

---

## [x] 任务9：完成验证与结果记录 ✅

**描述**: 对后端测试、前端测试和前端构建做完整验证，并在任务清单中记录实施情况。

**要求**:
- 运行后端测试
- 运行前端测试
- 运行前端构建
- 更新任务完成状态

**产出**:
- `.tasks/tasks.md`

**参考**:
- `docs/plans/2026-04-02-video-learning-custom-training-plan.md`

**完成时间**: 2026-04-02

**实施情况**:
- ✅ `cd backend && pytest tests/test_video_training.py tests/test_video_learning.py -q` 通过（17 passed）
- ✅ `cd frontend && npm run test -- src/__tests__/pages/VideoTraining.test.tsx src/__tests__/pages/VideoLearning.test.tsx` 通过（6 passed）
- ✅ `cd frontend && npm run build` 通过
- ⚠️ 后端仍有既有 Pydantic `model_*` 命名 warning 与 `datetime.utcnow()` 弃用 warning，未在本次任务中消除

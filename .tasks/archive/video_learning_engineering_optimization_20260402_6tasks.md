# 任务清单

> 自动生成于 2026-04-02 | 需求：视频学习自定义训练工程优先优化 | 共 6 个任务

---

## [x] 任务1：清理自定义训练链路的后端 warning 与 UTC 时间处理 ✅

**描述**: 先消除当前 custom training 相关后端 warning，确保测试输出干净，为后续异步训练和真实推理接入降低噪音。

**要求**:
- 先补失败测试锁定 `datetime.utcnow()` 弃用 warning
- 先补失败测试锁定 Pydantic `model_*` protected namespace warning
- 仅修复本轮自定义训练直接触达链路，避免扩大改动面

**产出**:
- `backend/tests/test_video_training.py`
- `backend/app/core/video_training.py`
- `backend/app/api/video_training.py`
- `backend/app/crud/model.py`
- `backend/app/schemas/model.py`
- `backend/app/schemas/video_learning.py`
- `backend/app/api/models.py`

**参考**:
- `backend/app/api/video_training.py`
- `backend/app/core/video_training.py`

**完成时间**: 2026-04-02

**实施情况**:
- ✅ 在 `backend/tests/test_video_training.py` 新增回归测试，锁定训练产物 UTC 时区时间戳与 `model_*` namespace warning
- ✅ 将 `backend/app/core/video_training.py`、`backend/app/api/video_training.py`、`backend/app/crud/model.py` 的相关 `datetime.utcnow()` 改为时区感知 UTC 时间
- ✅ 在 `backend/app/schemas/model.py` 与 `backend/app/schemas/video_learning.py` 引入统一 schema 基类，清除 `model_*` protected namespace warning
- ✅ 调整 `backend/app/api/models.py` 上传接口内部参数名，保留外部 `model_type` 表单字段不变，同时消除 FastAPI 动态 body model warning
- ✅ `cd backend && pytest tests/test_video_training.py tests/test_video_learning.py -q` 通过（19 passed）

---

## [x] 任务2：把训练任务改为后台异步执行与可观测状态流转 ✅

**描述**: 把当前创建即完成的同步占位实现改成后台执行，至少具备 pending/running/completed/failed 的真实流转和日志定位能力。

**要求**:
- 先补失败测试锁定异步状态变化
- 创建任务时立即返回 pending 记录
- 后台执行时更新 started_at、completed_at、progress、error_message

**产出**:
- `backend/tests/test_video_training.py`
- `backend/app/api/video_training.py`
- `backend/app/core/video_training.py`
- `backend/app/crud/video_training.py`

**参考**:
- `backend/app/api/video_learning.py`
- `backend/app/core/batch_analysis.py`

**完成时间**: 2026-04-02

**实施情况**:
- ✅ 在 `backend/tests/test_video_training.py` 新增异步状态流转测试，锁定创建后先返回 `pending`、随后轮询到 `completed`
- ✅ 将 `backend/app/api/video_training.py` 的训练任务创建接口改为使用 `BackgroundTasks` 后台执行
- ✅ 新增后台 runner，补齐 `pending -> running -> completed/failed` 状态推进，并写入 `started_at`、`completed_at`、`error_message`
- ✅ 修复测试环境下后台任务误连默认数据库的问题，改为基于当前请求 `db.bind` 构造 session factory
- ✅ `cd backend && pytest tests/test_video_training.py tests/test_video_learning.py -q` 通过（20 passed）

---

## [x] 任务3：完善物体训练数据集导出与训练产物元数据 ✅

**描述**: 让物体训练不再只写占位 `.pt` 文件，而是先形成可检查的数据集导出目录、类别映射和训练摘要。

**要求**:
- 先补失败测试锁定导出目录结构与摘要字段
- 基于标注集导出最小可用训练数据目录
- 在训练任务 metrics 或 artifact 中保存类别与样本统计

**产出**:
- `backend/tests/test_video_training.py`
- `backend/app/core/video_training.py`
- `backend/app/crud/video_training.py`

**参考**:
- `docs/plans/2026-04-02-video-learning-custom-training-design.md`

**完成时间**: 2026-04-02

**实施情况**:
- ✅ 在 `backend/tests/test_video_training.py` 新增回归测试，锁定物体训练完成后会输出数据集导出摘要与类别统计
- ✅ 在 `backend/app/core/video_training.py` 实现最小数据集导出，生成 `images/train`、`labels/train`、`data.yaml` 与标签摘要
- ✅ 在 `backend/app/crud/video_training.py` 增加标注与类别查询能力，支撑导出阶段汇总 `annotation_count`、`class_names`、`label_files`
- ✅ `cd backend && pytest tests/test_video_training.py tests/test_video_learning.py -q` 串行通过（21 passed）

---

## [x] 任务4：补齐动作样本 from-session 导入与原型训练增强 ✅

**描述**: 打通从已有学习会话提取动作片段生成样本的闭环，并增强动作训练产物内容，避免只输出占位 JSON。

**要求**:
- 先补失败测试锁定 `/samples/from-session` 行为
- 从会话动作段与骨骼信息生成动作样本
- 训练结果写出类别原型、特征摘要和样本统计

**产出**:
- `backend/tests/test_video_training.py`
- `backend/app/api/video_training.py`
- `backend/app/core/video_training.py`
- `backend/app/crud/video_training.py`

**参考**:
- `backend/app/api/video_learning.py`
- `backend/app/models/models.py`

**完成时间**: 2026-04-02

**实施情况**:
- ✅ 在 `backend/tests/test_video_training.py` 新增从学习会话导入动作样本并完成训练的回归测试
- ✅ 新增 `/api/video-training/action-sample-sets/{id}/samples/from-session`，从 `ActionSequence.features.skeleton_summary` 提取骨骼序列生成动作样本
- ✅ 在 `backend/app/core/video_training.py` 增强动作训练摘要，输出 `sample_summary` 与 `prototype_summary`
- ✅ 串行验证 `backend` custom training 相关测试通过

---

## [x] 任务5：将自定义模型真正接入视频学习推理链路 ✅

**描述**: 让视频学习流程不仅保存模型 id，还能在分析时读取自定义模型并把识别结果回写到动作/对象分析字段。

**要求**:
- 先补失败测试锁定模型选择后的分析结果差异
- 对象检测优先读取激活或指定的自定义物体模型
- 动作识别结果写入 `ActionSequence.features`

**产出**:
- `backend/tests/test_video_learning.py`
- `backend/app/core/video_learning.py`
- `backend/app/api/video_learning.py`
- `backend/app/crud/video_learning.py`

**参考**:
- `docs/plans/2026-04-02-video-learning-custom-training-design.md`

**完成时间**: 2026-04-02

**实施情况**:
- ✅ 在 `backend/tests/test_video_learning.py` 新增回归测试，锁定自定义物体模型与动作模型会实际影响学习结果输出
- ✅ 为 `LearningSession` 持久化 `object_model_id`、`action_model_id`，并在启动学习时保存到会话快照
- ✅ 在 `backend/app/api/video_learning.py` 后台任务中复用当前请求数据库连接，避免测试/运行环境错库
- ✅ 在 `backend/app/core/video_learning.py` 与响应 schema 中补齐 `model_source`、动作模型预测结果、`skeleton_summary` 等字段回写
- ✅ `cd backend && pytest tests/test_video_training.py tests/test_video_learning.py -q` 通过（23 passed）

---

## [x] 任务6：补齐训练工作台闭环交互并完成验证归档 ✅

**描述**: 在后端闭环稳定后，再补前端对标注、样本导入、任务状态展示与模型激活的真实交互，并完成验证记录。

**要求**:
- 先补前端失败测试
- 补齐训练状态刷新、样本导入与模型激活交互
- 运行后端测试、前端测试和前端构建并记录结果

**产出**:
- `frontend/src/__tests__/pages/VideoTraining.test.tsx`
- `frontend/src/pages/VideoTraining/index.tsx`
- `frontend/src/pages/VideoLearning/index.tsx`
- `.tasks/tasks.md`

**参考**:
- `frontend/src/pages/VideoTraining/index.tsx`
- `frontend/src/pages/VideoLearning/index.tsx`

**完成时间**: 2026-04-02

**实施情况**:
- ✅ 在 `frontend/src/pages/VideoTraining/index.tsx` 补齐从学习会话导入动作样本、默认会话加载、训练任务激活模型按钮等闭环交互
- ✅ 扩展 `frontend/src/__tests__/pages/VideoTraining.test.tsx`，覆盖导入区与训练任务激活入口展示
- ✅ 串行完成验证：`cd backend && pytest tests/test_video_training.py tests/test_video_learning.py -q`（23 passed）
- ✅ `cd frontend && npm run test -- src/__tests__/pages/VideoTraining.test.tsx src/__tests__/pages/VideoLearning.test.tsx`（7 passed）
- ✅ `cd frontend && npm run build` 通过
- ⚠️ 前端构建仍存在既有大包体积 warning，本轮未继续拆包优化

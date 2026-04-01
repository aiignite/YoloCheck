# Video Learning Workbench Phase 3 任务清单

> 使用 sequential-task-runner 技能执行此任务清单
> 项目: 视频学习工作台三阶段（识别更准 + 流程更智能 + 工作台更好用 + SOP输出）
> 设计文档: `docs/plans/2026-04-01-video-learning-workbench-phase3-design.md`
> 实施计划: `docs/plans/2026-04-01-video-learning-workbench-phase3-plan.md`

---

## [x] 任务1：准备隔离工作区并确认第三阶段基线 ✅

**完成时间**: 2026-04-01

**实施情况**:
- ✅ 已创建 `.worktrees/video-learning-phase3` 隔离工作区并切换到独立分支 `video-learning-phase3`
- ✅ 已确认 worktree 可访问第三阶段设计文档与实施计划
- ✅ 前端依赖已在 worktree 安装，构建验证通过：`cd frontend && npm run build`
- ✅ 后端导入验证通过：`cd backend && python -c "from app.api.video_learning import router; print('router import ok', len(router.routes))"`
- ⚠️ 前端基线仍存在大 chunk warning，但不阻塞第三阶段开发

---

## [x] 任务2：增强第三阶段后端响应结构与摘要骨架 ✅

**完成时间**: 2026-04-01

**实施情况**:
- ✅ `backend/tests/test_video_learning.py` 已先补 phase 3 summary / action 骨架失败测试，并完成红绿验证
- ✅ `backend/app/schemas/video_learning.py` 已为 `LearningSummary` 增加 `workflow_summary`、`workflow_suggestions`、`sop_preview` 默认字段
- ✅ `backend/app/schemas/video_learning.py` 已为 `ActionSequenceResponse` 增加 `suggestions` 默认字段
- ✅ `backend/app/api/video_learning.py` 已让 summary 返回第三阶段默认空结构，避免缺字段
- ⚠️ 当前仅为骨架字段，真实智能建议与 SOP 内容将在后续任务实现

---

## [x] 任务3：实现识别增强与流程智能建议 ✅

**完成时间**: 2026-04-01

**实施情况**:
- ✅ `backend/tests/test_video_learning.py` 已补充任务3红灯测试，覆盖增强动作特征、流程摘要与动作建议透出
- ✅ `backend/app/core/video_learning.py` 已增加 `quality_score`、`smoothed_object_frequency`、`suggested_action_name`、`suggestions` 等增强字段
- ✅ `backend/app/core/video_learning.py` 已增加 `workflow_summary` 与 `workflow_suggestions` 生成逻辑，并写入会话摘要
- ✅ `backend/app/api/video_learning.py` 已让 summary/action 响应透出真实流程建议结果而非空骨架
- ✅ 任务验证通过：`cd backend && pytest tests/test_video_learning.py -k "extract_actions or workflow or suggestions" -v`
- ⚠️ 当前建议逻辑仍为规则型启发式，后续任务再补 SOP 预览与建议采纳能力

---

## [x] 任务4：增加 SOP 预览、保存与建议采纳 API ✅

**完成时间**: 2026-04-01

**实施情况**:
- ✅ `backend/tests/test_video_learning.py` 已补充任务4红灯测试，覆盖 SOP 预览、SOP 保存、动作建议采纳接口
- ✅ `backend/app/models/models.py` 已为模板补充 `sop_content` 与 `workflow_summary` 数据落点
- ✅ `backend/app/schemas/video_learning.py` 已增加 SOP 预览、SOP 保存、建议采纳相关请求/响应模型
- ✅ `backend/app/crud/video_learning.py` 已增加动作建议采纳的最小持久化逻辑
- ✅ `backend/app/api/video_learning.py` 已新增 `/sop-preview`、`/sop`、`/apply-suggestion` 接口
- ✅ 任务验证通过：`cd backend && pytest tests/test_video_learning.py -k "sop or apply" -v`
- ⚠️ 当前 SOP 仍为结构化 JSON 预览/保存，尚未做文档导出

---

## [x] 任务5：升级工作台智能建议与 SOP 预览界面 ✅

**完成时间**: 2026-04-01

**实施情况**:
- ✅ `frontend/src/__tests__/pages/VideoLearning.test.tsx` 已补充任务5失败测试，覆盖流程概览、智能建议 tab、SOP 预览 tab 与建议采纳入口
- ✅ `frontend/src/pages/VideoLearning/index.tsx` 已接入 `workflow_summary`、`workflow_suggestions`、动作建议与 SOP preview 数据
- ✅ 工作台已增加流程概览卡片、智能建议 tab、SOP 预览 tab，并在动作建议卡片中提供单条建议采纳入口
- ✅ 任务验证通过：`cd frontend && npm run test -- src/__tests__/pages/VideoLearning.test.tsx`
- ⚠️ 第三阶段新增文案 key 仍待任务6统一补齐到 `zh.json` 与 `en.json`

---

## [x] 任务6：补全文案并完整测试、构建、debug、归档 ✅

**完成时间**: 2026-04-01

**实施情况**:
- ✅ `frontend/src/locales/zh.json` 与 `frontend/src/locales/en.json` 已补齐第三阶段工作台新增文案 key
- ✅ `frontend/vite.config.ts` 已增加 Vitest `jsdom` 环境与全局 setup，修复旧测试统一缺少浏览器环境的问题
- ✅ `frontend/src/__tests__/App.test.tsx` 与 `frontend/src/__tests__/pages/Dashboard.test.tsx` 已调整为更稳的存在性断言，避免重复文案导致误报
- ✅ 前端测试通过：`cd frontend && npm run test`
- ✅ 前端构建通过：`cd frontend && npm run build`
- ✅ 后端测试通过：`cd backend && pytest tests/test_video_learning.py -q`
- ✅ 后端导入验证通过：`cd backend && python -c "from app.api.video_learning import router; print('router import ok', len(router.routes))"`
- ⚠️ 仍存在既有 warning：Vitest `--localstorage-file`、Vite 大 chunk 提示、`pytest-asyncio` loop scope 和 Pydantic `model_` namespace 警告；本轮未扩展处理范围

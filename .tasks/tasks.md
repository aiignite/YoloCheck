# Video Learning Workbench Phase 3 任务清单

> 使用 sequential-task-runner 技能执行此任务清单
> 项目: 视频学习工作台三阶段（识别更准 + 流程更智能 + 工作台更好用 + SOP输出）
> 设计文档: `docs/plans/2026-04-01-video-learning-workbench-phase3-design.md`
> 实施计划: `docs/plans/2026-04-01-video-learning-workbench-phase3-plan.md`

---

## [ ] 任务1：准备隔离工作区并确认第三阶段基线

**描述**: 按技能要求建立 `.worktrees` 隔离工作区，并确认第三阶段开发基线可执行。

**要求**:
- 检查 `.worktrees/` 忽略规则
- 创建 phase 3 worktree
- 在 worktree 中确认基础命令可运行
- 不破坏当前主工作区未提交改动

**产出**:
- `.worktrees/`
- `docs/plans/2026-04-01-video-learning-workbench-phase3-design.md`
- `docs/plans/2026-04-01-video-learning-workbench-phase3-plan.md`

---

## [ ] 任务2：增强第三阶段后端响应结构与摘要骨架

**描述**: 为 summary / action 响应补齐 workflow 与 SOP 所需字段，先建立空结构与接口骨架。

**要求**:
- 扩展 `schemas/video_learning.py`
- 扩展 `api/video_learning.py`
- 为 phase 3 summary 增加默认返回结构
- 先写失败测试再实现

**产出**:
- `backend/app/schemas/video_learning.py`
- `backend/app/api/video_learning.py`
- `backend/tests/test_video_learning.py`

---

## [ ] 任务3：实现识别增强与流程智能建议

**描述**: 在现有 pose / interaction 基础上增加质量评分、建议动作名、流程建议和异常提示。

**要求**:
- 扩展 `core/video_learning.py`
- 将建议结果写入 action features 与 session summary
- 不引入新的训练框架
- 先写失败测试再实现

**产出**:
- `backend/app/core/video_learning.py`
- `backend/app/api/video_learning.py`
- `backend/tests/test_video_learning.py`

---

## [ ] 任务4：增加 SOP 预览、保存与建议采纳 API

**描述**: 把第三阶段智能分析结果转为可预览、可保存、可采纳的后端能力。

**要求**:
- 增加 SOP 预览接口
- 增加 SOP 保存接口
- 增加动作建议采纳接口
- 先写失败测试再实现

**产出**:
- `backend/app/api/video_learning.py`
- `backend/app/crud/video_learning.py`
- `backend/app/models/models.py`
- `backend/app/schemas/video_learning.py`
- `backend/tests/test_video_learning.py`

---

## [ ] 任务5：升级工作台智能建议与 SOP 预览界面

**描述**: 把第三阶段识别增强和流程智能结果接到 VideoLearning 工作台。

**要求**:
- 增加智能建议 tab
- 增加流程概览展示
- 增加 SOP 预览 tab
- 增加单条建议采纳入口
- 先写失败测试再实现

**产出**:
- `frontend/src/pages/VideoLearning/index.tsx`
- `frontend/src/__tests__/pages/VideoLearning.test.tsx`

---

## [ ] 任务6：补全文案并完整测试、构建、debug、归档

**描述**: 补充第三阶段中英文文案，并完成后端测试、前端测试、前端构建与后端导入验证，修复本轮问题后归档任务清单。

**要求**:
- 更新中英文翻译
- 前端测试通过
- 前端构建通过
- 后端测试通过
- 后端导入通过
- 修复本轮发现的问题

**产出**:
- `frontend/src/locales/zh.json`
- `frontend/src/locales/en.json`
- `backend/tests/test_video_learning.py`
- `frontend/src/__tests__/pages/VideoLearning.test.tsx`
- `.tasks/tasks.md`

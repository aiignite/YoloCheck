# Video Learning Workbench Phase 2 任务清单

> 使用 sequential-task-runner 技能执行此任务清单
> 项目: 视频学习工作台二阶段（pose + 交互 + 拆分合并 + 模板对比）

---

## [x] 任务1：扩展 pose / interaction 数据结构 ✅

**完成时间**: 2026-04-01

**实施情况**:
- ✅ `core/video_learning.py`: 为分析帧与动作段增加 pose / interaction 数据字段
- ✅ `schemas/video_learning.py`: 扩展 keyframe/action/summary 响应结构
- ✅ 保持数据库表结构不变，二阶段特征继续存入 JSON 字段，兼容一阶段数据
- ✅ 后端导入验证通过

---

## [x] 任务2：实现 pose 特征与交互特征抽取 ✅

**完成时间**: 2026-04-01

**实施情况**:
- ✅ `core/video_learning.py`: 新增 pose 模型懒加载、关键点提取、pose summary、interaction 估算
- ✅ `api/video_learning.py`: 关键帧保存时已附带 objects / pose_keypoints / interaction_summary
- ✅ 后端导入验证通过

---

## [x] 任务3：增加动作段拆分/合并与模板对比 API ✅

**完成时间**: 2026-04-01

**实施情况**:
- ✅ `crud/video_learning.py`: 新增动作段重排、拆分、与前一段合并能力
- ✅ `api/video_learning.py`: 新增 split / merge / compare 模板接口
- ✅ 后端导入验证通过

---

## [x] 任务4：升级 VideoLearning 工作台前端 ✅

**完成时间**: 2026-04-01

**实施情况**:
- ✅ 增加 pose 学习 tab、物体学习 tab、模板对比 tab
- ✅ 增加动作段拆分/合并按钮和接口接入
- ✅ 增加模板对比选择与结果展示
- ⚠️ 依赖任务5补全文案并统一做构建 debug

---

## [x] 任务5：补充翻译文案并完整验证 debug ✅

**完成时间**: 2026-04-01

**实施情况**:
- ✅ `frontend/src/locales/zh.json` 与 `frontend/src/locales/en.json` 已补齐二阶段 pose / split / merge / compare 文案
- ✅ 前端构建验证通过：`cd frontend && npm run build`
- ✅ 后端导入验证通过：`cd backend && python -c "from app.api.video_learning import router; print('router import ok', len(router.routes))"`
- ⚠️ 前端生产构建存在大 chunk 警告，但不影响本轮功能交付

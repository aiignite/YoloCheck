# 原型功能迁移记录（2026-09-25）

来源项目：`CheckPlatformWithYOLO`（纯前端原型，React + Tailwind，数据全 mock）
本仓库为其全栈化实现（FastAPI + React/antd）。本文档记录本次从原型移植的算法与功能，以及遗留路线。

## 一、本次已移植

### 1. YOLO 数据集体检与自动修复（原型 DatasetCheckerTool）★ 核心

原型中最真实、最完整的算法模块，已完整移植为后端引擎：

| 原型 | 本仓库落点 |
|---|---|
| `auditYoloText()` 逐行校验 | `backend/app/core/dataset_audit.py::audit_yolo_text()` |
| Auto-Fix 数学钳位 | `dataset_audit.py::auto_fix_yolo_text()` |
| `data.yaml` 程序化生成 | `dataset_audit.py::generate_data_yaml()` |
| 前端页面 | `frontend/src/pages/DatasetAudit/`（路由 `/dataset-audit`） |

校验规则（与原型一致）：字段数不足、classId 非整数/超出字典、坐标 NaN、中心点越界 [0,1]、
宽高 ≤ 0、宽高 > 1 警告、包围盒边缘出界警告（此处比原型多覆盖了 Y 方向）。

Auto-Fix 钳位公式（与原型一致）：
- cx/cy → clamp [0.01, 0.99]，NaN 回退 0.5
- w/h → |x| 后 clamp [0.02, 0.98]，NaN 回退 0.1
- 再按边界 [0.001, 0.999] 裁剪并重算中心点与宽高
- 保留空行与 `#` 注释行

API（均需登录）：
- `POST /api/dataset-audit/audit` — 逐行体检
- `POST /api/dataset-audit/audit-file` — 上传 .txt 体检
- `POST /api/dataset-audit/fix` — 一键修复，返回修复前后对比
- `POST /api/dataset-audit/data-yaml` — 生成 Ultralytics 数据集配置

测试：`backend/tests/test_dataset_audit.py`（10 用例）

### 2. 交互式标注画布（原型 VisionInspector + Phase3 拖拽几何）

并入数据集体检页第二个 Tab：
- 底图上传 + YOLO 框叠加渲染（类别色板、置信度徽章）
- 置信度滑块 + 类别显隐过滤；导出仅含可见框的 `labels.txt`
- 鼠标拖拽拉框：getBoundingClientRect 归一化、坐标钳位 [0,1]、
  小于 2% 画布尺寸的框按原型规则丢弃；点击选中查看归一化坐标并可删除

### 3. 推理 NMS/IoU 参数开放

- `yolo_engine.py::predict(iou=...)`、`live_monitor.py` 的 `/stream`、`/snapshot`、
  WS config 均透传 `iou`（默认不传保持 ultralytics 默认 0.7）
- LiveMonitor 每路画面新增 IoU 滑块

### 4. 告警工单状态机（原型 AlertWorkflow）

- `alerts` 表新增 `status`（pending/investigating/resolved）、`assigned_to`、`resolved_at`
  （alembic 迁移 `a3f8c21d94e7`，已应用到开发库；历史已确认告警回填为 resolved）
- 新端点：`PUT /{id}/claim`、`PUT /{id}/resolve`（闭环同步 acknowledged）、
  `POST /claim-all`（批量认领）、`GET /export/csv`（CSV 含引号转义）
- Alerts 页：状态列/筛选、认领→闭环流转按钮、认领全部、导出 CSV、六卡统计
- 测试：`tests/test_alert_workflow.py`（8 用例）

### 5. Bug 修复：`POST /live/upload-snapshot`

前端 LiveMonitor 本地摄像头抓拍调用该端点但后端不存在，已按前端契约补齐
（保存至 `uploads/snapshots/`，校验格式/大小）。

### 6. 测试修复（历史遗留）

`test_alerts.py`、`test_cameras.py`、`test_stats.py`、`test_integration.py`
原测试均未携带认证头导致 401（改动前即失败），已统一补齐 token fixture。

## 二、吸收自原型 docs 的算法规格（未编码，作为路线图）

`docs/ALGORITHM_DESIGN_AND_GAP_ANALYSIS.md`（自原型原样引入）核心规划：
- **YOLOv8-OBB 旋转框**（x,y,w,h,θ）替代 AABB，用于带角度缺陷
- **SAHI 640×640 滑窗切片 + 全局 NMS**，适配 SMT 微小缺陷大图
- **姿态→手部两阶段级联**：腕点先验裁剪 ROI → 21 点手部关键点；
  捏取判定（拇指尖-食指尖距离）、工具作业 IoU 判定
- 工位节拍直通 MES 算产线平衡率、Checkerboard 标定像素-毫米转换

## 三、原型中评估后未移植的部分

- AnalysisView / OptimizationRoadmapView / PhaseImplementationView 静态展示页：
  内容为硬编码规划文案，对本全栈项目价值低；规格已由上文文档承载
- 训练损失合成公式、遥测/断网模拟器：原型为模拟语义，本项目已有真实训练与流式推理
- Gemini 集成：原型含 `@google/genai` 依赖但无实际调用代码

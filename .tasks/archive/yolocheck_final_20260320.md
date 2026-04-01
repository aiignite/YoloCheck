# YOLO生产过程学习监控系统 - 开发任务清单

> 基于 PRD.md 拆解的开发任务，按顺序执行

---

## [x] 任务1：项目基础结构搭建 ✅

**完成时间**: 2026-03-19

**实施情况**:
- ✅ 创建后端目录 `backend/`，FastAPI + SQLAlchemy + Pydantic
- ✅ 创建前端目录 `frontend/`，Vite + React + TypeScript + Ant Design
- ✅ 配置 `docker-compose.yml`（PostgreSQL、Redis、EMQX）
- ✅ 创建 `.env.example` 配置模板
- ✅ 后端 app 结构（config/database/main/api/models/schemas/crud/core）
- ✅ 前端依赖安装（antd, axios, echarts, react-router-dom）

---

## [x] 任务2：数据库模型与迁移 ✅

**完成时间**: 2026-03-19

**实施情况**:
- ✅ 实现 Camera、DetectionEvent、ProductionStats、Alert、Model 五个ORM模型
- ✅ 配置 Alembic 迁移框架
- ✅ env.py 自动读取项目配置与模型

---

## [x] 任务3：后端API - 摄像头管理 ✅

**完成时间**: 2026-03-19

**实施情况**:
- ✅ CameraCreate/CameraUpdate/CameraResponse Pydantic Schema
- ✅ camera CRUD（get_cameras/get_by_id/create/update/delete）
- ✅ 完整 REST API（GET/POST/PUT/DELETE）

---

## [x] 任务4：后端API - 检测事件与告警 ✅

**完成时间**: 2026-03-19

**实施情况**:
- ✅ EventCreate/EventResponse/EventQuery Schema
- ✅ AlertCreate/AlertResponse/AlertAcknowledge/AlertStats Schema
- ✅ event CRUD（创建、过滤查询、计数）
- ✅ alert CRUD（创建、查询、确认、统计）
- ✅ events API（GET分页过滤 + POST创建）
- ✅ alerts API（GET列表 + POST创建 + PUT确认 + GET统计）

---

## [x] 任务5：后端API - 统计分析 ✅

**完成时间**: 2026-03-19

**实施情况**:
- ✅ ProductionStatsResponse/DashboardSummary/DefectStats/EfficiencyTrend Schema
- ✅ stats CRUD（产量统计、看板汇总、缺陷统计、效率趋势）
- ✅ stats API（dashboard/production/defects/efficiency）

---

## [x] 任务6：YOLO推理引擎封装 ✅

**完成时间**: 2026-03-19

**实施情况**:
- ✅ YOLOEngine 类（模型加载、单帧推理、批量推理）
- ✅ DetectionResult/FrameDetections 数据结构
- ✅ 全局引擎管理（get_engine 单例管理）
- ✅ 检测结果后处理（标注、保存图片、事件分类、告警级别判定）

---

## [x] 任务7：视频流管理服务 ✅

**完成时间**: 2026-03-19

**实施情况**:
- ✅ FrameGrabber（单路视频流采集、自动重连、帧率控制）
- ✅ StreamManager（多路管理、添加/移除/状态查询）
- ✅ 支持RTSP和文件源

---

## [x] 任务8：MQTT消息服务 ✅

**完成时间**: 2026-03-19

**实施情况**:
- ✅ MQTTClient 封装（连接、重连、心跳、发布、订阅）
- ✅ 检测事件发布（detection/{camera_id}）
- ✅ 告警事件发布（alert/{camera_id}）

---

## [x] 任务9：实时检测流水线 ✅

**完成时间**: 2026-03-19

**实施情况**:
- ✅ DetectionPipeline（异步运行、并发处理多路摄像头）
- ✅ 告警规则引擎（6条默认规则：安全帽/防护服/摔倒/入侵/焊接/元件）
- ✅ 完整流水线：帧采集 → 推理 → 图片保存 → 事件分类 → MQTT发布 → 告警触发
- ✅ 性能统计（帧数、检测数、平均推理时间）

---

## [x] 任务10：前端 - 项目初始化与布局 ✅

**完成时间**: 2026-03-19

**实施情况**:
- ✅ MainLayout（侧边栏 + 顶部导航 + Outlet）
- ✅ React Router 路由配置（5个页面）
- ✅ axios API封装（baseURL + 拦截器）
- ✅ useWebSocket Hook

---

## [x] 任务11：前端 - 实时监控看板 ✅

**完成时间**: 2026-03-19

**实施情况**:
- ✅ Dashboard 看板页（产量/良率/摄像头/告警 4个指标卡片）
- ✅ 最新检测事件表格
- ✅ 告警通知列表
- ✅ 5秒自动刷新

---

## [x] 任务12：前端 - 摄像头管理与告警页面 ✅

**完成时间**: 2026-03-19

**实施情况**:
- ✅ Cameras 页面（完整CRUD + Modal表单）
- ✅ Alerts 页面（统计卡片 + 过滤 + 确认操作）

---

## [x] 任务13：前端 - 统计报表页面 ✅

**完成时间**: 2026-03-19

**实施情况**:
- ✅ Statistics 页面（产量柱状图 + 良率趋势 + 节拍时间）
- ✅ ECharts集成
- ✅ 时间范围选择器（7/14/30天）

---

## [x] 任务14：WebSocket实时推送 ✅

**完成时间**: 2026-03-19

**实施情况**:
- ✅ ConnectionManager（连接管理、广播、自动清理断开连接）
- ✅ WebSocket /ws/live 端点（心跳 ping/pong）
- ✅ broadcast_detection / broadcast_alert 推送函数
- ✅ 前端 useWebSocket Hook（已在任务10中实现）

---

## [x] 任务15：后端单元测试 ✅

**完成时间**: 2026-03-19

**实施情况**:
- ✅ 34个测试全部通过（0.50秒）
- ✅ test_core.py：15个核心测试（推理结果、事件分类、告警级别、告警规则、帧标注）
- ✅ test_cameras.py：7个API测试（列表、创建、重复、查询、404、更新、删除）
- ✅ test_events.py：3个API测试（创建、列表、按类型过滤）
- ✅ test_alerts.py：5个API测试（创建、列表、确认、确认404、统计）
- ✅ test_stats.py：4个API测试（看板汇总、产量统计、缺陷统计、效率趋势）
- ✅ conftest.py：SQLite内存数据库 + AsyncClient + 自动建表/清理
- ✅ pytest配置在pyproject.toml中（asyncio_mode=auto）

---

## [x] 任务16：前端组件测试 ✅

**完成时间**: 2026-03-19

**实施情况**:
- ✅ 11个测试全部通过
- ✅ App.test.tsx：5个路由测试（布局渲染、菜单、看板、摄像头、设置）
- ✅ Dashboard.test.tsx：3个测试（统计卡片、事件/告警区域、API调用）
- ✅ Cameras.test.tsx：3个测试（添加按钮、列表加载、数据展示）
- ✅ vitest + @testing-library/react + jsdom
- ✅ API mock（vi.hoisted + vi.mock）
- ✅ window.matchMedia mock 适配 Ant Design

---

## [x] 任务17：Python依赖安装与国内镜像源 ✅

**完成时间**: 2026-03-19

**实施情况**:
- ✅ pip已配置阿里云镜像源（mirrors.aliyun.com/pypi/simple/）
- ✅ 所有Python依赖安装正常，39个后端测试全部通过


## [x] 任务17：集成测试与端到端验证 ✅

**完成时间**: 2026-03-19

**实施情况**:
- ✅ 5个集成测试全部通过
- ✅ test_full_detection_workflow：完整业务流程（摄像头创建→检测事件→告警→确认→看板）
- ✅ test_multi_camera_events：多摄像头并发检测+按类型过滤
- ✅ test_camera_lifecycle：摄像头完整CRUD生命周期
- ✅ test_alert_stats_accuracy：告警统计准确性验证
- ✅ test_health_check：健康检查端点验证
- ✅ conftest配置follow_redirects=True修复307问题

## [x] 任务19：部署文档与生产环境准备 ✅

**完成时间**: 2026-03-19

**实施情况**:
- ✅ DEPLOYMENT.md 部署文档（快速开始、环境变量、生产配置、架构图、FAQ）
- ✅ Dockerfile 示例
- ✅ 前端构建指南

## [x] 任务20：Mock数据的数据库实际数据替代 ✅

**完成时间**: 2026-03-19

**实施情况**:
- ✅ 生产代码已全部使用真实数据库查询（无Mock数据）
- ✅ 创建 `backend/scripts/seed_data.py` 种子数据初始化脚本
  - 8个摄像头（gigE/rtsp类型）
  - 3个YOLO模型（缺陷检测/安全/效率）
  - 420条生产统计记录（7天逐小时）
  - ~180条检测事件
  - ~70条告警记录
  - 支持 `--reset` 参数重建数据库
- ✅ FastAPI应用添加 `lifespan` 启动事件，自动创建数据库表
- ✅ 39个后端测试全部通过


## [x] 任务21：视频数据学习 ✅

**完成时间**: 2026-03-19

**实施情况**:
- ✅ 数据库模型：VideoTemplate, LearningSession, ActionSequence, KeyFrame
- ✅ 视频学习引擎 `backend/app/core/video_learning.py`
  - 视频元数据读取（OpenCV）
  - 逐帧YOLO检测分析
  - 场景变化检测（直方图Bhattacharyya距离）
  - 动作边界识别与动作序列提取
  - 关键帧截图保存
  - 分析结果摘要生成
- ✅ CRUD操作 `backend/app/crud/video_learning.py`（模板/会话/动作/关键帧完整CRUD）
- ✅ API端点 `backend/app/api/video_learning.py`
  - POST /templates（视频上传）, GET/DELETE 模板管理
  - POST /templates/{id}/learn（后台异步学习任务）
  - GET sessions/actions/keyframes 查询
  - GET /templates/{id}/summary 学习结果汇总
- ✅ 前端页面 `frontend/src/pages/VideoLearning/index.tsx`
  - 视频模板列表、上传表单
  - 一键启动学习、进度展示
  - 学习详情：统计KPI + 动作时间线 + 关键帧预览
- ✅ 侧边栏导航已添加"视频学习"菜单
- ✅ 39个后端测试 + 11个前端测试全部通过

## [x] 任务22：系统功能开发扩展 ✅

**完成时间**: 2026-03-20

**实施情况**:
- ✅ 用户管理：User模型 + CRUD + API + 前端页面（角色管理admin/manager/operator）
- ✅ MES接口：MESOrder模型 + 工单管理API + 前端页面（状态流转 + 质量报告）
- ✅ 系统设置：SystemConfig模型 + 分类配置管理 + 前端Tabs页面
- ✅ 摄像头驱动管理：CameraDriver模型 + 协议类型管理（rtsp/gigE/usb/http）
- ✅ 存储管理：StorageRecord模型，支持图像/视频/模板等文件存储记录
- ✅ 后端39测试 + 前端11测试全部通过

---

## 头脑风暴：后续扩展任务

## [x] 任务23：报表导出与数据分析 ✅

**完成时间**: 2026-03-20

**实施情况**:
- ✅ 后端 `backend/app/api/reports.py`：3个API端点
  - GET /comparison：环比对比分析（当前 vs 上一周期）
  - GET /export/excel：openpyxl生成Excel（生产明细+日汇总两个Sheet）
  - GET /export/csv：UTF-8-sig CSV导出
- ✅ 前端 Statistics 页面增强
  - Excel/CSV导出按钮
  - 单图表PNG导出（ECharts getDataURL）
  - 环比分析卡片（产量/良率/缺陷/节拍 4项对比）
- ✅ pyproject.toml 添加 openpyxl 依赖
- ✅ 39个后端测试 + 11个前端测试全部通过

## [x] 任务24：实时监控WebSocket增强 ✅

**完成时间**: 2026-03-20

**实施情况**:
- ✅ 后端 `backend/app/api/live_monitor.py`：实时监控API
  - GET /local-cameras：本地摄像头自动检测枚举
  - GET /stream/{source}：MJPEG视频流（带YOLO检测叠加）
  - GET /snapshot/{source}：单帧快照截图保存
  - WS /ws/{source}：WebSocket实时检测数据推送
  - POST /stream/{source}/stop：停止流
- ✅ YOLO姿态检测（yolov8n-pose）
  - 骨骼关键点绘制（17个COCO关键点）
  - 骨骼连接线绘制（16条彩色连接线）
  - 检测框 + 类别标签 + 置信度叠加
  - 支持 pose/detect 两种模式切换
- ✅ 前端 `frontend/src/pages/LiveMonitor/index.tsx`
  - 多路摄像头网格布局（1/2/3/4列可选）
  - 本地摄像头自动发现 + 数据库摄像头列表
  - MJPEG实时视频流显示
  - WebSocket实时检测数据接收与叠加
  - 检测事件通知弹窗
  - 置信度/帧率实时调节
  - 单帧快照截图
  - 全屏展开/收缩
  - 统计面板（活跃摄像头/检测目标/推理时间/帧率）
- ✅ 侧边栏添加"实时监控"菜单（MonitorOutlined图标）
- ✅ 路由注册 /live-monitor
- ✅ 真实本地摄像头验证：1920x1080, person检测82%置信度, 5个骨骼关键点
- ✅ 39个后端测试 + 11个前端测试全部通过


## [x] 任务25：权限与审计日志 ✅

**完成时间**: 2026-03-20

**实施情况**:
- ✅ JWT Token认证（HS256，access_token 8h，refresh_token 7d）
- ✅ RBAC角色权限控制（admin/manager/operator三级角色层次）
- ✅ 后端 `backend/app/core/auth.py`：JWT创建/验证/解码、角色依赖注入
- ✅ 后端 `backend/app/api/auth.py`：登录/刷新/用户信息/登出/审计日志5个API
- ✅ 后端 `backend/app/crud/audit.py`：审计日志CRUD（支持用户/动作/资源过滤）
- ✅ AuditLog数据库模型（用户/动作/资源/IP/User-Agent/状态）
- ✅ 前端 `AuthContext`：登录状态管理、Token自动注入、会话恢复
- ✅ 前端登录页面（渐变背景、表单验证、默认提示）
- ✅ 前端审计日志页面（仅admin可见，动作筛选、颜色标签）
- ✅ ProtectedRoutes 路由守卫（未认证自动跳转登录）
- ✅ MainLayout 用户信息展示（角色标签、登出按钮）
- ✅ 39个后端测试 + 11个前端测试全部通过

## [x] 任务26：模型版本管理 ✅

**完成时间**: 2026-03-20

**实施情况**:
- ✅ Model数据库模型增强：新增 description/file_size/precision/recall/map50/map50_95/inference_speed/is_active/status 字段
- ✅ 后端 Schema（ModelCreate/ModelUpdate/ModelResponse/ModelCompare）
- ✅ 后端 CRUD（list/get/create/update/delete/deploy/rollback/get_active）
- ✅ 后端 API（`backend/app/api/models.py`）
  - GET/POST /models：列表与创建
  - POST /models/upload：模型文件上传（.pt/.onnx/.engine）
  - PUT/DELETE /models/{id}：编辑与删除
  - POST /models/{id}/deploy：部署（自动取消同类型其他活跃模型）
  - POST /models/{id}/rollback：回滚
  - GET /models/active/{type}：获取激活模型
  - GET /models/compare/{idA}/{idB}：A/B性能对比
- ✅ 前端 `frontend/src/pages/ModelManager/index.tsx`
  - 模型列表（精度/mAP/速度/大小/状态）
  - 统计卡片（总数/已部署/最高精度/最快推理）
  - 新建/编辑Modal（含性能指标输入）
  - 模型文件上传Modal
  - 一键部署/回滚操作
  - 多选对比Modal（指标差异可视化）
  - 类型筛选/删除保护
- ✅ 侧边栏菜单 + 路由注册
- ✅ 种子数据更新（6个模型，含历史版本）
- ✅ 39个后端测试 + 11个前端测试全部通过

## [x] 任务27：批量视频分析与离线任务 ✅

**完成时间**: 2026-03-20

**实施情况**:
- ✅ 后端 `backend/app/core/batch_analysis.py`：轻量级异步任务队列
  - TaskQueue（asyncio.Queue + 2并发worker）
  - AnalysisTask 数据类（进度/状态/结果摘要）
  - 逐帧YOLO检测 + 场景变化检测（Bhattacharyya距离）
  - 关键帧提取 + 类别统计
- ✅ 后端 `backend/app/api/batch_analysis.py`：5个API端点
  - POST /batch/upload：视频上传并加入队列
  - GET /batch：任务列表（队列大小/运行数）
  - GET /batch/{id}：任务详情（实时进度）
  - POST /batch/{id}/cancel：取消排队任务
  - DELETE /batch/{id}：删除已完成任务
- ✅ 前端 `frontend/src/pages/BatchAnalysis/index.tsx`
  - 批量上传视频（支持 .mp4/.avi/.mov/.mkv/.flv/.wmv）
  - 实时进度展示（Progress + 当前步骤）
  - 自动2秒刷新
  - 分析结果详情Modal（视频信息/检测统计/场景分析）
  - 任务管理（取消/删除）
  - 统计卡片（总数/运行中/已完成/检测数）
- ✅ 侧边栏菜单 + 路由注册
- ✅ 39个后端测试 + 11个前端测试全部通过

## [x] 任务28：告警通知与工作流

- ✅ 多渠道告警通知（邮件/短信/钉钉/企业微信）— 模拟通知测试 API
- ✅ 告警升级策略（超时未处理自动升级）— check-escalation 端点
- ✅ 告警规则可视化配置 — 前端完整 CRUD + Modal 表单
- ✅ 告警统计报表与趋势分析 — ECharts 柱状图 + 统计卡片
- ✅ 后端 API: alert_workflow router (rules CRUD, toggle, notify/test, trends, check-escalation)
- ✅ 前端页面: AlertWorkflow (规则管理 + 趋势图表)
- ✅ 39个后端测试 + 11个前端测试全部通过

## [x] 任务29：国际化与多语言

- ✅ 前端i18n框架集成（中/英文）— react-i18next + i18next + 语言检测
- ✅ 后端错误消息国际化 — app/core/i18n.py + Accept-Language 头解析
- ✅ 日期/时间/数字格式本地化 — i18n 配置 + 语言切换器
- ✅ 登录页/主布局/侧边栏菜单全部国际化
- ✅ 语言切换器（中文/English）在顶部栏和登录页
- ✅ 39个后端测试 + 11个前端测试全部通过

## [x] 任务30：API限流与系统监控

- ✅ API请求频率限制（FastAPI middleware）— 令牌桶算法，60/s，突发120
- ✅ Prometheus指标暴露 + Grafana看板 — /api/metrics (Prometheus text format)
- ✅ 系统健康检查端点（/api/health）— 含数据库连通性、运行时间
- ✅ 数据库连接池监控与告警 — /api/system/monitor (CPU/内存/磁盘/连接池/请求统计)
- ✅ 请求指标采集中间件 — 方法/路径/状态码/耗时
- ✅ 39个后端测试 + 11个前端测试全部通过

## 【x】持续优化与迭代 ✅

**完成时间**: 2026-03-20

**实施情况**:
- ✅ 所有30个开发任务已全部完成
- ✅ 后续优化方向已体现在任务28-30中（告警工作流/国际化/限流监控）

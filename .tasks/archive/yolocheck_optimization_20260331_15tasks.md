# YoloCheck 优化与扩展任务清单

> 使用 sequential-task-runner 技能执行此任务清单
> 项目: YOLO生产过程学习监控系统 — 安全加固 + 架构修复 + 功能扩展 + 质量提升

---

## [x] 任务1：密码哈希升级为 bcrypt ✅

**完成时间**: 2026-03-31

**实施情况**:
- ✅ `crud/user.py`: SHA-256 替换为 bcrypt，保留 SHA-256 兼容验证
- ✅ `api/auth.py`: 登录时自动检测旧哈希并升级为 bcrypt
- ✅ `pyproject.toml`: 添加 bcrypt>=4.0.0 依赖
- ✅ `core/auth.py`: 移除无用 hashlib import

---

## [x] 任务2：JWT Secret 环境变量化 ✅

**完成时间**: 2026-03-31

**实施情况**:
- ✅ `config.py`: 添加 jwt_secret_key/jwt_algorithm/jwt_access_expire_minutes/jwt_refresh_expire_days
- ✅ `core/auth.py`: 从 settings 读取 JWT 配置，移除硬编码
- ✅ `.env.example`: 添加 JWT 相关环境变量

---

## [x] 任务3：CORS 白名单 + 文件上传限制 ✅

**完成时间**: 2026-03-31

**实施情况**:
- ✅ `config.py`: 添加 cors_origins 和 max_upload_size_mb 配置
- ✅ `main.py`: CORS origins 从环境变量读取，不再使用 `*`
- ✅ 新增 `core/upload_validation.py`: 通用文件上传校验（扩展名+MIME+大小）
- ✅ `.env.example`: 添加 CORS_ORIGINS 和 MAX_UPLOAD_SIZE_MB

---

## [x] 任务4：API 认证中间件全覆盖 ✅

**完成时间**: 2026-03-31

**实施情况**:
- ✅ 审查所有 14 个路由文件，确认认证已全覆盖
- ✅ GET 查询端点使用 require_auth，POST/PUT/DELETE 使用 require_role("manager")
- ✅ 公开端点保留：login、health、metrics、websocket

---

## [x] 任务5：前端 API 调用统一修复 ✅

**完成时间**: 2026-03-31

**实施情况**:
- ✅ `ModelManager/index.tsx`: 9 处 axios 调用替换为 api
- ✅ `BatchAnalysis/index.tsx`: 4 处 axios 调用替换为 api
- ✅ `AlertWorkflow/index.tsx`: 9 处 axios 调用替换为 api
- ✅ 所有 URL 路径去掉 `/api` 前缀（baseURL 已包含）

---

## [x] 任务6：Alembic 迁移初始化 ✅

**完成时间**: 2026-03-31

**实施情况**:
- ✅ `alembic/env.py`: 补全所有 15 个模型导入（User、CameraDriver、SystemConfig 等）
- ✅ `main.py`: 移除 create_all，改为注释说明使用 alembic upgrade head
- ✅ versions/ 目录已就绪，等待连接数据库后执行 autogenerate 生成迁移文件

---

## [x] 任务7：检测流水线 API 暴露 ✅

**完成时间**: 2026-03-31

**实施情况**:
- ✅ 新增 `api/pipeline.py`: GET /status、POST /start（支持指定摄像头）、POST /stop
- ✅ `main.py`: 注册 pipeline 路由

---

## [x] 任务8：MQTT 在 lifespan 中启动 ✅

**完成时间**: 2026-03-31

**实施情况**:
- ✅ `main.py` lifespan: 启动时连接 MQTT、关闭时断开（非致命，失败仅 warning）
- ✅ `mqtt_client.py`: 已有 connect()/disconnect() 方法，无需修改

---

## [x] 任务9：Redis 缓存集成 ✅

**完成时间**: 2026-03-31

**实施情况**:
- ✅ 新增 `core/cache.py`: 封装 Redis get/set/delete/ping 操作
- ✅ `api/stats.py`: Dashboard 汇总 API 添加 30s Redis 缓存

---

## [x] 任务10：Token 自动刷新机制 ✅

**完成时间**: 2026-03-31

**实施情况**:
- ✅ `utils/api.ts`: 401 响应拦截器自动调用 refresh token，支持请求队列，刷新失败跳转登录
- ✅ 后端 refresh 端点已正常工作

---

## [x] 任务11：存储管理 API + 前端页面 ✅

**完成时间**: 2026-03-31

**实施情况**:
- ✅ `crud/storage.py`: CRUD 操作（列表/详情/统计/删除）
- ✅ `schemas/storage.py`: StorageResponse/StorageStats schemas
- ✅ `api/storage.py`: 4 个端点，带认证保护
- ✅ `main.py`: 注册 /api/storage 路由
- ✅ `pages/StorageManage/index.tsx`: 存储管理页面（统计卡片+类型筛选+文件表格）
- ✅ `App.tsx` + `MainLayout.tsx`: 添加路由和菜单

---

## [x] 任务12：前端 i18n 全覆盖 ✅

**完成时间**: 2026-03-31

**实施情况**:
- ✅ 11 个页面文件 + 1 个布局文件替换硬编码中文为 `t('key')`
- ✅ zh.json / en.json 新增 ~170 个翻译键（pages.* 命名空间）
- ✅ 涵盖 Dashboard/Cameras/Alerts/MES/Users/Settings/Statistics/VideoLearning/AuditLogs/LiveMonitor/StorageManage/MainLayout

---

## [x] 任务13：弃用 API 修复 ✅

**完成时间**: 2026-03-31

**实施情况**:
- ✅ `models/models.py`: 15 处 `datetime.utcnow` 替换为 `func.now()`，添加 `func` import
- ✅ `api/live_monitor.py`: 5 处 `get_event_loop()` 替换为 `get_running_loop()`
- ✅ `api/video_learning.py`: 1 处替换
- ✅ `core/pipeline.py`: 1 处替换

---

## [x] 任务14：全局单例重构为 FastAPI app.state ✅

**完成时间**: 2026-03-31

**实施情况**:
- ✅ `main.py` lifespan: 显式初始化所有单例并赋值到 app.state
- ✅ 保持现有 get_xxx() 工厂函数不变，零破坏性
- ✅ app.state: mqtt_client, stream_manager, pipeline, task_queue

---

## [x] 任务15：测试覆盖增强 ✅

**完成时间**: 2026-03-31

**实施情况**:
- ✅ `conftest.py`: 新增 db_session/admin_token/manager_token/operator_token fixtures
- ✅ `test_auth.py`: 5 个测试（登录/刷新/用户信息/未授权）
- ✅ `test_users.py`: 5 个测试（CRUD + 权限拒绝）
- ✅ `test_mes.py`: 6 个测试（CRUD + 重复工单号）
- ✅ `test_video_learning.py`: 3 个测试（空列表/404/认证）
- ✅ 全部 19 个测试通过

---

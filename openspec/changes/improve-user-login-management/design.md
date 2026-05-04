## Context

当前 YoloCheck 系统使用 JWT token 进行认证，支持 access/refresh token 双令牌机制，RBAC 角色权限（admin/manager/operator），以及全局令牌桶限流。但缺乏验证码、登录失败锁定、密码策略、会话管理等企业级安全功能。

**技术栈**：FastAPI + SQLAlchemy async + PostgreSQL / SQLite，前端 React + Ant Design。

## Goals / Non-Goals

**Goals:**
- 登录页增加图形验证码，后端生成 base64 图片 + uuid key 校验
- 连续 N 次登录失败后临时锁定账户（默认 5 次失败锁定 15 分钟）
- 密码必须满足复杂度要求（大小写、数字、特殊字符、最小长度）
- 登录页「记住我」选项，勾选后 token 有效期延长到 30 天
- 用户可在设置页查看活跃会话并强制登出
- 用户可查看最近登录历史（IP、时间、设备）

**Non-Goals:**
- 不引入 OAuth/SSO（后续版本考虑）
- 不实现双因素认证（TOTP）
- 不改动现有 RBAC 权限系统

## Decisions

1. **验证码方案：captcha → 内置 svg-captcha 库**
   - 备选：Google reCAPTCHA 需要外网依赖，不适合内网部署
   - 使用 `svg-captcha` 生成 SVG 图形验证码，后端存储 key → code 映射到内存缓存（或 Redis）
   - 登录请求需携带 captcha_key + captcha_code

2. **登录失败锁定：数据库记录 + 内存缓存**
   - `login_attempts` 表记录每次失败尝试（user_id/IP、时间）
   - 内存缓存（或 Redis）记录失败计数，避免频繁查库
   - 锁定状态存储到 `users.is_locked_until` 字段

3. **密码策略：服务端校验 + 前端提示**
   - 后端 Pydantic validator 校验密码强度
   - 前端实时显示密码强度条和不符合项

4. **记住我：双 token 有效期策略**
   - 普通登录：access_token 480min / refresh_token 7 天（不变）
   - 勾选记住我：access_token 480min / refresh_token 30 天
   - 登录请求携带 `remember_me: bool` 参数

5. **会话管理：JWT jti 声明 + user_sessions 表**
   - 每次登录生成唯一 `jti` (JWT ID)，存入 `user_sessions` 表
   - 登出时删除该 session 记录，刷新 token 时更新
   - 用户可在页面查看所有活跃 session 并选择删除

6. **登录历史：复用现有 audit_log 表**
   - 现有 `audit_log` 表已有 login/logout 记录
   - 新增 `device_info` 和 `location` 字段（可选）
   - 提供 `/auth/login-history` 接口供用户查询

## Risks / Trade-offs

- [验证码用户体验] → 支持点击刷新，SVG 格式清晰快速；后续可降级为滑块验证
- [锁定导致管理员也无法登录] → 保留超级管理员绕过锁定的白名单机制（admin 角色除外）
- [记住我安全性降低] → refresh_token 有效期延长但 access_token 不变，且 refresh_token 可吊销
- [内存缓存重启丢失] → 登录失败计数使用数据库记录（login_attempts），不依赖内存缓存持久性

## Why

当前登录系统功能单一，缺乏验证码、登录失败锁定、密码强度校验、会话管理等企业级安全功能。随着系统用户增多，需要提升登录模块的安全性和用户体验。

## What Changes

- **验证码登录**：登录时增加图形验证码，防止暴力破解
- **登录失败锁定**：连续登录失败后临时锁定账户，提升安全性
- **密码强度校验**：注册/修改密码时强制校验密码复杂度
- **记住我功能**：登录页增加「记住我」选项，延长 token 有效期
- **会话管理**：用户可查看自己的活跃会话并强制登出
- **登录历史**：用户可查看最近登录记录（IP、时间、设备）

## Capabilities

### New Capabilities
- `captcha`: 图形验证码生成与校验
- `account-lockout`: 登录失败锁定与解锁机制
- `password-policy`: 密码强度规则与校验
- `session-management`: 用户会话管理与主动登出
- `login-history`: 登录历史记录查看

### Modified Capabilities

- *(无现有 spec 需修改)*

## Impact

- **后端新增**：captcha 生成/验证接口、登录失败计数、会话管理接口、登录历史查询接口
- **后端修改**：`app/api/auth.py` 登录流程集成验证码和锁定检查；`app/core/auth.py` 增加 JWT 会话标识；`app/config.py` 新增相关配置项
- **数据库**：新增 `login_attempts`（登录尝试记录）、`user_sessions`（会话记录）表
- **前端修改**：`Login/index.tsx` 增加验证码输入和记住我选项；新增会话管理页面

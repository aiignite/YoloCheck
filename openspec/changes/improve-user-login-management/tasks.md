## 1. Database Migrations

- [x] 1.1 Create `login_attempts` table with fields: id, username, ip_address, attempted_at, user_agent
- [x] 1.2 Add `is_locked_until` and `failed_login_count` columns to `users` table
- [x] 1.3 Create `user_sessions` table with fields: id, user_id, jti, ip_address, user_agent, device_info, created_at, last_accessed_at
- [x] 1.4 Create `password_history` table with fields: id, user_id, hashed_password, created_at

## 2. Backend - CAPTCHA System

- [x] 2.1 Add `svg-captcha` dependency to pyproject.toml (implemented inline SVG generator)
- [x] 2.2 Implement `/auth/captcha` endpoint returning SVG image + captcha_key
- [x] 2.3 Implement in-memory CAPTCHA store with 5-minute TTL and single-use semantics
- [x] 2.4 Add captcha_key and captcha_code fields to LoginRequest schema

## 3. Backend - Account Lockout

- [x] 3.1 Add config options to Settings: `login_max_attempts=5`, `login_lockout_minutes=15`
- [x] 3.2 Implement login attempt tracking with database read/check before auth
- [x] 3.3 Implement account lock check in login flow (skip for admin role)
- [x] 3.4 Implement `/auth/unlock/{user_id}` endpoint (admin only)
- [x] 3.5 Reset failed attempt counter on successful login

## 4. Backend - Password Policy

- [x] 4.1 Implement password validation function checking length, uppercase, lowercase, digit, special char
- [x] 4.2 Add password validation to user create and password change endpoints
- [x] 4.3 Implement password history check (last 5 passwords)
- [x] 4.4 Add config option: `password_min_length=8`, `password_history_count=5`

## 5. Backend - Session Management

- [x] 5.1 Generate unique `jti` (UUID) on each login and include in JWT payload
- [x] 5.2 Create `user_sessions` record on successful login
- [x] 5.3 Implement `/auth/sessions` GET endpoint listing user's active sessions
- [x] 5.4 Implement `/auth/sessions/{session_id}` DELETE endpoint to terminate a session
- [x] 5.5 Check session validity on token refresh (reject if session was terminated)
- [x] 5.6 Clean up expired sessions on read

## 6. Backend - Login History

- [x] 6.1 Update audit log on login to include device_info and ip_address
- [x] 6.2 Implement `/auth/login-history` GET endpoint with pagination for current user
- [x] 6.3 Implement `/auth/login-history/{user_id}` GET endpoint for admin users

## 7. Backend - Auth API Integration

- [x] 7.1 Update `/auth/login` to integrate CAPTCHA validation, lockout check, remember_me, session creation
- [x] 7.2 Update `/auth/refresh` to validate session is still active
- [x] 7.3 Add `remember_me` field to LoginRequest schema and extend refresh_token TTL when true
- [x] 7.4 Add `captcha_key` and `captcha_code` to login request validation

## 8. Frontend - Login Page Enhancement

- [x] 8.1 Add CAPTCHA image and input field to Login page
- [x] 8.2 Add "Remember Me" checkbox to Login form
- [x] 8.3 Add password strength indicator component
- [x] 8.4 Show appropriate error messages for CAPTCHA failure, account locked, password policy
- [x] 8.5 Update AuthContext to pass remember_me flag to login API call

## 9. Frontend - Session Management Page

- [x] 9.1 Create session management page component with active sessions table
- [x] 9.2 Implement "terminate session" action with confirmation dialog
- [x] 9.3 Add "current session" indicator badge
- [x] 9.4 Add route and navigation link to session management page

## 10. Frontend - Login History Page

- [x] 10.1 Create login history page component with paginated table
- [x] 10.2 Display timestamp, IP, user-agent, status with color-coded badges
- [x] 10.3 Add route and navigation link to login history page
- [x] 10.4 (Admin) Add user filter dropdown for admin view

## 11. Tests

- [x] 11.1 Write tests for CAPTCHA generate and validate endpoints
- [x] 11.2 Write tests for account lockout flow (lock, unlock, auto-unlock)
- [x] 11.3 Write tests for password policy validation
- [x] 11.4 Write tests for session management (create, list, terminate)
- [x] 11.5 Write tests for remember_me token expiry
- [x] 11.6 Write frontend component tests for new UI elements

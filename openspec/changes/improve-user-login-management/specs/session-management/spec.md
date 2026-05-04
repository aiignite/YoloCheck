## ADDED Requirements

### Requirement: Each login SHALL create a unique session record
The system SHALL generate a unique JWT ID (jti) for each login.
Each session SHALL store: user_id, jti, IP address, user-agent, device info, created_at, last_accessed_at.
Sessions SHALL be stored in a `user_sessions` database table.

#### Scenario: New session created on login
- **WHEN** user logs in successfully
- **THEN** a new session record SHALL be created
- **THEN** the JWT token SHALL include the jti claim

### Requirement: User SHALL view their active sessions
The system SHALL provide a page where users can see all their active sessions.
Each session entry SHALL show: login time, IP address, device/browser info, current session indicator.

#### Scenario: User views sessions
- **WHEN** user navigates to session management page
- **THEN** all active sessions for that user SHALL be displayed

### Requirement: User SHALL be able to terminate remote sessions
The system SHALL allow users to terminate any of their active sessions except the current one.
Terminating a session SHALL invalidate its refresh token.

#### Scenario: User terminates a session
- **WHEN** user clicks "terminate" on a remote session
- **THEN** that session SHALL be deleted
- **THEN** that session's refresh token SHALL become invalid

### Requirement: "Remember Me" SHALL extend session duration
The login page SHALL include a "Remember Me" checkbox.
When checked, the refresh token expiration SHALL be 30 days (instead of default 7 days).
When unchecked, the default token expiration SHALL apply.

#### Scenario: Remember me extends token lifetime
- **WHEN** user checks "Remember Me" during login
- **THEN** refresh token SHALL expire in 30 days

#### Scenario: Default token lifetime
- **WHEN** user does NOT check "Remember Me" during login
- **THEN** refresh token SHALL expire in default 7 days

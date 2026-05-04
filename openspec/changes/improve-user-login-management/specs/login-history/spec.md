## ADDED Requirements

### Requirement: All login attempts SHALL be recorded
The system SHALL record every login attempt (successful and failed) in the audit log.
Each record SHALL include: timestamp, username, IP address, user-agent, success/failure status, failure reason.
Failed attempts SHALL include the reason (invalid credentials, account locked, CAPTCHA failed).

#### Scenario: Successful login recorded
- **WHEN** user logs in successfully
- **THEN** an audit log entry SHALL be created with status "success"

#### Scenario: Failed login recorded
- **WHEN** user login fails
- **THEN** an audit log entry SHALL be created with status "failure" and reason

### Requirement: User SHALL view their own login history
The system SHALL provide an API endpoint `/auth/login-history` for users to retrieve their login history.
The response SHALL include: timestamp, IP address, user-agent, status, failure reason (if any).
Results SHALL be paginated with configurable page size.
Results SHALL be sorted by timestamp descending.

#### Scenario: User views login history
- **WHEN** user navigates to login history page
- **THEN** the most recent 20 login records SHALL be displayed in a table
- **THEN** older records SHALL be accessible via pagination

### Requirement: Admin SHALL view any user's login history
Admin users SHALL be able to query login history for any specific user.
The API SHALL support filtering by user_id, date range, and status.

#### Scenario: Admin views user login history
- **WHEN** admin user queries login history for a specific user
- **THEN** all login records for that user SHALL be returned

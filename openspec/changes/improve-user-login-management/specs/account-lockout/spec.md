## ADDED Requirements

### Requirement: Account SHALL be locked after consecutive failed login attempts
The system SHALL track failed login attempts per username.
After 5 consecutive failed attempts within 15 minutes, the account SHALL be temporarily locked.
Locked accounts SHALL NOT be able to log in until the lock expires or an admin unlocks them.
Admin role accounts SHALL be exempt from automatic lockout.

#### Scenario: Account locked after 5 failed attempts
- **WHEN** user enters wrong password 5 times consecutively
- **THEN** account SHALL be locked for 15 minutes
- **THEN** login attempts SHALL return account locked error message

#### Scenario: Locked account auto-unlocks after timeout
- **WHEN** account is locked and 15 minutes have passed
- **THEN** the next login attempt SHALL proceed normally

#### Scenario: Successful login resets failure count
- **WHEN** user logs in successfully
- **THEN** the failed attempt counter SHALL be reset to zero

### Requirement: Admin SHALL be able to manually unlock accounts
The system SHALL provide an API for admin users to unlock any locked account.
The unlock action SHALL be recorded in the audit log.

#### Scenario: Admin unlocks an account
- **WHEN** admin user submits unlock request for a locked account
- **THEN** the account SHALL be unlocked immediately
- **THEN** an audit log entry SHALL be created

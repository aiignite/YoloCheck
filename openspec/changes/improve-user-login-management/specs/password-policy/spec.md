## ADDED Requirements

### Requirement: Password SHALL meet minimum complexity requirements
The system SHALL enforce the following password rules:
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 digit
- At least 1 special character (!@#$%^&* etc.)
New passwords SHALL be validated on both registration and password change.

#### Scenario: Valid password accepted
- **WHEN** user sets a password meeting all complexity rules
- **THEN** the password SHALL be accepted and hashed

#### Scenario: Weak password rejected
- **WHEN** user sets a password that does not meet complexity rules
- **THEN** the system SHALL reject with specific error messages for each rule violation

### Requirement: Frontend SHALL show password strength indicator
The login/register form SHALL display a real-time password strength bar.
The strength indicator SHALL show which rules are met and which are missing.

#### Scenario: Password strength updates in real-time
- **WHEN** user types a password in the input field
- **THEN** a strength bar SHALL update in real-time showing weak/medium/strong

### Requirement: Previous N passwords SHALL not be reused
The system SHALL store the last 5 password hashes per user.
When changing password, the new password SHALL NOT match any of the last 5 passwords.

#### Scenario: Password reuse rejected
- **WHEN** user tries to set a password used in the last 5 changes
- **THEN** the system SHALL reject with "password previously used" error

## ADDED Requirements

### Requirement: Login page SHALL display a CAPTCHA image
The system SHALL generate and display a CAPTCHA image on the login page after username/password entry.
The CAPTCHA SHALL be an SVG image containing 4-6 alphanumeric characters.
The CAPTCHA SHALL support refresh (new image) without page reload.

#### Scenario: CAPTCHA displays on login
- **WHEN** user navigates to the login page
- **THEN** a CAPTCHA image and input field SHALL be displayed

#### Scenario: User can refresh CAPTCHA
- **WHEN** user clicks the refresh icon on the CAPTCHA image
- **THEN** a new CAPTCHA image SHALL be generated and displayed

### Requirement: CAPTCHA SHALL be validated server-side
The system SHALL verify the CAPTCHA code on the server before processing login credentials.
The CAPTCHA key and code SHALL be sent as part of the login request.
Each CAPTCHA code SHALL be single-use only.
CAPTCHA codes SHALL expire after 5 minutes.

#### Scenario: Successful CAPTCHA validation
- **WHEN** user submits correct CAPTCHA code with valid credentials
- **THEN** login SHALL proceed and user SHALL be authenticated

#### Scenario: Failed CAPTCHA validation
- **WHEN** user submits incorrect CAPTCHA code
- **THEN** login SHALL be rejected with CAPTCHA error message
- **THEN** a new CAPTCHA SHALL be generated for retry

## ADDED Requirements

### Requirement: Frontend calls Java via Vite proxy
All frontend API calls SHALL be proxied through Vite to Java :8090 without errors.

#### Scenario: Login succeeds with real JWT
- **WHEN** user logs in with valid credentials
- **THEN** the response contains a valid JWT access_token from Java backend

#### Scenario: All page loads return HTTP 200
- **WHEN** user navigates to any page (定稿/选品/素材/载体/看板)
- **THEN** no API call returns HTTP 500

#### Scenario: No mock token used
- **WHEN** frontend makes API calls
- **THEN** Authorization header contains a real JWT, not mock-token

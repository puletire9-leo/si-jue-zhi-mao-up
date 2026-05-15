## ADDED Requirements

### Requirement: Complete API endpoint inventory
The system SHALL have a Java controller mapping for every business API endpoint that existed in the Python backend.

#### Scenario: All Python route files have corresponding Java controllers
- **WHEN** comparing the 27 Python route files under `backend/app/api/` against Java controllers under `com.sjzm.controller/`
- **THEN** each Python route file SHALL map to at least one Java controller with equivalent HTTP methods and path patterns

#### Scenario: Frontend API calls resolve to Java endpoints
- **WHEN** the frontend `src/api/` modules issue HTTP requests
- **THEN** each request URL SHALL match a Java controller's `@RequestMapping` prefix plus method-level path

### Requirement: Correct HTTP method mapping
Each endpoint SHALL use the same HTTP method (GET/POST/PUT/DELETE) as its Python counterpart.

#### Scenario: CRUD operations use standard methods
- **WHEN** a GET request is sent to any list/detail endpoint
- **THEN** the Java controller SHALL respond with 200 and include the expected data

#### Scenario: Mutations use correct methods
- **WHEN** a POST/PUT/DELETE request is sent
- **THEN** the Java controller SHALL process the mutation and return 200 or 4xx/5xx with appropriate error messages

### Requirement: Legacy compatibility endpoints
The system SHALL maintain backward compatibility with frontend API path expectations.

#### Scenario: Frontend uses /api/v1/ prefix consistently
- **WHEN** any frontend API module calls an endpoint
- **THEN** the URL SHALL include `/api/v1/` and the Java controller SHALL be mapped to accept it

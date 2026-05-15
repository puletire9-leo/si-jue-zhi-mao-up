## ADDED Requirements

### Requirement: Authentication flow works end-to-end
The system SHALL support user login with bcrypt password verification and JWT token generation.

#### Scenario: Successful login
- **WHEN** a POST request with valid credentials is sent to `/api/v1/auth/login`
- **THEN** the system SHALL return an access token, refresh token, and user info

#### Scenario: Token validation
- **WHEN** a GET request with a valid Bearer token is sent to `/api/v1/auth/me`
- **THEN** the system SHALL return the authenticated user's profile and permissions

### Requirement: File upload flow works
The system SHALL accept multipart image uploads, store them locally, generate thumbnails, and create database records.

#### Scenario: Single image upload
- **WHEN** a POST with a valid image file is sent to `/api/v1/images/upload`
- **THEN** the file SHALL be saved to the configured upload directory and a database record created with correct URL

#### Scenario: Image retrieval
- **WHEN** a GET request is sent to the image file endpoint
- **THEN** the system SHALL return the image binary with correct Content-Type

### Requirement: COS storage integration
The system SHALL connect to Tencent Cloud Object Storage for image proxy operations.

#### Scenario: COS client initialization
- **WHEN** the Spring Boot application starts with `tencent.cos.enabled=true`
- **THEN** the COS client SHALL initialize successfully and log "COS 客户端初始化成功"

### Requirement: CRUD operations work across all modules
The system SHALL support create, read, update, and delete operations for Products, FinalDrafts, MaterialLibrary, CarrierLibrary, and Selections.

#### Scenario: List with pagination
- **WHEN** a GET request with page/size parameters is sent to any list endpoint
- **THEN** the system SHALL return a PageResult with list, total, page, and size fields

#### Scenario: Soft delete and recycle bin
- **WHEN** a DELETE request is sent for a resource
- **THEN** the resource SHALL appear in the corresponding recycle bin endpoint

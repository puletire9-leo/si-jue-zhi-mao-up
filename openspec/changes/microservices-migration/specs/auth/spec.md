## MODIFIED Requirements

### Requirement: Authentication Enforcement
The system MUST enforce JWT authentication at Gateway level for all protected routes. Previously the SecurityFilterChain was configured with `.anyRequest().permitAll()` and the JwtAuthenticationFilter was a no-op pass-through.

#### Scenario: Unauthenticated request rejected
- **WHEN** a request without a valid JWT accesses any protected endpoint
- **THEN** Gateway returns 401 Unauthorized without forwarding to downstream services

#### Scenario: Authenticated request with valid role
- **WHEN** a request with a valid admin JWT accesses `DELETE /api/v1/users/{id}`
- **THEN** the request is forwarded to `sjzm-user` and processed successfully

### Requirement: Session Management
The system MUST remain stateless. All authentication state is carried in the JWT token and validated at Gateway. No server-side session storage.

#### Scenario: Token contains all required claims
- **WHEN** a user logs in successfully
- **THEN** the issued JWT contains userId, username, role, and expiration claims

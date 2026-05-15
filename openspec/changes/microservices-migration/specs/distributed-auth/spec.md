## ADDED Requirements

### Requirement: Gateway JWT Validation
Spring Cloud Gateway SHALL validate JWT tokens on all protected routes before forwarding requests.

#### Scenario: Valid token passes through
- **WHEN** a request includes a valid JWT in the Authorization header
- **THEN** Gateway forwards the request to the target service with user info in headers

#### Scenario: Invalid token rejected at gateway
- **WHEN** a request includes an expired or invalid JWT
- **THEN** Gateway returns 401 without calling any downstream service

#### Scenario: Public endpoints bypass auth
- **WHEN** a request targets `/api/v1/auth/login` or `/api/v1/auth/register`
- **THEN** Gateway forwards the request without JWT validation

### Requirement: Service-Level RBAC
User service SHALL enforce role-based access control at the method level using Spring Security annotations.

#### Scenario: Admin accesses admin endpoint
- **WHEN** a user with role "admin" calls `DELETE /api/v1/users/{id}`
- **THEN** the request is allowed and the user is deleted

#### Scenario: User accesses admin endpoint
- **WHEN** a user with role "user" calls `DELETE /api/v1/users/{id}`
- **THEN** the service returns 403 Forbidden

### Requirement: Token Blacklist
Logout SHALL invalidate tokens by adding their hash to a Redis blacklist checked by Gateway.

#### Scenario: Logged-out token rejected
- **WHEN** a user logs out and then reuses the old token
- **THEN** Gateway returns 401 because the token is in the Redis blacklist

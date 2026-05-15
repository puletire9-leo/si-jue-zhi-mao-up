## ADDED Requirements

### Requirement: Vite proxy routes to Java backend
The Vite development server SHALL proxy all `/api/*` requests to the Java backend on port 8090.

#### Scenario: API proxy connectivity
- **WHEN** the browser sends a request to `http://localhost:5173/api/v1/*`
- **THEN** Vite SHALL forward it to `http://localhost:8090/api/v1/*` and return the response

#### Scenario: No ECONNREFUSED errors
- **WHEN** the Java backend is running on port 8090
- **THEN** all proxied requests SHALL return HTTP responses (not connection errors)

### Requirement: Frontend pages render without API errors
All major frontend pages SHALL render their data without red 4xx/5xx errors in the browser console.

#### Scenario: ProductDataDashboard loads
- **WHEN** navigating to the product data dashboard
- **THEN** product data SHALL load without API errors

#### Scenario: FinalDraft page loads
- **WHEN** navigating to the final draft management page
- **THEN** final drafts SHALL load with correct image thumbnails

#### Scenario: MaterialLibrary page loads
- **WHEN** navigating to the material library page
- **THEN** materials SHALL load with their associated data

#### Scenario: CarrierLibrary page loads
- **WHEN** navigating to the carrier library page
- **THEN** carriers SHALL load with their associated data

#### Scenario: Image management page loads
- **WHEN** navigating to the image management page
- **THEN** images SHALL display with thumbnails served through COS proxy

### Requirement: Auth token flows through frontend
The frontend SHALL properly store and attach JWT tokens to API requests.

#### Scenario: Login from frontend
- **WHEN** a user submits login credentials through the frontend
- **THEN** the token SHALL be stored and attached to subsequent API calls via axios interceptors

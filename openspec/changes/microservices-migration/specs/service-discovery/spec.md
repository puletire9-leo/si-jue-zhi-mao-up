## ADDED Requirements

### Requirement: Service Registration
Each microservice SHALL automatically register with Nacos on startup and deregister on shutdown.

#### Scenario: Service registers successfully
- **WHEN** a service starts and connects to Nacos
- **THEN** the service appears in Nacos service list with health status "UP"

#### Scenario: Service deregisters on shutdown
- **WHEN** a service receives SIGTERM
- **THEN** the service is removed from Nacos within 30 seconds

### Requirement: Dynamic Route Discovery
Spring Cloud Gateway SHALL discover service instances from Nacos and route requests using load-balanced URIs.

#### Scenario: Route resolves to healthy instance
- **WHEN** a request arrives at Gateway matching `/api/v1/auth/**`
- **THEN** Gateway forwards the request to a healthy `sjzm-user` instance

#### Scenario: Unhealthy instance excluded
- **WHEN** a `sjzm-user` instance health check fails
- **THEN** Gateway stops routing to that instance within 15 seconds

### Requirement: Centralized Configuration
All services SHALL load configuration from Nacos Config, with dynamic refresh for non-static properties.

#### Scenario: Config change without restart
- **WHEN** a config value is updated in Nacos Config
- **THEN** services annotated with `@RefreshScope` pick up the new value within 10 seconds

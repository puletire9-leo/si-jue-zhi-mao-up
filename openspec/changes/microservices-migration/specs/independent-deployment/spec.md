## ADDED Requirements

### Requirement: Per-Service Docker Image
Each microservice SHALL have its own Dockerfile producing an independent image.

#### Scenario: Build user service image
- **WHEN** CI pipeline builds `sjzm-user`
- **THEN** a Docker image tagged `sjzm-user:latest` is produced and pushed to registry

### Requirement: Docker Compose Multi-Service
Production deployment SHALL use a single `docker-compose.yml` that starts all services with correct dependencies and health checks.

#### Scenario: Full stack starts in order
- **WHEN** `docker compose up -d` is executed
- **THEN** services start in order: MySQL → Redis → Nacos → individual services → Gateway, and Gateway health check passes

### Requirement: Independent Scaling
Each service SHALL expose its own port and be independently scalable.

#### Scenario: Scale product service for high traffic
- **WHEN** product service instances are increased to 3 via `docker compose scale`
- **THEN** Nacos registers all 3 instances and Gateway load-balances across them

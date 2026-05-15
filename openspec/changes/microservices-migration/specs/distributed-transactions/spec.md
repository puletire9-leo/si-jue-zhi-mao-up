## ADDED Requirements

### Requirement: Distributed Transaction Support
The system SHALL use Seata AT mode to ensure data consistency across service boundaries for critical write operations.

#### Scenario: Successful cross-service transaction
- **WHEN** creating a final draft that requires both `sjzm-customization` and `sjzm-product` updates
- **THEN** both service databases commit atomically via Seata global transaction

#### Scenario: Transaction rollback on failure
- **WHEN** one service in a Seata global transaction fails
- **THEN** all participating services roll back their local changes automatically

### Requirement: Non-Critical Operations Use Eventual Consistency
Operations that do not require immediate consistency SHALL use RocketMQ with retry for eventual consistency.

#### Scenario: Image indexing after upload
- **WHEN** an image is uploaded to COS
- **THEN** the vector indexing happens asynchronously via MQ message, not blocking the upload response

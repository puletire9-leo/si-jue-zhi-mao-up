## ADDED Requirements

### Requirement: Developer-owned independent batches
The system SHALL maintain batches independently for GOOD and BAD libraries, and every batch MUST belong to exactly one developer.

#### Scenario: Developer creates a good-product batch
- **WHEN** a normal developer creates a batch while viewing the GOOD library
- **THEN** the system creates the batch for that developer and the GOOD bucket only

#### Scenario: Same name in separate buckets
- **WHEN** a developer creates batch `7.14` in both GOOD and BAD libraries
- **THEN** the system accepts both batches as independent classifications

#### Scenario: Administrator creates a batch
- **WHEN** an administrator creates a batch for a selected developer
- **THEN** the system assigns the batch to that selected developer

### Requirement: Default date-based batch name
The client SHALL default a new batch name to the local current date formatted as `M.d`, while allowing the user to edit it before creation.

#### Scenario: Create batch on July 14
- **WHEN** the user opens the create-batch prompt on July 14
- **THEN** the initial batch name is `7.14`

### Requirement: Single batch membership
Each library item SHALL have either no batch or exactly one batch whose developer and bucket match the item.

#### Scenario: Assign multiple selected items
- **WHEN** the user selects multiple items and assigns them to a valid batch
- **THEN** every selected item is assigned to that one batch atomically

#### Scenario: Reject cross-developer assignment
- **WHEN** an item and target batch belong to different developers
- **THEN** the system rejects the assignment without changing any selected item

#### Scenario: Reject cross-bucket assignment
- **WHEN** a GOOD item is assigned to a BAD batch or vice versa
- **THEN** the system rejects the assignment without changing any selected item

### Requirement: Unassign and conversion behavior
The system SHALL support removing selected items from classification, and SHALL clear batch membership whenever an item changes between GOOD and BAD.

#### Scenario: Remove classification
- **WHEN** the user unassigns selected items
- **THEN** their batch membership becomes empty while their GOOD or BAD bucket remains unchanged

#### Scenario: Convert good to bad
- **WHEN** a classified GOOD item is converted to BAD
- **THEN** the item becomes BAD and its batch membership is cleared

### Requirement: Batch filtering and export data
The library SHALL support filtering by all items, unassigned items, or a specific batch, and returned/exported records SHALL expose the batch identifier and display name.

#### Scenario: Filter unassigned items
- **WHEN** the user selects the unassigned classification filter
- **THEN** only items without a batch are returned

#### Scenario: Export a filtered batch
- **WHEN** the user downloads all CSV records while a specific batch is selected
- **THEN** all pages matching that batch are exported with batch ID and batch name

### Requirement: Batch authorization
Normal developers MUST only view and mutate their own batches and items, while administrators SHALL be able to operate across developers with explicit developer context.

#### Scenario: Normal developer requests another developer batch
- **WHEN** a normal developer attempts to view or use another developer's batch
- **THEN** the system denies access or excludes that batch

#### Scenario: Administrator uses the default developer
- **WHEN** an administrator enters the artificial library or adds an item without explicitly selecting another developer
- **THEN** the system selects and uses the active developer account named `刘淼` as the real owner

#### Scenario: Administrator creates without explicit developer context
- **WHEN** an administrator creates a batch without changing the default developer
- **THEN** the batch belongs to the active `刘淼` user account

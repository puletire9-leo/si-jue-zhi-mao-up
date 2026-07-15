## ADDED Requirements

### Requirement: Reusable selection mode
The artificial library SHALL use the same selection-mode interaction as the unified product-selection pages and MUST hide selection controls when selection mode is off.

#### Scenario: Enter selection mode
- **WHEN** the user enables selection mode
- **THEN** clicking a product card toggles its selected state and selection actions become available

#### Scenario: Select current page
- **WHEN** the user clicks select-all-current-page in selection mode
- **THEN** all selectable items on the current page are selected

#### Scenario: Open details while selecting
- **WHEN** the user clicks the product detail action in selection mode
- **THEN** the detail opens without toggling the card selection

### Requirement: Batch status presentation
Every product card SHALL display its developer and either its assigned batch name or an unassigned label.

#### Scenario: Classified item card
- **WHEN** an item belongs to batch `7.14`
- **THEN** its card displays classification `7.14`

#### Scenario: Unclassified item card
- **WHEN** an item has no batch
- **THEN** its card displays the unassigned state

### Requirement: Persisted card scaling
The artificial library SHALL reuse the unified product-selection card-size controls and persist its own scale preference locally.

#### Scenario: Adjust card size
- **WHEN** the user increases or decreases the card size
- **THEN** the whole product card composition scales while preserving grid layout and interactions

#### Scenario: Reopen the page
- **WHEN** the user returns to the artificial library after setting a card scale
- **THEN** the previously saved artificial-library scale is restored

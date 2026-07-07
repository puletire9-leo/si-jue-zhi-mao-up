## ADDED Requirements

### Requirement: Method-Card Based Shop Ranking
The system SHALL rank shops by the number of products that hit a selected method card.

#### Scenario: M01 shop ranking
- **WHEN** a user requests shop ranking with `methodId=M01`
- **THEN** the system returns shops ordered by M01 hit count descending using the M01 hit source

#### Scenario: Unsupported method ID
- **WHEN** a user requests shop ranking with an unsupported `methodId`
- **THEN** the system MUST respond clearly that the method is unsupported and MUST NOT silently return M01 data

### Requirement: Shop Ranking Rows Include Method Context
Each shop ranking row SHALL include the method context used to produce the ranking.

#### Scenario: Method context returned
- **WHEN** the system returns a shop ranking row
- **THEN** the row includes the selected `methodId`, shop identity, marketplace, and hit count

### Requirement: Hit-Product Profile Aggregates
The system SHALL compute shop profile aggregates from the products that hit the selected method card.

#### Scenario: Price profile returned
- **WHEN** a shop has hit products for the selected method card
- **THEN** the row includes average, minimum, and maximum price across those hit products

#### Scenario: Top category returned
- **WHEN** a shop has hit products with category paths
- **THEN** the row includes the most frequent hit-product leaf category as `topCategory`

### Requirement: Sales-Tier Distribution
The system SHALL expose sales-tier distribution for hit products in each shop ranking row.

#### Scenario: Sales-tier counts returned
- **WHEN** a shop ranking row is returned
- **THEN** the row includes counts for A, B, C, D, and UNKNOWN sales tiers among hit products

#### Scenario: Missing sales tier counted as UNKNOWN
- **WHEN** a hit product has no sales-tier value
- **THEN** the system counts it in the UNKNOWN tier bucket

### Requirement: Product Features Remain Separate From Method Hits
The shop grading consumer layer SHALL consume product base features and method-card hit sets without redefining either layer.

#### Scenario: Sales tier does not imply method hit
- **WHEN** a product has a sales tier such as A or B
- **THEN** the product MUST NOT be counted as a method-card hit unless the selected method card hit source includes it

#### Scenario: Method hit does not redefine base feature
- **WHEN** a product hits M01 or another method card
- **THEN** the shop grading layer MUST NOT rewrite the product's base feature values

### Requirement: Legacy Similarity Rating Remains Available
The system SHALL keep the existing similarity-based shop rating separate from the method-card shop grading flow.

#### Scenario: Legacy rating endpoint remains separate
- **WHEN** a user requests saved similarity ratings
- **THEN** the system returns the legacy rating data without mixing it into method-card hit ranking rows

## ADDED Requirements

### Requirement: Shared Product Feature Derivation
The system SHALL derive reusable base product features through a shared product feature processing capability instead of duplicating feature calculations inside individual method-card or filtering flows.

#### Scenario: Import derives shared features
- **WHEN** competitor products are imported or re-filtered
- **THEN** the system derives base product features including listing age, normalized weight, sales tier, and product-related URLs before downstream filters or method-card consumers use the products

#### Scenario: Method-card logic remains independent
- **WHEN** a method card evaluates product eligibility
- **THEN** the method card MAY consume base product features but MUST own its own hit criteria and MUST NOT be implemented as part of the shared feature derivation

### Requirement: Sales Volume Tier Feature
The system SHALL classify each product into a sales-volume tier using the product's `units` value as a reusable auxiliary feature.

#### Scenario: Units classify to A tier
- **WHEN** a product has `units >= 100`
- **THEN** the system sets its sales tier to `A`

#### Scenario: Units classify to B tier
- **WHEN** a product has `units` from 50 through 99
- **THEN** the system sets its sales tier to `B`

#### Scenario: Units classify to C tier
- **WHEN** a product has `units` from 15 through 49
- **THEN** the system sets its sales tier to `C`

#### Scenario: Units classify to D tier
- **WHEN** a product has `units` from 0 through 14
- **THEN** the system sets its sales tier to `D`

#### Scenario: Missing units classify to UNKNOWN
- **WHEN** a product has no `units` value
- **THEN** the system sets its sales tier to `UNKNOWN`

### Requirement: Feature Persistence Across Raw And Clean Tables
The system SHALL persist reusable base product features needed by downstream analysis on both the raw competitor product table and the clean competitor product table.

#### Scenario: Raw table stores sales tier
- **WHEN** a competitor product row is inserted, updated, or backfilled
- **THEN** `competitor_products.sales_tier` reflects the shared sales-volume tier rule

#### Scenario: Clean table carries sales tier
- **WHEN** `competitor_products_clean` is refreshed from raw competitor products
- **THEN** the clean representative row carries the appropriate `sales_tier` value for downstream consumers

### Requirement: Base Features Are Separate From Method-Card Hits
The system SHALL distinguish reusable base product features from method-card hit outcomes.

#### Scenario: Base feature examples
- **WHEN** a value describes an intrinsic or normalized product fact such as listing age, normalized weight, sales tier, deduplication key, or generated product URL
- **THEN** the value MAY be treated as a base product feature

#### Scenario: Method-card hit examples
- **WHEN** a value describes whether a product matched a specific method card such as M01, M03, or a future card
- **THEN** the value MUST be treated as a consumer-layer method-card outcome rather than a shared base product feature

#### Scenario: Future method cards avoid new base flags
- **WHEN** a future method card needs repeated ranking or aggregation
- **THEN** persisted hit flags or hit tables MUST require an explicit design decision and MUST NOT be added as routine base product features

### Requirement: Documentation Reflects The Layer Boundary
The system SHALL document the role of the product feature layer as a reusable data-processing layer beneath independent method cards.

#### Scenario: Shop grading docs reference feature layer
- **WHEN** shop grading or method-card documentation discusses sales grading or method-card hits
- **THEN** it distinguishes between base auxiliary product features and method-card consumer results

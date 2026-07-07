## Why

Current product import and selection logic already computes reusable facts such as listing age and normalized weight, but those computations live inside feature-specific flows and are mixed with method-card outcomes such as `m01_active`. As more method cards appear, the system needs a shared product feature processing layer so auxiliary product facts can be reused without turning every method card into another persisted special-case flag.

## What Changes

- Introduce a reusable product feature processing capability for base product facts used by selection, ranking, and analysis flows.
- Add sales-volume tiering as a base auxiliary feature: A/B/C/D/UNKNOWN from `units`.
- Treat existing derived facts such as listing age, normalized weight, deduplication key, URL generation, and simple normalized fields as reusable feature-layer outputs.
- Keep method-card hit logic independent in the consumer layer; method cards may consume base features but do not become base features.
- Clarify that `m01_active` is an existing optimization for M01 shop ranking, not the pattern for future method-card persistence.
- Provide a migration path from computations currently embedded in `CompetitorFilterService` toward a shared processor used by import, clean-layer sync, method-card queries, and future shop ranking.

## Capabilities

### New Capabilities

- `product-feature-processing`: Defines shared product feature derivation, including sales tiers and the boundary between reusable product facts and method-card hit results.

### Modified Capabilities

- None.

## Impact

- Java product service import/filter flow: `CompetitorFilterService` should delegate reusable feature derivation to a shared processor instead of owning all calculations directly.
- Product entities and persistence: likely adds columns for sales tier and related reusable feature outputs on `competitor_products` and `competitor_products_clean`.
- Clean-layer and method-card SQL: should consume shared feature outputs where appropriate while keeping each method card's own WHERE logic independent.
- Documentation: update the shop grading and method-library docs to reflect the L1/L2/L3 split and the role of base product features.

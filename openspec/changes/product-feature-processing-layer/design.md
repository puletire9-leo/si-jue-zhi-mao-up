## Context

The product service already derives several useful product facts during import and cleaning:

- `CompetitorFilterService` calculates `listing_days`, `weight_g`, product URLs, similar-image URLs, and legacy `filter_mode`.
- `competitor_products_clean` materializes a de-variantized clean table with `dedup_key`, `listing_days`, `weight_g`, and `m01_active`.
- Method cards (`M01`, `M02`, `M03`) currently query their own source tables and apply independent WHERE rules.
- M04 already acts as a data-processing evidence layer by calculating age-tier baselines and writing `m04_*` evidence fields.

The architectural gap is that reusable product facts and method-card outcomes are currently adjacent in the same flows. That is workable for M01, but it does not scale if future cards add more `mxx_active` flags or reimplement the same sales-tier, age, and weight derivation logic.

## Goals / Non-Goals

**Goals:**

- Establish a shared product feature processor for reusable product facts.
- Add sales-volume tiering as a stable base feature that future method cards can consume.
- Reuse the same feature derivation during import, filter reapply, and clean-table refresh.
- Keep every method card independent: each card owns its own hit logic, reasons, parameters, and SQL/API contract.
- Document the boundary between base features, L2 evidence outputs, and L3 method cards.

**Non-Goals:**

- Do not replace M01/M02/M03 method-card query logic in this change.
- Do not remove `m01_active`; keep it as an existing M01 shop-ranking optimization.
- Do not turn all future method-card hits into persisted columns.
- Do not redesign M04 or the whole scoring engine.
- Do not add a generic dynamic rule engine yet.

## Decisions

### Decision 1: Create a product feature processor, not a method-card processor

Add a Java service/component such as `ProductFeatureProcessor` that receives a `CompetitorProduct` plus marketplace/source context and fills reusable facts:

- `listing_days`
- `weight_g`
- `sales_tier`
- normalized/derived URLs
- future simple feature fields that describe the product itself

This processor must not decide whether a product hits M01, M03, or any future method card.

Alternative considered: keep adding helper methods to `CompetitorFilterService`. That is faster initially, but it preserves the current coupling and makes future method cards reimplement or accidentally mutate base feature logic.

### Decision 2: Persist sales tier on both raw and clean product tables

Add `sales_tier` to `competitor_products` and `competitor_products_clean`. The raw table stores the feature at import/reapply time. The clean table carries the representative product feature forward for L2 statistics and L3 method-card queries.

Sales tier rule:

- `A`: `units >= 100`
- `B`: `50 <= units <= 99`
- `C`: `15 <= units <= 49`
- `D`: `0 <= units < 15`
- `UNKNOWN`: `units IS NULL`

Alternative considered: compute sales tier only in SQL with `CASE WHEN`. That avoids schema changes, but repeats logic across method cards, store ranking, and analysis SQL.

### Decision 3: Treat method-card hits as consumer outputs

`m01_active` remains for now because the current shop-ranking implementation already depends on it for performance. However, it is explicitly an optimization for the M01 consumer flow, not a general feature-layer pattern.

Future cards should first consume base features and clean-table data through independent SQL. Persisted hit tables/flags should require a separate design decision, usually only when ranking or repeated large aggregations need it.

Alternative considered: introduce generic `method_active(method_id, asin, hit)` now. That may be useful later, but it is premature until more card-level ranking workflows prove the need.

### Decision 4: Keep clean-table responsibility separate from feature derivation

`competitor_products_clean` remains the materialized L1 clean table responsible for de-variantized representative rows. It should copy or select already-derived base features from raw products instead of recalculating them ad hoc.

Alternative considered: move all feature derivation into clean-table SQL. That helps analytics but misses import-time consumers such as legacy filtering, skip records, and 30-day tracking.

## Risks / Trade-offs

- [Risk] Existing rows will have null `sales_tier` until backfilled. -> Mitigation: add a SQL migration/backfill and ensure clean refresh copies the value.
- [Risk] `listing_days` semantics are currently nuanced for missing `available_date`. -> Mitigation: preserve existing behavior in the processor first; do not change missing-date policy in this change.
- [Risk] `m01_active` may continue to look like a base feature because it lives on product tables. -> Mitigation: update comments and docs to mark it as a consumer optimization, and avoid adding new `mxx_active` fields in this change.
- [Risk] Clean-table representative selection may copy one variant's `sales_tier` while another variant has a stronger tier. -> Mitigation: preserve current representative-row semantics initially; if store ranking needs parent-level max tier later, add a separate aggregate feature.

## Migration Plan

1. Add schema columns for `sales_tier` on raw and clean product tables.
2. Add entity/DTO mappings only where the project already exposes product-derived fields.
3. Extract reusable feature derivation from `CompetitorFilterService` into a shared processor.
4. Have import/reapply call the processor before legacy filtering and M01-specific logic.
5. Update clean-table insert/update SQL to carry `sales_tier`.
6. Backfill `sales_tier` for existing raw and clean rows.
7. Update docs to reflect the base-feature / evidence / method-card split.

Rollback: remove consumers of `sales_tier`, leave the column unused, and continue using existing `units` filters. The change should not alter method-card eligibility by itself.

## Open Questions

- Should `D` include zero-unit products as a meaningful tier, or should zero be separated as `ZERO` later?
- Should future parent-level clean features include both representative `sales_tier` and group-level max/min sales tier?
- Should `listing_days` eventually move from stored snapshot to a real-time derived view for time-sensitive consumers?

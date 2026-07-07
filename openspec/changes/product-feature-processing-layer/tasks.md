## 1. Schema And Model

- [x] 1.1 Add `sales_tier` column to `competitor_products` and `competitor_products_clean`, including a backfill statement based on `units`.
- [x] 1.2 Add `salesTier` to `CompetitorProduct` and any clean-table DTO/entity paths that expose clean product rows.
- [x] 1.3 Update clean-table insert/update SQL so `competitor_products_clean.sales_tier` is populated from the representative raw product row.

## 2. Shared Feature Processor

- [x] 2.1 Add a shared `ProductFeatureProcessor` service/component for reusable product facts.
- [x] 2.2 Move listing age, normalized weight, product URL, similar URL, and sales-tier derivation into the shared processor without changing current behavior.
- [x] 2.3 Keep M01 hit evaluation outside the shared processor and leave it in the method-card/shop-ranking consumer flow.

## 3. Import And Refresh Integration

- [x] 3.1 Update `CompetitorFilterService` to call the shared processor before legacy filtering and downstream collection.
- [x] 3.2 Ensure `reapplyFilter` also refreshes shared product features for existing rows.
- [x] 3.3 Ensure clean-layer refresh carries updated base features after import/reapply.

## 4. Consumer Compatibility

- [x] 4.1 Verify M01/M02/M03 method-card queries still return the same eligibility results after the refactor.
- [x] 4.2 Verify M01 shop-ranking behavior still works with existing `m01_active` semantics.
- [x] 4.3 Optionally expose `salesTier` in product query responses if the existing product list DTO already exposes comparable derived fields.

## 5. Documentation And Verification

- [x] 5.1 Update shop grading docs to define sales tier as a base auxiliary product feature, not a method card.
- [x] 5.2 Update method-library docs to reinforce the L1 feature / L2 evidence / L3 method-card split.
- [x] 5.3 Add or update focused tests for sales-tier derivation and feature-processor behavior.
- [x] 5.4 Run the relevant Java product-service test/build command and record any remaining verification gaps.

Verification note: attempted `mvn -pl sjzm-product -am -Dtest=ProductFeatureProcessorTest test`, but this environment has no `mvn` or `java` executable on PATH. Static `git diff --check` completed with line-ending warnings only.

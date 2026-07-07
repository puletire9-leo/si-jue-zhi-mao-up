## 1. API Contract And DTO

- [x] 1.1 Extend `ShopMethodRankItem` with `methodId`, price range fields, and sales-tier count fields.
- [x] 1.2 Update `/api/v1/modules/shop-rating/method-rank` descriptions to present it as method-card shop grading, not only M01 ranking.
- [x] 1.3 Add explicit unsupported `methodId` handling instead of silently routing every method to M01.

## 2. M01 Shop Profile Aggregation

- [x] 2.1 Extend `selectM01ShopRanking` to return `methodId='M01'`.
- [x] 2.2 Extend M01 ranking SQL with `minPrice`, `maxPrice`, and A/B/C/D/UNKNOWN hit-product sales-tier counts.
- [x] 2.3 Ensure null or blank `sales_tier` values are counted as UNKNOWN.
- [x] 2.4 Preserve existing M01 ranking sort order by `hitCount DESC, avgPrice ASC`.

## 3. Service Boundary

- [x] 3.1 Add method-aware dispatch in `ShopMethodRankService`.
- [x] 3.2 Keep `rankByM01` as the M01 implementation path.
- [x] 3.3 Ensure future method cards can plug in without adding routine `mxx_active` base-feature fields.

## 4. Documentation

- [x] 4.1 Update shop grading docs to define the shop grading consumer layer and hit-product profile fields.
- [x] 4.2 Document that sales-tier distribution describes hit products, not the whole seller store.
- [x] 4.3 Document that legacy similarity rating remains a separate optional view.

## 5. Verification

- [x] 5.1 Add or update focused tests if the current Java test setup supports this module path.
- [x] 5.2 Run OpenSpec validation for `shop-grading-consumer-layer`.
- [x] 5.3 Run relevant Java product-service compile/test command if local Java/Maven is available, otherwise record the verification gap.

Verification note: `openspec validate shop-grading-consumer-layer --strict` passed. `git diff --check` completed with line-ending warnings only. Java/Maven tests were not run because this environment has no `java` or `mvn` executable on PATH.

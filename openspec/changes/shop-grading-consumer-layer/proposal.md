## Why

The current shop grading implementation has an M01 hit-count ranking, but it is not yet a complete shop grading system. We need a consumer-layer shop model that turns independent method-card hits and reusable product features into a usable shop profile for selecting stable new-product sources.

## What Changes

- Introduce a shop grading consumer layer that aggregates method-card hit products by shop.
- Extend the M01 shop ranking output with shop profile fields such as sales-tier distribution, hit-product price range, top category, and representative product count.
- Keep method-card hit evaluation independent from base product features; shop grading consumes method-card outputs and product features, it does not define them.
- Support an explicit method-card switch contract, with M01 implemented first and future methods requiring their own hit source or query strategy.
- Preserve the existing legacy similarity rating tab/API as a separate optional view.
- Document the difference between:
  - product base features (`sales_tier`, `listing_days`, `weight_g`)
  - method-card hit sets
  - shop grading consumer aggregates

## Capabilities

### New Capabilities

- `shop-grading-consumer-layer`: Defines how shops are ranked and profiled from method-card hit products and product base features.

### Modified Capabilities

- None.

## Impact

- Java product service shop-rating module: `ShopRatingController`, `ShopMethodRankService`, `ShopMethodRankMapper`, and `ShopMethodRankItem`.
- SQL aggregation over `competitor_products_clean`, initially for M01 hit products using the existing `m01_active` optimization.
- Frontend shop overview can consume richer shop ranking rows, but the first implementation can remain API-first.
- Documentation under `docs/店铺品级` and method-library layer docs should reflect the new shop grading consumer layer.

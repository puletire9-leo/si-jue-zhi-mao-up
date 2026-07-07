## Context

The project now has a clearer layer boundary:

- Product base features describe products (`sales_tier`, `listing_days`, `weight_g`, `dedup_key`).
- Method cards independently define hit products (`M01`, `M02`, `M03`, future cards).
- Shop grading should be a consumer layer that aggregates method-card hit products into shop profiles.

Current code has a useful start: `/api/v1/modules/shop-rating/method-rank` returns M01 shop hit ranking through `m01_active` on `competitor_products_clean`. However, the row only contains `sellerName`, `marketplace`, `hitCount`, `topCategory`, and `avgPrice`. It does not yet expose sales-tier distribution, broader shop product profile, or a clear method-card switch contract.

## Goals / Non-Goals

**Goals:**

- Make shop grading a consumer-layer model over method-card hit products and product base features.
- Enrich M01 shop ranking with useful shop profile aggregates.
- Provide a stable API contract for `methodId`, even if only `M01` is implemented first.
- Preserve existing legacy similarity rating APIs as a separate view.
- Keep future method-card expansion explicit, not hidden behind routine `mxx_active` columns.

**Non-Goals:**

- Do not implement every future method card's shop ranking in this change.
- Do not remove existing `ShopRatingServiceImpl` similarity rating.
- Do not create a generic rule engine or universal `method_hit` table yet.
- Do not move base feature derivation into shop grading.
- Do not require frontend redesign before the backend contract is useful.

## Decisions

### Decision 1: M01 remains the first implemented hit source

Use existing `m01_active=1` on `competitor_products_clean` for M01 shop ranking. It is already optimized for the current M01 hit-count use case and avoids re-running the full M01 WHERE over all historical rows on every request.

Alternative considered: replace `m01_active` with real-time M01 SQL immediately. That would simplify conceptual purity but risks performance and would discard an existing optimization that already works for M01.

### Decision 2: Shop profile aggregates are computed from hit products first

The first enriched shop profile should describe the products that hit the selected method card:

- `hitCount`
- `avgPrice`
- `minPrice` / `maxPrice`
- `topCategory`
- `salesTierA/B/C/D/UnknownCount`
- optional `sampleAsins` for inspection

This keeps the row directly tied to the selected method-card lens.

Alternative considered: aggregate all products from the seller regardless of method-card hit. That is useful later for a full shop health profile, but it can confuse the first ranking because the row would mix "why this shop is ranked" with unrelated inventory.

### Decision 3: Add a method-card dispatch boundary without over-generalizing storage

`ShopMethodRankService` should expose a method-aware entry point. M01 maps to the existing M01 query. Unsupported method IDs should return a clear error or empty unsupported response, not silently fall back.

Future method cards can plug in by adding a hit source query:

- direct SQL over a source table
- persisted hit table if performance requires it
- source-specific aggregation if the data is already shop-oriented

Alternative considered: add `method_active(method_id, marketplace, dedup_key)` now. It may become right later, but the project only has one shop-ranking hit source today, so forcing a generic table now is premature.

### Decision 4: Keep method-card hits separate from sales tiers

`sales_tier` is a product base feature used in the shop profile distribution. It does not decide whether a product hit the method card unless a future method card explicitly uses it in that card's criteria.

Alternative considered: treat A/B/C/D as shop grade directly. That loses the important distinction between product feature distribution and method-card eligibility.

## Risks / Trade-offs

- [Risk] M01 ranking remains special because it uses `m01_active`. -> Mitigation: document it as the first hit source and keep future hit sources explicit.
- [Risk] Sales-tier distribution can be null-heavy until `sales_tier` migration is applied. -> Mitigation: count nulls as UNKNOWN and require the product-feature migration before trusting the distribution.
- [Risk] Hit-product profile may not describe the whole seller store. -> Mitigation: name fields and docs clearly as hit-product aggregates; add full-store aggregates later if needed.
- [Risk] Unsupported method IDs may surprise frontend users. -> Mitigation: return clear unsupported method feedback rather than incorrect data.

## Migration Plan

1. Extend `ShopMethodRankItem` with hit-product profile fields.
2. Extend M01 ranking SQL to compute sales-tier distribution and price range.
3. Add service-level method dispatch and validation for method IDs.
4. Update controller descriptions to describe shop grading as method-card consumer ranking.
5. Update docs under `docs/店铺品级`.
6. Add focused tests or mapper-level validation where the existing test environment allows.

Rollback: keep the existing M01 ranking endpoint and ignore the additional fields; the old core fields remain compatible.

## Open Questions

- Should the API include `sampleAsins` now, or wait for a shop-detail endpoint?
- Should "shop stability" be computed from weekly hit history in this change or a later one?
- Should full-store product distribution be a separate endpoint from method-hit distribution?

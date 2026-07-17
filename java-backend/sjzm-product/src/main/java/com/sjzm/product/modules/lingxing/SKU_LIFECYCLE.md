# Single-store SKU lifecycle

Endpoint:

`POST /api/v1/modules/lingxing/sampling-model/sku-lifecycle`

With an empty body, the endpoint selects one UK store and SKU whose first
observed FBA-active week is `2026-05-01` through `2026-05-07`. Weekly facts are
queried by `marketplace + sid + sku`; stores are not merged.

Optional fields include `marketplace`, `firstActiveWeek`, `firstActiveEnd`,
`snapshotWeek`, `startDate`, `endDate`, `asOfDate`, `sku`, and `sid`.

The response reports purchase batches, observed sell-out weeks, replenishment
orders, stockout gaps, weekly sales/profit/inventory state, and data quality
flags. A source purchase `sid=0` is retained as an unknown store attribution;
it is never silently treated as an exact store match.

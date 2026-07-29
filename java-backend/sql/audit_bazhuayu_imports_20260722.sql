SELECT 'tasks' AS scope_name, COUNT(*) AS row_count
FROM asin_import_tasks
WHERE import_type='BAZHUAYU_AUTO'
  AND created_at >= '2026-07-22 00:00:00' AND created_at < '2026-07-23 00:00:00';

SELECT 'weekly_raw' AS scope_name, COUNT(*) AS row_count,
       COUNT(DISTINCT marketplace, asin) AS distinct_keys
FROM bazhuayu_weekly_raw
WHERE scraped_at >= '2026-07-22 00:00:00' AND scraped_at < '2026-07-23 00:00:00';

SELECT 'skip_asins_matched_to_raw' AS scope_name, COUNT(*) AS row_count
FROM skip_asins s
JOIN (
    SELECT DISTINCT marketplace, asin
    FROM bazhuayu_weekly_raw
    WHERE scraped_at >= '2026-07-22 00:00:00' AND scraped_at < '2026-07-23 00:00:00'
) r ON CONVERT(r.marketplace USING utf8mb4) COLLATE utf8mb4_unicode_ci
       = CONVERT(s.marketplace USING utf8mb4) COLLATE utf8mb4_unicode_ci
   AND CONVERT(r.asin USING utf8mb4) COLLATE utf8mb4_unicode_ci
       = CONVERT(s.asin USING utf8mb4) COLLATE utf8mb4_unicode_ci;

SELECT 'premium_products' AS scope_name, COUNT(*) AS row_count
FROM premium_products
WHERE bazhuayu_mapping_id IS NOT NULL
  AND updated_at >= '2026-07-22 00:00:00' AND updated_at < '2026-07-23 00:00:00';

START TRANSACTION;

CREATE TEMPORARY TABLE tmp_bazhuayu_asins_20260722 (
    marketplace VARCHAR(10) NOT NULL,
    asin VARCHAR(20) NOT NULL,
    PRIMARY KEY (marketplace, asin)
) ENGINE=InnoDB;

INSERT IGNORE INTO tmp_bazhuayu_asins_20260722 (marketplace, asin)
SELECT marketplace, asin
FROM bazhuayu_weekly_raw
WHERE scraped_at >= '2026-07-22 00:00:00' AND scraped_at < '2026-07-23 00:00:00'
  AND marketplace IS NOT NULL AND asin IS NOT NULL AND asin<>'';

DELETE s
FROM skip_asins s
JOIN tmp_bazhuayu_asins_20260722 t
  ON CONVERT(t.marketplace USING utf8mb4) COLLATE utf8mb4_unicode_ci
       = CONVERT(s.marketplace USING utf8mb4) COLLATE utf8mb4_unicode_ci
 AND CONVERT(t.asin USING utf8mb4) COLLATE utf8mb4_unicode_ci
       = CONVERT(s.asin USING utf8mb4) COLLATE utf8mb4_unicode_ci;
SELECT ROW_COUNT() AS deleted_skip_asins;

DELETE FROM bazhuayu_weekly_raw
WHERE scraped_at >= '2026-07-22 00:00:00' AND scraped_at < '2026-07-23 00:00:00';
SELECT ROW_COUNT() AS deleted_weekly_raw;

DELETE FROM premium_products
WHERE bazhuayu_mapping_id IS NOT NULL
  AND updated_at >= '2026-07-22 00:00:00' AND updated_at < '2026-07-23 00:00:00';
SELECT ROW_COUNT() AS deleted_premium_products;

DELETE r
FROM asin_import_results r
JOIN asin_import_tasks t ON t.id=r.task_id
WHERE t.import_type='BAZHUAYU_AUTO'
  AND t.created_at >= '2026-07-22 00:00:00' AND t.created_at < '2026-07-23 00:00:00';
SELECT ROW_COUNT() AS deleted_import_results;

DELETE FROM asin_import_tasks
WHERE import_type='BAZHUAYU_AUTO'
  AND created_at >= '2026-07-22 00:00:00' AND created_at < '2026-07-23 00:00:00';
SELECT ROW_COUNT() AS deleted_import_tasks;

COMMIT;

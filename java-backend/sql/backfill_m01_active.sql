-- Backfill M01 active flags for existing competitor data.
-- Run after add_m01_active_flag.sql in the target application database.
-- Mirrors M01Rule thresholds for UK/DE/US.
--
-- M01 route convention:
--   New-release source rows missing available_date are treated as listing_days=89.
--   Missing date does not mean old product; price/weight/sales/BSR still gate M01.

SET NAMES utf8mb4;
SET @unknown_listing_days := 89;
SET @listing_days_max := 90;

UPDATE competitor_products
SET listing_days = @unknown_listing_days
WHERE marketplace IN ('UK', 'DE', 'US')
  AND (
      HEX(source) = 'E696B0E59381E6A69C'
      OR LOWER(source) LIKE '%new%'
  )
  AND (available_date IS NULL OR available_date <= 0)
  AND (listing_days IS NULL OR listing_days >= @listing_days_max);

UPDATE competitor_products cp
SET cp.m01_active =
    CASE
        WHEN (
             HEX(cp.source) = 'E696B0E59381E6A69C'
             OR LOWER(cp.source) LIKE '%new%'
         )
         AND cp.price IS NOT NULL
         AND cp.weight_g IS NOT NULL
         AND cp.weight_g < 300
         AND (
            CASE
                WHEN cp.available_date IS NOT NULL AND cp.available_date > 0
                THEN DATEDIFF(NOW(), FROM_UNIXTIME(cp.available_date / 1000))
                ELSE COALESCE(cp.listing_days, @unknown_listing_days)
            END
         ) < @listing_days_max
         AND (
            (
                cp.marketplace = 'UK'
                AND cp.price BETWEEN 4.99 AND 17.99
                AND (
                    ((
                        CASE
                            WHEN cp.available_date IS NOT NULL AND cp.available_date > 0
                            THEN DATEDIFF(NOW(), FROM_UNIXTIME(cp.available_date / 1000))
                            ELSE COALESCE(cp.listing_days, @unknown_listing_days)
                        END
                    ) <= 30 AND cp.units >= 2)
                    OR ((
                        CASE
                            WHEN cp.available_date IS NOT NULL AND cp.available_date > 0
                            THEN DATEDIFF(NOW(), FROM_UNIXTIME(cp.available_date / 1000))
                            ELSE COALESCE(cp.listing_days, @unknown_listing_days)
                        END
                    ) <= 60 AND cp.units >= 10)
                    OR ((
                        CASE
                            WHEN cp.available_date IS NOT NULL AND cp.available_date > 0
                            THEN DATEDIFF(NOW(), FROM_UNIXTIME(cp.available_date / 1000))
                            ELSE COALESCE(cp.listing_days, @unknown_listing_days)
                        END
                    ) <= 90 AND cp.units >= 30)
                    OR (cp.bsr IS NOT NULL AND cp.bsr > 0 AND cp.bsr < 20000)
                )
            )
            OR (
                cp.marketplace = 'DE'
                AND cp.price BETWEEN 5.99 AND 18.99
                AND (
                    ((
                        CASE
                            WHEN cp.available_date IS NOT NULL AND cp.available_date > 0
                            THEN DATEDIFF(NOW(), FROM_UNIXTIME(cp.available_date / 1000))
                            ELSE COALESCE(cp.listing_days, @unknown_listing_days)
                        END
                    ) <= 30 AND cp.units >= 4)
                    OR ((
                        CASE
                            WHEN cp.available_date IS NOT NULL AND cp.available_date > 0
                            THEN DATEDIFF(NOW(), FROM_UNIXTIME(cp.available_date / 1000))
                            ELSE COALESCE(cp.listing_days, @unknown_listing_days)
                        END
                    ) <= 60 AND cp.units >= 20)
                    OR ((
                        CASE
                            WHEN cp.available_date IS NOT NULL AND cp.available_date > 0
                            THEN DATEDIFF(NOW(), FROM_UNIXTIME(cp.available_date / 1000))
                            ELSE COALESCE(cp.listing_days, @unknown_listing_days)
                        END
                    ) <= 90 AND cp.units >= 50)
                    OR (cp.bsr IS NOT NULL AND cp.bsr > 0 AND cp.bsr < 25000)
                )
            )
            OR (
                cp.marketplace = 'US'
                AND cp.price BETWEEN 6.99 AND 25.99
                AND (
                    ((
                        CASE
                            WHEN cp.available_date IS NOT NULL AND cp.available_date > 0
                            THEN DATEDIFF(NOW(), FROM_UNIXTIME(cp.available_date / 1000))
                            ELSE COALESCE(cp.listing_days, @unknown_listing_days)
                        END
                    ) <= 30 AND cp.units >= 50)
                    OR ((
                        CASE
                            WHEN cp.available_date IS NOT NULL AND cp.available_date > 0
                            THEN DATEDIFF(NOW(), FROM_UNIXTIME(cp.available_date / 1000))
                            ELSE COALESCE(cp.listing_days, @unknown_listing_days)
                        END
                    ) <= 60 AND cp.units >= 120)
                    OR ((
                        CASE
                            WHEN cp.available_date IS NOT NULL AND cp.available_date > 0
                            THEN DATEDIFF(NOW(), FROM_UNIXTIME(cp.available_date / 1000))
                            ELSE COALESCE(cp.listing_days, @unknown_listing_days)
                        END
                    ) <= 90 AND cp.units >= 200)
                )
            )
         )
        THEN 1
        ELSE 0
    END
WHERE cp.marketplace IN ('UK', 'DE', 'US');

UPDATE competitor_products_clean
SET listing_days = @unknown_listing_days
WHERE marketplace IN ('UK', 'DE', 'US')
  AND (
      HEX(source) = 'E696B0E59381E6A69C'
      OR LOWER(source) LIKE '%new%'
  )
  AND (available_date IS NULL OR available_date <= 0)
  AND (listing_days IS NULL OR listing_days >= @listing_days_max);

UPDATE competitor_products_clean c
JOIN (
    SELECT
        marketplace,
        COALESCE(NULLIF(parent_asin, ''), asin) AS dedup_key,
        MAX(m01_active) AS m01_active
    FROM competitor_products
    WHERE marketplace IN ('UK', 'DE', 'US')
    GROUP BY marketplace, COALESCE(NULLIF(parent_asin, ''), asin)
) raw
  ON raw.marketplace = c.marketplace
 AND raw.dedup_key = c.dedup_key
SET c.m01_active = raw.m01_active
WHERE c.marketplace IN ('UK', 'DE', 'US');

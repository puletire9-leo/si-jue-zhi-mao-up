-- =================================================================
-- 全量首次清洗 · 按 (marketplace, effective_week_tag) 逐批存储过程
-- 2026-06-29
-- =================================================================
-- 背景：
--   competitor_products_clean 建表后需把历史 34.8 万行灌入。
--   一次性全量 INSERT ... SELECT（窗口函数）在 Docker MySQL 上 OOM/卡死。
--   本过程按周批次逐批清洗，每批独立事务，最大批 ~9 万行，秒级完成。
--
-- 复用 refresh_competitor_products_clean_batch.sql 的清洗口径：
--   - PARTITION BY COALESCE(NULLIF(parent_asin,''), asin) 去变体，取代表行
--   - ORDER BY listing_days DESC, units DESC, asin ASC 选 variant_rank=1
--   - ON DUPLICATE KEY UPDATE 幂等（uk_batch_dedup）
--
-- 幂等 & 可重入：
--   中途失败可重复执行，已清洗批次靠唯一键 UPDATE，不会重复插入。
--
-- 执行：
--   docker exec prod-mysql sh -c "mysql -usijue -pXXX sijuelishi < /tmp/full_clean_by_batch_proc.sql"
-- =================================================================

DROP PROCEDURE IF EXISTS sp_full_clean_by_batch;

DELIMITER $$

CREATE PROCEDURE sp_full_clean_by_batch()
BEGIN
  DECLARE done INT DEFAULT 0;
  -- collation 必须与 competitor_products 列对齐（库默认是 utf8mb4_unicode_ci，
  -- 但表列是 utf8mb4_0900_ai_ci）；不显式指定会在 WHERE = 比较时报 Illegal mix of collations
  DECLARE v_mp VARCHAR(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
  DECLARE v_batch VARCHAR(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
  DECLARE v_rows INT;

  -- 游标：所有 (marketplace, effective_week_tag) 批次，小批优先（先快速见效）
  DECLARE cur CURSOR FOR
    SELECT marketplace,
           COALESCE(week_tag, CONCAT(month, '-W00')) AS eff_week
    FROM competitor_products
    GROUP BY marketplace, eff_week
    ORDER BY COUNT(*) ASC;

  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

  OPEN cur;
  batch_loop: LOOP
    FETCH cur INTO v_mp, v_batch;
    IF done = 1 THEN
      LEAVE batch_loop;
    END IF;

    -- 单批清洗（独立语句，autocommit 下自动提交，不累积大事务）
    INSERT INTO competitor_products_clean
    SELECT
      ranked.id, ranked.marketplace, ranked.asin, ranked.month,
      ranked.title, ranked.brand, ranked.brand_url, ranked.image_url,
      ranked.parent_asin, ranked.sku,
      ranked.node_id, ranked.node_id_path, ranked.node_label_path, ranked.symbol,
      ranked.units, ranked.units_gr, ranked.amz_unit, ranked.amz_sales, ranked.amz_unit_date, ranked.revenue,
      ranked.bsr_id, ranked.bsr, ranked.bsr_cr, ranked.bsr_cv,
      ranked.ratings, ranked.rating, ranked.ratings_rate, ranked.ratings_cv, ranked.rating_delta,
      ranked.price, ranked.prime_price, ranked.profit, ranked.fba, ranked.delivery_price,
      ranked.seller_name, ranked.seller_id, ranked.seller_nation, ranked.sellers,
      ranked.fulfillment, ranked.variations, ranked.weight, ranked.dimension, ranked.dimensions_type,
      ranked.pkg_dimensions, ranked.pkg_dimension_type, ranked.pkg_weight,
      ranked.lqs, ranked.available_date, ranked.best_seller, ranked.amazon_choice, ranked.new_release, ranked.ebc, ranked.video,
      ranked.filter_mode, ranked.filter_reasons, ranked.listing_days, ranked.weight_g,
      ranked.product_url, ranked.similar_url, ranked.source,
      ranked.created_at, ranked.updated_at,
      ranked.score, ranked.grade, ranked.week_tag, ranked.is_current,
      COALESCE(NULLIF(ranked.parent_asin, ''), ranked.asin) AS dedup_key,
      v_batch AS effective_week_tag,
      NOW() AS cleaned_at
    FROM (
      SELECT cp.*,
        ROW_NUMBER() OVER (
          PARTITION BY COALESCE(NULLIF(cp.parent_asin, ''), cp.asin)
          ORDER BY cp.listing_days DESC, cp.units DESC, cp.asin ASC
        ) AS variant_rank
      FROM competitor_products cp
      WHERE cp.marketplace = v_mp
        AND COALESCE(cp.week_tag, CONCAT(cp.month, '-W00')) = v_batch
    ) ranked
    WHERE ranked.variant_rank = 1
    ON DUPLICATE KEY UPDATE
      units = VALUES(units),
      bsr = VALUES(bsr),
      price = VALUES(price),
      listing_days = VALUES(listing_days),
      bsr_id = VALUES(bsr_id),
      node_label_path = VALUES(node_label_path),
      rating = VALUES(rating),
      ratings = VALUES(ratings),
      parent_asin = VALUES(parent_asin),
      cleaned_at = NOW();

    SET v_rows = ROW_COUNT();
    -- 进度落到 server 日志（可选）
    SELECT CONCAT('cleaned batch ', v_mp, '/', v_batch, ' -> affected ', v_rows) AS progress;

  END LOOP batch_loop;
  CLOSE cur;
END$$

DELIMITER ;

CALL sp_full_clean_by_batch();

DROP PROCEDURE IF EXISTS sp_full_clean_by_batch;

-- 验证：
--   SELECT marketplace, effective_week_tag, COUNT(*) FROM competitor_products_clean
--     GROUP BY marketplace, effective_week_tag ORDER BY 3 DESC;
--   SELECT COUNT(*) FROM competitor_products_clean;   -- 应远小于 348845（去变体后）

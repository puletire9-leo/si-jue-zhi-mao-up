-- =================================================================
-- 增量周清洗：按 (marketplace, effective_week_tag) 单批清洗
-- 2026-06-25 · 替代一次性全量 INSERT（21 万行 OOM 风险）
-- =================================================================
-- 用法：
--   1) 每次新批次导入完成后，按导入的 (marketplace, week_tag) 调用本 SQL
--   2) 模板里 __MP__ 和 __BATCH_KEY__ 是占位符
--   3) Java 代码生成时按变量替换执行
--
-- 性能：每批 < 5 秒（实测 geji 11 批，最大 78k 行 4 秒完成）
-- 幂等：ON DUPLICATE KEY UPDATE 保证重复导入不冲突
--
-- 全量首次清洗用法：
--   按 GROUP BY (marketplace, effective_week_tag) 拿到批次列表，逐批跑本模板
--   geji 实测 11 批合计 17 秒
-- =================================================================

-- 注意：本文件是 SQL 模板，不能直接 source。需在外层应用按 (marketplace, week_tag) 循环替换占位符执行。
-- 占位符：
--   __MP__         → 'UK' / 'DE' / 'US'
--   __BATCH_KEY__  → 实际 effective_week_tag，如 '2026-W22' 或 '202606-W00'（老数据占位）

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
  '__BATCH_KEY__' AS effective_week_tag,
  NOW() AS cleaned_at
FROM (
  SELECT cp.*,
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(NULLIF(cp.parent_asin, ''), cp.asin)
      ORDER BY cp.listing_days DESC, cp.units DESC, cp.asin ASC
    ) AS variant_rank
  FROM competitor_products cp
  WHERE cp.marketplace = '__MP__'
    AND COALESCE(cp.week_tag, CONCAT(cp.month, '-W00')) = '__BATCH_KEY__'
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

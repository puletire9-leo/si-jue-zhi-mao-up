-- =================================================================
-- 数据清洗层：competitor_products_clean 实体表（v2 物化方案）
-- 2026-06-25 · 替代 v1 VIEW 方案
-- =================================================================
-- 业务规则（用户拍板 2026-06-25）：
--   - 原表 competitor_products 保留所有变体行（前端商品详情、父-子展开要用）
--   - 清洗表 competitor_products_clean 只存父群组代表行（系统筛选/排序/分位用）
--   - 按周为单位增量清洗（每周 2 次导入触发）
--   - 跨周快照独立保留（W23/W24/W25 各自一行，可追溯销量演化）
--   - 重复导入幂等（同周同父群组只保留一行，最新覆盖）
-- =================================================================

-- 第 1 步：删除旧 VIEW 和旧表（如果存在）
DROP VIEW IF EXISTS competitor_products_clean;
DROP TABLE IF EXISTS competitor_products_clean;

-- 第 2 步：用 LIKE 完全复制原表结构（包含所有列、字符集、collation）
CREATE TABLE competitor_products_clean LIKE competitor_products;

-- 第 3 步：删除原表的约束（不需要），加清洗专用列和唯一键
-- 注：CREATE TABLE LIKE 会复制 PRIMARY KEY + 所有 KEY，但我们要换索引策略
-- 先单独删除 uk_asin_month（MySQL 8 不支持 DROP INDEX IF EXISTS，单独执行）
ALTER TABLE competitor_products_clean DROP INDEX uk_asin_month;

ALTER TABLE competitor_products_clean
  ADD COLUMN dedup_key VARCHAR(20) NOT NULL COMMENT 'COALESCE(parent_asin, asin)' AFTER is_current,
  ADD COLUMN effective_week_tag VARCHAR(10) NOT NULL COMMENT '清洗用 week_tag；老数据用 month-W00 占位' AFTER dedup_key,
  ADD COLUMN cleaned_at DATETIME DEFAULT CURRENT_TIMESTAMP AFTER effective_week_tag,
  ADD UNIQUE KEY uk_batch_dedup (marketplace, effective_week_tag, dedup_key),
  ADD KEY idx_marketplace_month_clean (marketplace, month),
  ADD KEY idx_bsr_id_month_clean (marketplace, bsr_id, month),
  ADD KEY idx_parent_asin_clean (parent_asin),
  ADD KEY idx_effective_week (effective_week_tag);

-- 第 4 步：全量清洗（一次性，把历史数据全清洗进来）
-- 老数据没 week_tag → 用 month + '-W00' 占位（X 方案）
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
  COALESCE(ranked.week_tag, CONCAT(ranked.month, '-W00')) AS effective_week_tag,
  NOW() AS cleaned_at
FROM (
  SELECT cp.*,
    ROW_NUMBER() OVER (
      PARTITION BY cp.marketplace,
                   COALESCE(cp.week_tag, CONCAT(cp.month, '-W00')),
                   COALESCE(NULLIF(cp.parent_asin, ''), cp.asin)
      ORDER BY cp.listing_days DESC, cp.units DESC, cp.asin ASC
    ) AS variant_rank
  FROM competitor_products cp
) ranked
WHERE ranked.variant_rank = 1;

-- 验证：
--   SELECT COUNT(*) FROM competitor_products;
--   SELECT COUNT(*) FROM competitor_products_clean;
--   SELECT marketplace, COUNT(*) FROM competitor_products_clean GROUP BY marketplace;

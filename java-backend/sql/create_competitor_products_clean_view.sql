-- =================================================================
-- 数据清洗层视图：competitor_products_clean
-- 2026-06-25 · 解决卖家精灵变体污染（父 ASIN 销量/BSR 复制到所有子变体）
-- 适用：dev (sijuelishi_dev) + geji (geji_analysis)
-- =================================================================
-- 背景：
--   competitor_products 里同一个父 ASIN 有 N 个子变体（颜色/尺码），卖家精灵
--   把父系列的 units / bsr / price 复制到所有子行。直接对原表做 PERCENT_RANK
--   会让单个父系列以 N 倍权重影响分位，造成统计严重污染。
--   实测：DE 64% / UK 51% / US 77% 行是变体子。最大父群组 1677 个子变体。
--
-- 清洗规则（A 方案：父 ASIN 去重）：
--   - 按 (marketplace, month, COALESCE(parent_asin, asin)) 分组
--   - 每父群组 ORDER BY listing_days DESC, units DESC 选 ROW_NUMBER = 1 代表
--   - 代表选择优先级：
--     1) listing_days DESC：父系列最新变体（说明父还在加 SKU 是健康的）
--     2) units DESC：同账龄变体里销量最高的最有代表性
--
-- 维护契约：
--   - 所有用 competitor_products 做基线/分位/聚合统计的 SQL，
--     FROM 必须是 competitor_products_clean，不是原表
--   - 看单 ASIN 详情时仍用原表（保留所有变体行用于父-子展开）
-- =================================================================

CREATE OR REPLACE VIEW competitor_products_clean AS
WITH ranked_variants AS (
  SELECT cp.*,
    COALESCE(NULLIF(cp.parent_asin, ''), cp.asin) AS dedup_key,
    ROW_NUMBER() OVER (
      PARTITION BY
        cp.marketplace,
        cp.month,
        COALESCE(NULLIF(cp.parent_asin, ''), cp.asin)
      ORDER BY
        cp.listing_days DESC,  -- 父系列里最新变体优先
        cp.units DESC,         -- 销量最高优先（tiebreaker）
        cp.asin ASC            -- 同 listing_days 同 units 时按 asin 稳定排序
    ) AS variant_rank
  FROM competitor_products cp
)
SELECT
  -- 不带 dedup_key/variant_rank（这两个是清洗内部用，不暴露给下游）
  rv.id,
  rv.marketplace, rv.asin, rv.month,
  rv.title, rv.brand, rv.brand_url, rv.image_url,
  rv.parent_asin, rv.sku,
  rv.node_id, rv.node_id_path, rv.node_label_path,
  rv.symbol,
  rv.units, rv.units_gr, rv.amz_unit, rv.amz_sales, rv.amz_unit_date, rv.revenue,
  rv.bsr_id, rv.bsr, rv.bsr_cr, rv.bsr_cv,
  rv.ratings, rv.rating, rv.ratings_rate, rv.ratings_cv, rv.rating_delta,
  rv.price, rv.prime_price, rv.profit, rv.fba, rv.delivery_price,
  rv.seller_name, rv.seller_id, rv.seller_nation, rv.sellers,
  rv.fulfillment, rv.variations,
  rv.weight, rv.dimension, rv.dimensions_type, rv.pkg_dimensions, rv.pkg_dimension_type, rv.pkg_weight,
  rv.lqs, rv.available_date,
  rv.best_seller, rv.amazon_choice, rv.new_release, rv.ebc, rv.video,
  rv.filter_mode, rv.filter_reasons,
  rv.listing_days, rv.weight_g,
  rv.product_url, rv.similar_url, rv.source,
  rv.score, rv.grade, rv.week_tag, rv.is_current,
  rv.created_at, rv.updated_at
FROM ranked_variants rv
WHERE rv.variant_rank = 1;

-- 验证：
--   SELECT COUNT(*) FROM competitor_products;           -- 原表全量
--   SELECT COUNT(*) FROM competitor_products_clean;     -- 去重后
--   预期：去重后行数 ≈ 原表的 30-50%（取决于变体集中度）

-- =================================================================
-- M04 · 新品大类销量基础分级 · DDL
-- 2026-06-26
-- 见 docs/选品方法库/方法卡/M04_新品大类销量基础分级.md (v8)
-- =================================================================
-- 业务规则：
--   - 数据源：competitor_products_clean（已按父 ASIN 去重）
--   - 维度：marketplace × bsr_id × age_bucket × baseline_month
--   - 三档新品账龄：0_30 / 30_60 / 60_90（不包含 >90 老品）
--   - 硬门槛：listing_days < 90 AND weight_g < 300（M01 镜像）
--   - 分位双轨：units 销量 + bsr 排名（交叉验证防虚高）
-- =================================================================

CREATE TABLE IF NOT EXISTS category_age_tier_baseline (
  id BIGINT NOT NULL AUTO_INCREMENT,
  marketplace VARCHAR(10) NOT NULL,
  bsr_id VARCHAR(100) NOT NULL,
  age_bucket VARCHAR(8) NOT NULL COMMENT '0_30 / 30_60 / 60_90',
  baseline_month VARCHAR(6) NOT NULL,
  sample_size INT NOT NULL DEFAULT 0,
  units_p25 INT DEFAULT NULL,
  units_p50 INT DEFAULT NULL,
  units_p75 INT DEFAULT NULL,
  units_p90 INT DEFAULT NULL,
  bsr_p10 INT DEFAULT NULL COMMENT '前 10% BSR 阈值（最靠前最好）',
  bsr_p25 INT DEFAULT NULL,
  bsr_p50 INT DEFAULT NULL,
  bsr_p75 INT DEFAULT NULL,
  price_p50 DECIMAL(10,2) DEFAULT NULL,
  confidence VARCHAR(8) DEFAULT NULL COMMENT 'high (≥100 且分位不塌缩) / mid (≥50) / low',
  computed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_slice (marketplace, bsr_id, age_bucket, baseline_month),
  KEY idx_lookup (marketplace, bsr_id, baseline_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='M04 新品大类×账龄×销量分级基线';

-- competitor_products 增加 5 列 m04_* 打标输出（写在原表，因为前端商品详情、查重、单 ASIN 详情都看原表）
ALTER TABLE competitor_products
  ADD COLUMN m04_age_bucket VARCHAR(16) DEFAULT NULL COMMENT 'M04 新品账龄档 / out_of_scope',
  ADD COLUMN m04_tier VARCHAR(16) DEFAULT NULL COMMENT 'M04 等级 S/A/B/C/D / out_of_scope',
  ADD COLUMN m04_units_pct DECIMAL(4,3) DEFAULT NULL COMMENT 'units 在本档百分位 0-1',
  ADD COLUMN m04_bsr_pct DECIMAL(4,3) DEFAULT NULL COMMENT 'BSR 在本档百分位 0-1（数字越大越好）',
  ADD COLUMN m04_computed_at DATETIME DEFAULT NULL,
  ADD INDEX idx_m04_filter (marketplace, bsr_id, m04_age_bucket, m04_tier);

-- 清洗表也加 5 列（确保下游消费 clean 表时也能拿到 m04_* 标签）
ALTER TABLE competitor_products_clean
  ADD COLUMN m04_age_bucket VARCHAR(16) DEFAULT NULL,
  ADD COLUMN m04_tier VARCHAR(16) DEFAULT NULL,
  ADD COLUMN m04_units_pct DECIMAL(4,3) DEFAULT NULL,
  ADD COLUMN m04_bsr_pct DECIMAL(4,3) DEFAULT NULL,
  ADD COLUMN m04_computed_at DATETIME DEFAULT NULL,
  ADD INDEX idx_m04_filter_clean (marketplace, bsr_id, m04_age_bucket, m04_tier);

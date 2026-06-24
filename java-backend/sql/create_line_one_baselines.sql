CREATE TABLE IF NOT EXISTS category_bsr_baseline (
  id BIGINT NOT NULL AUTO_INCREMENT,
  marketplace VARCHAR(10) NOT NULL COMMENT 'Marketplace UK/DE/US',
  bsr_id VARCHAR(100) NOT NULL COMMENT 'Top-level category slug',
  bsr_bucket VARCHAR(16) NOT NULL COMMENT 'BSR bucket lt5k/5k20k/20k50k/50k150k/gt150k',
  baseline_month VARCHAR(6) NOT NULL COMMENT 'Baseline month yyyyMM',
  sample_size INT NOT NULL DEFAULT 0 COMMENT 'Sample size',
  units_p25 INT DEFAULT NULL COMMENT 'Units P25',
  units_p50 INT DEFAULT NULL COMMENT 'Units P50',
  units_p75 INT DEFAULT NULL COMMENT 'Units P75',
  price_avg DECIMAL(10,2) DEFAULT NULL COMMENT 'Average price',
  confidence VARCHAR(8) DEFAULT NULL COMMENT 'Confidence high/mid/low',
  computed_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Computed at',
  PRIMARY KEY (id),
  UNIQUE KEY uk_slice (marketplace, bsr_id, bsr_bucket, baseline_month),
  KEY idx_lookup (marketplace, bsr_id, baseline_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Line1 category BSR baseline';

CREATE TABLE IF NOT EXISTS subcategory_baseline (
  id BIGINT NOT NULL AUTO_INCREMENT,
  marketplace VARCHAR(10) NOT NULL COMMENT 'Marketplace UK/DE/US',
  bsr_id VARCHAR(100) DEFAULT NULL COMMENT 'Dominant category slug',
  sub_category VARCHAR(200) NOT NULL COMMENT 'Leaf subcategory label',
  baseline_month VARCHAR(6) NOT NULL COMMENT 'Baseline month yyyyMM',
  sample_size INT NOT NULL DEFAULT 0 COMMENT 'Sample size',
  units_p50 INT DEFAULT NULL COMMENT 'Units P50',
  units_p75 INT DEFAULT NULL COMMENT 'Units P75',
  units_p90 INT DEFAULT NULL COMMENT 'Units P90',
  price_p50 DECIMAL(10,2) DEFAULT NULL COMMENT 'Price P50',
  confidence VARCHAR(8) DEFAULT NULL COMMENT 'Confidence high/mid/low',
  computed_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Computed at',
  PRIMARY KEY (id),
  UNIQUE KEY uk_slice (marketplace, sub_category, baseline_month),
  KEY idx_lookup (marketplace, bsr_id, baseline_month),
  KEY idx_sub_lookup (marketplace, sub_category, baseline_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Line1 winner subcategory baseline';

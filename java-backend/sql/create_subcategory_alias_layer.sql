CREATE TABLE IF NOT EXISTS subcategory_alias_map (
  id BIGINT NOT NULL COMMENT 'Snowflake id',
  source_type VARCHAR(16) NOT NULL COMMENT 'WINNER or COMPETITOR',
  marketplace VARCHAR(10) NOT NULL COMMENT 'ALL/UK/DE/US',
  raw_subcategory VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Raw subcategory text',
  normalized_subcategory VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Normalized subcategory text',
  canonical_key VARCHAR(100) DEFAULT NULL COMMENT 'Canonical key',
  canonical_name VARCHAR(200) DEFAULT NULL COMMENT 'Canonical display name',
  carrier_hint VARCHAR(100) DEFAULT NULL COMMENT 'Carrier hint from ③ line',
  sample_count INT NOT NULL DEFAULT 0 COMMENT 'Observed sample count',
  latest_month VARCHAR(6) DEFAULT NULL COMMENT 'Latest baseline month',
  match_method VARCHAR(16) NOT NULL DEFAULT 'PENDING' COMMENT 'RAW/CATEGORY/CARRIER/MANUAL etc',
  status VARCHAR(16) NOT NULL DEFAULT 'PENDING' COMMENT 'APPROVED/PENDING/REJECTED',
  notes VARCHAR(500) DEFAULT NULL COMMENT 'Notes',
  deleted TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Logical delete flag',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Created at',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Updated at',
  PRIMARY KEY (id),
  UNIQUE KEY uk_alias (source_type, marketplace, raw_subcategory, deleted),
  KEY idx_status (source_type, status, marketplace, sample_count),
  KEY idx_canonical (canonical_key, marketplace)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Subcategory canonical alias map';

SET @add_canonical_key = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'subcategory_baseline'
        AND column_name = 'canonical_key'
    ),
    'SELECT 1',
    'ALTER TABLE subcategory_baseline ADD COLUMN canonical_key VARCHAR(100) DEFAULT NULL COMMENT ''Canonical subcategory key'' AFTER bsr_id'
  )
);
PREPARE stmt_add_canonical_key FROM @add_canonical_key;
EXECUTE stmt_add_canonical_key;
DEALLOCATE PREPARE stmt_add_canonical_key;

SET @drop_uk_slice = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'subcategory_baseline'
        AND index_name = 'uk_slice'
    ),
    'ALTER TABLE subcategory_baseline DROP INDEX uk_slice',
    'SELECT 1'
  )
);
PREPARE stmt_drop_uk_slice FROM @drop_uk_slice;
EXECUTE stmt_drop_uk_slice;
DEALLOCATE PREPARE stmt_drop_uk_slice;

SET @add_uk_slice = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'subcategory_baseline'
        AND index_name = 'uk_slice'
    ),
    'SELECT 1',
    'ALTER TABLE subcategory_baseline ADD UNIQUE KEY uk_slice (marketplace, canonical_key, baseline_month)'
  )
);
PREPARE stmt_add_uk_slice FROM @add_uk_slice;
EXECUTE stmt_add_uk_slice;
DEALLOCATE PREPARE stmt_add_uk_slice;

SET @add_idx_canonical_lookup = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'subcategory_baseline'
        AND index_name = 'idx_canonical_lookup'
    ),
    'SELECT 1',
    'ALTER TABLE subcategory_baseline ADD KEY idx_canonical_lookup (marketplace, canonical_key, baseline_month)'
  )
);
PREPARE stmt_add_idx_canonical_lookup FROM @add_idx_canonical_lookup;
EXECUTE stmt_add_idx_canonical_lookup;
DEALLOCATE PREPARE stmt_add_idx_canonical_lookup;

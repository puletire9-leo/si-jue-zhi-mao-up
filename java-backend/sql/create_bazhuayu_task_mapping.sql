CREATE TABLE IF NOT EXISTS bazhuayu_task_mapping (
    id BIGINT NOT NULL AUTO_INCREMENT,
    task_name VARCHAR(60) NOT NULL,
    task_category VARCHAR(32) NOT NULL DEFAULT 'DEFAULT',
    function_key VARCHAR(32) NOT NULL,
    marketplace VARCHAR(16) NOT NULL,
    task_id VARCHAR(64) NOT NULL,
    primary_task TINYINT(1) NOT NULL DEFAULT 0,
    initial_filter TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_bazhuayu_task_mapping (function_key, marketplace, task_id),
    KEY idx_bazhuayu_task_primary (function_key, marketplace, primary_task),
    KEY idx_bazhuayu_task_id (task_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bazhuayu named task mappings';

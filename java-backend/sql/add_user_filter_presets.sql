CREATE TABLE IF NOT EXISTS user_filter_presets (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    preset_name VARCHAR(50) NOT NULL,
    preset_index TINYINT NOT NULL,
    is_default TINYINT DEFAULT 0,
    filter_config TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_index (user_id, preset_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

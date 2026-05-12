-- 创建备份记录表
CREATE TABLE IF NOT EXISTS backup_records (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '备份记录ID',
    name VARCHAR(255) NOT NULL COMMENT '备份文件名',
    type VARCHAR(50) NOT NULL DEFAULT 'full' COMMENT '备份类型：full(全量备份)',
    size DECIMAL(10, 2) NOT NULL COMMENT '备份文件大小(MB)',
    status VARCHAR(50) NOT NULL DEFAULT 'success' COMMENT '备份状态：success(成功), failed(失败), running(运行中)',
    storage_location VARCHAR(50) NOT NULL DEFAULT 'local' COMMENT '存储位置：local(本地), cos(腾讯云COS)',
    cos_object_key VARCHAR(255) DEFAULT NULL COMMENT '腾讯云COS对象键',
    cos_url TEXT DEFAULT NULL COMMENT '腾讯云COS访问URL',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '备份创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录更新时间',
    INDEX idx_created_at (created_at),
    INDEX idx_storage_location (storage_location)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据库备份记录表';

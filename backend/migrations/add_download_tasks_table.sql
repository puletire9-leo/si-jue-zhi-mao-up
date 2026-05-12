-- 下载任务表
CREATE TABLE IF NOT EXISTS download_tasks (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL COMMENT '任务名称',
    source VARCHAR(50) NOT NULL COMMENT '来源: final-draft, product, selection, material, carrier, system',
    status ENUM('pending', 'processing', 'completed', 'failed', 'cancelled') DEFAULT 'pending' COMMENT '任务状态',
    progress INT DEFAULT 0 COMMENT '进度百分比 0-100',
    total_files INT DEFAULT 0 COMMENT '总文件数',
    completed_files INT DEFAULT 0 COMMENT '已完成文件数',
    failed_files INT DEFAULT 0 COMMENT '失败文件数',
    total_size BIGINT DEFAULT 0 COMMENT '总大小(字节)',
    local_path VARCHAR(500) COMMENT '本地缓存文件路径',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    completed_at TIMESTAMP NULL COMMENT '完成时间',
    error_message TEXT COMMENT '错误信息',
    created_by INT COMMENT '创建用户ID',
    INDEX idx_status (status),
    INDEX idx_created_by (created_by),
    INDEX idx_created_at (created_at),
    INDEX idx_source (source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='下载任务表';

-- 下载任务文件明细表
CREATE TABLE IF NOT EXISTS download_task_files (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id VARCHAR(36) NOT NULL COMMENT '任务ID',
    file_name VARCHAR(255) NOT NULL COMMENT '文件名',
    file_size BIGINT DEFAULT 0 COMMENT '文件大小(字节)',
    status ENUM('pending', 'success', 'failed') DEFAULT 'pending' COMMENT '文件状态',
    error_message TEXT COMMENT '错误信息',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    FOREIGN KEY (task_id) REFERENCES download_tasks(id) ON DELETE CASCADE,
    INDEX idx_task_id (task_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='下载任务文件明细表';

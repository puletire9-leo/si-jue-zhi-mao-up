-- 创建定稿表
CREATE TABLE IF NOT EXISTS final_drafts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sku VARCHAR(255) NOT NULL UNIQUE COMMENT 'SKU编号',
    batch VARCHAR(255) DEFAULT NULL COMMENT '批次',
    developer VARCHAR(255) DEFAULT NULL COMMENT '开发人',
    carrier VARCHAR(255) DEFAULT NULL COMMENT '载体',
    images TEXT DEFAULT '[]' COMMENT '图片URL列表，JSON格式',
    reference_images TEXT DEFAULT '[]' COMMENT '参考图URL列表，JSON格式',
    status VARCHAR(50) DEFAULT 'pending' COMMENT '状态：pending(待处理), approved(已通过), rejected(已拒绝)',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_sku (sku),
    INDEX idx_batch (batch),
    INDEX idx_developer (developer),
    INDEX idx_carrier (carrier),
    INDEX idx_status (status),
    INDEX idx_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='定稿信息表';

-- 创建定稿回收站表
CREATE TABLE IF NOT EXISTS final_draft_recycle_bin (
    id INT AUTO_INCREMENT PRIMARY KEY,
    draft_id INT NOT NULL COMMENT '原定稿ID',
    sku VARCHAR(255) NOT NULL COMMENT 'SKU编号',
    batch VARCHAR(255) DEFAULT NULL COMMENT '批次',
    developer VARCHAR(255) DEFAULT NULL COMMENT '开发人',
    carrier VARCHAR(255) DEFAULT NULL COMMENT '载体',
    images TEXT DEFAULT '[]' COMMENT '图片URL列表，JSON格式',
    reference_images TEXT DEFAULT '[]' COMMENT '参考图URL列表，JSON格式',
    status VARCHAR(50) DEFAULT NULL COMMENT '删除前状态',
    deleted_by INT NOT NULL COMMENT '删除人ID',
    deleted_by_name VARCHAR(255) NOT NULL COMMENT '删除人姓名',
    delete_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '删除时间',
    INDEX idx_draft_id (draft_id),
    INDEX idx_sku (sku),
    INDEX idx_delete_time (delete_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='定稿回收站表';

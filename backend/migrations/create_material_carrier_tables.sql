-- 创建素材库表
CREATE TABLE IF NOT EXISTS material_library (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sku VARCHAR(255) NOT NULL UNIQUE COMMENT 'SKU编号',
    batch VARCHAR(255) DEFAULT NULL COMMENT '批次',
    developer VARCHAR(255) DEFAULT NULL COMMENT '开发人',
    carrier VARCHAR(255) DEFAULT NULL COMMENT '载体',
    element VARCHAR(255) DEFAULT NULL COMMENT '元素',
    modification_requirement TEXT DEFAULT NULL COMMENT '修改要求',
    images TEXT COMMENT '图片URL列表，JSON格式',
    reference_images TEXT COMMENT '参考图URL列表，JSON格式',
    final_draft_images TEXT COMMENT '设计稿图片URL列表，JSON格式',
    local_thumbnail_path VARCHAR(500) DEFAULT NULL COMMENT '本地缩略图路径',
    local_thumbnail_status VARCHAR(50) DEFAULT 'pending' COMMENT '本地缩略图状态：pending(待处理), completed(已完成), failed(失败)',
    local_thumbnail_updated_at TIMESTAMP DEFAULT NULL COMMENT '本地缩略图更新时间',
    status VARCHAR(50) DEFAULT 'pending' COMMENT '状态：pending(待处理), approved(已通过), rejected(已拒绝)',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_sku (sku),
    INDEX idx_batch (batch),
    INDEX idx_developer (developer),
    INDEX idx_carrier (carrier),
    INDEX idx_status (status),
    INDEX idx_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='素材库信息表';

-- 创建载体库表
CREATE TABLE IF NOT EXISTS carrier_library (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sku VARCHAR(255) NOT NULL UNIQUE COMMENT 'SKU编号',
    images TEXT COMMENT '图片URL列表，JSON格式',
    product_size VARCHAR(100) DEFAULT NULL COMMENT '产品尺寸',
    carrier_name VARCHAR(100) DEFAULT NULL COMMENT '载体名称',
    material VARCHAR(100) DEFAULT NULL COMMENT '材质',
    process VARCHAR(100) DEFAULT NULL COMMENT '工艺',
    weight INT DEFAULT NULL COMMENT '克重',
    packaging_method VARCHAR(100) DEFAULT NULL COMMENT '打包方式',
    packaging_size VARCHAR(100) DEFAULT NULL COMMENT '包装尺寸',
    price DECIMAL(10,2) DEFAULT NULL COMMENT '价格',
    min_order_quantity INT DEFAULT NULL COMMENT '起订量',
    supplier VARCHAR(255) DEFAULT NULL COMMENT '供应商',
    supplier_link VARCHAR(500) DEFAULT NULL COMMENT '供应商下单链接',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_sku (sku),
    INDEX idx_carrier_name (carrier_name),
    INDEX idx_supplier (supplier),
    INDEX idx_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='载体库信息表';

-- 创建素材库回收站表
CREATE TABLE IF NOT EXISTS material_library_recycle_bin (
    id INT AUTO_INCREMENT PRIMARY KEY,
    material_id INT NOT NULL COMMENT '原素材库ID',
    sku VARCHAR(255) NOT NULL COMMENT 'SKU编号',
    batch VARCHAR(255) DEFAULT NULL COMMENT '批次',
    developer VARCHAR(255) DEFAULT NULL COMMENT '开发人',
    carrier VARCHAR(255) DEFAULT NULL COMMENT '载体',
    element VARCHAR(255) DEFAULT NULL COMMENT '元素',
    modification_requirement TEXT DEFAULT NULL COMMENT '修改要求',
    images TEXT COMMENT '图片URL列表，JSON格式',
    reference_images TEXT COMMENT '参考图URL列表，JSON格式',
    final_draft_images TEXT COMMENT '设计稿图片URL列表，JSON格式',
    local_thumbnail_path VARCHAR(500) DEFAULT NULL COMMENT '本地缩略图路径',
    status VARCHAR(50) DEFAULT NULL COMMENT '删除前状态',
    deleted_by INT NOT NULL COMMENT '删除人ID',
    deleted_by_name VARCHAR(255) NOT NULL COMMENT '删除人姓名',
    delete_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '删除时间',
    INDEX idx_material_id (material_id),
    INDEX idx_sku (sku),
    INDEX idx_delete_time (delete_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='素材库回收站表';

-- 创建载体库回收站表
CREATE TABLE IF NOT EXISTS carrier_library_recycle_bin (
    id INT AUTO_INCREMENT PRIMARY KEY,
    draft_id INT NOT NULL COMMENT '原载体库ID',
    sku VARCHAR(255) NOT NULL COMMENT 'SKU编号',
    images TEXT COMMENT '图片URL列表，JSON格式',
    product_size VARCHAR(100) DEFAULT NULL COMMENT '产品尺寸',
    carrier_name VARCHAR(100) DEFAULT NULL COMMENT '载体名称',
    material VARCHAR(100) DEFAULT NULL COMMENT '材质',
    process VARCHAR(100) DEFAULT NULL COMMENT '工艺',
    weight INT DEFAULT NULL COMMENT '克重',
    packaging_method VARCHAR(100) DEFAULT NULL COMMENT '打包方式',
    packaging_size VARCHAR(100) DEFAULT NULL COMMENT '包装尺寸',
    price DECIMAL(10,2) DEFAULT NULL COMMENT '价格',
    min_order_quantity INT DEFAULT NULL COMMENT '起订量',
    supplier VARCHAR(255) DEFAULT NULL COMMENT '供应商',
    supplier_link VARCHAR(500) DEFAULT NULL COMMENT '供应商下单链接',
    deleted_by INT NOT NULL COMMENT '删除人ID',
    deleted_by_name VARCHAR(255) NOT NULL COMMENT '删除人姓名',
    delete_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '删除时间',
    INDEX idx_draft_id (draft_id),
    INDEX idx_sku (sku),
    INDEX idx_carrier_name (carrier_name),
    INDEX idx_delete_time (delete_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='载体库回收站表';

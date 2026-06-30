-- 人员名单表（按职能收口，替代散落各处的硬编码名单）
-- 职能 role_type: developer(开发人) / operator(运营) / product_manager(产品负责人) / purchaser(采购员)
-- 见 java-backend/sjzm-product/.../modules/roster

CREATE TABLE IF NOT EXISTS person_roster (
    id          BIGINT       NOT NULL PRIMARY KEY COMMENT '主键(雪花ID)',
    name        VARCHAR(50)  NOT NULL COMMENT '姓名',
    role_type   VARCHAR(30)  NOT NULL COMMENT '职能: developer/operator/product_manager/purchaser',
    sort_order  INT          DEFAULT 0 COMMENT '排序权重，越小越前',
    enabled     TINYINT(1)   DEFAULT 1 COMMENT '是否启用 1启用 0停用',
    remark      VARCHAR(255) DEFAULT NULL COMMENT '备注',
    created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE KEY uk_name_role (name, role_type),
    KEY idx_role_type (role_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='人员名单（按职能）';

-- ── 迁移数据：以现有最全名单为准，去重 ──
-- 开发人：取 prod 02_baseline_data.sql 的 developer_list（9 人，最全）
INSERT INTO person_roster (id, name, role_type, sort_order) VALUES
    (1001, '刘淼',   'developer', 1),
    (1002, '宋凤莉', 'developer', 2),
    (1003, '周沁仪', 'developer', 3),
    (1004, '蒋舒',   'developer', 4),
    (1005, '龙梦临', 'developer', 5),
    (1006, '陈杨',   'developer', 6),
    (1007, '张子轩', 'developer', 7),
    (1008, '黄雨珊', 'developer', 8),
    (1009, '夏浩宇', 'developer', 9)
ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order);

-- 产品负责人：取 导入零星.py FIXED_VALUES（10 人，最全）
INSERT INTO person_roster (id, name, role_type, sort_order) VALUES
    (2001, '唐若',   'product_manager', 1),
    (2002, '张亚芳', 'product_manager', 2),
    (2003, '阳姣',   'product_manager', 3),
    (2004, '尹心如', 'product_manager', 4),
    (2005, '蒋舒',   'product_manager', 5),
    (2006, '张奋奋', 'product_manager', 6),
    (2007, '李杉',   'product_manager', 7),
    (2008, '余江燕', 'product_manager', 8),
    (2009, '张洁',   'product_manager', 9),
    (2010, '李微微', 'product_manager', 10)
ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order);

-- 采购员：导入零星.py 硬编码
INSERT INTO person_roster (id, name, role_type, sort_order) VALUES
    (3001, '王亚成', 'purchaser', 1)
ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order);

-- 运营：暂空，由前端补录

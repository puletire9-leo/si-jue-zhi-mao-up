-- 产品点击行为记录表
-- 用于 AI 分析用户浏览/选择行为的偏好数据源

CREATE TABLE IF NOT EXISTS product_click_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL COMMENT '用户ID',
    asin VARCHAR(20) NOT NULL COMMENT '产品ASIN',
    marketplace VARCHAR(10) NOT NULL COMMENT '站点 UK/DE',
    source VARCHAR(50) DEFAULT '新品榜' COMMENT '来源: 新品榜/竞品店铺/总选品',
    action VARCHAR(20) NOT NULL COMMENT '行为类型: click=浏览卡片/跳链接, select=选中',
    product_title VARCHAR(500) DEFAULT NULL COMMENT '产品标题(冗余，分析时免JOIN)',
    clicked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '点击时间',
    INDEX idx_user (user_id),
    INDEX idx_asin (asin),
    INDEX idx_source_action (source, action, clicked_at),
    INDEX idx_user_time (user_id, clicked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='产品点击行为记录表';

docker exec sjzm-mysql mysql -e "
CREATE TABLE IF NOT EXISTS \`user\` (
    \`id\` BIGINT NOT NULL COMMENT '用户ID',
    \`username\` VARCHAR(50) NOT NULL COMMENT '用户名',
    \`password\` VARCHAR(255) NOT NULL COMMENT '密码',
    \`nickname\` VARCHAR(100) DEFAULT NULL COMMENT '昵称',
    \`role\` VARCHAR(20) NOT NULL DEFAULT 'USER' COMMENT '角色',
    \`status\` TINYINT NOT NULL DEFAULT 1 COMMENT '状态',
    \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`uk_username\` (\`username\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

INSERT INTO \`user\` (\`id\`, \`username\`, \`password\`, \`nickname\`, \`role\`, \`status\`) VALUES
(1, 'admin', '\$2a\$12\$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.AF0.7KyJ/Z3Gq', '管理员', 'ADMIN', 1)
ON DUPLICATE KEY UPDATE \`username\`=\`username\`;
" sijuelishi

-- 迁移 9 个产品负责人为 users 表"运营"角色账号
-- 背景：原 person_roster.product_manager 10 人本质是运营，而非独立的"产品负责人"角色
--      其中蒋舒已存在于 users（role=管理员），保留不动；其余 9 人新建账号
-- 密码：固定为不可登录哈希（status=0 同时阻止登录）。如需启用，admin 在用户管理界面重置密码并把 status 改为 1。
--
-- 不可登录密码：bcrypt('') 的安全替代——使用占位 hash 即可，配合 status=0 双保险
-- $2b$12$DISABLED.PLACEHOLDER.................................................

INSERT INTO users (username, password, role, status, created_at, updated_at) VALUES
('唐若',   '$2b$12$DISABLED.PLACEHOLDER.................................................', '运营', 0, NOW(), NOW()),
('张亚芳', '$2b$12$DISABLED.PLACEHOLDER.................................................', '运营', 0, NOW(), NOW()),
('阳姣',   '$2b$12$DISABLED.PLACEHOLDER.................................................', '运营', 0, NOW(), NOW()),
('尹心如', '$2b$12$DISABLED.PLACEHOLDER.................................................', '运营', 0, NOW(), NOW()),
('张奋奋', '$2b$12$DISABLED.PLACEHOLDER.................................................', '运营', 0, NOW(), NOW()),
('李杉',   '$2b$12$DISABLED.PLACEHOLDER.................................................', '运营', 0, NOW(), NOW()),
('余江燕', '$2b$12$DISABLED.PLACEHOLDER.................................................', '运营', 0, NOW(), NOW()),
('张洁',   '$2b$12$DISABLED.PLACEHOLDER.................................................', '运营', 0, NOW(), NOW()),
('李微微', '$2b$12$DISABLED.PLACEHOLDER.................................................', '运营', 0, NOW(), NOW());

SELECT id, username, role, status FROM users WHERE role='运营' ORDER BY id;

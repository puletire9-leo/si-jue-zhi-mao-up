-- 账号用户名英文 → 中文 迁移（一次性执行）
-- 背景：登录账号 username 与业务归属 developer 是独立字段，改 username 不影响历史业务数据。
-- admin 保留不动。其余 15 个账号改为中文名，改后用中文名登录。
-- 执行前务必备份 users 表：CREATE TABLE users_bak_20260630 AS SELECT * FROM users;

UPDATE users SET username = '张子轩' WHERE id = 20 AND username = 'zhangzixuan';
UPDATE users SET username = '周沁仪' WHERE id = 22 AND username = 'zhouqinyi';
UPDATE users SET username = '刘淼'   WHERE id = 23 AND username = 'liumiao';
UPDATE users SET username = '宋凤莉' WHERE id = 24 AND username = 'songfengli';
UPDATE users SET username = '龙梦临' WHERE id = 25 AND username = 'long';
UPDATE users SET username = '蒋舒'   WHERE id = 26 AND username = 'jiangshu';
UPDATE users SET username = '陈杨'   WHERE id = 27 AND username = 'chenyang';
UPDATE users SET username = '彭苗'   WHERE id = 28 AND username = 'pengmiao';
UPDATE users SET username = '王亚成' WHERE id = 29 AND username = 'wangyachen';
UPDATE users SET username = '黄雨珊' WHERE id = 30 AND username = 'huangyushan';
UPDATE users SET username = '洪宝'   WHERE id = 31 AND username = 'hongbao';
UPDATE users SET username = '刘陈霞' WHERE id = 32 AND username = 'liuchenxia';
UPDATE users SET username = '伍霄'   WHERE id = 33 AND username = 'wuxiao';
UPDATE users SET username = '李欣'   WHERE id = 34 AND username = 'lixin';
UPDATE users SET username = '夏浩宇' WHERE id = 40 AND username = 'xiahaoyu';

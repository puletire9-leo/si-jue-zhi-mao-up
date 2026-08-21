-- 财务日报人员维度数据补丁；与 DDL 分离，可幂等执行。
-- NULL 生效区间表示历史及未来持续有效，后续由“人员维度配置”页面维护。
INSERT INTO person_roster (id, name, role_type, sort_order, enabled, effective_from, effective_to, remark) VALUES
    (4001, '阳姣',   'operator', 1, 1, NULL, NULL, '财务日报运营维度'),
    (4002, '张奋奋', 'operator', 2, 1, NULL, NULL, '财务日报运营维度'),
    (4003, '尹心如', 'operator', 3, 1, NULL, NULL, '财务日报运营维度'),
    (4004, '余江燕', 'operator', 4, 1, NULL, NULL, '财务日报运营维度'),
    (4005, '李微微', 'operator', 5, 1, NULL, NULL, '财务日报运营维度')
ON DUPLICATE KEY UPDATE
    sort_order = VALUES(sort_order),
    enabled = VALUES(enabled),
    remark = VALUES(remark);

-- 2026-08 财务生产口径：张子轩退出，夏浩宇加入；旧案例仍走独立固定名单。
UPDATE person_roster
SET effective_to = COALESCE(effective_to, '2026-07-31')
WHERE name = '张子轩' AND role_type = 'developer';

UPDATE person_roster
SET effective_from = COALESCE(effective_from, '2026-08-01')
WHERE name = '夏浩宇' AND role_type = 'developer';

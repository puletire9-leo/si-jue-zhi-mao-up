-- =================================================================
-- 请求中心 trigger_ref 扩容
-- =================================================================
-- 背景：
--   候选池“全选全部可抓店铺”会创建几百/上千个 item。
--   run.trigger_ref 原为 VARCHAR(128)，批量 id JSON 会触发：
--   Data too long for column 'trigger_ref'
--
-- 口径：
--   真实执行依赖 sellersprite_request_item.trigger_id；
--   trigger_ref 只作为任务来源摘要/可选 JSON 留底，但不能成为批量任务瓶颈。
-- =================================================================

ALTER TABLE sellersprite_request_run
    MODIFY COLUMN trigger_ref TEXT NULL COMMENT '来源引用摘要/JSON；批量任务不要依赖长度固定的 VARCHAR';

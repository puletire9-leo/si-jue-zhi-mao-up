-- ============================================================
-- AI 选品「一键同步本周全载体」异步任务状态表
-- 说明：harvest-all 全表扫 LIKE 很慢（102条串行~14min），改异步执行。
--       本表记录一次全载体同步的进度与结果，前端轮询。
--       范式参照 lingxing_data_sync_run。
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_selection_harvest_run (
  run_id        VARCHAR(64)  NOT NULL COMMENT '运行 ID：harvest-all-<uuid>',
  status        VARCHAR(16)  NOT NULL DEFAULT 'RUNNING' COMMENT 'RUNNING / SUCCESS / FAILED',
  week_tag      VARCHAR(16)  DEFAULT '' COMMENT 'ISO 周（如 2026-W32）',
  batch_id      VARCHAR(64)  DEFAULT '' COMMENT '写入的周批次 id：batch_<周>',
  marketplaces  VARCHAR(64)  DEFAULT '' COMMENT '本次同步站点，如 UK/DE/US',
  carrier_total INT          DEFAULT 0  COMMENT '待同步载体总数',
  carrier_done  INT          DEFAULT 0  COMMENT '已完成载体数（进度）',
  hit_total     INT          DEFAULT 0  COMMENT '各载体命中行数累加（未去重）',
  batch_total   INT          DEFAULT 0  COMMENT '本周批次当前总行数（去重后）',
  error_message TEXT         COMMENT '失败原因',
  started_at    DATETIME     DEFAULT CURRENT_TIMESTAMP COMMENT '开始时间',
  finished_at   DATETIME     NULL COMMENT '结束时间',
  PRIMARY KEY (run_id),
  KEY idx_status (status),
  KEY idx_started_at (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI选品全载体异步同步运行记录';

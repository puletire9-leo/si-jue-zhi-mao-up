package com.sjzm.product.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * AI 选品「一键同步本周全载体」异步任务状态。
 * harvest-all 全表扫 LIKE 很慢，改异步执行；本表记录进度供前端轮询。
 * 范式参照 lingxing_data_sync_run。
 */
@Data
@TableName("ai_selection_harvest_run")
public class AiSelectionHarvestRun {

    /** 运行 ID：harvest-all-<uuid> */
    @TableId(type = IdType.INPUT)
    private String runId;

    /** RUNNING / SUCCESS / FAILED */
    private String status;

    /** ISO 周（如 2026-W32） */
    private String weekTag;

    /** 写入的周批次 id：batch_<周> */
    private String batchId;

    /** 本次同步站点，如 UK/DE/US */
    private String marketplaces;

    /** 待同步载体总数 */
    private Integer carrierTotal;

    /** 已完成载体数（进度） */
    private Integer carrierDone;

    /** 各载体命中行数累加（未去重） */
    private Integer hitTotal;

    /** 本周批次当前总行数（去重后） */
    private Integer batchTotal;

    /** 失败原因 */
    private String errorMessage;

    private LocalDateTime startedAt;

    private LocalDateTime finishedAt;
}

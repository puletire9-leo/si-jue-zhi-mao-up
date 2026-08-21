package com.sjzm.product.modules.lingxing.dto;

import lombok.Data;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 财务日报加工结果（供 Job 编排飞书发布 + 落审计 resultJson）。
 */
@Data
public class FinanceDailyReportResult {

    private LocalDate reportDate;

    /** 领星 asinList 拉到的原始行数（统一表站点白名单过滤前） */
    private int fetchedRows;

    /** 统一表站点白名单过滤后的 ASIN 行数（保留旧字段名兼容审计） */
    private int teamRows;

    /** UK 财务口径的去重 ASIN 数 */
    private int distinctAsins;

    /** 写入日表的行数（去重后） */
    private int storedRows;

    /** 截止目标日前，在当前计算站点真实产生过正销量的 ASIN 数。 */
    private int priorPositiveAsins;

    /** 实际使用的上一状态快照日期。 */
    private LocalDate statusSnapshotDate;

    /** 上一状态快照中仍有效断货的 ASIN 数。 */
    private int priorOutOfStockAsins;

    /** 本次写入的派生状态快照行数。 */
    private int storedStatusRows;

    /** 命中 RDS 统一表的 ASIN 数 */
    private int unifiedMatchAsins;

    /** 5 维度汇总行：基础 4 行固定，运营/开发仅输出当天实际存在的人员。 */
    private List<FinanceDailyReportRow> rows;

    /** 各阶段耗时（毫秒），键为阶段名 */
    private Map<String, Long> stageDurationsMs;
}

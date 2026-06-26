package com.sjzm.product.service;

import java.util.Map;

/**
 * 数据清洗层服务：维护 competitor_products_clean 表。
 * 见 docs/选品方法库/补充/数据清洗层.md
 */
public interface CleanLayerService {

    /**
     * 增量清洗指定批次：按父 ASIN 去重后 INSERT/UPDATE 进清洗表。
     * 用法：每次 AsinImportService 完成一个 (marketplace, week_tag) 批次后调用。
     *
     * @param marketplace UK/DE/US
     * @param weekTag     yyyy-Www（必须非空，老数据走 cleanByEffectiveWeekTag 自助调）
     * @return {marketplace, weekTag, affectedRows}
     */
    Map<String, Object> cleanWeekBatch(String marketplace, String weekTag);

    /**
     * 按 effective_week_tag 触发清洗（含老数据占位的 yyyyMM-W00）。
     * 用法：补录、回滚、历史数据回填。
     */
    Map<String, Object> cleanByEffectiveWeekTag(String marketplace, String effectiveWeekTag);
}

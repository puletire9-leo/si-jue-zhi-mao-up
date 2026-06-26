package com.sjzm.product.service;

import java.util.Map;

public interface CategoryAgeTierBaselineService {

    /**
     * 月度刷新基线 + 全量回写打标。
     * 1) 重算 category_age_tier_baseline（按 marketplace × bsr_id × age_bucket × month）
     * 2) UPDATE competitor_products 该月份所有行的 m04_* 5 列
     *
     * @param month       基线月份 yyyyMM
     * @param marketplace 可选，过滤站点
     * @return 摘要：basesInserted / asinsTagged / outOfScopeCount
     */
    Map<String, Object> computeAndTagByMonth(String month, String marketplace);

    /**
     * 周度增量打标（基线不变，只对本周新数据打标）。
     *
     * @param weekTag     yyyy-Www（如 2026-W26）
     * @param month       对应 baseline_month（决定查哪份基线）
     * @param marketplace 可选
     * @return 摘要：weekTag / asinsTagged
     */
    Map<String, Object> tagAsinsByWeek(String weekTag, String month, String marketplace);
}

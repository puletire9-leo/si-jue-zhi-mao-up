package com.sjzm.product.modules.lingxing.service;

import com.sjzm.product.mapper.LingxingAsinBaselineMapper;
import com.sjzm.product.mapper.LingxingOverviewCountMapper;
import com.sjzm.product.mapper.LingxingSkuDataLayerMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 领星工作台总览服务。
 *
 * <p>聚合 10 张 lingxing_* 表的行数 + baseline 团队分布 + 最近同步记录，
 * 给前端 /lingxing/workspace 页面用。</p>
 */
@Service
@RequiredArgsConstructor
public class LingxingOverviewService {

    private final LingxingAsinBaselineMapper baselineMapper;
    private final LingxingSkuDataLayerMapper syncRunMapper;
    private final LingxingOverviewCountMapper countMapper;

    /** 工作台总览：所有关键数据卡片一次返回。 */
    public Map<String, Object> workspaceOverview() {
        Map<String, Object> out = new LinkedHashMap<>();

        Map<String, Long> counts = new LinkedHashMap<>();
        counts.put("baseline", countMapper.countBaseline());
        counts.put("monthlyPerformance", countMapper.countMonthlyPerformance());
        counts.put("skuWeekly", countMapper.countSkuWeekly());
        counts.put("profitAsin", countMapper.countProfitAsin());
        counts.put("localProduct", countMapper.countLocalProduct());
        counts.put("seller", countMapper.countSeller());
        counts.put("purchasePlan", countMapper.countPurchasePlan());
        counts.put("purchaseOrder", countMapper.countPurchaseOrder());
        counts.put("purchaseOrderItem", countMapper.countPurchaseOrderItem());
        counts.put("dataSyncRun", countMapper.countDataSyncRun());
        out.put("tableCounts", counts);

        Map<String, Object> coverage = new HashMap<>();
        coverage.put("monthlyLatest", countMapper.latestMonthlyMonth());
        coverage.put("monthlyEarliest", countMapper.earliestMonthlyMonth());
        coverage.put("weeklyLatest", countMapper.latestWeeklyEnd());
        coverage.put("profitLatest", countMapper.latestProfitDate());
        out.put("coverage", coverage);

        out.put("byDeveloper", baselineMapper.countByDeveloper());
        out.put("byCurrency", baselineMapper.countByCurrency());
        out.put("byStartMonth", baselineMapper.countByStartMonth());
        out.put("byStatus", baselineMapper.countByStatus());

        List<Map<String, Object>> recentRuns = syncRunMapper.listRecentRuns(10);
        out.put("recentSyncs", recentRuns);

        return out;
    }
}

package com.sjzm.product.modules.lingxing.service;

import com.sjzm.product.mapper.LingxingOverviewCountMapper;
import com.sjzm.product.mapper.LingxingProductUnifiedMapper;
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

    private final LingxingSkuDataLayerMapper syncRunMapper;
    private final LingxingOverviewCountMapper countMapper;
    private final LingxingProductUnifiedMapper unifiedMapper;

    /** 工作台总览：所有关键数据卡片一次返回。 */
    public Map<String, Object> workspaceOverview() {
        Map<String, Object> out = new LinkedHashMap<>();

        Map<String, Long> counts = new LinkedHashMap<>();
        counts.put("monthlyPerformance", countMapper.countMonthlyPerformance());
        counts.put("skuWeekly", countMapper.countSkuWeekly());
        counts.put("profitAsin", countMapper.countProfitAsin());
        counts.put("localProduct", countMapper.countLocalProduct());
        counts.put("seller", countMapper.countSeller());
        counts.put("purchasePlan", countMapper.countPurchasePlan());
        counts.put("purchaseOrder", countMapper.countPurchaseOrder());
        counts.put("purchaseOrderItem", countMapper.countPurchaseOrderItem());
        counts.put("dataSyncRun", countMapper.countDataSyncRun());
        counts.put("productUnified", countMapper.countProductUnified());
        out.put("tableCounts", counts);

        Map<String, Object> coverage = new HashMap<>();
        coverage.put("monthlyLatest", countMapper.latestMonthlyMonth());
        coverage.put("monthlyEarliest", countMapper.earliestMonthlyMonth());
        coverage.put("weeklyLatest", countMapper.latestWeeklyEnd());
        coverage.put("weeklyEarliest", countMapper.earliestWeeklyStart());
        coverage.put("profitLatest", countMapper.latestProfitDate());
        out.put("coverage", coverage);

        // 产品统一表聚合（今天建成的最终产出物：6994 目标标签 ASIN 宽表）
        Map<String, Object> unified = new LinkedHashMap<>();
        unified.put("total", unifiedMapper.countUnified());
        unified.put("withSales", unifiedMapper.countWithSales());
        unified.put("byCountry", unifiedMapper.countUnifiedByCountry());
        unified.put("byDeveloper", unifiedMapper.countUnifiedByDeveloper());
        unified.put("byLatestMonth", unifiedMapper.countUnifiedByLatestMonth());
        unified.put("byTag", unifiedMapper.sumUnifiedByTag());
        out.put("unified", unified);

        List<Map<String, Object>> recentRuns = syncRunMapper.listRecentRuns(10);
        out.put("recentSyncs", recentRuns);

        return out;
    }
}

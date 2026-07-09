package com.sjzm.product.modules.lingxing.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sjzm.product.mapper.LingxingSellerMapper;
import com.sjzm.product.mapper.LingxingSkuPoolMapper;
import com.sjzm.product.modules.lingxing.entity.LingxingSeller;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.temporal.WeekFields;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 领星 UK/DE 目标标签 SKU 池。
 *
 * 主链路：领星产品表现 API → lingxing_product_performance.raw_json.tag_set →
 * 自动筛选 6 个目标标签 → sku_pool。
 */
@Service
@RequiredArgsConstructor
public class LingxingSkuPoolService {

    /**
     * 6 个目标 Listing 标签对应的领星 global_tag_id。
     * tag_name 可能受字符集/改名影响，筛选以 tag_id 为准。
     */
    public static final List<String> TARGET_TAG_IDS = List.of(
            "907657425150046095", // 绿标
            "907563170455592213", // 欧洲精铺2025
            "907654877317203632", // 欧洲精铺2025非标品
            "907596133278666918", // 欧洲精铺2025季节性断货
            "907585847123066054", // 欧洲精铺2025待淘汰
            "907585631391968576"  // 欧洲精铺2025淘汰
    );

    private static final Map<Integer, String> MARKETPLACE_BY_MID = Map.of(
            4, "UK",
            5, "DE"
    );

    private final LingxingSkuPoolMapper skuPoolMapper;
    private final LingxingSellerMapper sellerMapper;
    private final LingxingProductPerformanceSyncService performanceSyncService;
    private final LingxingSkuDataLayerService skuDataLayerService;

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> rebuildFromExistingPerformance(String snapshotWeek) {
        String week = normalizeSnapshotWeek(snapshotWeek);
        skuPoolMapper.deactivateSnapshot(week);
        int upserted = skuPoolMapper.insertFromPerformanceTags(week, TARGET_TAG_IDS);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("snapshotWeek", week);
        result.put("source", "LINGXING_PERFORMANCE_TAG_SET");
        result.put("targetTagIds", TARGET_TAG_IDS);
        result.put("upserted", upserted);
        result.put("stats", skuPoolMapper.stats(week));
        result.put("normalized", skuDataLayerService.rebuildSkuSnapshotAndTargetPoolFromExisting(week, null));
        return result;
    }

    /**
     * 全自动刷新：
     * 1. 从 lingxing_seller 取 UK(mid=4)、DE(mid=5) 前台仍可见店铺；
     * 2. 串行调用产品表现 API，summary_field=sku 拉全量 SKU；
     * 3. 用 raw_json.tag_set 重建 SKU 池。
     */
    public Map<String, Object> syncUkDeSkuPerformanceAndRebuild(String startDate,
                                                                 String endDate,
                                                                 String currencyCode,
                                                                 String snapshotWeek) {
        if (!StringUtils.hasText(startDate) || !StringUtils.hasText(endDate)) {
            throw new IllegalArgumentException("startDate/endDate 必填");
        }

        Map<String, Object> syncResults = new LinkedHashMap<>();
        for (Integer mid : List.of(4, 5)) {
            List<Long> sids = skuPoolSids(mid);
            if (sids.isEmpty()) {
                syncResults.put(MARKETPLACE_BY_MID.get(mid), Map.of("sids", 0, "skipped", true));
                continue;
            }
            Map<String, Object> sync = performanceSyncService.sync(
                    sids,
                    startDate,
                    endDate,
                    "sku",
                    currencyCode,
                    null,
                    null,
                    false
            );
            Map<String, Object> one = new LinkedHashMap<>(sync);
            one.put("sidCount", sids.size());
            one.put("mid", mid);
            syncResults.put(MARKETPLACE_BY_MID.get(mid), one);
        }

        Map<String, Object> rebuild = rebuildFromExistingPerformance(snapshotWeek);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sync", syncResults);
        result.put("rebuild", rebuild);
        return result;
    }

    public Map<String, Object> stats(String snapshotWeek) {
        String week = normalizeSnapshotWeek(snapshotWeek);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("snapshotWeek", week);
        result.put("targetTagIds", TARGET_TAG_IDS);
        result.put("stats", skuPoolMapper.stats(week));
        return result;
    }

    public Map<String, Object> list(String snapshotWeek, String marketplace, String sku, int current, int size) {
        String week = normalizeSnapshotWeek(snapshotWeek);
        int page = Math.max(current, 1);
        int pageSize = Math.min(Math.max(size, 1), 500);
        int offset = (page - 1) * pageSize;

        String normalizedMarketplace = StringUtils.hasText(marketplace)
                ? marketplace.trim().toUpperCase(Locale.ROOT)
                : null;
        long total = skuPoolMapper.count(week, normalizedMarketplace, sku);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("records", skuPoolMapper.list(week, normalizedMarketplace, sku, pageSize, offset));
        result.put("total", total);
        result.put("current", page);
        result.put("size", pageSize);
        result.put("pages", (total + pageSize - 1) / pageSize);
        result.put("snapshotWeek", week);
        return result;
    }

    private List<Long> skuPoolSids(Integer mid) {
        return sellerMapper.selectList(new LambdaQueryWrapper<LingxingSeller>()
                        .eq(LingxingSeller::getMid, mid)
                        .in(LingxingSeller::getStatus, List.of(1, 2))
                        .orderByAsc(LingxingSeller::getSid))
                .stream()
                .map(LingxingSeller::getSid)
                .toList();
    }

    private String normalizeSnapshotWeek(String snapshotWeek) {
        if (StringUtils.hasText(snapshotWeek)) {
            return snapshotWeek.trim();
        }
        LocalDate today = LocalDate.now();
        WeekFields wf = WeekFields.ISO;
        int week = today.get(wf.weekOfWeekBasedYear());
        int year = today.get(wf.weekBasedYear());
        return "%d-W%02d".formatted(year, week);
    }
}

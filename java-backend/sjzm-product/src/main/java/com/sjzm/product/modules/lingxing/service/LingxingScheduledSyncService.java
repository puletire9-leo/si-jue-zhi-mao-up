package com.sjzm.product.modules.lingxing.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sjzm.product.mapper.LingxingSellerMapper;
import com.sjzm.product.mapper.LingxingSkuDataLayerMapper;
import com.sjzm.product.modules.lingxing.entity.LingxingSeller;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 领星每周自动同步调度。
 *
 * <p>正确流程（对照领星文档）：
 * <ol>
 *   <li>先调店铺列表接口刷新最新 UK/DE 店铺 sid</li>
 *   <li>多店铺批量拉产品表现（sid 上限 200/批，批间间隔 10s，令牌桶=1）</li>
 *   <li>清洗：产品表现 → 周表 → 产品统一表</li>
 * </ol>
 *
 * <p><b>默认关闭</b>：{@code LINGXING_SCHEDULED_ENABLED=false}，人工验证一轮后再开。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LingxingScheduledSyncService {

    private static final DateTimeFormatter DF = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final int SID_BATCH = 200; // 产品表现接口 sid 上限

    @Value("${lingxing.scheduled.enabled:false}")
    private boolean scheduledEnabled;

    private final LingxingSellerMapper sellerMapper;
    private final LingxingSellerSyncService sellerSyncService;
    private final LingxingProductPerformanceSyncService performanceSyncService;
    private final LingxingSkuDataLayerService skuDataLayerService;
    private final LingxingProductUnifiedService unifiedService;
    private final LingxingSkuDataLayerMapper syncRunMapper;

    /**
     * 每周一 03:30 触发（错开整点避开限流高峰）。
     * cron: 秒 分 时 日 月 周。
     */
    @Scheduled(cron = "${lingxing.scheduled.cron:0 30 3 ? * MON}")
    public void weeklySync() {
        if (!scheduledEnabled) {
            log.debug("领星每周自动同步已禁用（LINGXING_SCHEDULED_ENABLED=false），跳过");
            return;
        }
        // 最近完整一周：上周一 ~ 上周日
        LocalDate today = LocalDate.now();
        LocalDate start = today.minusDays(7).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate end = start.plusDays(6);
        run(start.format(DF), end.format(DF));
    }

    /**
     * 执行一次完整同步（供调度与手动触发共用）。
     * 流程：①刷新店铺列表 → ②多店铺批量拉产品表现 → ③清洗（周表→统一表）
     *
     * @param startDate 窗口开始 yyyy-MM-dd
     * @param endDate   窗口结束 yyyy-MM-dd
     */
    public Map<String, Object> run(String startDate, String endDate) {
        String runId = "product-performance-weekly-" + System.currentTimeMillis();
        syncRunMapper.beginRun(runId, "PRODUCT_PERFORMANCE_WEEKLY", null,
                startDate, endDate, null, null,
                "{\"startDate\":\"" + startDate + "\",\"endDate\":\"" + endDate + "\"}");

        int totalUpserted = 0;
        int totalFetched = 0;
        try {
            // ① 先刷新店铺列表，拿最新 UK/DE 店铺 sid（文档：/erp/sc/data/seller/lists 一次性全量）
            Map<String, Object> sellerResult = sellerSyncService.syncAll();
            log.info("领星每周同步：店铺列表刷新 {}", sellerResult);

            List<Long> sids = activeUkDeSids();
            if (sids.isEmpty()) {
                throw new IllegalStateException("无有效 UK/DE 店铺 sid，店铺列表同步后仍为空");
            }
            log.info("领星每周同步开始：{} 个 UK/DE 店铺，窗口 {}~{}", sids.size(), startDate, endDate);

            // ② 多店铺批量拉产品表现（sid 上限 200/批）
            // 文档：多店铺查询批间间隔 10s；SyncService 内翻页也按 10s。
            // summary_field=msku：周表加工需从 price_list 展开 SKU
            int batchCount = (sids.size() + SID_BATCH - 1) / SID_BATCH;
            for (int i = 0; i < sids.size(); i += SID_BATCH) {
                List<Long> batch = sids.subList(i, Math.min(i + SID_BATCH, sids.size()));
                int batchNo = i / SID_BATCH + 1;
                log.info("领星每周同步：批次 {}/{}，本批 {} 店", batchNo, batchCount, batch.size());
                try {
                    Map<String, Object> r = performanceSyncService.sync(
                            batch, startDate, endDate, "msku", null);
                    totalFetched += ((Number) r.getOrDefault("fetched", 0)).intValue();
                    totalUpserted += ((Number) r.getOrDefault("upserted", 0)).intValue();
                    log.info("领星每周同步：批次 {}/{} 完成 {}", batchNo, batchCount, r);
                } catch (Exception ex) {
                    log.warn("领星每周同步：批次 {}/{} 失败，跳过：{}", batchNo, batchCount, ex.getMessage());
                }
                // 批与批之间再间隔 10s（文档多店铺规则）
                if (i + SID_BATCH < sids.size()) {
                    sleep(10_000L);
                }
            }

            // ③ 清洗：产品表现 → 周表 → 产品统一表
            Map<String, Object> weekly = skuDataLayerService.upsertWeeklyFromExistingPerformance(
                    startDate, endDate, null, runId);
            log.info("领星每周同步：周表加工 {}", weekly);

            Map<String, Object> unified = unifiedService.rebuild(null);
            log.info("领星每周同步：统一表重算 {}", unified);

            syncRunMapper.finishRun(runId, "SUCCESS", totalUpserted, null);
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("runId", runId);
            out.put("window", startDate + "~" + endDate);
            out.put("sidCount", sids.size());
            out.put("fetched", totalFetched);
            out.put("upserted", totalUpserted);
            out.put("weekly", weekly);
            out.put("unified", unified);
            return out;
        } catch (Exception e) {
            log.error("领星每周同步失败：{}", e.getMessage(), e);
            syncRunMapper.finishRun(runId, "FAILED", totalUpserted, truncate(e.getMessage(), 500));
            throw new RuntimeException("领星每周同步失败: " + e.getMessage(), e);
        }
    }

    /**
     * 查 UK/DE 在售店铺 sid（status=1 且 mid IN(4,5)）。
     * mid=4 → UK，mid=5 → DE（领星只经营欧洲双站）。
     */
    private List<Long> activeUkDeSids() {
        List<LingxingSeller> sellers = sellerMapper.selectList(
                new LambdaQueryWrapper<LingxingSeller>()
                        .eq(LingxingSeller::getStatus, 1)
                        .in(LingxingSeller::getMid, 4L, 5L));
        List<Long> sids = new ArrayList<>();
        for (LingxingSeller s : sellers) {
            if (s.getSid() != null) sids.add(s.getSid());
        }
        return sids;
    }

    private String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }

    private void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
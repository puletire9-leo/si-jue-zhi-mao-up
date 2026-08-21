package com.sjzm.product.modules.lingxing.service;

import com.sjzm.product.mapper.LingxingSkuDataLayerMapper;
import com.sjzm.product.rds.service.RdsBatchWriteService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.temporal.IsoFields;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 领星 SKU 周数据加工层。
 *
 * <p>当前需求只保留一条：把已落库的产品表现（{@code lingxing_product_performance}，summary_field=msku）
 * 从 raw_json 展开加工进周表 {@code lingxing_sku_weekly_performance}（SKU×店铺×周 一行）。</p>
 *
 * <p>加工 SQL 见 mapper/LingxingSkuWeeklyMapper.xml；限定 mid IN(4,5)=UK/DE，SHA256 幂等。
 * 历史的 snapshot/monthly/sku_pool 加工不在本次需求内，故不实现（sku_store_snapshot/sku_pool
 * 生产库从未建表，仅有废弃建表脚本；product_performance/sku_weekly 均为活表）。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LingxingSkuDataLayerService {

    private final LingxingSkuDataLayerMapper mapper;
    private final RdsBatchWriteService rdsBatchWriteService;

    /**
     * 把指定时间窗的产品表现加工进周表。
     *
     * @param startDate  周窗口开始 yyyy-MM-dd（null 加工全部窗口）
     * @param endDate    周窗口结束 yyyy-MM-dd
     * @param snapshotWeek 快照周标记（如 2026-W29；空则按 startDate 推导 ISO 周）
     * @param sourceRunId  来源 run_id（周表 source_run_id 记来源；空则自动加 -weekly 后缀）
     * @return {rows, snapshotWeek, runId}
     */
    public Map<String, Object> upsertWeeklyFromExistingPerformance(String startDate,
                                                                   String endDate,
                                                                   String snapshotWeek,
                                                                   String sourceRunId) {
        String week = StringUtils.hasText(snapshotWeek) ? snapshotWeek.trim() : deriveIsoWeek(startDate);
        String runId = StringUtils.hasText(sourceRunId) ? sourceRunId.trim() + "-weekly"
                : "sku-weekly-" + System.currentTimeMillis();

        int rows = rdsBatchWriteService.executeOne(LingxingSkuDataLayerMapper.class,
                rdsMapper -> rdsMapper.upsertWeeklyFromPerformance(
                        emptyToNull(startDate), emptyToNull(endDate), week, runId));
        int total = mapper.countWeekly(emptyToNull(startDate), emptyToNull(endDate));
        log.info("周表加工完成：窗口 {}~{}，本次影响 {} 行，窗口内共 {} 行，week={}, runId={}",
                startDate, endDate, rows, total, week, runId);

        Map<String, Object> r = new LinkedHashMap<>();
        r.put("affected", rows);
        r.put("windowRows", total);
        r.put("snapshotWeek", week);
        r.put("runId", runId);
        return r;
    }

    /** 按 startDate 推导 ISO 周标记 yyyy-Www（快照周缺省时用）。 */
    private String deriveIsoWeek(String startDate) {
        if (!StringUtils.hasText(startDate)) return null;
        LocalDate d = LocalDate.parse(startDate.trim());
        int wk = d.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR);
        int yr = d.get(IsoFields.WEEK_BASED_YEAR);
        return String.format("%d-W%02d", yr, wk);
    }

    private String emptyToNull(String s) {
        return StringUtils.hasText(s) ? s.trim() : null;
    }
}

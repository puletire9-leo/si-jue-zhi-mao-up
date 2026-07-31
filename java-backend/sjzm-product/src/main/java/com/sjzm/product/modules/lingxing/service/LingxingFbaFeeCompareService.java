package com.sjzm.product.modules.lingxing.service;

import com.sjzm.product.mapper.LingxingFbaFeeCompareMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * FBA 配送费对比编排：开发人预测 vs 亚马逊实际/预估。
 *
 * <p>流程：<ol>
 *   <li>查合格 ASIN 对应的 listing sid+msku（统一表目标 ∩ 近3月合计销量>30 ∩ 近3月合计正利润）</li>
 *   <li>getPrices 拉亚马逊 FBA 预估费落中间表 lingxing_listing_fba_fee</li>
 *   <li>truncate + rebuildAll 生成对比表（JOIN 开发人预测 lingxing_developer_fba）</li>
 * </ol>
 * 开发人预测值来自 CSV 导入（import_developer_fba.py），需先导入。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LingxingFbaFeeCompareService {

    private final LingxingFbaFeeCompareMapper compareMapper;
    private final LingxingListingFeeService listingFeeService;

    @Transactional
    public Map<String, Object> rebuild() {
        long t0 = System.currentTimeMillis();

        // ① 合格 ASIN 的 sid+msku
        List<Map<String, Object>> sidMskus = compareMapper.selectQualifiedSidMskus();
        log.info("FBA费对比：合格 ASIN 对应 sid+msku {} 项", sidMskus.size());

        // ② getPrices 拉亚马逊 FBA 预估费
        Map<String, Object> feeResult = listingFeeService.syncFees(sidMskus);

        // ③ 重算对比表
        compareMapper.truncateAll();
        int affected = compareMapper.rebuildAll();

        long ms = System.currentTimeMillis() - t0;
        log.info("FBA费对比重算完成：对比 {} 行，getPrices {}，耗时 {}ms", affected, feeResult, ms);

        Map<String, Object> r = new LinkedHashMap<>();
        r.put("qualifiedSidMskus", sidMskus.size());
        r.put("fee", feeResult);
        r.put("compareRows", affected);
        r.put("costMs", ms);
        return r;
    }

    /**
     * 按月+销量补拉亚马逊 FBA 预估费（getPrices）落中间表 lingxing_listing_fba_fee。
     * 用于扩展 getPrices 覆盖面（如 7 月销量>10 的新品，3 月对比口径未覆盖到）。
     *
     * @param ym        月份，如 '2026-07'
     * @param minVolume 该月销量下限（>）
     */
    public Map<String, Object> syncFeesByMonth(String ym, int minVolume) {
        long t0 = System.currentTimeMillis();
        List<Map<String, Object>> sidMskus = compareMapper.selectSidMskusByMonth(ym, minVolume);
        log.info("按月补拉 FBA 费：{} 销量>{} → sid+msku {} 项", ym, minVolume, sidMskus.size());
        Map<String, Object> feeResult = listingFeeService.syncFees(sidMskus);
        long msCost = System.currentTimeMillis() - t0;
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("month", ym);
        r.put("minVolume", minVolume);
        r.put("sidMskus", sidMskus.size());
        r.put("fee", feeResult);
        r.put("costMs", msCost);
        return r;
    }
}

package com.sjzm.product.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sjzm.product.dto.CarrierHarvestSpec;
import com.sjzm.product.entity.NonstandardCarrier;
import com.sjzm.product.mapper.AiSelectionHarvestRunMapper;
import com.sjzm.product.mapper.AiSelectionMapper;
import com.sjzm.product.mapper.NonstandardCarrierMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

/**
 * AI 选品「一键同步本周全载体」异步执行器。
 * 独立 bean 承载 @Async，规避 AiSelectionService 内部自调用导致异步失效。
 *
 * <p>提速 C：不再逐载体扫表，而是每站点每表一次合并扫描
 * （全载体 OR 并集召回 + CASE 分流 carrier），把 102 条压成 markets×2 条。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "features.ai-selection", name = "enabled", havingValue = "true")
public class AiSelectionHarvestRunner {

    private final AiSelectionMapper aiSelectionMapper;
    private final NonstandardCarrierMapper carrierMapper;
    private final AiSelectionHarvestRunMapper runMapper;

    /**
     * 异步执行全载体合并捞取，全程更新 ai_selection_harvest_run 进度。
     * markets/batchId 由调用方（Service.startHarvestAll）预先算好并建好 RUNNING 记录。
     */
    @Async("taskExecutor")
    public void runHarvestAll(String runId, List<String> markets, String batchId,
                              String batchLabel, String userId) {
        int hitTotal = 0;
        try {
            List<CarrierHarvestSpec> specs = buildSpecs();
            if (specs.isEmpty()) {
                runMapper.finishRun(runId, "FAILED", batchId, 0, 0, "没有可用载体（检索词全空）");
                return;
            }

            // 每站点一次 shop + 一次 clean 合并扫描（全载体分流）
            int stepDone = 0;
            for (String mk : markets) {
                hitTotal += aiSelectionMapper.harvestAllFromShop(mk, batchId, batchLabel, userId, specs);
                stepDone++;
                updateProgress(runId, stepDone, hitTotal, batchId);

                hitTotal += aiSelectionMapper.harvestAllFromClean(mk, batchId, batchLabel, userId, specs);
                stepDone++;
                updateProgress(runId, stepDone, hitTotal, batchId);
            }

            int batchTotal = aiSelectionMapper.countByBatch(batchId);
            runMapper.finishRun(runId, "SUCCESS", batchId, hitTotal, batchTotal, null);
            log.info("AI 选品全载体异步完成: runId={}, batchId={}, 命中合计={}, 本周批次总数={}",
                    runId, batchId, hitTotal, batchTotal);
        } catch (Exception e) {
            log.error("AI 选品全载体异步失败: runId={}", runId, e);
            int batchTotal = safeCount(batchId);
            runMapper.finishRun(runId, "FAILED", batchId, hitTotal, batchTotal,
                    e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName());
        }
    }

    private void updateProgress(String runId, int stepDone, int hitTotal, String batchId) {
        try {
            runMapper.updateProgress(runId, stepDone, hitTotal, safeCount(batchId));
        } catch (Exception ignore) {
            // 进度更新失败不影响主流程
        }
    }

    private int safeCount(String batchId) {
        try {
            return aiSelectionMapper.countByBatch(batchId);
        } catch (Exception e) {
            return 0;
        }
    }

    /** 读所有 enabled 载体，组装成合并扫描用的规格列表（过滤无召回词的）。 */
    private List<CarrierHarvestSpec> buildSpecs() {
        LambdaQueryWrapper<NonstandardCarrier> cw = new LambdaQueryWrapper<>();
        cw.eq(NonstandardCarrier::getEnabled, 1);
        List<NonstandardCarrier> carriers = carrierMapper.selectList(cw);
        List<CarrierHarvestSpec> specs = new ArrayList<>();
        for (NonstandardCarrier c : carriers) {
            CarrierHarvestSpec spec = new CarrierHarvestSpec();
            spec.setCarrierKey(c.getCarrierKey());
            spec.setTitleKeywords(splitCsv(c.getTitleKeywords()));
            spec.setCategoryPaths(splitCsv(c.getCategoryPaths()));
            spec.setExcludeKeywords(splitCsv(c.getExcludeKeywords()));
            spec.setConditionalExcludeKeywords(splitCsv(c.getConditionalExcludeKeywords()));
            spec.setIncludeKeywords(splitCsv(c.getIncludeKeywords()));
            if (spec.hasRecall()) {
                specs.add(spec);
            } else {
                log.warn("AI 选品全载体：跳过无检索词载体 {}", c.getCarrierKey());
            }
        }
        return specs;
    }

    /** 已启用载体数（用于状态记录展示）。 */
    public int countEnabledCarriers() {
        LambdaQueryWrapper<NonstandardCarrier> cw = new LambdaQueryWrapper<>();
        cw.eq(NonstandardCarrier::getEnabled, 1);
        return Math.toIntExact(carrierMapper.selectCount(cw));
    }

    private List<String> splitCsv(String csv) {
        if (StringUtils.isBlank(csv)) return Collections.emptyList();
        return java.util.Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toList());
    }
}

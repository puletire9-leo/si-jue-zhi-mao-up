package com.sjzm.product.modules.bazhuayu.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.toolkit.Db;
import com.fasterxml.jackson.databind.JsonNode;
import com.sjzm.product.modules.bazhuayu.entity.BazhuayuWeeklyRaw;
import com.sjzm.product.mapper.BazhuayuWeeklyRawMapper;
import com.sjzm.product.service.AsinImportService;
import com.sjzm.product.service.ScoringService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

/**
 * 八爪鱼自动采集调度服务。
 * 每周定时：删旧周 → 逐站点 启动云采集/轮询/拉取 → 写周表 → 整形 → 复用初筛建任务（BAZHUAYU_AUTO）。
 *
 * 流水线止于初筛：卖家精灵 API（消耗额度）仍由人在前端确认后手动触发
 * （走现有 /api/v1/asin-import/execute）。
 *
 * 跑在已有 sellerImportExecutor 线程池上：既避开 @Async 自调用失效问题，
 * 又不阻塞 Spring 单线程调度器。
 */
@Slf4j
@Service
public class BazhuayuScheduledService {

    private static final String IMPORT_TYPE = "BAZHUAYU_AUTO";
    private static final int DB_BATCH_SIZE = 2000;

    private final BazhuayuClient client;
    private final BazhuayuConfigService configService;
    private final BazhuayuWeeklyRawMapper rawMapper;
    private final AsinImportService asinImportService;
    private final ScoringService scoringService;
    private final ThreadPoolTaskExecutor executor;

    public BazhuayuScheduledService(BazhuayuClient client,
                                    BazhuayuConfigService configService,
                                    BazhuayuWeeklyRawMapper rawMapper,
                                    AsinImportService asinImportService,
                                    ScoringService scoringService,
                                    @Qualifier("sellerImportExecutor") ThreadPoolTaskExecutor executor) {
        this.client = client;
        this.configService = configService;
        this.rawMapper = rawMapper;
        this.asinImportService = asinImportService;
        this.scoringService = scoringService;
        this.executor = executor;
    }

    /** 默认周一 03:00（cron 走 env 可调），异步提交避免阻塞调度线程 */
    @Scheduled(cron = "${BAZHUAYU_CRON:0 0 3 * * MON}")
    public void scheduledWeekly() {
        log.info("八爪鱼定时采集触发");
        triggerAsync(null);
    }

    /**
     * 提交一次采集（fire-and-forget）。
     * @param marketplace 指定站点；null 表示配置中的全部站点
     */
    public void triggerAsync(String marketplace) {
        executor.execute(() -> {
            try {
                runCollection(marketplace);
            } catch (Exception e) {
                log.error("八爪鱼采集任务异常: {}", e.getMessage(), e);
            }
        });
    }

    /**
     * 采集主流程。单站点失败不影响其余。
     * @return 各站点结果汇总
     */
    public Map<String, Object> runCollection(String marketplace) {
        String weekTag = scoringService.getCurrentWeekTag();

        // 1. 删非本周数据（上周自动删，只保留最新周）
        int deleted = rawMapper.delete(new LambdaQueryWrapper<BazhuayuWeeklyRaw>()
                .ne(BazhuayuWeeklyRaw::getWeekTag, weekTag));
        if (deleted > 0) log.info("清理非本周({})八爪鱼数据 {} 行", weekTag, deleted);

        // 2. 确定要跑的站点
        Map<String, String> taskMap = configService.getMarketplaceTaskMap();
        List<String> marketplaces = new ArrayList<>();
        if (marketplace != null && !marketplace.isBlank()) {
            if (taskMap.containsKey(marketplace)) marketplaces.add(marketplace);
            else log.warn("站点 {} 未在八爪鱼任务映射中配置", marketplace);
        } else {
            marketplaces.addAll(taskMap.keySet());
        }
        if (marketplaces.isEmpty()) {
            log.warn("无可采集站点（检查 api_config.bazhuayu_taskgroup_mapping）");
            return Map.of("weekTag", weekTag, "results", List.of());
        }

        // 3. 逐站点采集 + 初筛
        List<Map<String, Object>> results = new ArrayList<>();
        for (String mp : marketplaces) {
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("marketplace", mp);
            try {
                r.putAll(collectAndScreen(mp, taskMap.get(mp), weekTag));
            } catch (Exception e) {
                log.error("站点 {} 采集失败: {}", mp, e.getMessage(), e);
                r.put("status", "ERROR");
                r.put("error", e.getMessage());
            }
            results.add(r);
        }
        return Map.of("weekTag", weekTag, "results", results);
    }

    /** 单站点：启动云采集 → 等完成 → 拉数据 → 写周表 → 整形 → 复用初筛建任务 */
    private Map<String, Object> collectAndScreen(String mp, String taskId, String weekTag) {
        log.info("站点 {} 开始采集，八爪鱼任务 {}", mp, taskId);
        String lotNo = client.startExtraction(taskId);
        boolean finished = client.waitForExtraction(taskId);
        if (!finished) {
            return Map.of("status", "EXTRACT_TIMEOUT", "lotNo", lotNo == null ? "" : lotNo);
        }

        List<JsonNode> rawRows = client.fetchAllData(taskId);
        log.info("站点 {} 拉取 {} 行原始数据", mp, rawRows.size());

        // 写周表 + 整形为初筛输入（列序对齐文件路径）
        List<BazhuayuWeeklyRaw> toSave = new ArrayList<>(DB_BATCH_SIZE);
        List<Map<String, String>> shapedRows = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (JsonNode raw : rawRows) {
            String asin = BazhuayuRowMapper.extractAsin(raw);
            if (asin == null || !seen.add(asin)) continue;

            String price = BazhuayuRowMapper.pick(raw, BazhuayuRowMapper.PRICE_KEYS);
            String reviews = BazhuayuRowMapper.pick(raw, BazhuayuRowMapper.REVIEW_KEYS);
            String title = BazhuayuRowMapper.pick(raw, BazhuayuRowMapper.TITLE_KEYS);

            BazhuayuWeeklyRaw e = new BazhuayuWeeklyRaw();
            e.setMarketplace(mp);
            e.setAsin(asin);
            e.setPrice(price);
            e.setReviews(reviews);
            e.setTitle(title);
            e.setRawJson(raw.toString());
            e.setWeekTag(weekTag);
            e.setLotNo(lotNo);
            e.setScrapedAt(LocalDateTime.now());
            toSave.add(e);

            shapedRows.add(BazhuayuRowMapper.shapeRow(asin, price, reviews, title));
        }

        // 重跑幂等：先删本站点本周旧行再写
        rawMapper.delete(new LambdaQueryWrapper<BazhuayuWeeklyRaw>()
                .eq(BazhuayuWeeklyRaw::getMarketplace, mp)
                .eq(BazhuayuWeeklyRaw::getWeekTag, weekTag));
        if (!toSave.isEmpty()) Db.saveBatch(toSave, DB_BATCH_SIZE);
        log.info("站点 {} 写入周表 {} 行", mp, toSave.size());

        // 复用初筛建任务（产出进 asin_import_tasks/results，前端确认后走现有 execute）
        Map<String, Object> preview = asinImportService.filterRowsAndCreateTask(shapedRows, mp, IMPORT_TYPE);
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("status", "READY");
        r.put("rawCount", toSave.size());
        r.put("lotNo", lotNo);
        r.putAll(preview);
        return r;
    }
}

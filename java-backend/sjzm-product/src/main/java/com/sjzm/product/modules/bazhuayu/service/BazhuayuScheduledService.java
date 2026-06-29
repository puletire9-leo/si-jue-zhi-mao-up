package com.sjzm.product.modules.bazhuayu.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.toolkit.Db;
import com.fasterxml.jackson.databind.JsonNode;
import com.sjzm.product.modules.bazhuayu.config.BazhuayuConfig;
import com.sjzm.product.modules.bazhuayu.entity.BazhuayuWeeklyRaw;
import com.sjzm.product.mapper.BazhuayuWeeklyRawMapper;
import com.sjzm.product.modules.bazhuayu.service.BazhuayuRunStateService.Phase;
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
 * 八爪鱼采集调度 + 控制台编排服务。
 *
 * 三种入口：
 *  1. 定时 {@link #scheduledWeekly()} / 手动 {@link #triggerAsync} —— **纯 drain**「读取已采数据」：
 *     云端已自带周日/周二定时采集，我们次日(周一/周三)06:00 拉未导出增量入库初筛，不控制云端启停。
 *  2. {@link #startCloudCollect} —— **手动启动云端采集一条龙**：startExtraction → 等待采完 → (榜单)drain 入库。
 *  3. {@link #stopTask} —— **停止**：协作式取消 + 调云端 stopExtraction。
 *
 * 跑在 bazhuayuExecutor 线程池（core=3/max=6），6 个任务可并行；与卖家精灵执行池隔离。
 * 流水线止于初筛：卖家精灵 API（消耗额度）仍由人在前端确认后手动触发。
 */
@Slf4j
@Service
public class BazhuayuScheduledService {

    private static final String IMPORT_TYPE = "BAZHUAYU_AUTO";
    private static final int DB_BATCH_SIZE = 2000;

    private final BazhuayuClient client;
    private final BazhuayuConfigService configService;
    private final BazhuayuConfig config;
    private final BazhuayuWeeklyRawMapper rawMapper;
    private final AsinImportService asinImportService;
    private final ScoringService scoringService;
    private final BazhuayuRunStateService runState;
    private final ThreadPoolTaskExecutor executor;

    public BazhuayuScheduledService(BazhuayuClient client,
                                    BazhuayuConfigService configService,
                                    BazhuayuConfig config,
                                    BazhuayuWeeklyRawMapper rawMapper,
                                    AsinImportService asinImportService,
                                    ScoringService scoringService,
                                    BazhuayuRunStateService runState,
                                    @Qualifier("bazhuayuExecutor") ThreadPoolTaskExecutor executor) {
        this.client = client;
        this.configService = configService;
        this.config = config;
        this.rawMapper = rawMapper;
        this.asinImportService = asinImportService;
        this.scoringService = scoringService;
        this.runState = runState;
        this.executor = executor;
    }

    // ============================================================
    // 入口 1：定时 / 手动「读取已采数据」（纯 drain，不控制云端）
    // ============================================================

    /** 默认周一+周三 06:00（cron 走 env 可调），异步提交避免阻塞调度线程 */
    @Scheduled(cron = "${BAZHUAYU_CRON:0 0 3 * * MON}")
    public void scheduledWeekly() {
        log.info("八爪鱼定时采集触发");
        triggerAsync(null);
    }

    /**
     * 提交一次「读取已采数据」drain（fire-and-forget）。
     * @param marketplace 指定站点；null 表示榜单全部站点
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
     * 「读取已采数据」主流程（榜单 drain）。单站点失败不影响其余。
     * @return 各站点结果汇总
     */
    public Map<String, Object> runCollection(String marketplace) {
        String weekTag = scoringService.getCurrentWeekTag();

        // 1. 删非本周数据（上周自动删，只保留最新周）
        int deleted = rawMapper.delete(new LambdaQueryWrapper<BazhuayuWeeklyRaw>()
                .ne(BazhuayuWeeklyRaw::getWeekTag, weekTag));
        if (deleted > 0) log.info("清理非本周({})八爪鱼数据 {} 行", weekTag, deleted);

        // 2. 确定要跑的站点（榜单）
        Map<String, String> taskMap = configService.getMarketplaceTaskMap();
        List<String> marketplaces = resolveMarketplaces(marketplace, taskMap);
        if (marketplaces.isEmpty()) {
            log.warn("无可采集站点（检查 api_config.bazhuayu_taskgroup_mapping）");
            return Map.of("weekTag", weekTag, "results", List.of());
        }

        // 3. 逐站点 drain + 初筛
        List<Map<String, Object>> results = new ArrayList<>();
        for (String mp : marketplaces) {
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("marketplace", mp);
            try {
                r.putAll(collectAndScreen(mp, taskMap.get(mp), weekTag, null));
            } catch (Exception e) {
                log.error("站点 {} 采集失败: {}", mp, e.getMessage(), e);
                r.put("status", "ERROR");
                r.put("error", e.getMessage());
            }
            results.add(r);
        }
        return Map.of("weekTag", weekTag, "results", results);
    }

    /** 解析要跑的榜单站点：指定单站点须在映射中，否则取全部。 */
    private List<String> resolveMarketplaces(String marketplace, Map<String, String> taskMap) {
        List<String> marketplaces = new ArrayList<>();
        if (marketplace != null && !marketplace.isBlank()) {
            if (taskMap.containsKey(marketplace)) marketplaces.add(marketplace);
            else log.warn("站点 {} 未在八爪鱼任务映射中配置", marketplace);
        } else {
            marketplaces.addAll(taskMap.keySet());
        }
        return marketplaces;
    }

    // ============================================================
    // 入口 2：手动启动云端采集一条龙（启动 → 等待 → drain）
    // ============================================================

    /**
     * 启动云端采集一条龙（异步）。每任务一个槽，tryBegin 占位成功才提交，防重复启动。
     * @param function    {@link BazhuayuConfigService#FUNC_BANGDAN} / {@link BazhuayuConfigService#FUNC_YITUSHITU}
     * @param marketplace 站点；null 表示该功能下全部站点
     * @return {accepted:[已启动], skipped:[正在跑被跳过], missing:[未配置 taskId]}
     */
    public Map<String, Object> startCloudCollect(String function, String marketplace) {
        Map<String, String> taskMap = configService.getFunctionTaskMap(function);
        List<String> marketplaces = resolveMarketplaces(marketplace, taskMap);

        List<String> accepted = new ArrayList<>();
        List<String> skipped = new ArrayList<>();
        List<String> missing = new ArrayList<>();
        for (String mp : marketplaces) {
            String taskId = taskMap.get(mp);
            if (taskId == null || taskId.isBlank()) { missing.add(mp); continue; }
            if (runState.tryBegin(function, mp, taskId)) {
                accepted.add(mp);
                executor.execute(() -> runOneDragon(function, mp, taskId));
            } else {
                skipped.add(mp);   // 该任务正在跑
            }
        }
        return Map.of("function", function, "accepted", accepted, "skipped", skipped, "missing", missing);
    }

    /**
     * 一条龙：STARTING → 启动云采集 → WAITING_CLOUD（轮询等采完，带进度+取消）→
     *   榜单：DRAINING → drain 入库初筛 → DONE；以图识图：采完即 DONE（本期不接数据管道）。
     * 等待被取消/超时/Stopped 则置对应终态，**绝不 drain**（数据不完整 + markexported 不可逆）。
     */
    private void runOneDragon(String function, String mp, String taskId) {
        boolean isBangdan = BazhuayuConfigService.FUNC_BANGDAN.equals(function);
        try {
            runState.setPhase(function, mp, Phase.STARTING);
            String lotNo = client.startExtraction(taskId);
            runState.setLotNo(function, mp, lotNo);
            log.info("[{}:{}] 云采集已启动 lotNo={}", function, mp, lotNo);

            runState.setPhase(function, mp, Phase.WAITING_CLOUD);
            BazhuayuClient.WaitResult wr = client.waitForExtraction(taskId,
                    c -> runState.setCloudCount(function, mp, c),
                    () -> runState.isCancelled(function, mp));
            switch (wr) {
                case CANCELLED -> { runState.fail(function, mp, Phase.STOPPED, "用户已停止"); return; }
                case STOPPED   -> { runState.fail(function, mp, Phase.STOPPED, "云端任务已停止"); return; }
                case TIMEOUT   -> { runState.fail(function, mp, Phase.TIMEOUT, "云端采集等待超时"); return; }
                case FINISHED  -> { /* 继续 */ }
            }

            if (!isBangdan) {
                // 以图识图：本期仅启停/监控，采完即完成，数据管道下一步再做
                runState.done(function, mp);
                log.info("[{}:{}] 云采集完成（以图识图本期不入库）", function, mp);
                return;
            }

            runState.setPhase(function, mp, Phase.DRAINING);
            String weekTag = scoringService.getCurrentWeekTag();
            Map<String, Object> r = collectAndScreen(mp, taskId, weekTag,
                    () -> runState.isCancelled(function, mp));
            int rawCount = ((Number) r.getOrDefault("rawCount", 0)).intValue();
            if (runState.isCancelled(function, mp)) {
                runState.fail(function, mp, Phase.STOPPED, "drain 期间已停止（已入库 " + rawCount + " 行）");
            } else {
                runState.finishDrain(function, mp, rawCount);
            }
            log.info("[{}:{}] 一条龙完成，入库 {} 行", function, mp, rawCount);
        } catch (Exception e) {
            log.error("[{}:{}] 一条龙失败: {}", function, mp, e.getMessage(), e);
            runState.fail(function, mp, Phase.ERROR, e.getMessage());
        }
    }

    // ============================================================
    // 入口 3：停止（协作式取消 + 云端 stop）
    // ============================================================

    /**
     * 停止任务：置取消标志 + 调云端 stopExtraction。云端 stop 失败原因透传（不吞）。
     * @return {stopped:bool, cloudStopError:可空}
     */
    public Map<String, Object> stopTask(String function, String marketplace) {
        String taskId = configService.getTaskId(function, marketplace);
        if (taskId == null || taskId.isBlank()) {
            throw new IllegalArgumentException("任务 " + function + ":" + marketplace + " 未在映射中配置");
        }
        runState.requestCancel(function, marketplace);
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("function", function);
        r.put("marketplace", marketplace);
        try {
            client.stopExtraction(taskId);
            r.put("stopped", true);
        } catch (Exception e) {
            // 云端 stop 失败（如权限/任务已停），取消标志已置，本地一条龙仍会停；把错误透传
            log.warn("[{}:{}] 云端 stop 失败: {}", function, marketplace, e.getMessage());
            r.put("stopped", false);
            r.put("cloudStopError", e.getMessage());
        }
        return r;
    }

    // ============================================================
    // 共用：单站点 drain + 初筛
    // ============================================================

    /** 单站点：删本周旧行 → drain（带取消）→ 初筛。云端已自采，我们只取未导出增量。 */
    private Map<String, Object> collectAndScreen(String mp, String taskId, String weekTag,
                                                 java.util.function.BooleanSupplier cancelled) {
        log.info("站点 {} 开始增量采集，八爪鱼任务 {}", mp, taskId);

        // 重跑幂等：先删本站点本周旧行，之后逐页追加
        rawMapper.delete(new LambdaQueryWrapper<BazhuayuWeeklyRaw>()
                .eq(BazhuayuWeeklyRaw::getMarketplace, mp)
                .eq(BazhuayuWeeklyRaw::getWeekTag, weekTag));

        AsinImportService.StreamingFilterContext ctx =
                asinImportService.createStreamingTask(mp, IMPORT_TYPE);

        int totalRaw = client.drainNotExported(taskId, page -> {
            List<BazhuayuWeeklyRaw> pageEntities = new ArrayList<>(page.size());
            List<Map<String, String>> shapedRows = new ArrayList<>(page.size());
            Set<String> pageSeen = new HashSet<>();
            for (JsonNode raw : page) {
                String asin = BazhuayuRowMapper.extractAsin(raw);
                if (asin == null || !pageSeen.add(asin)) continue;   // 页内去重(跨页由初筛 ctx 兜底)

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
                e.setLotNo(null);
                e.setScrapedAt(LocalDateTime.now());
                pageEntities.add(e);

                shapedRows.add(BazhuayuRowMapper.shapeRow(asin, price, reviews, title));
            }
            if (!pageEntities.isEmpty()) Db.saveBatch(pageEntities, DB_BATCH_SIZE);
            asinImportService.filterPageAndAppend(ctx, shapedRows);
        }, config.getDrainMaxRows(), cancelled);

        Map<String, Object> preview = asinImportService.finishStreamingTask(ctx);
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("status", "READY");
        r.put("rawCount", totalRaw);
        r.putAll(preview);
        return r;
    }
}

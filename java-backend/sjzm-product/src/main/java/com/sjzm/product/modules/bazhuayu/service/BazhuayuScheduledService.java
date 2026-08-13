package com.sjzm.product.modules.bazhuayu.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.sjzm.product.entity.AsinImportTask;
import com.sjzm.product.mapper.AsinImportTaskMapper;
import com.sjzm.product.mapper.BazhuayuWeeklyRawMapper;
import com.sjzm.product.config.DatabaseWorkloadGate;
import com.sjzm.product.modules.bazhuayu.config.BazhuayuConfig;
import com.sjzm.product.modules.bazhuayu.entity.BazhuayuTaskMapping;
import com.sjzm.product.modules.bazhuayu.entity.BazhuayuWeeklyRaw;
import com.sjzm.product.modules.bazhuayu.entity.PremiumProduct;
import com.sjzm.product.modules.bazhuayu.mapper.PremiumProductMapper;
import com.sjzm.product.modules.bazhuayu.service.BazhuayuRunStateService.Phase;
import com.sjzm.product.service.AsinImportService;
import com.sjzm.product.service.ScoringService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Bazhuayu scheduling and console orchestration.
 *
 * <p>There are three entry points:
 * <ol>
 *   <li>Scheduled/manual drain of already collected cloud data.</li>
 *   <li>Manual cloud collection one-dragon flow: start, wait, drain.</li>
 *   <li>Stop: cooperative local cancel plus cloud stop.</li>
 * </ol>
 */
@Slf4j
@Service
public class BazhuayuScheduledService {

    private static final String IMPORT_TYPE = "BAZHUAYU_AUTO";

    private final BazhuayuClient client;
    private final BazhuayuConfigService configService;
    private final BazhuayuConfig config;
    private final BazhuayuWeeklyRawMapper rawMapper;
    private final PremiumProductMapper premiumProductMapper;
    private final AsinImportService asinImportService;
    private final ScoringService scoringService;
    private final BazhuayuRunStateService runState;
    private final BazhuayuImportControlService importControl;
    private final AsinImportTaskMapper taskMapper;
    private final ThreadPoolTaskExecutor executor;
    private final DatabaseWorkloadGate workloadGate;
    private final Set<String> activeDrainMarketplaces = ConcurrentHashMap.newKeySet();

    public BazhuayuScheduledService(BazhuayuClient client,
                                    BazhuayuConfigService configService,
                                    BazhuayuConfig config,
                                    BazhuayuWeeklyRawMapper rawMapper,
                                    PremiumProductMapper premiumProductMapper,
                                    AsinImportService asinImportService,
                                    ScoringService scoringService,
                                    BazhuayuRunStateService runState,
                                    BazhuayuImportControlService importControl,
                                    AsinImportTaskMapper taskMapper,
                                    @Qualifier("bazhuayuExecutor") ThreadPoolTaskExecutor executor,
                                    DatabaseWorkloadGate workloadGate) {
        this.client = client;
        this.configService = configService;
        this.config = config;
        this.rawMapper = rawMapper;
        this.premiumProductMapper = premiumProductMapper;
        this.asinImportService = asinImportService;
        this.scoringService = scoringService;
        this.runState = runState;
        this.importControl = importControl;
        this.taskMapper = taskMapper;
        this.executor = executor;
        this.workloadGate = workloadGate;
    }

    // ============================================================
    // Entry 1: scheduled/manual drain of already collected data.
    // ============================================================

    @Scheduled(cron = "${BAZHUAYU_CRON:0 0 3 * * MON}")
    public void scheduledWeekly() {
        log.info("Bazhuayu scheduled drain triggered");
        triggerAsync(null);
    }

    /**
     * Submit one fire-and-forget drain.
     *
     * @param marketplace target marketplace, or null for all bangdan marketplaces
     */
    public void triggerAsync(String marketplace) {
        executor.execute(() -> {
            try {
                runCollection(marketplace);
            } catch (Exception e) {
                log.error("Bazhuayu drain task failed: {}", e.getMessage(), e);
            }
        });
    }

    public record DirectTriggerResult(Long taskId, String status, boolean alreadyImported,
                                      boolean submitted, String batchNo) {}

    /** 手动按配置行的 taskId 导入，避免同站点多任务时误用主任务。 */
    public DirectTriggerResult triggerTaskAsync(String function, String marketplace, String taskId) {
        return triggerTaskAsync(function, marketplace, taskId, null);
    }

    /** 手动导入页面当前显示的云采集批次；提交异步任务前先同步校验并创建可见任务。 */
    public DirectTriggerResult triggerTaskAsync(String function, String marketplace, String taskId,
                                                BazhuayuBatchSnapshot expectedBatch) {
        if (!BazhuayuConfigService.FUNC_BANGDAN.equals(function)) {
            throw new IllegalArgumentException("当前仅榜单任务支持导入 DB");
        }
        BazhuayuTaskMapping entry = configService.findTaskEntry(function, marketplace, taskId);
        if (entry == null) {
            throw new IllegalArgumentException("八爪鱼命名任务不存在: "
                    + function + ":" + marketplace + ":" + taskId);
        }
        BazhuayuBatchSnapshot batch = expectedBatch == null
                ? null : validateLatestBatch(taskId, expectedBatch, null);
        boolean initialFilter = !Boolean.FALSE.equals(entry.getInitialFilter());
        String targetTable = initialFilter ? "competitor_products" : "premium_products";
        AsinImportService.QueuedTask queued = asinImportService.createQueuedBazhuayuTask(
                entry.getMarketplace(), IMPORT_TYPE, entry.getId(), entry.getTaskId(), entry.getTaskName(),
                entry.getTaskCategory(), initialFilter, targetTable, batch);
        String batchNo = batch == null ? null : batch.batchNo();
        if (!queued.shouldSubmit()) {
            return new DirectTriggerResult(queued.taskId(),
                    queued.alreadyImported() ? "ALREADY_IMPORTED" : "QUEUED",
                    queued.alreadyImported(), false, batchNo);
        }
        try {
            executor.execute(() -> {
                try {
                    String weekTag = scoringService.getCurrentWeekTag();
                    Map<String, Object> result = collectConfiguredTask(
                            function, marketplace, taskId, weekTag, null, batch);
                    if ("SKIPPED".equals(result.get("status"))) {
                        asinImportService.failBazhuayuTaskById(queued.taskId(),
                                "导入未执行: " + result.getOrDefault("reason", "SKIPPED"));
                    }
                } catch (Exception e) {
                    asinImportService.failBazhuayuTaskById(queued.taskId(), e.getMessage());
                    log.error("Bazhuayu task {}:{} direct drain failed: {}",
                            marketplace, taskId, e.getMessage(), e);
                }
            });
        } catch (RuntimeException e) {
            asinImportService.failBazhuayuTaskById(queued.taskId(), e.getMessage());
            throw e;
        }
        return new DirectTriggerResult(queued.taskId(), "QUEUED", false, true, batchNo);
    }

    /**
     * 一键全导：遍历所有 bangdan 任务映射，逐个锁定各自最新云采集批次后异步 drain 入库。
     * 每个任务复用 {@link #triggerTaskAsync}（含"所见即所导"批次校验 + 幂等 + 僵尸重跑）。
     * 单个任务失败/跳过不影响其它任务；同步返回每个任务的受理结果（提交/已导入/错误）。
     */
    public Map<String, Object> triggerAllBangdanTasks() {
        // bangdan 功能下全部任务（精铺 initialFilter=true + 精品 false 都纳入）
        List<BazhuayuTaskMapping> entries = configService.listTaskEntries().stream()
                .filter(e -> BazhuayuConfigService.FUNC_BANGDAN.equals(e.getFunctionKey()))
                .toList();
        List<Map<String, Object>> items = new ArrayList<>();
        int submitted = 0, alreadyImported = 0, failed = 0;
        boolean first = true;
        for (BazhuayuTaskMapping entry : entries) {
            // 每个任务都要调 statuses/v2 查最新批次；连发会触发八爪鱼 TooManyRequests(1s5次)。
            // 任务间隔 400ms 节流，确保云端状态查询不超频（首个不等）。
            if (!first) sleepQuietly(400);
            first = false;
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("marketplace", entry.getMarketplace());
            item.put("taskId", entry.getTaskId());
            item.put("taskName", entry.getTaskName());
            item.put("taskCategory", entry.getTaskCategory());
            try {
                // 锁定该任务当前最新 Finished 批次（与单个导入同口径）
                BazhuayuBatchSnapshot latest = client.getLatestBatchSnapshot(entry.getTaskId());
                latest.assertSameBatch(latest);
                DirectTriggerResult r = triggerTaskAsync(
                        BazhuayuConfigService.FUNC_BANGDAN, entry.getMarketplace(), entry.getTaskId(), latest);
                item.put("status", r.status());
                item.put("batchNo", r.batchNo());
                item.put("importTaskId", r.taskId());
                if (r.submitted()) submitted++;
                else if (r.alreadyImported()) alreadyImported++;
            } catch (Exception e) {
                failed++;
                item.put("status", "ERROR");
                item.put("error", e.getMessage());
                log.error("一键全导：任务 {}:{} 触发失败: {}",
                        entry.getMarketplace(), entry.getTaskId(), e.getMessage(), e);
            }
            items.add(item);
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("total", entries.size());
        result.put("submitted", submitted);
        result.put("alreadyImported", alreadyImported);
        result.put("failed", failed);
        result.put("items", items);
        log.info("一键全导受理完成: 总 {} / 提交 {} / 已导入 {} / 失败 {}",
                entries.size(), submitted, alreadyImported, failed);
        return result;
    }

    /** 静默 sleep（被打断即恢复中断标志，不抛异常）。用于任务间节流。 */
    private void sleepQuietly(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    /**
     * Drain bangdan cloud increments and run the initial filter. One marketplace failure does not block others.
     */
    public Map<String, Object> runCollection(String marketplace) {
        String weekTag = scoringService.getCurrentWeekTag();

        int deleted = rawMapper.delete(new LambdaQueryWrapper<BazhuayuWeeklyRaw>()
                .ne(BazhuayuWeeklyRaw::getWeekTag, weekTag));
        if (deleted > 0) {
            log.info("Cleaned {} stale Bazhuayu raw rows outside week {}", deleted, weekTag);
        }

        List<BazhuayuTaskMapping> entries = configService.listTaskEntries().stream()
                .filter(entry -> BazhuayuConfigService.FUNC_BANGDAN.equals(entry.getFunctionKey()))
                .filter(entry -> marketplace == null || marketplace.isBlank()
                        || marketplace.equalsIgnoreCase(entry.getMarketplace()))
                .toList();
        if (entries.isEmpty()) {
            log.warn("No Bazhuayu marketplaces configured; check api_config.bazhuayu_taskgroup_mapping");
            return Map.of("weekTag", weekTag, "results", List.of());
        }

        List<Map<String, Object>> results = new ArrayList<>();
        for (BazhuayuTaskMapping entry : entries) {
            String mp = entry.getMarketplace();
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("marketplace", mp);
            r.put("taskName", entry.getTaskName());
            r.put("taskCategory", entry.getTaskCategory());
            r.put("initialFilter", entry.getInitialFilter());
            try {
                BazhuayuBatchSnapshot latestBatch = client.getLatestBatchSnapshot(entry.getTaskId());
                latestBatch.assertSameBatch(latestBatch);
                r.putAll(collectConfiguredTask(BazhuayuConfigService.FUNC_BANGDAN,
                        mp, entry.getTaskId(), weekTag, null, latestBatch));
            } catch (Exception e) {
                log.error("Bazhuayu marketplace {} drain failed: {}", mp, e.getMessage(), e);
                r.put("status", "ERROR");
                r.put("error", e.getMessage());
            }
            results.add(r);
        }
        return Map.of("weekTag", weekTag, "results", results);
    }

    private List<String> resolveMarketplaces(String marketplace, Map<String, String> taskMap) {
        List<String> marketplaces = new ArrayList<>();
        if (marketplace != null && !marketplace.isBlank()) {
            if (taskMap.containsKey(marketplace)) {
                marketplaces.add(marketplace);
            } else {
                log.warn("Bazhuayu marketplace {} is not configured in task mapping", marketplace);
            }
        } else {
            marketplaces.addAll(taskMap.keySet());
        }
        return marketplaces;
    }

    // ============================================================
    // Entry 2: manual cloud collection one-dragon flow.
    // ============================================================

    /**
     * Start cloud collection asynchronously. Each task has one run-state slot to avoid duplicate starts.
     *
     * @param function    bangdan or yitushitu
     * @param marketplace target marketplace, or null for all marketplaces under this function
     * @return accepted, skipped, and missing marketplace lists
     */
    public Map<String, Object> startCloudCollect(String function, String marketplace) {
        Map<String, String> taskMap = configService.getFunctionTaskMap(function);
        List<String> marketplaces = resolveMarketplaces(marketplace, taskMap);

        List<String> accepted = new ArrayList<>();
        List<String> skipped = new ArrayList<>();
        List<String> missing = new ArrayList<>();
        for (String mp : marketplaces) {
            String taskId = taskMap.get(mp);
            if (taskId == null || taskId.isBlank()) {
                missing.add(mp);
                continue;
            }
            if (runState.tryBegin(function, mp, taskId)) {
                accepted.add(mp);
                executor.execute(() -> runOneDragon(function, mp, taskId));
            } else {
                skipped.add(mp);
            }
        }
        return Map.of("function", function, "accepted", accepted, "skipped", skipped, "missing", missing);
    }

    /** 手动按配置行启动指定 taskId；同功能同站点仍只允许一条同时运行。 */
    public Map<String, Object> startCloudCollectTask(String function, String marketplace, String taskId) {
        if (runState.tryBegin(function, marketplace, taskId)) {
            executor.execute(() -> runOneDragon(function, marketplace, taskId));
            return Map.of("function", function, "accepted", List.of(marketplace),
                    "skipped", List.of(), "missing", List.of());
        }
        return Map.of("function", function, "accepted", List.of(),
                "skipped", List.of(marketplace), "missing", List.of());
    }

    private void runOneDragon(String function, String mp, String taskId) {
        boolean isBangdan = BazhuayuConfigService.FUNC_BANGDAN.equals(function);
        try {
            runState.setPhase(function, mp, Phase.STARTING);
            String lotNo = client.startExtraction(taskId);
            runState.setLotNo(function, mp, lotNo);
            log.info("[{}:{}] cloud collection started, lotNo={}", function, mp, lotNo);

            runState.setPhase(function, mp, Phase.WAITING_CLOUD);
            BazhuayuClient.WaitResult wr = client.waitForExtraction(taskId,
                    c -> runState.setCloudCount(function, mp, c),
                    () -> runState.isCancelled(function, mp));
            switch (wr) {
                case CANCELLED -> {
                    runState.fail(function, mp, Phase.STOPPED, "cancelled by user");
                    return;
                }
                case STOPPED -> {
                    runState.fail(function, mp, Phase.STOPPED, "cloud task stopped");
                    return;
                }
                case TIMEOUT -> {
                    runState.fail(function, mp, Phase.TIMEOUT, "cloud collection wait timeout");
                    return;
                }
                case FINISHED -> {
                    // Continue to drain.
                }
            }

            if (!isBangdan) {
                // Yitushitu currently only starts/stops cloud collection; it has no local drain pipeline yet.
                runState.done(function, mp);
                log.info("[{}:{}] cloud collection finished; yitushitu is not drained locally", function, mp);
                return;
            }

            runState.setPhase(function, mp, Phase.DRAINING);
            String weekTag = scoringService.getCurrentWeekTag();
            BazhuayuBatchSnapshot latestBatch = client.getLatestBatchSnapshot(taskId).withLotNo(lotNo);
            Map<String, Object> r = collectConfiguredTask(function, mp, taskId, weekTag,
                    () -> runState.isCancelled(function, mp), latestBatch);
            int rawCount = ((Number) r.getOrDefault("rawCount", 0)).intValue();
            if (runState.isCancelled(function, mp)) {
                runState.fail(function, mp, Phase.STOPPED,
                        "drain stopped after writing " + rawCount + " rows");
            } else {
                runState.finishDrain(function, mp, rawCount);
            }
            log.info("[{}:{}] one-dragon completed, rawCount={}", function, mp, rawCount);
        } catch (Exception e) {
            log.error("[{}:{}] one-dragon failed: {}", function, mp, e.getMessage(), e);
            runState.fail(function, mp, Phase.ERROR, e.getMessage());
        }
    }

    // ============================================================
    // Entry 3: stop cloud/local collection.
    // ============================================================

    public Map<String, Object> stopTask(String function, String marketplace) {
        String taskId = configService.getTaskId(function, marketplace);
        if (taskId == null || taskId.isBlank()) {
            throw new IllegalArgumentException("Bazhuayu task " + function + ":" + marketplace + " is not configured");
        }
        return stopTask(function, marketplace, taskId);
    }

    public Map<String, Object> stopTask(String function, String marketplace, String taskId) {
        if (taskId == null || taskId.isBlank()) {
            throw new IllegalArgumentException("Bazhuayu taskId is not configured");
        }
        BazhuayuRunStateService.RunState current = runState.get(function, marketplace);
        if (current != null && taskId.equals(current.getTaskId())) {
            runState.requestCancel(function, marketplace);
        }
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("function", function);
        r.put("marketplace", marketplace);
        try {
            client.stopExtraction(taskId);
            r.put("stopped", true);
        } catch (Exception e) {
            // Keep the local cancel flag even when the cloud stop call fails.
            log.warn("[{}:{}] cloud stop failed: {}", function, marketplace, e.getMessage());
            r.put("stopped", false);
            r.put("cloudStopError", e.getMessage());
        }
        return r;
    }

    private Map<String, Object> collectConfiguredTask(
            String function,
            String marketplace,
            String taskId,
            String weekTag,
            java.util.function.BooleanSupplier cancelled,
            BazhuayuBatchSnapshot expectedBatch) {
        return workloadGate.runHeavyWrite(() -> doCollectConfiguredTask(
                function, marketplace, taskId, weekTag, cancelled, expectedBatch));
    }

    private Map<String, Object> doCollectConfiguredTask(
            String function,
            String marketplace,
            String taskId,
            String weekTag,
            java.util.function.BooleanSupplier cancelled,
            BazhuayuBatchSnapshot expectedBatch) {
        BazhuayuTaskMapping entry = configService.findTaskEntry(function, marketplace, taskId);
        if (entry == null) {
            throw new IllegalArgumentException("八爪鱼命名任务不存在: " + function + ":" + marketplace + ":" + taskId);
        }
        boolean initialFilter = entry == null || !BazhuayuConfigService.FUNC_BANGDAN.equals(function)
                || !Boolean.FALSE.equals(entry.getInitialFilter());
        BazhuayuBatchSnapshot batch = expectedBatch == null
                ? null : validateLatestBatch(taskId, expectedBatch, expectedBatch.lotNo());
        if (initialFilter) {
            return collectAndScreen(entry, weekTag, cancelled, batch);
        }
        return collectPremium(entry, weekTag, cancelled, batch);
    }

    private BazhuayuBatchSnapshot validateLatestBatch(
            String taskId,
            BazhuayuBatchSnapshot expected,
            String knownLotNo) {
        BazhuayuBatchSnapshot actual = client.getLatestBatchSnapshot(taskId);
        actual.assertSameBatch(expected);
        return knownLotNo == null || knownLotNo.isBlank() ? actual : actual.withLotNo(knownLotNo);
    }

    /** 未启用初筛的榜单任务：全部 ASIN 作为 PASS 生成可见任务，等待人工点击请求。 */
    private Map<String, Object> collectPremium(
            BazhuayuTaskMapping entry,
            String weekTag,
            java.util.function.BooleanSupplier cancelled,
            BazhuayuBatchSnapshot batch) {
        String mp = entry.getMarketplace();
        if (!activeDrainMarketplaces.add(mp)) {
            return Map.of("status", "SKIPPED", "reason", "DRAIN_ALREADY_RUNNING", "rawCount", 0);
        }

        // 加锁后所有分支都必须走 finally 释放；命中幂等直接 return 也不能漏掉 remove。
        try {
            String month = YearMonth.now().format(DateTimeFormatter.ofPattern("yyyyMM"));
            AsinImportService.StreamingFilterContext ctx = asinImportService.createStreamingTask(
                    mp, IMPORT_TYPE, entry.getId(), entry.getTaskId(), entry.getTaskName(),
                    entry.getTaskCategory(), false, "premium_products", batch);
            if (ctx.isAlreadyImported()) {
                return Map.of("status", "SKIPPED", "reason", "BATCH_ALREADY_IMPORTED",
                        "taskId", ctx.getTaskId(), "batchNo", batch == null ? null : batch.batchNo());
            }
            try {
                // 精品“导入DB”只读取页面确认的最新批次；无 lotNo 时由客户端按批次数量截断 /data/all。
                // /data/notexported 受八爪鱼“已导出”游标影响：云端明明有上千条时也可能返回 0，
                // 因此这里只用 /data/all 流式分页；精铺初筛仍保留 notexported 增量语义。
                java.util.function.Consumer<List<JsonNode>> pageHandler = page -> {
                    List<PremiumProduct> shells = new ArrayList<>(page.size());
                    List<Map<String, String>> shapedRows = new ArrayList<>(page.size());
                    Set<String> pageSeen = new HashSet<>();
                    LocalDateTime now = LocalDateTime.now();
                    for (JsonNode raw : page) {
                        String asin = BazhuayuRowMapper.extractAsin(raw);
                        if (asin == null || !pageSeen.add(asin)) continue;
                        String price = BazhuayuRowMapper.pick(raw, BazhuayuRowMapper.PRICE_KEYS);
                        String reviews = BazhuayuRowMapper.pick(raw, BazhuayuRowMapper.REVIEW_KEYS);
                        String title = BazhuayuRowMapper.pick(raw, BazhuayuRowMapper.TITLE_KEYS);

                        PremiumProduct product = new PremiumProduct();
                        product.setMarketplace(mp);
                        product.setAsin(asin);
                        product.setMonth(month);
                        product.setTitle(title);
                        product.setSource("精品榜-八爪鱼");
                        product.setWeekTag(weekTag);
                        product.setIsCurrent(1);
                        product.setBazhuayuMappingId(entry.getId());
                        product.setBazhuayuTaskId(entry.getTaskId());
                        product.setBazhuayuTaskName(entry.getTaskName());
                        product.setBazhuayuRawJson(raw.toString());
                        product.setDeleted(0);
                        product.setCreatedAt(now);
                        product.setUpdatedAt(now);
                        shells.add(product);
                        shapedRows.add(BazhuayuRowMapper.shapeRow(asin, price, reviews, title));
                    }
                    if (!shells.isEmpty()) premiumProductMapper.upsertRawBatch(shells);
                    asinImportService.appendPageWithoutInitialFilter(ctx, shapedRows);
                };
                int totalRaw = batch == null
                        ? client.fetchAllDataStreaming(entry.getTaskId(), pageHandler)
                        : client.fetchBatchDataStreaming(entry.getTaskId(), batch, pageHandler);

                Map<String, Object> result = new LinkedHashMap<>();
                result.put("rawCount", totalRaw);
                result.put("batchNo", batch == null ? null : batch.batchNo());
                result.put("status", "READY");
                result.putAll(asinImportService.finishStreamingTask(ctx));
                log.info("[精品榜:{}] 已导入任务 {}，跳过初筛，等待人工请求卖家精灵",
                        mp, ctx.getTaskId());
                return result;
            } catch (RuntimeException e) {
                asinImportService.failStreamingTask(ctx, e.getMessage());
                throw e;
            }
        } finally {
            activeDrainMarketplaces.remove(mp);
        }
    }

    private Map<String, Object> collectAndScreen(BazhuayuTaskMapping entry, String weekTag,
                                                 java.util.function.BooleanSupplier cancelled,
                                                 BazhuayuBatchSnapshot batch) {
        return collectAndScreen(entry, weekTag, cancelled, batch, null, 0);
    }

    /**
     * @param seedCtx     非空 = 续跑：复用已 seed 计数的上下文，跳过建任务/清周表；空 = 新建。
     * @param startOffset 续跑起始云端原始行 offset（新建为 0）。
     */
    private Map<String, Object> collectAndScreen(BazhuayuTaskMapping entry, String weekTag,
                                                 java.util.function.BooleanSupplier cancelled,
                                                 BazhuayuBatchSnapshot batch,
                                                 AsinImportService.StreamingFilterContext seedCtx,
                                                 int startOffset) {
        String mp = entry.getMarketplace();
        String taskId = entry.getTaskId();
        if (!activeDrainMarketplaces.add(mp)) {
            log.warn("marketplace {} drain is already running; skip duplicate trigger", mp);
            Map<String, Object> skipped = new LinkedHashMap<>();
            skipped.put("status", "SKIPPED");
            skipped.put("reason", "DRAIN_ALREADY_RUNNING");
            skipped.put("rawCount", 0);
            return skipped;
        }

        log.info("Starting Bazhuayu increment drain for marketplace {}, task {} (resume={}, startOffset={})",
                mp, taskId, seedCtx != null, startOffset);

        // 加锁后所有分支都必须走 finally 释放；命中幂等直接 return 也不能漏掉 remove。
        try {
            // 续跑复用 seed 上下文，新建走原逻辑。initialized 起始值：续跑视为已初始化（不再清周表）。
            AtomicBoolean initialized = new AtomicBoolean(seedCtx != null);
            AsinImportService.StreamingFilterContext ctx = seedCtx != null ? seedCtx
                    : asinImportService.createStreamingTask(
                            mp, IMPORT_TYPE, entry.getId(), entry.getTaskId(), entry.getTaskName(),
                            entry.getTaskCategory(), true, "competitor_products", batch);
            if (ctx.isAlreadyImported()) {
                return Map.of("status", "SKIPPED", "reason", "BATCH_ALREADY_IMPORTED",
                        "taskId", ctx.getTaskId(), "batchNo", batch == null ? null : batch.batchNo());
            }
            // 协作暂停信号：用户点“暂停”→ importControl 置位；drain 每页边界检查后停在整页。
            final Long ctxTaskId = ctx.getTaskId();
            java.util.function.BooleanSupplier pauseCheck =
                    () -> importControl.isPauseRequested(ctxTaskId)
                            || (cancelled != null && cancelled.getAsBoolean());

            try {
                java.util.function.Consumer<List<JsonNode>> pageHandler = page -> {
                    if (initialized.compareAndSet(false, true)) {
                        rawMapper.delete(new LambdaQueryWrapper<BazhuayuWeeklyRaw>()
                                .eq(BazhuayuWeeklyRaw::getMarketplace, mp)
                                .eq(BazhuayuWeeklyRaw::getWeekTag, weekTag));
                    }

                    List<BazhuayuWeeklyRaw> pageEntities = new ArrayList<>(page.size());
                    List<Map<String, String>> shapedRows = new ArrayList<>(page.size());
                    Set<String> pageSeen = new HashSet<>();
                    for (JsonNode raw : page) {
                        String asin = BazhuayuRowMapper.extractAsin(raw);
                        if (asin == null || !pageSeen.add(asin)) {
                            continue;
                        }

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
                        e.setLotNo(batch == null ? null : batch.lotNo());
                        e.setScrapedAt(LocalDateTime.now());
                        pageEntities.add(e);

                        shapedRows.add(BazhuayuRowMapper.shapeRow(asin, price, reviews, title));
                    }
                    if (!pageEntities.isEmpty()) {
                        rawMapper.insertBatchIgnoreDup(pageEntities);
                    }
                    asinImportService.filterPageAndAppend(ctx, shapedRows);
                };
                // batch 路径 startOffset==alreadyProcessed（offset 按整页原始行前移，从 0 起精确）。
                int totalRaw = batch == null
                        ? client.drainNotExported(taskId, pageHandler, config.getDrainMaxRows(), pauseCheck)
                        : client.fetchBatchDataStreaming(taskId, batch, pageHandler,
                                startOffset, startOffset, pauseCheck);

                // 暂停命中：落断点，任务置 PAUSED，可续跑。
                if (importControl.isPauseRequested(ctxTaskId)
                        || (cancelled != null && cancelled.getAsBoolean())) {
                    int nextOffset = startOffset + totalRaw;
                    asinImportService.pauseStreamingTask(ctx, nextOffset);
                    importControl.clear(ctxTaskId);
                    Map<String, Object> paused = new LinkedHashMap<>();
                    paused.put("status", "PAUSED");
                    paused.put("rawCount", totalRaw);
                    paused.put("resumeOffset", nextOffset);
                    paused.put("taskId", ctxTaskId);
                    paused.put("batchNo", batch == null ? null : batch.batchNo());
                    return paused;
                }

                Map<String, Object> r = new LinkedHashMap<>();
                r.put("status", "READY");
                r.put("rawCount", totalRaw);
                r.put("batchNo", batch == null ? null : batch.batchNo());
                if (!initialized.get()) {
                    log.info("marketplace {} has no not-exported increment; skip drain", mp);
                }

                Map<String, Object> preview = asinImportService.finishStreamingTask(ctx);
                r.putAll(preview);
                return r;
            } catch (RuntimeException e) {
                asinImportService.failStreamingTask(ctx, e.getMessage());
                throw e;
            } finally {
                importControl.clear(ctxTaskId);
            }
        } finally {
            activeDrainMarketplaces.remove(mp);
        }
    }

    // ============================================================
    // Entry 4: 导入任务 暂停 / 续跑 / 重新获取（仅初筛榜单，batch 路径）。
    // ============================================================

    /** 暂停一个正在导入的任务：置协作信号，worker 处理完当前页后收口 PAUSED。 */
    public Map<String, Object> pauseImportTask(Long taskId) {
        AsinImportTask task = taskMapper.selectById(taskId);
        if (task == null) throw new IllegalArgumentException("导入任务不存在: " + taskId);
        String st = task.getTaskStatus();
        if (!"RUNNING".equals(st) && !"DRAINING".equals(st)) {
            throw new IllegalStateException("仅运行中(RUNNING/DRAINING)的任务可暂停，当前状态: " + st);
        }
        importControl.requestPause(taskId);
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("taskId", taskId);
        r.put("status", "PAUSE_REQUESTED");
        return r;
    }

    /** 续跑一个 PAUSED/ERROR/INTERRUPTED 的导入任务：从断点 offset 继续拉取同批次。 */
    public Map<String, Object> resumeImportTask(Long taskId) {
        AsinImportTask task = taskMapper.selectById(taskId);
        if (task == null) throw new IllegalArgumentException("导入任务不存在: " + taskId);
        String st = task.getTaskStatus();
        if (!"PAUSED".equals(st) && !"ERROR".equals(st) && !"INTERRUPTED".equals(st)) {
            throw new IllegalStateException("仅 PAUSED/ERROR/INTERRUPTED 任务可续跑，当前状态: " + st);
        }
        if (Boolean.FALSE.equals(task.getInitialFilter())) {
            throw new IllegalStateException("精品(直入)任务暂不支持续跑，请用重新获取");
        }
        if (task.getBazhuayuBatchNo() == null || task.getBazhuayuBatchNo().isBlank()) {
            throw new IllegalStateException("任务无云端批次信息，无法续跑，请用重新获取");
        }
        BazhuayuTaskMapping entry = configService.findTaskEntry(
                BazhuayuConfigService.FUNC_BANGDAN, task.getMarketplace(), task.getBazhuayuTaskId());
        if (entry == null) {
            throw new IllegalStateException("八爪鱼命名任务不存在，无法续跑: "
                    + task.getMarketplace() + ":" + task.getBazhuayuTaskId());
        }
        BazhuayuBatchSnapshot batch = new BazhuayuBatchSnapshot(
                task.getBazhuayuBatchNo(), task.getBazhuayuLotNo(),
                task.getBazhuayuBatchStartTime(), null, task.getBazhuayuBatchEndTime(),
                task.getBazhuayuBatchCount() == null ? 0 : task.getBazhuayuBatchCount(), "Finished");
        int startOffset = task.getResumeOffset() == null ? 0 : task.getResumeOffset();
        importControl.clear(taskId);
        AsinImportService.StreamingFilterContext ctx = asinImportService.beginResumeStreamingTask(taskId);
        executor.execute(() -> {
            try {
                String weekTag = scoringService.getCurrentWeekTag();
                workloadGate.runHeavyWrite(() ->
                        collectAndScreen(entry, weekTag, null, batch, ctx, startOffset));
            } catch (Exception e) {
                asinImportService.failStreamingTask(ctx, "续跑失败: " + e.getMessage());
                log.error("导入任务 {} 续跑失败: {}", taskId, e.getMessage(), e);
            }
        });
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("taskId", taskId);
        r.put("status", "RESUMED");
        r.put("startOffset", startOffset);
        return r;
    }

    /** 重新获取：删旧任务数据后按同配置重拉云端最新批次（走标准 trigger 幂等+校验链路）。 */
    public Map<String, Object> refetchImportTask(Long taskId) {
        AsinImportTask task = taskMapper.selectById(taskId);
        if (task == null) throw new IllegalArgumentException("导入任务不存在: " + taskId);
        String st = task.getTaskStatus();
        if ("RUNNING".equals(st) || "DRAINING".equals(st) || "QUEUED".equals(st)) {
            throw new IllegalStateException("任务运行中，请先暂停再重新获取，当前状态: " + st);
        }
        if (Boolean.FALSE.equals(task.getInitialFilter())) {
            throw new IllegalStateException("精品(直入)任务暂不支持重新获取");
        }
        BazhuayuTaskMapping entry = configService.findTaskEntry(
                BazhuayuConfigService.FUNC_BANGDAN, task.getMarketplace(), task.getBazhuayuTaskId());
        if (entry == null) {
            throw new IllegalStateException("八爪鱼命名任务不存在，无法重新获取: "
                    + task.getMarketplace() + ":" + task.getBazhuayuTaskId());
        }
        // 先清旧任务（含 results/skip/raw），使同批次可真正重导。
        importControl.clear(taskId);
        asinImportService.deleteBazhuayuTask(taskId);
        // 重拉云端当前最新 Finished 批次（与配置面板“导入DB”同口径）。
        BazhuayuBatchSnapshot latest = client.getLatestBatchSnapshot(entry.getTaskId());
        latest.assertSameBatch(latest);
        DirectTriggerResult r = triggerTaskAsync(
                BazhuayuConfigService.FUNC_BANGDAN, entry.getMarketplace(), entry.getTaskId(), latest);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("oldTaskId", taskId);
        result.put("newTaskId", r.taskId());
        result.put("status", r.status());
        result.put("batchNo", r.batchNo());
        return result;
    }
}

package com.sjzm.product.modules.bazhuayu.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.sjzm.product.mapper.BazhuayuWeeklyRawMapper;
import com.sjzm.product.modules.bazhuayu.config.BazhuayuConfig;
import com.sjzm.product.modules.bazhuayu.entity.BazhuayuWeeklyRaw;
import com.sjzm.product.modules.bazhuayu.service.BazhuayuRunStateService.Phase;
import com.sjzm.product.service.AsinImportService;
import com.sjzm.product.service.ScoringService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

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
    private final AsinImportService asinImportService;
    private final ScoringService scoringService;
    private final BazhuayuRunStateService runState;
    private final ThreadPoolTaskExecutor executor;
    private final Set<String> activeDrainMarketplaces = ConcurrentHashMap.newKeySet();

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

        Map<String, String> taskMap = configService.getMarketplaceTaskMap();
        List<String> marketplaces = resolveMarketplaces(marketplace, taskMap);
        if (marketplaces.isEmpty()) {
            log.warn("No Bazhuayu marketplaces configured; check api_config.bazhuayu_taskgroup_mapping");
            return Map.of("weekTag", weekTag, "results", List.of());
        }

        List<Map<String, Object>> results = new ArrayList<>();
        for (String mp : marketplaces) {
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("marketplace", mp);
            try {
                r.putAll(collectAndScreen(mp, taskMap.get(mp), weekTag, null));
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
            Map<String, Object> r = collectAndScreen(mp, taskId, weekTag,
                    () -> runState.isCancelled(function, mp));
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
        runState.requestCancel(function, marketplace);
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

    private Map<String, Object> collectAndScreen(String mp, String taskId, String weekTag,
                                                 java.util.function.BooleanSupplier cancelled) {
        if (!activeDrainMarketplaces.add(mp)) {
            log.warn("marketplace {} drain is already running; skip duplicate trigger", mp);
            Map<String, Object> skipped = new LinkedHashMap<>();
            skipped.put("status", "SKIPPED");
            skipped.put("reason", "DRAIN_ALREADY_RUNNING");
            skipped.put("rawCount", 0);
            return skipped;
        }

        log.info("Starting Bazhuayu increment drain for marketplace {}, task {}", mp, taskId);

        AtomicBoolean initialized = new AtomicBoolean(false);
        AtomicReference<AsinImportService.StreamingFilterContext> ctxRef = new AtomicReference<>();

        try {
            int totalRaw = client.drainNotExported(taskId, page -> {
                if (initialized.compareAndSet(false, true)) {
                    rawMapper.delete(new LambdaQueryWrapper<BazhuayuWeeklyRaw>()
                            .eq(BazhuayuWeeklyRaw::getMarketplace, mp)
                            .eq(BazhuayuWeeklyRaw::getWeekTag, weekTag));
                    ctxRef.set(asinImportService.createStreamingTask(mp, IMPORT_TYPE));
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
                    e.setLotNo(null);
                    e.setScrapedAt(LocalDateTime.now());
                    pageEntities.add(e);

                    shapedRows.add(BazhuayuRowMapper.shapeRow(asin, price, reviews, title));
                }
                if (!pageEntities.isEmpty()) {
                    rawMapper.insertBatchIgnoreDup(pageEntities);
                }
                asinImportService.filterPageAndAppend(ctxRef.get(), shapedRows);
            }, config.getDrainMaxRows(), cancelled);

            Map<String, Object> r = new LinkedHashMap<>();
            r.put("status", "READY");
            r.put("rawCount", totalRaw);
            if (!initialized.get()) {
                log.info("marketplace {} has no not-exported increment; skip drain", mp);
                r.put("totalCount", 0);
                r.put("passCount", 0);
                r.put("priceFailCount", 0);
                r.put("reviewFailCount", 0);
                r.put("duplicateCount", 0);
                r.put("skipCount", 0);
                r.put("skipMainCount", 0);
                r.put("skipBlacklistCount", 0);
                r.put("batchTotal", 0);
                r.put("discardedAsins", 0);
                return r;
            }

            Map<String, Object> preview = asinImportService.finishStreamingTask(ctxRef.get());
            r.putAll(preview);
            return r;
        } catch (RuntimeException e) {
            asinImportService.failStreamingTask(ctxRef.get(), e.getMessage());
            throw e;
        } finally {
            activeDrainMarketplaces.remove(mp);
        }
    }
}

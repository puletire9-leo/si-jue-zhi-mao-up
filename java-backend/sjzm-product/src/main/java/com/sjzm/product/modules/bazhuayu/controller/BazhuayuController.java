package com.sjzm.product.modules.bazhuayu.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sjzm.common.Result;
import com.sjzm.product.entity.AsinImportTask;
import com.sjzm.product.mapper.AsinImportTaskMapper;
import com.sjzm.product.mapper.BazhuayuWeeklyRawMapper;
import com.sjzm.product.modules.bazhuayu.entity.BazhuayuWeeklyRaw;
import com.sjzm.product.modules.bazhuayu.entity.BazhuayuTaskMapping;
import com.sjzm.product.modules.bazhuayu.service.BazhuayuClient;
import com.sjzm.product.modules.bazhuayu.service.BazhuayuBatchSnapshot;
import com.sjzm.product.modules.bazhuayu.service.BazhuayuCloudStatsService;
import com.sjzm.product.modules.bazhuayu.service.BazhuayuConfigService;
import com.sjzm.product.modules.bazhuayu.service.BazhuayuImageSearchService;
import com.sjzm.product.modules.bazhuayu.service.BazhuayuRunStateService;
import com.sjzm.product.modules.bazhuayu.service.BazhuayuScheduledService;
import com.sjzm.product.modules.requestcenter.entity.SellerspriteRequestRun;
import com.sjzm.product.modules.requestcenter.service.SellerspriteRequestCenterService;
import com.sjzm.product.service.ScoringService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 八爪鱼自动采集模块。
 * 前缀 /api/v1/modules/bazhuayu（网关 + nginx 已覆盖 /modules/**）。
 * 采集→初筛在本模块；确认执行复用现有 /api/v1/asin-import/execute。
 */
@RestController
@RequestMapping("/api/v1/modules/bazhuayu")
@RequiredArgsConstructor
@Tag(name = "八爪鱼自动采集", description = "定时云端采集 → 入库 → 初筛 → 前端确认")
public class BazhuayuController {

    private static final String IMPORT_TYPE = "BAZHUAYU_AUTO";

    private final BazhuayuScheduledService scheduledService;
    private final BazhuayuConfigService configService;
    private final BazhuayuRunStateService runStateService;
    private final BazhuayuCloudStatsService cloudStatsService;
    private final BazhuayuClient client;
    private final BazhuayuImageSearchService imageSearchService;
    private final BazhuayuWeeklyRawMapper rawMapper;
    private final AsinImportTaskMapper taskMapper;
    private final ScoringService scoringService;
    private final SellerspriteRequestCenterService requestCenterService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @org.springframework.beans.factory.annotation.Value("${spring.datasource.url:}")
    private String datasourceUrl;
    @org.springframework.beans.factory.annotation.Value("${spring.profiles.active:default}")
    private String activeProfile;

    @PostMapping("/trigger")
    @Operation(summary = "导入页面确认的最新云采集批次（异步，不启动云端）")
    public Result<Map<String, Object>> trigger(
            @RequestParam(defaultValue = "bangdan") String function,
            @RequestParam(required = false) String marketplace,
            @RequestParam(required = false) String taskId,
            @RequestParam(required = false) String batchNo,
            @RequestParam(required = false) String batchStartTime,
            @RequestParam(required = false) String batchEndTime,
            @RequestParam(defaultValue = "0") int batchCount) {
        if (taskId != null && !taskId.isBlank() && marketplace != null && !marketplace.isBlank()) {
            // 兼容部署前已打开的旧前端：旧页面不会携带批次参数，后端自动锁定当前最新 Finished 批次。
            // 新前端仍携带页面显示的批次元数据，继续执行严格的“所见即所导”校验。
            BazhuayuBatchSnapshot expected;
            if (batchNo == null || batchNo.isBlank() || batchStartTime == null || batchStartTime.isBlank()) {
                expected = client.getLatestBatchSnapshot(taskId);
                expected.assertSameBatch(expected);
            } else {
                expected = BazhuayuBatchSnapshot.expected(
                        batchNo, batchStartTime, batchEndTime, batchCount);
            }
            scheduledService.triggerTaskAsync(function, marketplace, taskId, expected);
            batchNo = expected.batchNo();
        } else {
            scheduledService.triggerAsync(marketplace);
        }
        return Result.success(Map.of("status", "TRIGGERED",
                "marketplace", marketplace == null ? "ALL" : marketplace,
                "batchNo", batchNo == null ? "" : batchNo));
    }

    @PostMapping("/start-collect")
    @Operation(summary = "启动云端采集一条龙（启动→等待采完→榜单则drain入库初筛，全异步）")
    public Result<Map<String, Object>> startCollect(
            @RequestParam(defaultValue = "bangdan") String function,
            @RequestParam(required = false) String marketplace,
            @RequestParam(required = false) String taskId) {
        return Result.success(taskId != null && !taskId.isBlank() && marketplace != null
                ? scheduledService.startCloudCollectTask(function, marketplace, taskId)
                : scheduledService.startCloudCollect(function, marketplace));
    }

    @PostMapping("/stop-collect")
    @Operation(summary = "停止采集：协作式取消 + 调云端 stopExtraction（需团队版权限）")
    public Result<Map<String, Object>> stopCollect(
            @RequestParam(defaultValue = "bangdan") String function,
            @RequestParam String marketplace,
            @RequestParam(required = false) String taskId) {
        return Result.success(taskId != null && !taskId.isBlank()
                ? scheduledService.stopTask(function, marketplace, taskId)
                : scheduledService.stopTask(function, marketplace));
    }

    @GetMapping("/run-state")
    @Operation(summary = "查询 6 任务一条龙运行态（内存，含云端实时进度），供前端轮询")
    public Result<Collection<BazhuayuRunStateService.RunState>> runState() {
        return Result.success(runStateService.all());
    }

    @GetMapping("/overview")
    @Operation(summary = "查询八爪鱼控制台总览：三段口径——当前运行(内存) / 本周(ISO 周) / 历史累计(全量)")
    public Result<Map<String, Object>> overview() {
        String weekTag = scoringService.getCurrentWeekTag();
        java.time.LocalDateTime weekStartDt = weekStartDateTime();

        // 历史全量：一次拉齐；本周切片通过 createdAt >= weekStart 判定。
        // asin_import_tasks 已按 (import_type, marketplace) 索引；BAZHUAYU_AUTO 数据量小(周级几十条)，全量扫描无压力。
        List<AsinImportTask> allTasks = taskMapper.selectList(
                new LambdaQueryWrapper<AsinImportTask>()
                        .eq(AsinImportTask::getImportType, IMPORT_TYPE)
                        .orderByDesc(AsinImportTask::getId));
        List<AsinImportTask> weekTasks = allTasks.stream()
                .filter(t -> t.getCreatedAt() != null && !t.getCreatedAt().isBefore(weekStartDt))
                .toList();
        Map<Long, SellerspriteRequestRun> sellerspriteRuns = requestCenterService
                .findLatestAsinRunsBySourceTaskIds(allTasks.stream().map(AsinImportTask::getId).toList());
        List<BazhuayuWeeklyRaw> raws = rawMapper.selectList(
                new LambdaQueryWrapper<BazhuayuWeeklyRaw>()
                        .eq(BazhuayuWeeklyRaw::getWeekTag, weekTag));

        Map<String, BazhuayuRunStateService.RunState> runStateMap = runStateService.all().stream()
                .collect(Collectors.toMap(
                        BazhuayuRunStateService.RunState::getTaskKey,
                        state -> state,
                        (left, right) -> left));
        Map<String, Long> weeklyRawCountByMarketplace = raws.stream()
                .collect(Collectors.groupingBy(BazhuayuWeeklyRaw::getMarketplace, LinkedHashMap::new, Collectors.counting()));
        Map<String, List<AsinImportTask>> weekTasksByMp = weekTasks.stream()
                .collect(Collectors.groupingBy(AsinImportTask::getMarketplace, LinkedHashMap::new, Collectors.toList()));
        Map<String, List<AsinImportTask>> allTasksByMp = allTasks.stream()
                .collect(Collectors.groupingBy(AsinImportTask::getMarketplace, LinkedHashMap::new, Collectors.toList()));

        Set<String> marketplaces = new LinkedHashSet<>();
        marketplaces.addAll(List.of("US", "UK", "DE"));
        marketplaces.addAll(weeklyRawCountByMarketplace.keySet());
        marketplaces.addAll(allTasksByMp.keySet());
        marketplaces.addAll(runStateMap.values().stream()
                .map(BazhuayuRunStateService.RunState::getMarketplace)
                .collect(Collectors.toCollection(LinkedHashSet::new)));

        List<Map<String, Object>> marketplaceRows = new ArrayList<>();
        for (String marketplace : marketplaces) {
            BazhuayuRunStateService.RunState state = runStateMap.get(BazhuayuRunStateService.key("bangdan", marketplace));
            List<AsinImportTask> mpWeekTasks = weekTasksByMp.getOrDefault(marketplace, List.of());
            List<AsinImportTask> mpAllTasks = allTasksByMp.getOrDefault(marketplace, List.of());
            AsinImportTask latestTask = mpAllTasks.isEmpty() ? null : mpAllTasks.get(0);

            Map<String, Long> weekStatus = statusCounts(mpWeekTasks);
            Map<String, Long> lifetimeStatus = statusCounts(mpAllTasks);

            // 当前运行：只看内存态非终态（服务重启即清空，与 DB 中残留 RUNNING 无关）
            boolean nowRunning = state != null && isRunningPhase(state.getPhase());

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("marketplace", marketplace);
            // 当前运行段
            row.put("currentPhase", state != null ? state.getPhase() : BazhuayuRunStateService.Phase.IDLE);
            row.put("currentRunning", nowRunning);
            row.put("currentCloudExtractCount", state != null ? state.getCloudExtractCount() : 0);
            row.put("currentDrainedRows", state != null ? state.getDrainedRows() : 0);
            row.put("currentError", state != null ? state.getError() : null);
            // 本周段
            row.put("weeklyRawCount", weeklyRawCountByMarketplace.getOrDefault(marketplace, 0L));
            row.put("weekTaskCount", mpWeekTasks.size());
            row.put("weekReadyCount", weekStatus.getOrDefault("READY", 0L));
            row.put("weekRunningCount", weekStatus.getOrDefault("RUNNING", 0L));
            row.put("weekDoneCount", weekStatus.getOrDefault("DONE", 0L));
            row.put("weekErrorCount", weekStatus.getOrDefault("ERROR", 0L));
            row.put("weekPausedCount", weekStatus.getOrDefault("PAUSED", 0L));
            // 历史累计段
            row.put("lifetimeTaskCount", mpAllTasks.size());
            row.put("lifetimeDoneCount", lifetimeStatus.getOrDefault("DONE", 0L));
            row.put("lifetimeErrorCount", lifetimeStatus.getOrDefault("ERROR", 0L));
            row.put("latestTask", latestTask != null ? taskToMap(latestTask, sellerspriteRuns) : null);
            // 云端行数快照（进程内缓存, 每小时定时刷 + 前端可手动刷）
            // 榜单 taskId 一定接进了业务链路; 以图识图独立展示, 不参与其它段汇总
            row.put("cloudStatsBangdan", cloudStatsService.get(BazhuayuConfigService.FUNC_BANGDAN, marketplace));
            row.put("cloudStatsYitushitu", cloudStatsService.get(BazhuayuConfigService.FUNC_YITUSHITU, marketplace));
            marketplaceRows.add(row);
        }

        long currentRunningTotal = runStateService.all().stream()
                .filter(s -> isRunningPhase(s.getPhase()))
                .count();
        long cloudExtractTotal = runStateService.all().stream()
                .filter(s -> isRunningPhase(s.getPhase()))
                .mapToInt(BazhuayuRunStateService.RunState::getCloudExtractCount)
                .sum();

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("weekTag", weekTag);
        data.put("weekStart", weekStartDt.toString());
        data.put("currentStates", runStateService.all());
        data.put("marketplaces", marketplaceRows);
        data.put("weekTasks", weekTasks.stream().map(task -> taskToMap(task, sellerspriteRuns)).toList());
        data.put("lifetimeTasks", allTasks.stream().map(task -> taskToMap(task, sellerspriteRuns)).toList());
        // 历史累计概览（跨站点汇总）
        Map<String, Long> lifetimeStatusAll = statusCounts(allTasks);
        Map<String, Long> weekStatusAll = statusCounts(weekTasks);
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("currentRunning", currentRunningTotal);
        summary.put("currentCloudExtractCount", cloudExtractTotal);
        summary.put("weeklyRawCount", (long) raws.size());
        summary.put("weekTaskCount", (long) weekTasks.size());
        summary.put("weekDoneCount", weekStatusAll.getOrDefault("DONE", 0L));
        summary.put("weekErrorCount", weekStatusAll.getOrDefault("ERROR", 0L));
        summary.put("lifetimeTaskCount", (long) allTasks.size());
        summary.put("lifetimeDoneCount", lifetimeStatusAll.getOrDefault("DONE", 0L));
        summary.put("lifetimeErrorCount", lifetimeStatusAll.getOrDefault("ERROR", 0L));
        data.put("summary", summary);
        data.put("datasource", parseDatasource(datasourceUrl, activeProfile));
        return Result.success(data);
    }

    /**
     * 从 spring.datasource.url 解析出 host:port/database，前端顶部标签用。
     * 仅只读展示，不返回用户名/密码。
     */
    static Map<String, String> parseDatasource(String url, String profile) {
        Map<String, String> ds = new LinkedHashMap<>();
        ds.put("profile", profile == null ? "default" : profile);
        if (url == null || url.isBlank()) {
            ds.put("host", "?");
            ds.put("port", "?");
            ds.put("database", "?");
            return ds;
        }
        // jdbc:mysql://host:port/database?...
        try {
            int schemeEnd = url.indexOf("://");
            String rest = schemeEnd >= 0 ? url.substring(schemeEnd + 3) : url;
            int qMark = rest.indexOf('?');
            if (qMark >= 0) {
                rest = rest.substring(0, qMark);
            }
            int slash = rest.indexOf('/');
            String hostPort = slash >= 0 ? rest.substring(0, slash) : rest;
            String db = slash >= 0 ? rest.substring(slash + 1) : "";
            int colon = hostPort.indexOf(':');
            ds.put("host", colon >= 0 ? hostPort.substring(0, colon) : hostPort);
            ds.put("port", colon >= 0 ? hostPort.substring(colon + 1) : "");
            ds.put("database", db);
        } catch (Exception e) {
            ds.put("host", "?");
            ds.put("port", "?");
            ds.put("database", "?");
        }
        return ds;
    }

    private static Map<String, Long> statusCounts(List<AsinImportTask> tasks) {
        return tasks.stream().collect(Collectors.groupingBy(
                t -> t.getTaskStatus() == null ? "UNKNOWN" : t.getTaskStatus(),
                Collectors.counting()));
    }

    private static boolean isRunningPhase(BazhuayuRunStateService.Phase phase) {
        return phase == BazhuayuRunStateService.Phase.STARTING
                || phase == BazhuayuRunStateService.Phase.WAITING_CLOUD
                || phase == BazhuayuRunStateService.Phase.DRAINING;
    }

    @GetMapping("/weekly-raw")
    @Operation(summary = "分页查询本周原始采集数据")
    public Result<Map<String, Object>> weeklyRaw(
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "50") long size,
            @RequestParam(required = false) String marketplace) {
        String weekTag = scoringService.getCurrentWeekTag();
        long safeSize = Math.min(Math.max(size, 1), 500);
        long safePage = Math.max(page, 1);
        long offset = (safePage - 1) * safeSize;

        LambdaQueryWrapper<BazhuayuWeeklyRaw> countQw = new LambdaQueryWrapper<BazhuayuWeeklyRaw>()
                .eq(BazhuayuWeeklyRaw::getWeekTag, weekTag);
        if (marketplace != null && !marketplace.isBlank()) {
            countQw.eq(BazhuayuWeeklyRaw::getMarketplace, marketplace);
        }
        Long total = rawMapper.selectCount(countQw);

        // 手动分页（本服务未装 MyBatis-Plus 分页拦截器，用 LIMIT 兜底）
        LambdaQueryWrapper<BazhuayuWeeklyRaw> qw = new LambdaQueryWrapper<BazhuayuWeeklyRaw>()
                .eq(BazhuayuWeeklyRaw::getWeekTag, weekTag)
                .orderByDesc(BazhuayuWeeklyRaw::getScrapedAt)
                .last("LIMIT " + offset + ", " + safeSize);
        if (marketplace != null && !marketplace.isBlank()) {
            qw.eq(BazhuayuWeeklyRaw::getMarketplace, marketplace);
        }
        List<BazhuayuWeeklyRaw> records = rawMapper.selectList(qw);

        Map<String, Object> data = new java.util.LinkedHashMap<>();
        data.put("records", records);
        data.put("total", total == null ? 0 : total);
        data.put("current", safePage);
        data.put("size", safeSize);
        return Result.success(data);
    }

    @GetMapping("/latest-tasks")
    @Operation(summary = "本周自动初筛任务列表（供前端确认）")
    public Result<List<AsinImportTask>> latestTasks() {
        String weekTag = scoringService.getCurrentWeekTag();
        List<AsinImportTask> tasks = taskMapper.selectList(
                new LambdaQueryWrapper<AsinImportTask>()
                        .eq(AsinImportTask::getImportType, IMPORT_TYPE)
                        .ge(AsinImportTask::getCreatedAt, weekStart())
                        .orderByDesc(AsinImportTask::getId));
        return Result.success(tasks);
    }

    @PutMapping("/config/mapping")
    @Operation(summary = "更新任务组→站点→任务ID 映射(JSON)")
    public Result<Void> updateMapping(@RequestBody Map<String, Object> body) {
        Object mapping = body.get("mapping");
        if (mapping == null) throw new IllegalArgumentException("mapping 不能为空");
        try {
            // 客户端可传 JSON 字符串或嵌套对象，统一序列化成 JSON 字符串入库
            String json = (mapping instanceof String s) ? s : objectMapper.writeValueAsString(mapping);
            configService.updateTaskMapping(json);
        } catch (Exception e) {
            throw new IllegalArgumentException("映射序列化失败: " + e.getMessage());
        }
        return Result.success();
    }

    @GetMapping("/config/mapping")
    @Operation(summary = "读回当前生效的任务映射（DB 优先，env 回退，含来源标识）",
            description = "返回 {mapping:{function:{marketplace:taskId}}, fromDb:boolean}。前端 CRUD 面板用来渲染。")
    public Result<Map<String, Object>> getMapping() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("mapping", configService.getMapping());
        data.put("taskNames", configService.getTaskNames());
        data.put("entries", configService.listTaskEntries());
        data.put("fromDb", configService.isMappingFromDb());
        return Result.success(data);
    }

    @GetMapping("/cloud-stats")
    @Operation(summary = "云端行数快照（进程内内存缓存）",
            description = "返回每个 (function, marketplace) 的云端已采行数 + 上次同步时间。定时任务每小时刷; 前端可点手动刷新。")
    public Result<Map<String, BazhuayuCloudStatsService.CloudStat>> cloudStats() {
        return Result.success(cloudStatsService.snapshot());
    }

    @PostMapping("/cloud-stats/refresh")
    @Operation(summary = "立刻刷新云端行数（不带参数=全刷；带 function+marketplace=单条刷）")
    public Result<Map<String, Object>> refreshCloudStats(
            @RequestParam(required = false) String function,
            @RequestParam(required = false) String marketplace,
            @RequestParam(required = false) String taskId) {
        Map<String, Object> data = new LinkedHashMap<>();
        if (function != null && !function.isBlank() && marketplace != null && !marketplace.isBlank()) {
            String effectiveTaskId = taskId != null && !taskId.isBlank()
                    ? taskId : configService.getTaskId(function, marketplace);
            boolean ok = cloudStatsService.refreshOne(function, marketplace, effectiveTaskId);
            data.put("refreshed", ok ? 1 : 0);
            data.put("stat", cloudStatsService.getByTaskId(effectiveTaskId));
        } else {
            data.put("refreshed", cloudStatsService.refreshAll());
            data.put("snapshot", cloudStatsService.snapshot());
        }
        return Result.success(data);
    }

    @PostMapping("/config/mapping/entry")
    @Operation(summary = "新增或更新单条映射(function+marketplace → taskId)",
            description = "面板行内保存/新增按钮用。写入 DB 会覆盖 env 生效。")
    public Result<Map<String, Map<String, String>>> upsertMappingEntry(@RequestBody Map<String, String> body) {
        String function = body.get("function");
        String marketplace = body.get("marketplace");
        String taskId = body.get("taskId");
        String taskName = body.get("taskName");
        return Result.success(configService.upsertMappingEntry(function, marketplace, taskId, taskName));
    }

    @PostMapping("/config/task-entry")
    @Operation(summary = "新增八爪鱼命名任务，同功能同站点可多条")
    public Result<BazhuayuTaskMapping> createTaskEntry(@RequestBody Map<String, Object> body) {
        return Result.success(configService.createTaskEntry(
                String.valueOf(body.get("function")),
                String.valueOf(body.get("marketplace")),
                String.valueOf(body.get("taskId")),
                String.valueOf(body.get("taskName")),
                body.get("taskCategory") == null ? "默认" : String.valueOf(body.get("taskCategory")),
                !Boolean.FALSE.equals(body.get("initialFilter"))));
    }

    @PutMapping("/config/task-entry/{id}")
    @Operation(summary = "更新八爪鱼命名任务")
    public Result<BazhuayuTaskMapping> updateTaskEntry(
            @PathVariable Long id, @RequestBody Map<String, Object> body) {
        return Result.success(configService.updateTaskEntry(
                id,
                String.valueOf(body.get("taskId")),
                String.valueOf(body.get("taskName")),
                body.get("taskCategory") == null ? "默认" : String.valueOf(body.get("taskCategory")),
                !Boolean.FALSE.equals(body.get("initialFilter"))));
    }

    @DeleteMapping("/config/task-entry/{id}")
    @Operation(summary = "删除八爪鱼命名任务")
    public Result<Void> deleteTaskEntry(@PathVariable Long id) {
        configService.deleteTaskEntry(id);
        return Result.success();
    }

    @DeleteMapping("/config/mapping/entry")
    @Operation(summary = "删除单条映射(function+marketplace)",
            description = "面板行删除按钮用。若删空则清除 DB 记录, 让代码回退到 env(dev.env)。")
    public Result<Map<String, Map<String, String>>> deleteMappingEntry(
            @RequestParam String function,
            @RequestParam String marketplace) {
        return Result.success(configService.deleteMappingEntry(function, marketplace));
    }

    @PostMapping("/mark-all-exported")
    @Operation(summary = "清积压(方案Y)：把历史未导出数据全标记已导出，不入库。⚠️不可逆")
    public Result<Map<String, Object>> markAllExported(@RequestParam String marketplace) {
        Map<String, String> taskMap = configService.getMarketplaceTaskMap();
        String taskId = taskMap.get(marketplace);
        if (taskId == null) {
            throw new IllegalArgumentException("站点 " + marketplace + " 未在八爪鱼任务映射中配置");
        }
        int marked = client.markAllExported(taskId);
        return Result.success(Map.of("marketplace", marketplace, "markedRows", marked));
    }

    @PostMapping("/image-search")
    @Operation(summary = "以图识图：对一个 ASIN 发起英国 stylesnap 视觉搜索（同步等待云端采集，约数分钟）")
    public Result<List<com.sjzm.product.modules.bazhuayu.entity.BazhuayuImageSearchResult>> imageSearch(
            @RequestBody Map<String, Object> body) {
        Object asin = body.get("asin");
        if (asin == null || asin.toString().isBlank()) {
            throw new IllegalArgumentException("asin 不能为空");
        }
        boolean forceRefresh = Boolean.TRUE.equals(body.get("forceRefresh"))
                || "true".equalsIgnoreCase(String.valueOf(body.get("forceRefresh")));
        return Result.success(imageSearchService.searchByAsin(asin.toString(), forceRefresh));
    }

    @GetMapping("/image-search/{asin}")
    @Operation(summary = "查询以图识图缓存结果（不触发采集）")
    public Result<List<com.sjzm.product.modules.bazhuayu.entity.BazhuayuImageSearchResult>> getImageSearch(
            @PathVariable String asin) {
        return Result.success(imageSearchService.listResults(asin));
    }

    /** 本周一 00:00 字符串（供旧接口 latestTasks 使用 String 比较） */
    private String weekStart() {
        java.time.LocalDate monday = java.time.LocalDate.now()
                .with(java.time.temporal.WeekFields.ISO.dayOfWeek(), 1);
        return monday + " 00:00:00";
    }

    /** 本周一 00:00 的 LocalDateTime，用于精确的时间比较（overview 用） */
    private java.time.LocalDateTime weekStartDateTime() {
        java.time.LocalDate monday = java.time.LocalDate.now()
                .with(java.time.temporal.WeekFields.ISO.dayOfWeek(), 1);
        return monday.atStartOfDay();
    }

    private Map<String, Object> taskToMap(AsinImportTask task,
                                          Map<Long, SellerspriteRequestRun> sellerspriteRuns) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", task.getId());
        item.put("marketplace", task.getMarketplace());
        item.put("importType", task.getImportType());
        item.put("bazhuayuMappingId", task.getBazhuayuMappingId());
        item.put("bazhuayuTaskId", task.getBazhuayuTaskId());
        item.put("taskName", task.getTaskName());
        item.put("taskCategory", task.getTaskCategory());
        item.put("initialFilter", !Boolean.FALSE.equals(task.getInitialFilter()));
        item.put("targetTable", task.getTargetTable());
        // 流式初筛（入库+初筛）处理中的任务在 DB 里是 RUNNING 且 batchTotal 尚未定，
        // 派生为 DRAINING 展示态，与"一条龙" run-state 的 DRAINING 语义对齐；
        // RUNNING + batchTotal>0 属卖家精灵 API 执行阶段，保持 RUNNING。
        int batchTotal = task.getBatchTotal() != null ? task.getBatchTotal() : 0;
        boolean draining = "RUNNING".equals(task.getTaskStatus()) && batchTotal == 0;
        item.put("status", draining ? "DRAINING" : task.getTaskStatus());
        // 已处理行数：流式初筛周期写回的 totalCount 即当前累计处理量
        item.put("processedCount", task.getTotalCount() != null ? task.getTotalCount() : 0);
        item.put("totalCount", task.getTotalCount() != null ? task.getTotalCount() : 0);
        item.put("passCount", task.getPassCount() != null ? task.getPassCount() : 0);
        item.put("priceFailCount", task.getPriceFailCount() != null ? task.getPriceFailCount() : 0);
        item.put("reviewFailCount", task.getReviewFailCount() != null ? task.getReviewFailCount() : 0);
        item.put("duplicateCount", task.getDuplicateCount() != null ? task.getDuplicateCount() : 0);
        item.put("skipCount", task.getSkipCount() != null ? task.getSkipCount() : 0);
        item.put("batchTotal", task.getBatchTotal() != null ? task.getBatchTotal() : 0);
        item.put("batchCurrent", task.getBatchCurrent() != null ? task.getBatchCurrent() : 0);
        item.put("apiSuccess", task.getApiSuccess() != null ? task.getApiSuccess() : 0);
        item.put("apiFail", task.getApiFail() != null ? task.getApiFail() : 0);
        item.put("apiRequestsUsed", task.getApiRequestsUsed() != null ? task.getApiRequestsUsed() : 0);
        item.put("parentAsinCount", task.getParentAsinCount() != null ? task.getParentAsinCount() : 0);
        item.put("variantAsinCount", task.getVariantAsinCount() != null ? task.getVariantAsinCount() : 0);
        item.put("dataMonth", task.getDataMonth());
        item.put("errorMessage", task.getErrorMessage());
        item.put("createdAt", task.getCreatedAt());
        item.put("completedAt", task.getUpdatedAt());
        SellerspriteRequestRun run = sellerspriteRuns.get(task.getId());
        if (run != null) {
            Map<String, Object> summary = new LinkedHashMap<>();
            summary.put("runId", run.getRunId());
            summary.put("status", run.getStatus());
            summary.put("totalCount", run.getTotalCount());
            summary.put("pendingCount", run.getPendingCount());
            summary.put("runningCount", run.getRunningCount());
            summary.put("successCount", run.getSuccessCount());
            summary.put("failedCount", run.getFailedCount());
            summary.put("skippedCount", run.getSkippedCount());
            summary.put("apiCalls", run.getApiCalls());
            summary.put("startedAt", run.getStartedAt());
            summary.put("finishedAt", run.getFinishedAt());
            summary.put("lastErrorMessage", run.getLastErrorMessage());
            item.put("sellerSpriteRun", summary);
        }
        return item;
    }
}

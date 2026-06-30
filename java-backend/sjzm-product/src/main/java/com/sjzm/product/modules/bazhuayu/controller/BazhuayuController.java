package com.sjzm.product.modules.bazhuayu.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sjzm.common.Result;
import com.sjzm.product.entity.AsinImportTask;
import com.sjzm.product.mapper.AsinImportTaskMapper;
import com.sjzm.product.mapper.BazhuayuWeeklyRawMapper;
import com.sjzm.product.modules.bazhuayu.entity.BazhuayuWeeklyRaw;
import com.sjzm.product.modules.bazhuayu.service.BazhuayuClient;
import com.sjzm.product.modules.bazhuayu.service.BazhuayuConfigService;
import com.sjzm.product.modules.bazhuayu.service.BazhuayuImageSearchService;
import com.sjzm.product.modules.bazhuayu.service.BazhuayuRunStateService;
import com.sjzm.product.modules.bazhuayu.service.BazhuayuScheduledService;
import com.sjzm.product.service.ScoringService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Collection;
import java.util.List;
import java.util.Map;

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
    private final BazhuayuClient client;
    private final BazhuayuImageSearchService imageSearchService;
    private final BazhuayuWeeklyRawMapper rawMapper;
    private final AsinImportTaskMapper taskMapper;
    private final ScoringService scoringService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @PostMapping("/trigger")
    @Operation(summary = "读取已采数据：手动触发一次 drain 增量入库+初筛（异步，不启动云端）")
    public Result<Map<String, Object>> trigger(
            @RequestParam(required = false) String marketplace) {
        scheduledService.triggerAsync(marketplace);
        return Result.success(Map.of("status", "TRIGGERED",
                "marketplace", marketplace == null ? "ALL" : marketplace));
    }

    @PostMapping("/start-collect")
    @Operation(summary = "启动云端采集一条龙（启动→等待采完→榜单则drain入库初筛，全异步）")
    public Result<Map<String, Object>> startCollect(
            @RequestParam(defaultValue = "bangdan") String function,
            @RequestParam(required = false) String marketplace) {
        return Result.success(scheduledService.startCloudCollect(function, marketplace));
    }

    @PostMapping("/stop-collect")
    @Operation(summary = "停止采集：协作式取消 + 调云端 stopExtraction（需团队版权限）")
    public Result<Map<String, Object>> stopCollect(
            @RequestParam(defaultValue = "bangdan") String function,
            @RequestParam String marketplace) {
        return Result.success(scheduledService.stopTask(function, marketplace));
    }

    @GetMapping("/run-state")
    @Operation(summary = "查询 6 任务一条龙运行态（内存，含云端实时进度），供前端轮询")
    public Result<Collection<BazhuayuRunStateService.RunState>> runState() {
        return Result.success(runStateService.all());
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

    /** 本周一 00:00（用于按创建时间过滤本周任务） */
    private String weekStart() {
        java.time.LocalDate monday = java.time.LocalDate.now()
                .with(java.time.temporal.WeekFields.ISO.dayOfWeek(), 1);
        return monday + " 00:00:00";
    }
}

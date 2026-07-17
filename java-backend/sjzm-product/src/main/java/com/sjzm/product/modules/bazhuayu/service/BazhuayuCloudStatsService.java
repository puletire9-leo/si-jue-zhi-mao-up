package com.sjzm.product.modules.bazhuayu.service;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;
import java.util.function.Supplier;

/**
 * 云端行数缓存。
 * <p>目标：让前端看到"云端已采 X 行 / 本地已入库 Y 行"的差异，判断是否有云端已采但本地未 drain 的积压。
 * <p>轻量：全量刷新只调一次批量状态接口，不做业务逻辑。
 * <p>定时刷（每小时）+ 手动触发（前端按钮）双通道；结果放进程内 ConcurrentHashMap（重启自动冷启）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BazhuayuCloudStatsService {

    private final BazhuayuConfigService configService;
    private final BazhuayuClient client;

    /** key = taskId，同站点多任务必须分别缓存。 */
    private final Map<String, CloudStat> cache = new ConcurrentHashMap<>();
    /** 定时刷新、全量手动刷新、单行刷新互斥，避免同时轰击八爪鱼状态接口。 */
    private final ReentrantLock refreshLock = new ReentrantLock();

    /**
     * 每小时刷一次全量映射的所有 taskId 云端行数。
     * 关闭方式：外部把 BAZHUAYU_CLOUD_STATS_CRON 设为不匹配任何时间的 cron，例如 `0 0 0 31 2 ?`。
     * 用独立 cron 属性（不复用 BAZHUAYU_CRON）避免和 drain 定时耦合。
     */
    @Scheduled(cron = "${BAZHUAYU_CLOUD_STATS_CRON:0 5 * * * *}")
    public void refreshAllScheduled() {
        try {
            int updated = refreshAll();
            log.info("Bazhuayu cloud stats scheduled refresh: {} entries updated", updated);
        } catch (Exception e) {
            log.error("Bazhuayu cloud stats scheduled refresh failed: {}", e.getMessage(), e);
        }
    }

    /**
     * 刷一遍完整映射里所有 taskId 的云端状态。
     * 单条失败不阻塞其余（云端偶发 500 是常态）。
     * @return 成功刷新的条目数
     */
    public int refreshAll() {
        if (!refreshLock.tryLock()) {
            log.info("八爪鱼云端状态正在刷新，本次全量请求复用现有缓存");
            return 0;
        }
        List<com.sjzm.product.modules.bazhuayu.entity.BazhuayuTaskMapping> entries =
                configService.listTaskEntries();
        try {
            LinkedHashSet<String> taskIds = new LinkedHashSet<>();
            entries.forEach(entry -> taskIds.add(entry.getTaskId()));
            Map<String, JsonNode> statuses = withTooManyRequestsRetry(
                    () -> client.getTaskStatusesV2(taskIds));
            int ok = 0;
            for (var entry : entries) {
                JsonNode status = statuses.get(entry.getTaskId());
                if (status == null) continue;
                recordSuccess(entry.getFunctionKey(), entry.getMarketplace(), entry.getTaskId(), status);
                ok++;
            }
            return ok;
        } catch (Exception e) {
            String message = friendlyError(e);
            entries.forEach(entry -> recordFailure(entry.getFunctionKey(), entry.getMarketplace(),
                    entry.getTaskId(), message));
            log.warn("刷新八爪鱼全量云端状态失败: {}", message);
            return 0;
        } finally {
            refreshLock.unlock();
        }
    }

    /** 单条刷新，失败返回 false（内部已日志）。前端「手动刷新云端」按钮用。 */
    public boolean refreshOne(String function, String marketplace, String taskId) {
        if (taskId == null || taskId.isBlank()) return false;
        if (!refreshLock.tryLock()) {
            log.info("八爪鱼云端状态正在刷新，跳过重复单行请求 taskId={}", taskId);
            return false;
        }
        try {
            JsonNode status = withTooManyRequestsRetry(() -> client.getTaskStatusV2(taskId));
            recordSuccess(function, marketplace, taskId, status);
            return true;
        } catch (Exception e) {
            String message = friendlyError(e);
            log.warn("刷新云端状态失败 taskId={}: {}", taskId, message);
            recordFailure(function, marketplace, taskId, message);
            return false;
        } finally {
            refreshLock.unlock();
        }
    }

    private void recordSuccess(String function, String marketplace, String taskId, JsonNode status) {
        BazhuayuBatchSnapshot batch = BazhuayuBatchSnapshot.fromStatus(status);
        CloudStat stat = cache.computeIfAbsent(taskId, key -> new CloudStat());
        stat.setFunction(function);
        stat.setMarketplace(marketplace);
        stat.setTaskId(taskId);
        stat.setCloudStatus(status.path("status").asText(""));
        stat.setCloudCount(status.path("currentTotalExtractCount").asInt(0));
        stat.setLatestBatchNo(batch.batchNo());
        stat.setLatestBatchStartTime(batch.startTime());
        stat.setLatestBatchExecutingTime(batch.executingTime());
        stat.setLatestBatchEndTime(batch.endTime());
        stat.setLatestBatchCount(batch.cloudCount());
        stat.setLastSyncAt(LocalDateTime.now());
        stat.setLastError(null);
        stat.setLastErrorAt(null);
    }

    private void recordFailure(String function, String marketplace, String taskId, String message) {
        CloudStat stat = cache.computeIfAbsent(taskId, key -> new CloudStat());
        stat.setFunction(function);
        stat.setMarketplace(marketplace);
        stat.setTaskId(taskId);
        stat.setLastError(message);
        stat.setLastErrorAt(LocalDateTime.now());
    }

    private <T> T withTooManyRequestsRetry(Supplier<T> action) {
        RuntimeException last = null;
        for (int attempt = 0; attempt < 3; attempt++) {
            try {
                return action.get();
            } catch (RuntimeException e) {
                last = e;
                if (!isTooManyRequests(e) || attempt == 2) throw e;
                long waitMs = 2000L * (attempt + 1);
                log.info("八爪鱼状态接口限流，{}ms 后第 {} 次重试", waitMs, attempt + 2);
                try {
                    Thread.sleep(waitMs);
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    throw e;
                }
            }
        }
        throw last == null ? new IllegalStateException("八爪鱼状态刷新失败") : last;
    }

    private boolean isTooManyRequests(Throwable error) {
        String message = error.getMessage();
        return message != null && message.contains("TooManyRequests");
    }

    private String friendlyError(Throwable error) {
        return isTooManyRequests(error)
                ? "八爪鱼云端限流，已保留上次数据，请稍后重试"
                : String.valueOf(error.getMessage());
    }

    /** 单条查询，供 overview / controller 使用。找不到返回 null（前端标未同步过）。 */
    public CloudStat get(String function, String marketplace) {
        String taskId = configService.getTaskId(function, marketplace);
        return taskId == null ? null : cache.get(taskId);
    }

    public CloudStat getByTaskId(String taskId) {
        return taskId == null ? null : cache.get(taskId);
    }

    /** 全量快照（前端配置面板一次拿完）。 */
    public Map<String, CloudStat> snapshot() {
        return new LinkedHashMap<>(cache);
    }

    @Data
    public static class CloudStat {
        private String function;
        private String marketplace;
        private String taskId;
        /** 云端返回的状态字符串，如 Finished / Running / Stopped */
        private String cloudStatus;
        /** 云端当前已采集条数（currentTotalExtractCount） */
        private int cloudCount;
        /** 最新云采集批次号：由 startExecuteTime 格式化为 yyyyMMdd-HHmmss。 */
        private String latestBatchNo;
        private LocalDateTime latestBatchStartTime;
        private LocalDateTime latestBatchExecutingTime;
        private LocalDateTime latestBatchEndTime;
        private int latestBatchCount;
        /** 上次刷新成功时间 */
        private LocalDateTime lastSyncAt;
        /** 最近一次刷新失败信息；下一次成功后清空。 */
        private String lastError;
        private LocalDateTime lastErrorAt;
    }
}

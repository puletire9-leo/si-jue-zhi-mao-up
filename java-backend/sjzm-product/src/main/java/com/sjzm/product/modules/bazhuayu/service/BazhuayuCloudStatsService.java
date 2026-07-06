package com.sjzm.product.modules.bazhuayu.service;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 云端行数缓存。
 * <p>目标：让前端看到"云端已采 X 行 / 本地已入库 Y 行"的差异，判断是否有云端已采但本地未 drain 的积压。
 * <p>轻量：只调 <code>getTaskStatusV2</code>（快），不做业务逻辑。
 * <p>定时刷（每小时）+ 手动触发（前端按钮）双通道；结果放进程内 ConcurrentHashMap（重启自动冷启）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BazhuayuCloudStatsService {

    private final BazhuayuConfigService configService;
    private final BazhuayuClient client;

    /** key = function:marketplace（复用 BazhuayuRunStateService.key 约定） */
    private final Map<String, CloudStat> cache = new ConcurrentHashMap<>();

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
        Map<String, Map<String, String>> mapping = configService.getMapping();
        int ok = 0;
        for (Map.Entry<String, Map<String, String>> fn : mapping.entrySet()) {
            String function = fn.getKey();
            for (Map.Entry<String, String> mp : fn.getValue().entrySet()) {
                if (refreshOne(function, mp.getKey(), mp.getValue())) ok++;
            }
        }
        return ok;
    }

    /** 单条刷新，失败返回 false（内部已日志）。前端「手动刷新云端」按钮用。 */
    public boolean refreshOne(String function, String marketplace, String taskId) {
        if (taskId == null || taskId.isBlank()) return false;
        String key = key(function, marketplace);
        try {
            JsonNode status = client.getTaskStatusV2(taskId);
            String s = status.path("status").asText("");
            int count = status.path("currentTotalExtractCount").asInt(0);

            CloudStat stat = new CloudStat();
            stat.setFunction(function);
            stat.setMarketplace(marketplace);
            stat.setTaskId(taskId);
            stat.setCloudStatus(s);
            stat.setCloudCount(count);
            stat.setLastSyncAt(LocalDateTime.now());
            cache.put(key, stat);
            return true;
        } catch (Exception e) {
            log.warn("刷新云端状态失败 {}={}: {}", key, taskId, e.getMessage());
            // 保留旧值 + 记错误信息，让前端能看到「上次成功时间」+「本次失败」
            CloudStat old = cache.get(key);
            if (old != null) {
                old.setLastError(e.getMessage());
                old.setLastErrorAt(LocalDateTime.now());
            } else {
                CloudStat stat = new CloudStat();
                stat.setFunction(function);
                stat.setMarketplace(marketplace);
                stat.setTaskId(taskId);
                stat.setLastError(e.getMessage());
                stat.setLastErrorAt(LocalDateTime.now());
                cache.put(key, stat);
            }
            return false;
        }
    }

    /** 单条查询，供 overview / controller 使用。找不到返回 null（前端标未同步过）。 */
    public CloudStat get(String function, String marketplace) {
        return cache.get(key(function, marketplace));
    }

    /** 全量快照（前端配置面板一次拿完）。 */
    public Map<String, CloudStat> snapshot() {
        return new LinkedHashMap<>(cache);
    }

    private static String key(String function, String marketplace) {
        return function + ":" + marketplace;
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
        /** 上次刷新成功时间 */
        private LocalDateTime lastSyncAt;
        /** 上次刷新失败信息（成功后不清空，让用户能看到"上一轮出过问题"） */
        private String lastError;
        private LocalDateTime lastErrorAt;
    }
}

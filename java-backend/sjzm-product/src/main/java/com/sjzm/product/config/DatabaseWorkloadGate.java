package com.sjzm.product.config;

import com.sjzm.common.BusinessException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

/**
 * 单实例数据库重负载门禁。
 * 普通分页、详情和小型 CRUD 不进入本门禁；只保护聚合查询、全量导出和批量写入。
 */
@Slf4j
@Component
public class DatabaseWorkloadGate {

    private final Semaphore heavyQuerySlots;
    private final Semaphore exportSlots;
    private final Semaphore heavyWriteSlots;
    private final long acquireTimeoutMs;
    private final ThreadLocal<Integer> heavyWriteDepth = ThreadLocal.withInitial(() -> 0);

    public DatabaseWorkloadGate(
            @Value("${DB_HEAVY_QUERY_MAX_CONCURRENCY:2}") int heavyQueryConcurrency,
            @Value("${DB_EXPORT_MAX_CONCURRENCY:1}") int exportConcurrency,
            @Value("${DB_HEAVY_WRITE_MAX_CONCURRENCY:1}") int heavyWriteConcurrency,
            @Value("${DB_WORKLOAD_ACQUIRE_TIMEOUT_MS:1000}") long acquireTimeoutMs) {
        this.heavyQuerySlots = new Semaphore(Math.max(1, heavyQueryConcurrency), true);
        this.exportSlots = new Semaphore(Math.max(1, exportConcurrency), true);
        this.heavyWriteSlots = new Semaphore(Math.max(1, heavyWriteConcurrency), true);
        this.acquireTimeoutMs = Math.max(1L, acquireTimeoutMs);
    }

    public <T> T runHeavyQuery(Supplier<T> action) {
        return runTimed(heavyQuerySlots, "大型查询繁忙，请稍后重试", action);
    }

    /** CSV 导出同时占用一个导出槽和一个大型查询槽。 */
    public <T> T runExport(Supplier<T> action) {
        return runTimed(exportSlots, "已有全量导出任务正在运行，请稍后重试",
                () -> runHeavyQuery(action));
    }

    /**
     * 批量写入按公平队列串行执行。允许同线程重入，避免导入完成后调用清洗层时自锁。
     */
    public <T> T runHeavyWrite(Supplier<T> action) {
        int depth = heavyWriteDepth.get();
        if (depth > 0) {
            heavyWriteDepth.set(depth + 1);
            try {
                return action.get();
            } finally {
                heavyWriteDepth.set(depth);
            }
        }

        boolean acquired = false;
        try {
            if (!heavyWriteSlots.tryAcquire()) {
                log.info("数据库批量写入槽位繁忙，当前任务进入单通道队列");
                heavyWriteSlots.acquire();
            }
            acquired = true;
            heavyWriteDepth.set(1);
            return action.get();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BusinessException(429, "批量任务排队被中断，请稍后重试", e);
        } finally {
            heavyWriteDepth.remove();
            if (acquired) {
                heavyWriteSlots.release();
            }
        }
    }

    private <T> T runTimed(Semaphore semaphore, String busyMessage, Supplier<T> action) {
        boolean acquired = false;
        try {
            acquired = semaphore.tryAcquire(acquireTimeoutMs, TimeUnit.MILLISECONDS);
            if (!acquired) {
                throw new BusinessException(429, busyMessage);
            }
            return action.get();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BusinessException(429, "数据库任务等待被中断，请稍后重试", e);
        } finally {
            if (acquired) {
                semaphore.release();
            }
        }
    }
}

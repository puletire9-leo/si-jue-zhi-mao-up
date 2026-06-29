package com.sjzm.product.modules.bazhuayu.service;

import com.sjzm.product.modules.bazhuayu.service.BazhuayuRunStateService.Phase;
import com.sjzm.product.modules.bazhuayu.service.BazhuayuRunStateService.RunState;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * RunStateService CAS 占位 + 协作式取消 + 终态流转测试。
 * 这是「同任务空闲才能启动」「停止」语义的核心闸门，重点验证并发正确性。
 */
class BazhuayuRunStateServiceTest {

    private BazhuayuRunStateService svc;

    @BeforeEach
    void setUp() {
        svc = new BazhuayuRunStateService();
    }

    @Test
    void tryBegin_emptySlot_succeeds_andSetsStarting() {
        boolean ok = svc.tryBegin("bangdan", "US", "task-1");
        assertThat(ok).isTrue();
        RunState s = find("bangdan:US");
        assertThat(s.getPhase()).isEqualTo(Phase.STARTING);
        assertThat(s.getTaskId()).isEqualTo("task-1");
        assertThat(s.isCancelRequested()).isFalse();
    }

    @Test
    void tryBegin_whileRunning_isRejected() {
        assertThat(svc.tryBegin("bangdan", "US", "t1")).isTrue();    // 占位
        // 各运行中阶段都应拒绝二次 begin
        svc.setPhase("bangdan", "US", Phase.WAITING_CLOUD);
        assertThat(svc.tryBegin("bangdan", "US", "t1")).isFalse();
        svc.setPhase("bangdan", "US", Phase.DRAINING);
        assertThat(svc.tryBegin("bangdan", "US", "t1")).isFalse();
    }

    @Test
    void tryBegin_afterTerminal_succeedsAgain() {
        svc.tryBegin("bangdan", "US", "t1");
        svc.finishDrain("bangdan", "US", 30000);
        assertThat(find("bangdan:US").getPhase()).isEqualTo(Phase.DONE);
        // 终态后可再次启动
        assertThat(svc.tryBegin("bangdan", "US", "t1")).isTrue();
        RunState s = find("bangdan:US");
        assertThat(s.getPhase()).isEqualTo(Phase.STARTING);
        assertThat(s.getDrainedRows()).isZero();   // 重置
    }

    @Test
    void differentTasks_independent() {
        assertThat(svc.tryBegin("bangdan", "US", "t-us")).isTrue();
        assertThat(svc.tryBegin("yitushitu", "US", "t-img-us")).isTrue();   // 不同功能同站点互不影响
        assertThat(svc.tryBegin("bangdan", "UK", "t-uk")).isTrue();
        assertThat(svc.all()).hasSize(3);
    }

    @Test
    void requestCancel_setsFlag_visibleToIsCancelled() {
        svc.tryBegin("bangdan", "DE", "t1");
        assertThat(svc.isCancelled("bangdan", "DE")).isFalse();
        svc.requestCancel("bangdan", "DE");
        assertThat(svc.isCancelled("bangdan", "DE")).isTrue();
        assertThat(svc.isRunning("bangdan", "DE")).isTrue();   // 取消标志不改 phase
    }

    @Test
    void fail_setsTerminalAndError() {
        svc.tryBegin("bangdan", "US", "t1");
        svc.fail("bangdan", "US", Phase.TIMEOUT, "云端采集等待超时");
        RunState s = find("bangdan:US");
        assertThat(s.getPhase()).isEqualTo(Phase.TIMEOUT);
        assertThat(s.getError()).isEqualTo("云端采集等待超时");
        assertThat(svc.isRunning("bangdan", "US")).isFalse();
    }

    @Test
    void setCloudCount_andFinishDrain_accumulate() {
        svc.tryBegin("bangdan", "US", "t1");
        svc.setCloudCount("bangdan", "US", 150000);
        svc.finishDrain("bangdan", "US", 28000);
        RunState s = find("bangdan:US");
        assertThat(s.getCloudExtractCount()).isEqualTo(150000);
        assertThat(s.getDrainedRows()).isEqualTo(28000);
        assertThat(s.getPhase()).isEqualTo(Phase.DONE);
    }

    /** 并发：10 线程同时抢占同一任务，只能有 1 个成功（CAS 正确性）。 */
    @Test
    void tryBegin_concurrent_onlyOneWins() throws InterruptedException {
        int threads = 10;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch ready = new CountDownLatch(threads);
        CountDownLatch go = new CountDownLatch(1);
        AtomicInteger wins = new AtomicInteger();
        for (int i = 0; i < threads; i++) {
            pool.submit(() -> {
                ready.countDown();
                try {
                    go.await();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    return;
                }
                if (svc.tryBegin("bangdan", "US", "t1")) wins.incrementAndGet();
            });
        }
        ready.await();
        go.countDown();
        pool.shutdown();
        assertThat(pool.awaitTermination(5, TimeUnit.SECONDS)).isTrue();
        assertThat(wins.get()).isEqualTo(1);   // 仅一个线程占位成功
    }

    private RunState find(String taskKey) {
        return svc.all().stream()
                .filter(s -> s.getTaskKey().equals(taskKey))
                .findFirst()
                .orElseThrow();
    }
}

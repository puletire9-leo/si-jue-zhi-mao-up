package com.sjzm.product.config;

import com.sjzm.common.BusinessException;
import org.junit.jupiter.api.Test;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DatabaseWorkloadGateTest {

    @Test
    void rejectsHeavyQueryWhenSlotCannotBeAcquiredInTime() throws Exception {
        DatabaseWorkloadGate gate = new DatabaseWorkloadGate(1, 1, 1, 30);
        CountDownLatch entered = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        ExecutorService executor = Executors.newSingleThreadExecutor();
        try {
            executor.submit(() -> gate.runHeavyQuery(() -> {
                entered.countDown();
                try {
                    release.await(2, TimeUnit.SECONDS);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                return null;
            }));
            entered.await(1, TimeUnit.SECONDS);

            assertThatThrownBy(() -> gate.runHeavyQuery(() -> "unexpected"))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("大型查询繁忙");
        } finally {
            release.countDown();
            executor.shutdownNow();
        }
    }

    @Test
    void queuesHeavyWritesAndRunsThemOneAtATime() throws Exception {
        DatabaseWorkloadGate gate = new DatabaseWorkloadGate(2, 1, 1, 30);
        CountDownLatch firstEntered = new CountDownLatch(1);
        CountDownLatch releaseFirst = new CountDownLatch(1);
        CountDownLatch secondEntered = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<String> first = executor.submit(() -> gate.runHeavyWrite(() -> {
                firstEntered.countDown();
                try {
                    releaseFirst.await(2, TimeUnit.SECONDS);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                return "first";
            }));
            firstEntered.await(1, TimeUnit.SECONDS);

            Future<String> second = executor.submit(() -> gate.runHeavyWrite(() -> {
                secondEntered.countDown();
                return "second";
            }));

            assertThat(secondEntered.await(80, TimeUnit.MILLISECONDS)).isFalse();
            releaseFirst.countDown();
            assertThat(first.get(1, TimeUnit.SECONDS)).isEqualTo("first");
            assertThat(second.get(1, TimeUnit.SECONDS)).isEqualTo("second");
        } finally {
            releaseFirst.countDown();
            executor.shutdownNow();
        }
    }
}

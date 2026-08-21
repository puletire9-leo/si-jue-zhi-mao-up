package com.sjzm.product.modules.automation.job;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/** Collects ordered, millisecond-level timings for one automation run. */
public class AutomationStageTimer {

    private final Map<String, Long> durations = new LinkedHashMap<>();

    public <T> T time(String stage, TimedSupplier<T> supplier) {
        long startedAt = System.nanoTime();
        try {
            return supplier.get();
        } catch (AutomationStageException ex) {
            throw ex;
        } catch (RuntimeException ex) {
            record(stage, startedAt);
            throw new AutomationStageException(stage, durations, ex);
        } finally {
            if (!durations.containsKey(stage)) {
                record(stage, startedAt);
            }
        }
    }

    public void time(String stage, TimedAction action) {
        time(stage, () -> {
            action.run();
            return null;
        });
    }

    public void addAll(Map<String, Long> values) {
        if (values != null) {
            values.forEach((key, value) -> durations.putIfAbsent(key, value));
        }
    }

    public Map<String, Long> snapshot() {
        return Collections.unmodifiableMap(new LinkedHashMap<>(durations));
    }

    private void record(String stage, long startedAt) {
        durations.put(stage, (System.nanoTime() - startedAt) / 1_000_000L);
    }

    @FunctionalInterface
    public interface TimedSupplier<T> {
        T get();
    }

    @FunctionalInterface
    public interface TimedAction {
        void run();
    }
}

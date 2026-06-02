package com.sjzm.util;

import com.google.common.hash.BloomFilter;
import com.google.common.hash.Funnels;
import lombok.extern.slf4j.Slf4j;

import java.nio.charset.StandardCharsets;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
public class BloomFilterUtil {

    private static final ConcurrentHashMap<String, BloomFilter<String>> BLOOM_FILTERS = new ConcurrentHashMap<>();

    public static BloomFilter<String> getOrCreate(String name, long expectedInsertions, double fpp) {
        return BLOOM_FILTERS.computeIfAbsent(name, k -> {
            log.info("创建BloomFilter: name={}, expectedInsertions={}, fpp={}", name, expectedInsertions, fpp);
            return BloomFilter.create(Funnels.stringFunnel(StandardCharsets.UTF_8), expectedInsertions, fpp);
        });
    }

    public static BloomFilter<String> get(String name) {
        return BLOOM_FILTERS.get(name);
    }

    public static void put(String name, String value) {
        BloomFilter<String> filter = getOrCreate(name, 1000000, 0.01);
        filter.put(value);
    }

    public static boolean mightContain(String name, String value) {
        BloomFilter<String> filter = get(name);
        if (filter == null) {
            return true;
        }
        return filter.mightContain(value);
    }

    public static void remove(String name) {
        BLOOM_FILTERS.remove(name);
        log.info("删除BloomFilter: name={}", name);
    }

    public static void clearAll() {
        BLOOM_FILTERS.clear();
        log.info("清空所有BloomFilter");
    }

    public static int count() {
        return BLOOM_FILTERS.size();
    }
}

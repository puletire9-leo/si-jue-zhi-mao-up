package com.sjzm.util;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 雪花ID生成器
 * 用于生成分布式唯一ID，兼容 MyBatis-Plus 的 IdType.ASSIGN_ID
 */
@Slf4j
@Component
public class SnowflakeIdGenerator {

    /** 起始时间戳（2024-01-01 00:00:00） */
    private static final long EPOCH = 1704067200000L;

    /** 机器ID所占位数 */
    private static final long WORKER_ID_BITS = 5L;

    /** 数据标识ID所占位数 */
    private static final long DATACENTER_ID_BITS = 5L;

    /** 支持的最大机器ID */
    private static final long MAX_WORKER_ID = ~(-1L << WORKER_ID_BITS);

    /** 支持的最大数据标识ID */
    private static final long MAX_DATACENTER_ID = ~(-1L << DATACENTER_ID_BITS);

    /** 序列在ID中占的位数 */
    private static final long SEQUENCE_BITS = 12L;

    /** 机器ID向左移12位 */
    private static final long WORKER_ID_SHIFT = SEQUENCE_BITS;

    /** 数据标识ID向左移17位 */
    private static final long DATACENTER_ID_SHIFT = SEQUENCE_BITS + WORKER_ID_BITS;

    /** 时间截向左移22位 */
    private static final long TIMESTAMP_SHIFT = SEQUENCE_BITS + WORKER_ID_BITS + DATACENTER_ID_BITS;

    /** 生成序列的掩码 */
    private static final long SEQUENCE_MASK = ~(-1L << SEQUENCE_BITS);

    /** 工作机器ID(0~31) */
    private final long workerId;

    /** 数据中心ID(0~31) */
    private final long datacenterId;

    /** 毫秒内序列(0~4095) */
    private long sequence = 0L;

    /** 上次生成ID的时间截 */
    private long lastTimestamp = -1L;

    public SnowflakeIdGenerator() {
        this(0L, 0L);
    }

    /**
     * 构造函数
     *
     * @param workerId     工作ID (0~31)
     * @param datacenterId 数据中心ID (0~31)
     */
    public SnowflakeIdGenerator(long workerId, long datacenterId) {
        if (workerId > MAX_WORKER_ID || workerId < 0) {
            throw new IllegalArgumentException(
                    String.format("Worker ID 不能大于 %d 或小于 0", MAX_WORKER_ID));
        }
        if (datacenterId > MAX_DATACENTER_ID || datacenterId < 0) {
            throw new IllegalArgumentException(
                    String.format("Datacenter ID 不能大于 %d 或小于 0", MAX_DATACENTER_ID));
        }
        this.workerId = workerId;
        this.datacenterId = datacenterId;
        log.info("雪花ID生成器初始化: workerId={}, datacenterId={}", workerId, datacenterId);
    }

    /**
     * 获得下一个ID (该方法是线程安全的)
     */
    public synchronized long nextId() {
        long timestamp = timeGen();

        // 如果当前时间小于上一次ID生成的时间戳，说明系统时钟回退过
        if (timestamp < lastTimestamp) {
            throw new RuntimeException(
                    String.format("时钟回退，拒绝生成ID，回退时间 %d 毫秒", lastTimestamp - timestamp));
        }

        // 如果是同一时间生成的，则进行毫秒内序列
        if (lastTimestamp == timestamp) {
            sequence = (sequence + 1) & SEQUENCE_MASK;
            // 毫秒内序列溢出
            if (sequence == 0) {
                // 阻塞到下一个毫秒，获得新的时间戳
                timestamp = tilNextMillis(lastTimestamp);
            }
        } else {
            // 时间戳改变，毫秒内序列重置
            sequence = 0L;
        }

        lastTimestamp = timestamp;

        return ((timestamp - EPOCH) << TIMESTAMP_SHIFT)
                | (datacenterId << DATACENTER_ID_SHIFT)
                | (workerId << WORKER_ID_SHIFT)
                | sequence;
    }

    /**
     * 阻塞到下一个毫秒，直到获得新的时间戳
     */
    protected long tilNextMillis(long lastTimestamp) {
        long timestamp = timeGen();
        while (timestamp <= lastTimestamp) {
            timestamp = timeGen();
        }
        return timestamp;
    }

    /**
     * 返回以毫秒为单位的当前时间
     */
    protected long timeGen() {
        return System.currentTimeMillis();
    }
}

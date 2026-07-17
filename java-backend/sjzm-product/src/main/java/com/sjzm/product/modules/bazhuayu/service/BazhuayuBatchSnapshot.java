package com.sjzm.product.modules.bazhuayu.service;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Objects;

/**
 * 八爪鱼单次云采集快照。
 *
 * <p>开放平台 statuses/v2 不返回网页内部 lotNo，但会返回最新一次执行的精确开始/结束时间、
 * 状态和本批次数量。页面展示批次号与八爪鱼网页一致，由 startExecuteTime 格式化为
 * yyyyMMdd-HHmmss；系统自己启动云采集时可额外携带 start 接口返回的真实 lotNo。</p>
 */
public record BazhuayuBatchSnapshot(
        String batchNo,
        String lotNo,
        LocalDateTime startTime,
        LocalDateTime executingTime,
        LocalDateTime endTime,
        int cloudCount,
        String status) {

    private static final DateTimeFormatter BATCH_NO_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");

    public static BazhuayuBatchSnapshot fromStatus(JsonNode statusNode) {
        return fromStatus(statusNode, null);
    }

    public static BazhuayuBatchSnapshot fromStatus(JsonNode statusNode, String knownLotNo) {
        JsonNode status = statusNode == null ? com.fasterxml.jackson.databind.node.NullNode.getInstance() : statusNode;
        LocalDateTime start = parseTime(status.path("startExecuteTime").asText(null));
        String batchNo = start == null ? null : start.format(BATCH_NO_FORMAT);
        String responseLotNo = firstText(status, "lotNo", "lotno");
        return new BazhuayuBatchSnapshot(
                batchNo,
                hasText(knownLotNo) ? knownLotNo.trim() : responseLotNo,
                start,
                parseTime(status.path("executingTime").asText(null)),
                parseTime(status.path("endExecuteTime").asText(null)),
                status.path("currentTotalExtractCount").asInt(0),
                status.path("status").asText(""));
    }

    public static BazhuayuBatchSnapshot expected(
            String batchNo,
            String startTime,
            String endTime,
            int cloudCount) {
        if (!hasText(batchNo) || !hasText(startTime)) {
            throw new IllegalArgumentException("请先刷新并选择最新云采集批次");
        }
        return new BazhuayuBatchSnapshot(
                batchNo.trim(),
                null,
                parseRequiredTime(startTime, "批次开始时间"),
                null,
                parseTime(endTime),
                Math.max(0, cloudCount),
                "Finished");
    }

    public BazhuayuBatchSnapshot withLotNo(String value) {
        return new BazhuayuBatchSnapshot(batchNo, value, startTime, executingTime, endTime, cloudCount, status);
    }

    public boolean isFinished() {
        return "Finished".equalsIgnoreCase(status);
    }

    public void assertSameBatch(BazhuayuBatchSnapshot expected) {
        if (expected == null) return;
        boolean same = Objects.equals(batchNo, expected.batchNo)
                && Objects.equals(startTime, expected.startTime)
                && (expected.endTime == null || Objects.equals(endTime, expected.endTime))
                && (expected.cloudCount <= 0 || cloudCount == expected.cloudCount);
        if (!same) {
            throw new IllegalArgumentException("云端最新批次已变化，请刷新页面后重新确认（页面批次 "
                    + expected.batchNo + "，当前批次 " + (batchNo == null ? "无" : batchNo) + "）");
        }
        if (!isFinished()) {
            throw new IllegalArgumentException("批次 " + batchNo + " 当前状态为 " + status + "，完成后才能导入");
        }
    }

    private static LocalDateTime parseRequiredTime(String value, String label) {
        LocalDateTime parsed = parseTime(value);
        if (parsed == null) throw new IllegalArgumentException(label + "无效");
        return parsed;
    }

    private static LocalDateTime parseTime(String value) {
        if (!hasText(value)) return null;
        try {
            return LocalDateTime.parse(value.trim(), DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private static String firstText(JsonNode node, String... keys) {
        for (String key : keys) {
            String value = node.path(key).asText(null);
            if (hasText(value)) return value.trim();
        }
        return null;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}

package com.sjzm.product.modules.lingxing.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.BufferedWriter;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.UUID;
import java.util.stream.Stream;
import java.util.zip.GZIPOutputStream;

/**
 * Archives raw Lingxing API rows as compressed JSONL.
 *
 * The DB remains the query source. These files are the external raw evidence
 * store and are kept bounded by retention days plus per-file rotation.
 */
@Slf4j
@Service
public class LingxingRawJsonArchiveService {

    private static final DateTimeFormatter RUN_TS = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Path archiveRoot;
    private final boolean enabled;
    private final int retentionDays;
    private final long maxFileBytes;

    public LingxingRawJsonArchiveService(
            @Value("${lingxing.raw-archive.enabled:${LINGXING_RAW_ARCHIVE_ENABLED:true}}") boolean enabled,
            @Value("${lingxing.raw-archive.dir:${LINGXING_RAW_ARCHIVE_DIR:data/lingxing/raw-json}}") String archiveDir,
            @Value("${lingxing.raw-archive.retention-days:${LINGXING_RAW_ARCHIVE_RETENTION_DAYS:180}}") int retentionDays,
            @Value("${lingxing.raw-archive.max-file-mb:${LINGXING_RAW_ARCHIVE_MAX_FILE_MB:50}}") int maxFileMb) {
        this.enabled = enabled && StringUtils.hasText(archiveDir);
        this.archiveRoot = StringUtils.hasText(archiveDir) ? Path.of(archiveDir).toAbsolutePath().normalize() : null;
        this.retentionDays = Math.max(retentionDays, 1);
        this.maxFileBytes = Math.max(maxFileMb, 1) * 1024L * 1024L;
    }

    public ArchiveWriter openProductPerformanceWriter(String summaryField,
                                                      String startDate,
                                                      String endDate,
                                                      String sidScope) {
        String runId = "product-performance-" + LocalDateTime.now().format(RUN_TS) + "-" +
                UUID.randomUUID().toString().substring(0, 8);
        if (!enabled) {
            return ArchiveWriter.disabled(runId);
        }
        Path dir = archiveRoot
                .resolve("product-performance")
                .resolve("summary-" + sanitize(summaryField))
                .resolve(monthPart(startDate))
                .resolve(runId);
        return new ArchiveWriter(runId, dir, maxFileBytes, objectMapper, summaryField, startDate, endDate, sidScope);
    }

    public void cleanupExpiredFiles() {
        if (!enabled || archiveRoot == null || !Files.exists(archiveRoot)) {
            return;
        }
        LocalDate cutoff = LocalDate.now().minusDays(retentionDays);
        try (Stream<Path> paths = Files.walk(archiveRoot)) {
            paths.filter(Files::isRegularFile)
                    .filter(p -> p.getFileName().toString().endsWith(".jsonl.gz"))
                    .filter(p -> olderThan(p, cutoff))
                    .forEach(this::deleteQuietly);
        } catch (IOException ex) {
            log.warn("领星 raw_json 归档清理失败 root={}", archiveRoot, ex);
        }
        deleteEmptyDirs();
    }

    private boolean olderThan(Path path, LocalDate cutoff) {
        try {
            return Files.getLastModifiedTime(path).toInstant()
                    .atZone(java.time.ZoneId.systemDefault())
                    .toLocalDate()
                    .isBefore(cutoff);
        } catch (IOException ex) {
            return false;
        }
    }

    private void deleteEmptyDirs() {
        try (Stream<Path> paths = Files.walk(archiveRoot)) {
            paths.filter(Files::isDirectory)
                    .sorted(Comparator.reverseOrder())
                    .filter(p -> !p.equals(archiveRoot))
                    .forEach(p -> {
                        try (Stream<Path> children = Files.list(p)) {
                            if (children.findAny().isEmpty()) {
                                Files.deleteIfExists(p);
                            }
                        } catch (IOException ignored) {
                            // Best-effort cleanup only.
                        }
                    });
        } catch (IOException ignored) {
            // Best-effort cleanup only.
        }
    }

    private void deleteQuietly(Path path) {
        try {
            Files.deleteIfExists(path);
        } catch (IOException ex) {
            log.warn("删除领星 raw_json 归档失败 path={}", path, ex);
        }
    }

    private String monthPart(String startDate) {
        if (StringUtils.hasText(startDate) && startDate.length() >= 7) {
            return startDate.substring(0, 7);
        }
        return LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM"));
    }

    private String sanitize(String value) {
        if (!StringUtils.hasText(value)) {
            return "unknown";
        }
        return value.trim().replaceAll("[^A-Za-z0-9_-]", "_");
    }

    public static final class ArchiveWriter implements AutoCloseable {
        @Getter
        private final String runId;
        private final boolean enabled;
        private final Path dir;
        private final long maxFileBytes;
        private final ObjectMapper objectMapper;
        private final String summaryField;
        private final String startDate;
        private final String endDate;
        private final String sidScope;
        private BufferedWriter writer;
        private int partNo = 0;
        private long currentBytes = 0L;

        private ArchiveWriter(String runId, Path dir, long maxFileBytes, ObjectMapper objectMapper,
                              String summaryField, String startDate, String endDate, String sidScope) {
            this.runId = runId;
            this.enabled = true;
            this.dir = dir;
            this.maxFileBytes = maxFileBytes;
            this.objectMapper = objectMapper;
            this.summaryField = summaryField;
            this.startDate = startDate;
            this.endDate = endDate;
            this.sidScope = sidScope;
        }

        private ArchiveWriter(String runId) {
            this.runId = runId;
            this.enabled = false;
            this.dir = null;
            this.maxFileBytes = 0L;
            this.objectMapper = null;
            this.summaryField = null;
            this.startDate = null;
            this.endDate = null;
            this.sidScope = null;
        }

        private static ArchiveWriter disabled(String runId) {
            return new ArchiveWriter(runId);
        }

        public void write(JsonNode row) {
            if (!enabled) {
                return;
            }
            try {
                ObjectNode envelope = objectMapper.createObjectNode();
                envelope.put("archivedAt", LocalDateTime.now().toString());
                envelope.put("source", "lingxing.productPerformance.asinList");
                envelope.put("summaryField", summaryField);
                envelope.put("startDate", startDate);
                envelope.put("endDate", endDate);
                envelope.put("sidScope", sidScope);
                envelope.set("row", row);
                String line = objectMapper.writeValueAsString(envelope) + "\n";
                byte[] bytes = line.getBytes(StandardCharsets.UTF_8);
                if (writer == null || currentBytes + bytes.length > maxFileBytes) {
                    rotate();
                }
                writer.write(line);
                currentBytes += bytes.length;
            } catch (IOException ex) {
                throw new IllegalStateException("领星 raw_json 归档写入失败", ex);
            }
        }

        private void rotate() throws IOException {
            closeCurrent();
            Files.createDirectories(dir);
            partNo++;
            Path file = dir.resolve("part-" + String.format("%03d", partNo) + ".jsonl.gz");
            writer = new BufferedWriter(new OutputStreamWriter(
                    new GZIPOutputStream(Files.newOutputStream(file)), StandardCharsets.UTF_8));
            currentBytes = 0L;
        }

        @Override
        public void close() {
            try {
                closeCurrent();
            } catch (IOException ex) {
                throw new IllegalStateException("领星 raw_json 归档关闭失败", ex);
            }
        }

        private void closeCurrent() throws IOException {
            if (writer != null) {
                writer.close();
                writer = null;
            }
        }
    }
}

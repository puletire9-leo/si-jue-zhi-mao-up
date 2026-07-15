package com.sjzm.product.service;

import com.sjzm.product.dto.SelectionCsvRowRef;
import com.sjzm.product.dto.SelectionPageCsvExportRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.nio.charset.StandardCharsets;
import java.sql.ResultSetMetaData;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * 按统一选品页面全部筛选结果的行定位信息，从真实数据表导出完整数据库列。
 *
 * <p>表名只能由服务端白名单决定，前端不能传任意表名。</p>
 */
@Service
@RequiredArgsConstructor
public class SelectionPageCsvExportService {

    private static final int MAX_ROWS = 10_000;
    private static final DateTimeFormatter FILE_TIME = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss");

    private static final Map<String, SourceSpec> SOURCE_SPECS = Map.of(
            "competitor_clean", new SourceSpec(
                    "competitor_products_clean", List.of("effective_week_tag", "week_tag")),
            "competitor_raw", new SourceSpec(
                    "competitor_products", List.of("week_tag")),
            "deng_zong", new SourceSpec(
                    "deng_zong_shop", List.of("batch_date")),
            "shop_products", new SourceSpec(
                    "shop_products", List.of("batch_date", "batch_code", "week_tag"))
    );

    private final JdbcTemplate jdbcTemplate;

    public CsvExport exportCurrentPage(SelectionPageCsvExportRequest request) {
        SourceSpec spec = SOURCE_SPECS.get(normalizeSource(request.getSource()));
        if (spec == null) {
            throw new IllegalArgumentException("不支持的选品数据源: " + request.getSource());
        }
        if (request.getRows() == null || request.getRows().isEmpty()) {
            throw new IllegalArgumentException("当前筛选没有可导出的商品");
        }
        if (request.getRows().size() > MAX_ROWS) {
            throw new IllegalArgumentException("单次最多导出 " + MAX_ROWS + " 条筛选结果");
        }

        List<SelectionCsvRowRef> refs = request.getRows().stream()
                .filter(Objects::nonNull)
                .filter(row -> StringUtils.hasText(row.getAsin()))
                .toList();
        if (refs.isEmpty()) {
            throw new IllegalArgumentException("当前筛选没有有效 ASIN");
        }

        Set<String> asinSet = new LinkedHashSet<>();
        refs.forEach(row -> asinSet.add(row.getAsin().trim()));
        QueryResult queryResult = queryRows(spec.tableName(), request.getMarketplace(), new ArrayList<>(asinSet));

        Map<String, List<Map<String, Object>>> rowsByAsin = new LinkedHashMap<>();
        for (Map<String, Object> row : queryResult.rows()) {
            String asin = stringValue(row.get("asin"));
            rowsByAsin.computeIfAbsent(asin, ignored -> new ArrayList<>()).add(row);
        }

        List<Map<String, Object>> orderedRows = new ArrayList<>();
        for (SelectionCsvRowRef ref : refs) {
            Map<String, Object> matched = findMatchingRow(
                    ref,
                    rowsByAsin.getOrDefault(ref.getAsin().trim(), List.of()),
                    spec.snapshotColumns()
            );
            if (matched != null) {
                orderedRows.add(matched);
            }
        }

        byte[] csv = buildCsv(queryResult.columns(), orderedRows);
        String filename = "selection_current_page_"
                + normalizeSource(request.getSource()) + "_"
                + request.getMarketplace().toUpperCase(Locale.ROOT) + "_"
                + LocalDateTime.now().format(FILE_TIME) + ".csv";
        return new CsvExport(csv, filename, orderedRows.size());
    }

    private QueryResult queryRows(String tableName, String marketplace, List<String> asins) {
        String placeholders = String.join(",", java.util.Collections.nCopies(asins.size(), "?"));
        String sql = "SELECT * FROM " + tableName
                + " WHERE marketplace = ? AND asin IN (" + placeholders + ")"
                + " ORDER BY created_at DESC, id DESC";

        return jdbcTemplate.query(sql, statement -> {
            int index = 1;
            statement.setString(index++, marketplace.toUpperCase(Locale.ROOT));
            for (String asin : asins) {
                statement.setString(index++, asin);
            }
        }, resultSet -> {
            ResultSetMetaData metadata = resultSet.getMetaData();
            int columnCount = metadata.getColumnCount();
            List<String> columns = new ArrayList<>(columnCount);
            for (int i = 1; i <= columnCount; i++) {
                columns.add(metadata.getColumnLabel(i));
            }

            List<Map<String, Object>> rows = new ArrayList<>();
            while (resultSet.next()) {
                Map<String, Object> row = new LinkedHashMap<>();
                for (int i = 1; i <= columnCount; i++) {
                    row.put(columns.get(i - 1), resultSet.getObject(i));
                }
                rows.add(row);
            }
            return new QueryResult(columns, rows);
        });
    }

    private Map<String, Object> findMatchingRow(
            SelectionCsvRowRef ref,
            List<Map<String, Object>> candidates,
            List<String> snapshotColumns
    ) {
        if (candidates.isEmpty()) {
            return null;
        }

        if (StringUtils.hasText(ref.getId())) {
            for (Map<String, Object> candidate : candidates) {
                if (ref.getId().trim().equals(stringValue(candidate.get("id")))) {
                    return candidate;
                }
            }
        }

        if (StringUtils.hasText(ref.getSnapshotKey())) {
            String expected = ref.getSnapshotKey().trim();
            for (Map<String, Object> candidate : candidates) {
                for (String column : snapshotColumns) {
                    if (expected.equals(stringValue(candidate.get(column)))) {
                        return candidate;
                    }
                }
            }
        }

        // SQL 已按 created_at / id 倒序；没有快照信息时取该 ASIN 最新记录。
        return candidates.get(0);
    }

    private byte[] buildCsv(List<String> columns, List<Map<String, Object>> rows) {
        StringBuilder csv = new StringBuilder(4096);
        appendCsvLine(csv, new ArrayList<>(columns));
        for (Map<String, Object> row : rows) {
            List<Object> values = new ArrayList<>(columns.size());
            for (String column : columns) {
                values.add(row.get(column));
            }
            appendCsvLine(csv, values);
        }

        byte[] content = csv.toString().getBytes(StandardCharsets.UTF_8);
        byte[] withBom = new byte[content.length + 3];
        withBom[0] = (byte) 0xEF;
        withBom[1] = (byte) 0xBB;
        withBom[2] = (byte) 0xBF;
        System.arraycopy(content, 0, withBom, 3, content.length);
        return withBom;
    }

    private void appendCsvLine(StringBuilder csv, List<?> values) {
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) {
                csv.append(',');
            }
            csv.append(escapeCsvValue(values.get(i)));
        }
        csv.append("\r\n");
    }

    private String escapeCsvValue(Object value) {
        if (value == null) {
            return "\"\"";
        }
        String text = value instanceof byte[] bytes
                ? Base64.getEncoder().encodeToString(bytes)
                : String.valueOf(value);
        // 避免标题等外部文本在 Excel 中触发 CSV 公式注入。
        if (value instanceof CharSequence && !text.isEmpty() && "=+-@".indexOf(text.charAt(0)) >= 0) {
            text = "'" + text;
        }
        return "\"" + text.replace("\"", "\"\"") + "\"";
    }

    private String normalizeSource(String source) {
        return source == null ? "" : source.trim().toLowerCase(Locale.ROOT);
    }

    private String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private record SourceSpec(String tableName, List<String> snapshotColumns) {
    }

    private record QueryResult(List<String> columns, List<Map<String, Object>> rows) {
    }

    public record CsvExport(byte[] content, String filename, int exportedRows) {
    }
}

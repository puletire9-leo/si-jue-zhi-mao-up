package com.sjzm.product.modules.automation.job;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sjzm.product.modules.automation.config.FinanceDailyReportConfig;
import com.sjzm.product.modules.automation.entity.AutomationRecordBinding;
import com.sjzm.product.modules.automation.service.AutomationBindingService;
import com.sjzm.product.modules.feishu.service.FeishuClient;
import com.sjzm.product.modules.lingxing.dto.FinanceDailyReportResult;
import com.sjzm.product.modules.lingxing.dto.FinanceDailyReportRow;
import com.sjzm.product.modules.lingxing.service.LingxingFinanceDailyReportService;
import com.sjzm.product.modules.lingxing.service.LingxingListingSyncService;
import com.sjzm.product.modules.roster.service.PersonRosterService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 领星财务日报任务（FINANCE_DAILY_REPORT）。
 *
 * <p>接入 automation 请求中心（{@link AutomationJob}，触发端点 POST /api/v1/modules/automation/jobs/{jobCode}/run），
 * 参数 {@code reportDate}（yyyy-MM-dd，缺省昨天）。执行：
 * <ol>
 *   <li>{@link LingxingFinanceDailyReportService#run(LocalDate)} 拉领星单日 asinList →
 *       完整采集 UK/DE 并由领星换算 GBP 后落 RDS → 两站白名单过滤 → 跨站点 ASIN 合并 → ALL/GBP 动态行；</li>
 *   <li>按维度把统一 GBP 动态行幂等写入 5 张飞书数据表（通过 automation_record_binding 记录绑定）。</li>
 * </ol>
 * 阶段耗时与结果落入 AutomationRun.resultJson（审计）。
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class FinanceDailyReportJob implements AutomationJob {

    public static final String CODE = "FINANCE_DAILY_REPORT";
    private static final String TARGET_TYPE = "FEISHU";
    private static final int BATCH_SIZE = 200;

    /** 开发/非标品/上架时间三张表用内部名（与最终日报 Sheet 命名一致） */
    private static final Set<String> INTERNAL_NAMING_DIMENSIONS = Set.of("开发", "非标品", "上架时间");

    private static final Map<String, String> INTERNAL_NAMES = Map.of(
            "SKU总数量", "看SKU数据",
            "动销＞90天的SKU", "SKU的库存/销量",
            "未上架SKU", "没库存的",
            "断货SKU", "有出单后面没库存的");

    private static final Map<String, String> DIMENSION_VALUE_FIELD = Map.of(
            "运营", "销售人员",
            "开发", "开发人员",
            "上架时间", "上架时间");

    private final LingxingFinanceDailyReportService service;
    private final LingxingListingSyncService listingSyncService;
    private final FeishuClient feishuClient;
    private final AutomationBindingService bindingService;
    private final FinanceDailyReportConfig config;
    private final PersonRosterService personRosterService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public String code() {
        return CODE;
    }

    @Override
    public String name() {
        return "领星财务日报";
    }

    @Override
    public String description() {
        return "完整采集领星 UK/DE 单日产品表现，由领星统一换算 GBP 后按 ASIN 合并生成财务日报";
    }

    @Override
    public AutomationJobResult execute(AutomationExecutionContext context) {
        AutomationStageTimer timer = new AutomationStageTimer();
        LocalDate reportDate = reportDate(context);
        boolean pullFromLingxing = booleanParameter(context, "pullFromLingxing", true);
        boolean refreshListing = booleanParameter(context, "refreshListing", pullFromLingxing);
        boolean persistFacts = booleanParameter(context, "persistFacts", pullFromLingxing);
        // 调试/补数阶段默认不冻结；只有日报确认完成时显式传 true。
        boolean persistStatusSnapshot = booleanParameter(
                context, "persistStatusSnapshot", false);
        boolean allowRepull = booleanParameter(context, "allowRepull", false);
        boolean publishToFeishu = booleanParameter(context, "publishToFeishu", true);
        if (publishToFeishu) timer.time("validateTarget", this::validateTarget);
        Map<String, Object> listingRefresh = Map.of();
        if (refreshListing) {
            listingRefresh = timer.time("refreshListing", listingSyncService::refreshTargetListings);
        }

        FinanceDailyReportResult result = timer.time("financeProcessing", () -> service.run(
                reportDate, pullFromLingxing, persistFacts, persistStatusSnapshot, allowRepull));
        timer.addAll(result.getStageDurationsMs());
        if (publishToFeishu) {
            timer.time("validateReportQuality", () -> validateDataQualityForPublish(result));
        }

        long created = 0;
        long updated = 0;
        long failed = 0;
        if (publishToFeishu) {
            for (Map.Entry<String, String> entry : tableByDimension().entrySet()) {
                String dimension = entry.getKey();
                String tableId = entry.getValue();
                List<FinanceDailyReportRow> rows = result.getRows().stream()
                        .filter(r -> dimension.equals(r.dimension()))
                        .toList();
                try {
                    int[] counts = timer.time(publishStage(dimension), () ->
                            publishRows(dimension, tableId, reportDate, rows));
                    created += counts[0];
                    updated += counts[1];
                } catch (RuntimeException ex) {
                    failed += rows.size();
                    log.error("财务日报飞书发布失败 dimension={}, reason={}", dimension, ex.getMessage(), ex);
                }
            }
        }

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("reportDate", reportDate.toString());
        details.put("pullFromLingxing", pullFromLingxing);
        details.put("refreshListing", refreshListing);
        details.put("listingRefresh", listingRefresh);
        details.put("persistFacts", persistFacts);
        details.put("persistStatusSnapshot", persistStatusSnapshot);
        details.put("allowRepull", allowRepull);
        details.put("publishToFeishu", publishToFeishu);
        details.put("stageDurationsMs", timer.snapshot());
        details.put("fetchedRows", result.getFetchedRows());
        details.put("teamRows", result.getTeamRows());
        details.put("distinctAsins", result.getDistinctAsins());
        details.put("storedRows", result.getStoredRows());
        details.put("storedStatusRows", result.getStoredStatusRows());
        details.put("statusSnapshotDate", result.getStatusSnapshotDate());
        details.put("priorOutOfStockAsins", result.getPriorOutOfStockAsins());
        details.put("priorPositiveAsins", result.getPriorPositiveAsins());
        details.put("unifiedMatchAsins", result.getUnifiedMatchAsins());
        details.put("created", created);
        details.put("updated", updated);
        details.put("rows", result.getRows());
        details.put("total", totalMetrics(result));
        long success = publishToFeishu ? created + updated : result.getRows().size();
        return new AutomationJobResult(result.getRows().size(), success, failed, 0, details);
    }

    private String publishStage(String dimension) {
        return switch (dimension) {
            case "总" -> "publishFeishuTotal";
            case "运营" -> "publishFeishuOperations";
            case "开发" -> "publishFeishuDevelopers";
            case "非标品" -> "publishFeishuNonstandard";
            case "上架时间" -> "publishFeishuListingTime";
            default -> "publishFeishuOther";
        };
    }

    private boolean booleanParameter(AutomationExecutionContext context, String key, boolean defaultValue) {
        Object value = context.parameters().get(key);
        if (value == null) return defaultValue;
        if (value instanceof Boolean bool) return bool;
        return Boolean.parseBoolean(String.valueOf(value));
    }

    /** 按维度把若干行幂等写入一张飞书表，返回 {created, updated}。 */
    private int[] publishRows(String dimension, String tableId, LocalDate reportDate,
                              List<FinanceDailyReportRow> rows) {
        String resource = config.getFeishuAppToken() + ":" + tableId;
        List<DeliveryItem> creates = new ArrayList<>();
        List<DeliveryItem> updates = new ArrayList<>();
        for (FinanceDailyReportRow row : rows) {
            String businessKey = businessKey(reportDate, dimension, row);
            AutomationRecordBinding binding = bindingService.find(CODE, businessKey, TARGET_TYPE, resource);
            if (binding == null) creates.add(new DeliveryItem(row, null, businessKey));
            else updates.add(new DeliveryItem(row, binding, businessKey));
        }
        int created = 0;
        int updated = 0;
        for (int from = 0; from < creates.size(); from += BATCH_SIZE) {
            List<DeliveryItem> batch = creates.subList(from, Math.min(from + BATCH_SIZE, creates.size()));
            created += createBatch(dimension, tableId, resource, reportDate, batch);
        }
        for (int from = 0; from < updates.size(); from += BATCH_SIZE) {
            List<DeliveryItem> batch = updates.subList(from, Math.min(from + BATCH_SIZE, updates.size()));
            updateBatch(dimension, tableId, resource, reportDate, batch);
            updated += batch.size();
        }
        return new int[]{created, updated};
    }

    private int createBatch(String dimension, String tableId, String resource,
                            LocalDate reportDate, List<DeliveryItem> batch) {
        ArrayNode records = objectMapper.createArrayNode();
        for (DeliveryItem item : batch) {
            records.add(objectMapper.createObjectNode().set("fields", fields(dimension, reportDate, item.row())));
        }
        JsonNode resp = feishuClient.batchCreateRecords(config.getFeishuAppToken(), tableId, records);
        JsonNode created = resp.path("data").path("records");
        if (!created.isArray() || created.size() != batch.size()) {
            throw new IllegalStateException("飞书批量新增返回记录数不一致: " + batch.size());
        }
        for (int i = 0; i < batch.size(); i++) {
            String recordId = created.get(i).path("record_id").asText();
            if (!StringUtils.hasText(recordId)) throw new IllegalStateException("飞书新增记录缺少 record_id");
            saveBinding(batch.get(i), null, recordId, resource);
        }
        return batch.size();
    }

    private void updateBatch(String dimension, String tableId, String resource,
                             LocalDate reportDate, List<DeliveryItem> batch) {
        ArrayNode records = objectMapper.createArrayNode();
        for (DeliveryItem item : batch) {
            ObjectNode record = objectMapper.createObjectNode();
            record.put("record_id", item.binding().getTargetRecordId());
            record.set("fields", fields(dimension, reportDate, item.row()));
            records.add(record);
        }
        feishuClient.batchUpdateRecords(config.getFeishuAppToken(), tableId, records);
        for (DeliveryItem item : batch) {
            saveBinding(item, item.binding(), item.binding().getTargetRecordId(), resource);
        }
    }

    /** 单行 → 飞书 fields（日期 + 国家 + 币种 + 维度值 + 16 指标）。 */
    private ObjectNode fields(String dimension, LocalDate reportDate, FinanceDailyReportRow row) {
        ObjectNode fields = objectMapper.createObjectNode();
        long epochMillis = reportDate.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli();
        fields.put("日期", epochMillis);
        fields.put("国家", row.marketplace());
        fields.put("币种", row.currencyCode());

        String dimValueField = DIMENSION_VALUE_FIELD.get(dimension);
        if (dimValueField != null) {
            fields.put(dimValueField, row.dimensionValue());
        }
        boolean internal = INTERNAL_NAMING_DIMENSIONS.contains(dimension);
        for (Map.Entry<String, BigDecimal> e : row.metrics().entrySet()) {
            String metric = e.getKey();
            String fieldName = internal ? INTERNAL_NAMES.getOrDefault(metric, metric) : metric;
            BigDecimal value = e.getValue() == null ? BigDecimal.ZERO : e.getValue();
            if (LingxingFinanceDailyReportService.MONEY_METRICS.contains(metric)) {
                fields.put(fieldName, value.setScale(2, RoundingMode.HALF_UP).doubleValue());
            } else {
                fields.put(fieldName, value.longValue());
            }
        }
        return fields;
    }

    private void saveBinding(DeliveryItem item, AutomationRecordBinding current,
                             String recordId, String resource) {
        AutomationRecordBinding binding = new AutomationRecordBinding();
        if (current != null) binding.setId(current.getId());
        binding.setJobCode(CODE);
        binding.setBusinessKey(item.businessKey());
        binding.setTargetType(TARGET_TYPE);
        binding.setTargetResource(resource);
        binding.setTargetRecordId(recordId);
        binding.setTerminal(0);
        bindingService.bind(binding);
    }

    private String businessKey(LocalDate reportDate, String dimension, FinanceDailyReportRow row) {
        return reportDate + "|" + row.marketplace() + "|" + dimension + "|"
                + (row.dimensionValue() == null ? "" : row.dimensionValue());
    }

    private Map<String, String> tableByDimension() {
        Map<String, String> map = new LinkedHashMap<>();
        map.put("总", config.getFeishuTableTotal());
        map.put("运营", config.getFeishuTableOperations());
        map.put("开发", config.getFeishuTableDeveloper());
        map.put("非标品", config.getFeishuTableNonstandard());
        map.put("上架时间", config.getFeishuTableListingTime());
        return map;
    }

    private Map<String, Object> totalMetrics(FinanceDailyReportResult result) {
        Map<String, Object> total = new LinkedHashMap<>();
        result.getRows().stream().filter(r -> "总".equals(r.dimension())).forEach(row -> {
            Map<String, Object> marketplaceTotal = new LinkedHashMap<>();
            row.metrics().forEach((k, v) -> {
                    BigDecimal value = v == null ? BigDecimal.ZERO : v;
                    if (LingxingFinanceDailyReportService.MONEY_METRICS.contains(k)) {
                        marketplaceTotal.put(k, value.setScale(2, RoundingMode.HALF_UP).doubleValue());
                    } else {
                        marketplaceTotal.put(k, value.longValue());
                    }
                });
            marketplaceTotal.put("币种", row.currencyCode());
            total.put(row.marketplace(), marketplaceTotal);
        });
        return total;
    }

    private void validateTarget() {
        if (!StringUtils.hasText(config.getFeishuAppToken())) {
            throw new IllegalStateException("未配置财务日报飞书 app token（FINANCE_DAILY_REPORT_FEISHU_APP_TOKEN）");
        }
        if (tableByDimension().values().stream().anyMatch(v -> !StringUtils.hasText(v))) {
            throw new IllegalStateException("未配置财务日报飞书 5 张数据表 ID（FINANCE_DAILY_REPORT_TABLE_*）");
        }
    }

    /**
     * 发布门禁：缺少远程主数据或历史基线时允许阶段计算和审计，但禁止污染飞书日报。
     */
    private void validateDataQualityForPublish(FinanceDailyReportResult result) {
        List<FinanceDailyReportRow> rows = result.getRows();
        LocalDate reportDate = result.getReportDate();
        Set<String> configuredOperators = Set.copyOf(
                personRosterService.listNamesEffectiveOn("operator", reportDate));
        Set<String> configuredDevelopers = Set.copyOf(
                personRosterService.listNamesEffectiveOn("developer", reportDate));
        int maxRows = 4 + configuredOperators.size() + configuredDevelopers.size();
        if (rows.size() < 4 || rows.size() > maxRows) {
            throw new IllegalStateException("财务日报 GBP 动态行数异常，拒绝发布飞书: expected=4.."
                    + maxRows + ", actual=" + rows.size());
        }
        Map<String, Long> dimensionCounts = rows.stream().collect(java.util.stream.Collectors.groupingBy(
                FinanceDailyReportRow::dimension, LinkedHashMap::new, java.util.stream.Collectors.counting()));
        if (dimensionCounts.getOrDefault("总", 0L) != 1L
                || dimensionCounts.getOrDefault("非标品", 0L) != 1L
                || dimensionCounts.getOrDefault("上架时间", 0L) != 2L
                || dimensionCounts.getOrDefault("运营", 0L) > configuredOperators.size()
                || dimensionCounts.getOrDefault("开发", 0L) > configuredDevelopers.size()
                || dimensionCounts.keySet().stream().anyMatch(
                        dimension -> !Set.of("总", "非标品", "上架时间", "运营", "开发").contains(dimension))) {
            throw new IllegalStateException("财务日报 GBP 维度结构异常，拒绝发布飞书: " + dimensionCounts);
        }
        Set<String> outputOperators = rows.stream()
                .filter(row -> "运营".equals(row.dimension()))
                .map(FinanceDailyReportRow::dimensionValue)
                .collect(java.util.stream.Collectors.toSet());
        Set<String> outputDevelopers = rows.stream()
                .filter(row -> "开发".equals(row.dimension()))
                .map(FinanceDailyReportRow::dimensionValue)
                .collect(java.util.stream.Collectors.toSet());
        if (!configuredOperators.containsAll(outputOperators)
                || !configuredDevelopers.containsAll(outputDevelopers)) {
            throw new IllegalStateException("财务日报包含目标日期未配置人员，拒绝发布飞书: operators="
                    + outputOperators + ", developers=" + outputDevelopers);
        }
        long distinctBusinessRows = rows.stream()
                .map(row -> row.dimension() + "|" + row.dimensionValue())
                .distinct().count();
        if (distinctBusinessRows != rows.size()) {
            throw new IllegalStateException("财务日报存在重复维度行，拒绝发布飞书");
        }
        if (rows.stream().anyMatch(row -> !"ALL".equals(row.marketplace()))) {
            throw new IllegalStateException("财务日报仍按国家拆分，拒绝发布飞书");
        }
        if (rows.stream().anyMatch(row -> !"GBP".equals(row.currencyCode()))) {
            throw new IllegalStateException("财务日报币种异常，拒绝发布飞书: expected=GBP");
        }
        BigDecimal totalSku = rows.stream()
                .filter(row -> "总".equals(row.dimension()))
                .map(row -> row.metrics().getOrDefault("SKU总数量", BigDecimal.ZERO))
                .findFirst().orElse(BigDecimal.ZERO);
        BigDecimal listingSku = rows.stream()
                .filter(row -> "上架时间".equals(row.dimension()))
                .map(row -> row.metrics().getOrDefault("SKU总数量", BigDecimal.ZERO))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (listingSku.compareTo(totalSku) > 0) {
            throw new IllegalStateException("财务日报上架时间 SKU 大于总量，拒绝发布飞书: totalSku="
                    + totalSku + ", listingTimeSku=" + listingSku);
        }
        int distinct = result.getDistinctAsins();
        if (distinct <= 0) {
            throw new IllegalStateException("财务日报无有效 ASIN，拒绝发布飞书");
        }
    }

    private LocalDate reportDate(AutomationExecutionContext context) {
        Object value = context.parameters() == null ? null : context.parameters().get("reportDate");
        if (value != null) {
            String s = String.valueOf(value).trim();
            if (s.length() >= 10) {
                try {
                    return LocalDate.parse(s.substring(0, 10));
                } catch (Exception ignored) {
                    // 解析失败退回默认
                }
            }
        }
        return LocalDate.now().minusDays(1);
    }

    private record DeliveryItem(FinanceDailyReportRow row, AutomationRecordBinding binding, String businessKey) {
    }
}

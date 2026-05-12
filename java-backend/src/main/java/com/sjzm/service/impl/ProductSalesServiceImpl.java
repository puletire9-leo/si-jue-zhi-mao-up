package com.sjzm.service.impl;

import com.sjzm.dto.*;
import com.sjzm.service.ProductSalesService;
import lombok.extern.slf4j.Slf4j;
import org.apache.hadoop.conf.Configuration;
import org.apache.parquet.column.page.PageReadStore;
import org.apache.parquet.example.data.Group;
import org.apache.parquet.example.data.simple.SimpleGroupFactory;
import org.apache.parquet.hadoop.ParquetReader;
import org.apache.parquet.hadoop.example.GroupReadSupport;
import org.apache.parquet.hadoop.metadata.ParquetMetadata;
import org.apache.parquet.schema.MessageType;
import org.apache.hadoop.fs.Path;
import org.apache.parquet.schema.PrimitiveType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
public class ProductSalesServiceImpl implements ProductSalesService {

    @Value("${parquet.data.dir:/data/parquet}")
    private String parquetDataDir;

    @Value("${parquet.file.name:product_sales.parquet}")
    private String parquetFileName;

    private String parquetFilePath;

    private final Map<String, List<Integer>> asinIndex = new ConcurrentHashMap<>();
    private final Set<String> shopsSet = ConcurrentHashMap.newKeySet();
    private final AtomicLong totalRows = new AtomicLong(0);
    private final Map<String, String> dateRange = new ConcurrentHashMap<>(2);
    private volatile boolean indexBuilt = false;
    private final Object indexLock = new Object();

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final Pattern KEYWORD_PATTERN = Pattern.compile("[a-zA-Z0-9]+");

    private static final Set<String> CORE_COLUMNS = Set.of(
            "ASIN", "标题", "SKU", "MSKU", "店铺", "销量", "销售额", "订单量",
            "日期", "结算毛利润", "结算毛利率", "订单毛利润", "订单毛利率",
            "广告花费", "广告订单量", "ACOS", "退款金额", "退款量", "退款率"
    );

    @PostConstruct
    public void init() {
        this.parquetFilePath = parquetDataDir + "/" + parquetFileName;
        log.info("[ProductSalesService] Initialized with parquet path: {}", parquetFilePath);
    }

    @Override
    public SearchResponse searchProducts(String keyword, List<String> shops, String startDate, String endDate, int limit, int offset) {
        ensureIndexBuilt();

        List<ProductSummary> allResults = new ArrayList<>();
        Set<String> seenAsins = ConcurrentHashMap.newKeySet();

        try (ParquetReader<Group> reader = createParquetReader()) {
            Group line;
            int batchCount = 0;
            int maxBatches = 1000;

            while ((line = reader.read()) != null && batchCount < maxBatches) {
                if (allResults.size() >= limit + offset + 100) {
                    break;
                }

                String asin = getStringValue(line, "ASIN", "");
                if (asin == null || asin.isBlank()) {
                    continue;
                }
                asin = asin.trim().toUpperCase();
                if (seenAsins.contains(asin)) {
                    continue;
                }

                if (keyword != null && !keyword.isBlank() && !matchesKeyword(line, keyword)) {
                    continue;
                }

                if (shops != null && !shops.isEmpty()) {
                    String shop = getStringValue(line, "店铺", "未知");
                    if (!shops.contains(shop)) {
                        continue;
                    }
                }

                if (startDate != null || endDate != null) {
                    String date = getStringValue(line, "日期", "");
                    if (!dateMatchesRange(date, startDate, endDate)) {
                        continue;
                    }
                }

                seenAsins.add(asin);
                allResults.add(buildProductSummary(line, asin));
                batchCount++;
            }
        } catch (IOException e) {
            log.error("[ProductSalesService] Failed to search products", e);
            throw new RuntimeException("搜索产品失败: " + e.getMessage(), e);
        }

        allResults.sort((a, b) -> Integer.compare(
                b.getTotalSales() != null ? b.getTotalSales() : 0,
                a.getTotalSales() != null ? a.getTotalSales() : 0
        ));

        long total = allResults.size();
        if (offset >= allResults.size()) {
            return new SearchResponse(total, Collections.emptyList(), false);
        }

        int endIndex = Math.min(offset + limit, allResults.size());
        List<ProductSummary> page = allResults.subList(offset, endIndex);

        return new SearchResponse(total, page, endIndex < allResults.size());
    }

    @Override
    public WeeklySalesResponse getWeeklySales(List<String> asins, String startDate, String endDate, List<String> shops) {
        if (asins == null || asins.isEmpty()) {
            return new WeeklySalesResponse(Collections.emptyList(), Collections.emptyList(), Collections.emptyMap(), Collections.emptyMap());
        }

        Set<String> asinSet = asins.stream().map(String::trim).map(String::toUpperCase).collect(Collectors.toSet());
        Set<String> shopSet = shops != null ? new HashSet<>(shops) : null;

        Map<String, Map<String, DailyData>> weeklyData = new ConcurrentHashMap<>();
        Set<String> allWeeks = ConcurrentHashMap.newKeySet();

        try (ParquetReader<Group> reader = createParquetReader()) {
            Group line;
            while ((line = reader.read()) != null) {
                String asin = getStringValue(line, "ASIN", "");
                if (asin == null || asin.isBlank()) continue;
                asin = asin.trim().toUpperCase();
                if (!asinSet.contains(asin)) continue;

                String shop = getStringValue(line, "店铺", "未知");
                if (shopSet != null && !shopSet.contains(shop)) continue;

                String dateStr = getStringValue(line, "日期", "");
                if (!dateMatchesRange(dateStr, startDate, endDate)) continue;

                String weekStart = getWeekStart(dateStr);
                if (weekStart == null) continue;

                allWeeks.add(weekStart);

                final String finalWeekStart = weekStart;
                final Group finalLine = line;
                weeklyData.computeIfAbsent(asin, k -> new ConcurrentHashMap<>())
                        .compute(finalWeekStart, (k, existing) -> {
                            DailyData data = existing != null ? existing : new DailyData();
                            data.sales += getIntValue(finalLine, "销量", 0);
                            data.revenue += getDoubleValue(finalLine, "销售额", 0.0);
                            return data;
                        });
            }
        } catch (IOException e) {
            log.error("[ProductSalesService] Failed to get weekly sales", e);
            throw new RuntimeException("获取周销量失败: " + e.getMessage(), e);
        }

        List<String> sortedWeeks = new ArrayList<>(allWeeks);
        Collections.sort(sortedWeeks);

        List<String> weekLabels = sortedWeeks.stream().map(this::formatWeekLabel).collect(Collectors.toList());

        Map<String, List<Integer>> salesData = new LinkedHashMap<>();
        Map<String, List<Double>> revenueData = new LinkedHashMap<>();

        for (String asin : asins) {
            String asinUpper = asin.trim().toUpperCase();
            List<Integer> salesList = new ArrayList<>();
            List<Double> revenueList = new ArrayList<>();

            Map<String, DailyData> asinWeekly = weeklyData.get(asinUpper);
            for (String week : sortedWeeks) {
                if (asinWeekly != null && asinWeekly.containsKey(week)) {
                    DailyData data = asinWeekly.get(week);
                    salesList.add(data.sales);
                    revenueList.add(Math.round(data.revenue * 100.0) / 100.0);
                } else {
                    salesList.add(0);
                    revenueList.add(0.0);
                }
            }
            salesData.put(asinUpper, salesList);
            revenueData.put(asinUpper, revenueList);
        }

        return new WeeklySalesResponse(sortedWeeks, weekLabels, salesData, revenueData);
    }

    @Override
    public List<ShopInfo> getShops() {
        ensureIndexBuilt();
        return shopsSet.stream().sorted().map(name -> new ShopInfo(name, 0)).collect(Collectors.toList());
    }

    @Override
    public DateRangeResponse getDateRange() {
        ensureIndexBuilt();
        String minDate = dateRange.get("minDate");
        String maxDate = dateRange.get("maxDate");

        int totalWeeks = 0;
        if (minDate != null && maxDate != null) {
            try {
                LocalDate start = LocalDate.parse(minDate, DATE_FORMATTER);
                LocalDate end = LocalDate.parse(maxDate, DATE_FORMATTER);
                totalWeeks = (int) (end.toEpochDay() - start.toEpochDay()) / 7 + 1;
            } catch (DateTimeParseException e) {
                log.warn("Failed to parse date range: {} - {}", minDate, maxDate);
            }
        }

        return new DateRangeResponse(minDate != null ? minDate : "", maxDate != null ? maxDate : "", totalWeeks);
    }

    @Override
    public PeriodComparisonResponse getPeriodComparison(List<String> asins, PeriodComparisonRequest.PeriodRange periodA, PeriodComparisonRequest.PeriodRange periodB, List<String> shops) {
        if (asins == null || asins.isEmpty()) {
            throw new IllegalArgumentException("ASIN列表不能为空");
        }
        if (asins.size() > 100) {
            throw new IllegalArgumentException("最多同时查询100个ASIN");
        }
        if (periodA == null || periodA.getStartDate() == null || periodA.getEndDate() == null) {
            throw new IllegalArgumentException("周期A日期参数不完整");
        }
        if (periodB == null || periodB.getStartDate() == null || periodB.getEndDate() == null) {
            throw new IllegalArgumentException("周期B日期参数不完整");
        }

        PeriodData dataA = getPeriodData(asins, periodA.getStartDate(), periodA.getEndDate(), shops, "周期A");
        PeriodData dataB = getPeriodData(asins, periodB.getStartDate(), periodB.getEndDate(), shops, "周期B");

        Map<String, Double> changes = calculateChanges(dataA, dataB);

        boolean isDeclining = dataB.getSales() > dataA.getSales();
        double declinePercent = 0.0;
        if (isDeclining) {
            if (dataA.getSales() > 0) {
                declinePercent = Math.round((double) (dataB.getSales() - dataA.getSales()) / dataA.getSales() * 10000.0) / 100.0;
            } else if (dataB.getSales() > 0) {
                declinePercent = 100.0;
            }
        }

        return new PeriodComparisonResponse(dataA, dataB, changes, isDeclining, isDeclining ? declinePercent : 0.0);
    }

    @Override
    public PeriodTrendComparisonResponse getPeriodTrend(List<String> asins, PeriodComparisonRequest.PeriodRange periodA, PeriodComparisonRequest.PeriodRange periodB, List<String> shops) {
        if (asins == null || asins.isEmpty()) {
            throw new IllegalArgumentException("ASIN列表不能为空");
        }
        if (asins.size() > 100) {
            throw new IllegalArgumentException("最多同时查询100个ASIN");
        }

        DailyTrendResponse trendA = getDailyTrend(asins, periodA.getStartDate(), periodA.getEndDate(), shops);
        DailyTrendResponse trendB = getDailyTrend(asins, periodB.getStartDate(), periodB.getEndDate(), shops);

        return new PeriodTrendComparisonResponse(trendA, trendB);
    }

    @Override
    public Map<String, Object> healthCheck() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", "ok");
        result.put("dataFile", parquetFilePath);
        result.put("totalRows", totalRows.get());

        try {
            List<String> columns = getColumns();
            result.put("columnsCount", columns.size());
            result.put("columns", columns);
        } catch (Exception e) {
            result.put("status", "error");
            result.put("error", e.getMessage());
        }

        return result;
    }

    private void ensureIndexBuilt() {
        if (!indexBuilt) {
            synchronized (indexLock) {
                if (!indexBuilt) {
                    buildIndex();
                }
            }
        }
    }

    private void buildIndex() {
        log.info("[ProductSalesService] Building index...");
        Set<String> asinSet = ConcurrentHashMap.newKeySet();
        Set<String> shopsLocal = ConcurrentHashMap.newKeySet();
        Set<String> dates = ConcurrentHashMap.newKeySet();

        try (ParquetReader<Group> reader = createParquetReader()) {
            Group line;
            int count = 0;
            int sampleSize = 10000;

            while ((line = reader.read()) != null && count < sampleSize) {
                String asin = getStringValue(line, "ASIN", "");
                if (asin != null && !asin.isBlank()) {
                    asinSet.add(asin.trim().toUpperCase());
                }

                String shop = getStringValue(line, "店铺", "");
                if (shop != null && !shop.isBlank()) {
                    shopsLocal.add(shop);
                }

                String date = getStringValue(line, "日期", "");
                if (date != null && !date.isBlank()) {
                    dates.add(date);
                }

                count++;
            }

            totalRows.set(count);

            if (!dates.isEmpty()) {
                List<String> sortedDates = new ArrayList<>(dates);
                Collections.sort(sortedDates);
                dateRange.put("minDate", sortedDates.get(0));
                dateRange.put("maxDate", sortedDates.get(sortedDates.size() - 1));
            }

            shopsSet.addAll(shopsLocal);
            asinSet.forEach(asin -> asinIndex.computeIfAbsent(asin, k -> new ArrayList<>()).add(0));

        } catch (IOException e) {
            log.warn("[ProductSalesService] Failed to build index: {}", e.getMessage());
        }

        indexBuilt = true;
        log.info("[ProductSalesService] Index built: {} ASINs, {} shops", asinSet.size(), shopsSet.size());
    }

    private ParquetReader<Group> createParquetReader() throws IOException {
        Configuration conf = new Configuration();
        conf.set("fs.s3a.impl", "org.apache.hadoop.fs.LocalFileSystem");

        GroupReadSupport readSupport = new GroupReadSupport();
        return ParquetReader.builder(readSupport, new Path(parquetFilePath))
                .withConf(conf)
                .build();
    }

    private List<String> getColumns() throws IOException {
        Configuration conf = new Configuration();
        org.apache.hadoop.fs.Path hdfsPath = new org.apache.hadoop.fs.Path(parquetFilePath);
        ParquetMetadata metadata =
                org.apache.parquet.hadoop.ParquetFileReader.readFooter(conf, hdfsPath);
        MessageType schema = metadata.getFileMetaData().getSchema();
        return schema.getFields().stream().map(f -> f.getName()).collect(Collectors.toList());
    }

    private boolean matchesKeyword(Group line, String keyword) {
        String keywordLower = keyword.toLowerCase().trim();
        String[] fields = {"ASIN", "标题", "SKU", "MSKU"};

        for (String field : fields) {
            String value = getStringValue(line, field, "");
            if (value != null && value.toLowerCase().contains(keywordLower)) {
                return true;
            }
        }
        return false;
    }

    private boolean dateMatchesRange(String date, String startDate, String endDate) {
        if (date == null || date.isBlank()) {
            return false;
        }
        try {
            LocalDate d = LocalDate.parse(date, DATE_FORMATTER);
            if (startDate != null && !startDate.isBlank()) {
                LocalDate start = LocalDate.parse(startDate, DATE_FORMATTER);
                if (d.isBefore(start)) return false;
            }
            if (endDate != null && !endDate.isBlank()) {
                LocalDate end = LocalDate.parse(endDate, DATE_FORMATTER);
                if (d.isAfter(end)) return false;
            }
            return true;
        } catch (DateTimeParseException e) {
            return false;
        }
    }

    private String getWeekStart(String dateStr) {
        if (dateStr == null || dateStr.isBlank()) return null;
        try {
            LocalDate date = LocalDate.parse(dateStr, DATE_FORMATTER);
            LocalDate monday = date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            return monday.format(DATE_FORMATTER);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private String formatWeekLabel(String weekStart) {
        try {
            LocalDate start = LocalDate.parse(weekStart, DATE_FORMATTER);
            LocalDate end = start.plusDays(6);
            return String.format("%02d/%02d~%02d/%02d", start.getMonthValue(), start.getDayOfMonth(),
                    end.getMonthValue(), end.getDayOfMonth());
        } catch (DateTimeParseException e) {
            return weekStart;
        }
    }

    private ProductSummary buildProductSummary(Group line, String asin) {
        return new ProductSummary(
                asin,
                truncateString(getStringValue(line, "标题", ""), 100),
                getStringValue(line, "SKU", null),
                getStringValue(line, "MSKU", null),
                getStringValue(line, "店铺", "未知"),
                getIntValue(line, "销量", 0),
                getDoubleValue(line, "销售额", 0.0)
        );
    }

    private PeriodData getPeriodData(List<String> asins, String startDate, String endDate, List<String> shops, String label) {
        Set<String> asinSet = asins.stream().map(String::trim).map(String::toUpperCase).collect(Collectors.toSet());
        Set<String> shopSet = shops != null ? new HashSet<>(shops) : null;

        PeriodData totals = new PeriodData();
        totals.setLabel(label);
        totals.setStartDate(startDate);
        totals.setEndDate(endDate);
        totals.setDateRange(startDate + " ~ " + endDate);

        try (ParquetReader<Group> reader = createParquetReader()) {
            Group line;
            while ((line = reader.read()) != null) {
                String asin = getStringValue(line, "ASIN", "");
                if (asin == null || asin.isBlank()) continue;
                asin = asin.trim().toUpperCase();
                if (!asinSet.contains(asin)) continue;

                String shop = getStringValue(line, "店铺", "未知");
                if (shopSet != null && !shopSet.contains(shop)) continue;

                String dateStr = getStringValue(line, "日期", "");
                if (!dateMatchesRange(dateStr, startDate, endDate)) continue;

                totals.setOrders(totals.getOrders() + getIntValue(line, "订单量", 0));
                totals.setSales(totals.getSales() + getIntValue(line, "销量", 0));

                double revenue = getDoubleValue(line, "销售额", 0.0);
                totals.setRevenue(totals.getRevenue() + revenue);

                totals.setGrossProfit(totals.getGrossProfit() + getDoubleValue(line, "订单毛利润", 0.0));
                totals.setSettlementProfit(totals.getSettlementProfit() + getDoubleValue(line, "结算毛利润", 0.0));

                double adSpend = getDoubleValue(line, "广告花费", 0.0);
                if (adSpend > 0) {
                    totals.setAdSpend(totals.getAdSpend() + adSpend);
                    totals.setAdOrders(totals.getAdOrders() + getIntValue(line, "广告订单量", 0));
                }

                double refundAmount = getDoubleValue(line, "退款金额", 0.0);
                if (refundAmount > 0) {
                    totals.setRefundAmount(totals.getRefundAmount() + refundAmount);
                    totals.setRefundCount(totals.getRefundCount() + getIntValue(line, "退款量", 0));
                }
            }
        } catch (IOException e) {
            log.error("[ProductSalesService] Failed to get period data", e);
        }

        totals.setRevenue(Math.round(totals.getRevenue() * 100.0) / 100.0);
        totals.setGrossProfit(Math.round(totals.getGrossProfit() * 100.0) / 100.0);
        totals.setSettlementProfit(Math.round(totals.getSettlementProfit() * 100.0) / 100.0);
        totals.setAdSpend(Math.round(totals.getAdSpend() * 100.0) / 100.0);
        totals.setRefundAmount(Math.round(totals.getRefundAmount() * 100.0) / 100.0);

        if (totals.getRevenue() > 0) {
            totals.setGrossProfitRate(Math.round(totals.getGrossProfit() / totals.getRevenue() * 10000.0) / 100.0);
            totals.setSettlementProfitRate(Math.round(totals.getSettlementProfit() / totals.getRevenue() * 10000.0) / 100.0);
            totals.setAdAcos(Math.round(totals.getAdSpend() / totals.getRevenue() * 10000.0) / 100.0);
        }
        if (totals.getSales() > 0) {
            totals.setRefundRate(Math.round((double) totals.getRefundCount() / totals.getSales() * 10000.0) / 100.0);
        }

        return totals;
    }

    private DailyTrendResponse getDailyTrend(List<String> asins, String startDate, String endDate, List<String> shops) {
        Set<String> asinSet = asins.stream().map(String::trim).map(String::toUpperCase).collect(Collectors.toSet());
        Set<String> shopSet = shops != null ? new HashSet<>(shops) : null;

        List<String> dateList = new ArrayList<>();
        Map<String, DailyData> dailyData = new ConcurrentHashMap<>();

        try {
            LocalDate start = LocalDate.parse(startDate, DATE_FORMATTER);
            LocalDate end = LocalDate.parse(endDate, DATE_FORMATTER);
            LocalDate current = start;
            while (!current.isAfter(end)) {
                String dateStr = current.format(DATE_FORMATTER);
                dateList.add(dateStr);
                dailyData.put(dateStr, new DailyData());
                current = current.plusDays(1);
            }
        } catch (DateTimeParseException e) {
            return new DailyTrendResponse(Collections.emptyList(), Collections.emptyList(), Collections.emptyList());
        }

        try (ParquetReader<Group> reader = createParquetReader()) {
            Group line;
            while ((line = reader.read()) != null) {
                String asin = getStringValue(line, "ASIN", "");
                if (asin == null || asin.isBlank()) continue;
                asin = asin.trim().toUpperCase();
                if (!asinSet.contains(asin)) continue;

                String shop = getStringValue(line, "店铺", "未知");
                if (shopSet != null && !shopSet.contains(shop)) continue;

                String dateStr = getStringValue(line, "日期", "");
                if (!dailyData.containsKey(dateStr)) continue;

                DailyData data = dailyData.get(dateStr);
                data.sales += getIntValue(line, "销量", 0);
                data.revenue += getDoubleValue(line, "销售额", 0.0);
            }
        } catch (IOException e) {
            log.error("[ProductSalesService] Failed to get daily trend", e);
        }

        List<Integer> salesList = dateList.stream().map(d -> dailyData.get(d).sales).collect(Collectors.toList());
        List<Double> revenueList = dateList.stream()
                .map(d -> Math.round(dailyData.get(d).revenue * 100.0) / 100.0)
                .collect(Collectors.toList());

        return new DailyTrendResponse(dateList, salesList, revenueList);
    }

    private Map<String, Double> calculateChanges(PeriodData dataA, PeriodData dataB) {
        Map<String, Double> changes = new LinkedHashMap<>();

        double valA = dataA.getOrders();
        double valB = dataB.getOrders();
        changes.put("orders", calculateChangePercent(valA, valB));

        valA = dataA.getSales();
        valB = dataB.getSales();
        changes.put("sales", calculateChangePercent(valA, valB));

        valA = dataA.getRevenue();
        valB = dataB.getRevenue();
        changes.put("revenue", calculateChangePercent(valA, valB));

        valA = dataA.getGrossProfit();
        valB = dataB.getGrossProfit();
        changes.put("grossProfit", calculateChangePercent(valA, valB));

        valA = dataA.getSettlementProfit();
        valB = dataB.getSettlementProfit();
        changes.put("settlementProfit", calculateChangePercent(valA, valB));

        valA = dataA.getAdSpend();
        valB = dataB.getAdSpend();
        changes.put("adSpend", calculateChangePercent(valA, valB));

        valA = dataA.getAdOrders();
        valB = dataB.getAdOrders();
        changes.put("adOrders", calculateChangePercent(valA, valB));

        valA = dataA.getRefundAmount();
        valB = dataB.getRefundAmount();
        changes.put("refundAmount", calculateChangePercent(valA, valB));

        valA = dataA.getRefundCount();
        valB = dataB.getRefundCount();
        changes.put("refundCount", calculateChangePercent(valA, valB));

        changes.put("grossProfitRate", Math.round((dataB.getGrossProfitRate() - dataA.getGrossProfitRate()) * 100.0) / 100.0);
        changes.put("settlementProfitRate", Math.round((dataB.getSettlementProfitRate() - dataA.getSettlementProfitRate()) * 100.0) / 100.0);
        changes.put("adAcos", Math.round((dataB.getAdAcos() - dataA.getAdAcos()) * 100.0) / 100.0);
        changes.put("refundRate", Math.round((dataB.getRefundRate() - dataA.getRefundRate()) * 100.0) / 100.0);

        return changes;
    }

    private double calculateChangePercent(double valA, double valB) {
        if (valA > 0) {
            return Math.round((valB - valA) / valA * 10000.0) / 100.0;
        } else if (valB > 0) {
            return 100.0;
        } else {
            return 0.0;
        }
    }

    private String getStringValue(Group line, String fieldName, String defaultValue) {
        try {
            if (line.getType().containsField(fieldName)) {
                int index = line.getType().getFieldIndex(fieldName);
                if (line.getFieldRepetitionCount(index) > 0) {
                    return line.getValueToString(index, 0);
                }
            }
        } catch (Exception e) {
            // ignore
        }
        return defaultValue;
    }

    private int getIntValue(Group line, String fieldName, int defaultValue) {
        try {
            if (line.getType().containsField(fieldName)) {
                int index = line.getType().getFieldIndex(fieldName);
                if (line.getFieldRepetitionCount(index) > 0) {
                    return line.getInteger(index, 0);
                }
            }
        } catch (Exception e) {
            // ignore
        }
        return defaultValue;
    }

    private double getDoubleValue(Group line, String fieldName, double defaultValue) {
        try {
            if (line.getType().containsField(fieldName)) {
                int index = line.getType().getFieldIndex(fieldName);
                if (line.getFieldRepetitionCount(index) > 0) {
                    return line.getDouble(index, 0);
                }
            }
        } catch (Exception e) {
            // ignore
        }
        return defaultValue;
    }

    private String truncateString(String str, int maxLength) {
        if (str == null) return "";
        return str.length() > maxLength ? str.substring(0, maxLength) : str;
    }

    private static class DailyData {
        int sales = 0;
        double revenue = 0.0;
    }
}

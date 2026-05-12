package com.sjzm.service.impl;

import com.sjzm.service.ProductDataService;
import lombok.extern.slf4j.Slf4j;
import org.apache.hadoop.conf.Configuration;
import org.apache.hadoop.fs.Path;
import org.apache.parquet.column.page.PageReadStore;
import org.apache.parquet.example.data.Group;
import org.apache.parquet.hadoop.ParquetReader;
import org.apache.parquet.hadoop.ParquetFileReader;
import org.apache.parquet.hadoop.example.GroupReadSupport;
import org.apache.parquet.hadoop.metadata.ParquetMetadata;
import org.apache.parquet.schema.MessageType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
public class ProductDataServiceImpl implements ProductDataService {

    @Value("${parquet.product.data.dir:/data/parquet}")
    private String parquetDataDir;

    @Value("${parquet.product.data.file:product_data_merged.parquet}")
    private String parquetFileName;

    private String parquetFilePath;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private static final Map<String, String> FIELD_MAPPING = new LinkedHashMap<>();
    static {
        FIELD_MAPPING.put("date", "日期");
        FIELD_MAPPING.put("asin", "ASIN");
        FIELD_MAPPING.put("store", "店铺");
        FIELD_MAPPING.put("country", "国家");
        FIELD_MAPPING.put("developer", "开发人");
        FIELD_MAPPING.put("sales_volume", "销量");
        FIELD_MAPPING.put("sales_amount", "销售额");
        FIELD_MAPPING.put("order_quantity", "订单量");
        FIELD_MAPPING.put("main_category_rank", "大类排名");
        FIELD_MAPPING.put("cvr", "广告CVR");
        FIELD_MAPPING.put("roas", "ROAS");
        FIELD_MAPPING.put("ad_spend", "广告花费");
        FIELD_MAPPING.put("ad_sales_amount", "广告销售额");
        FIELD_MAPPING.put("product_name", "标题");
        FIELD_MAPPING.put("impressions", "展示");
        FIELD_MAPPING.put("clicks", "点击");
        FIELD_MAPPING.put("ctr", "CTR");
    }

    private static final String[] ALL_CATEGORIES = {
            "Garden", "Home & Kitchen", "DIY & Tools", "Toys & Games",
            "Sports & Outdoors", "Automotive", "Fashion", "Beauty",
            "Pet Supplies", "Stationery & Office Supplies", "Health & Personal Care",
            "Business, Industry & Science", "Baby Products", "Grocery",
            "Lighting", "Electronics & Photo", "Computers & Accessories",
            "Musical Instruments & DJ", "PC & Video Games", "Books", "无排名", "淘汰sku"
    };

    private static final Pattern CATEGORY_NUMBER_PATTERN = Pattern.compile("[：:|]\\d+$");

    @PostConstruct
    public void init() {
        this.parquetFilePath = parquetDataDir + "/" + parquetFileName;
        log.info("[ProductDataService] Initialized with parquet path: {}", parquetFilePath);
    }

    @Override
    public List<String> getAvailableMonths() {
        log.info("[ProductDataService] Getting available months");
        try {
            Set<String> months = new TreeSet<>(Collections.reverseOrder());
            Configuration conf = new Configuration();
            org.apache.hadoop.fs.Path hdfsPath = new org.apache.hadoop.fs.Path(parquetFilePath);
            ParquetMetadata metadata = ParquetFileReader.readFooter(conf, hdfsPath);
            MessageType schema = metadata.getFileMetaData().getSchema();

            if (schema.containsField(getChineseField("date"))) {
                try (ParquetReader<Group> reader = createParquetReader()) {
                    Group line;
                    int count = 0;
                    while ((line = reader.read()) != null && count < 100000) {
                        String date = getStringValue(line, "日期", "");
                        if (date != null && date.length() >= 7) {
                            months.add(date.substring(0, 7));
                        }
                        count++;
                    }
                }
            }

            return new ArrayList<>(months);
        } catch (Exception e) {
            log.warn("[ProductDataService] Failed to get available months: {}", e.getMessage());
            return generateDefaultMonths();
        }
    }

    @Override
    public Map<String, Object> getCategoryStats(String startDate, String endDate, String month,
                                                String store, String country, String developer) {
        log.info("[ProductDataService] Getting category stats: startDate={}, endDate={}, month={}", startDate, endDate, month);

        String actualStartDate = startDate;
        String actualEndDate = endDate;

        if (month != null && !month.isEmpty()) {
            actualStartDate = month + "-01";
            LocalDate end = LocalDate.parse(actualStartDate, DATE_FORMATTER).plusMonths(1).minusDays(1);
            actualEndDate = end.format(DATE_FORMATTER);
        }

        Map<String, CategoryStat> categoryStats = new ConcurrentHashMap<>();
        Set<String> allAsins = ConcurrentHashMap.newKeySet();

        try (ParquetReader<Group> reader = createParquetReader()) {
            Group line;
            while ((line = reader.read()) != null) {
                if (!dateMatchesRange(getStringValue(line, "日期", ""), actualStartDate, actualEndDate)) {
                    continue;
                }
                if (!filterByConditions(line, store, country, developer)) {
                    continue;
                }

                String category = extractCategory(getStringValue(line, "大类排名", ""));
                int salesVolume = getIntValue(line, "销量", 0);
                double salesAmount = getDoubleValue(line, "销售额", 0.0);
                int orderQuantity = getIntValue(line, "订单量", 0);
                String asin = getStringValue(line, "ASIN", "");
                double adSpend = getDoubleValue(line, "广告花费", 0.0);
                double adSales = getDoubleValue(line, "广告销售额", 0.0);
                double roas = getDoubleValue(line, "ROAS", 0.0);
                double cvr = parseCvr(getStringValue(line, "广告CVR", "0"));

                allAsins.add(asin);

                CategoryStat stat = categoryStats.computeIfAbsent(category, k -> new CategoryStat());
                stat.category = category;
                stat.productCount++;
                stat.totalSalesVolume += salesVolume;
                stat.totalSalesAmount += salesAmount;
                stat.totalOrderQuantity += orderQuantity;
                stat.totalAdSpend += adSpend;
                stat.totalAdSales += adSales;
                stat.avgRoasSum += roas;
                stat.avgCvrSum += cvr;
                stat.roasCount++;
            }
        } catch (IOException e) {
            log.error("[ProductDataService] Failed to read parquet file", e);
        }

        for (CategoryStat stat : categoryStats.values()) {
            stat.avgRoas = stat.roasCount > 0 ? Math.round(stat.avgRoasSum / stat.roasCount * 100.0) / 100.0 : 0.0;
            stat.avgCvr = stat.roasCount > 0 ? Math.round(stat.avgCvrSum / stat.roasCount * 100.0) / 100.0 : 0.0;
            stat.avgAcoas = stat.totalSalesAmount > 0 ? Math.round(stat.totalAdSpend / stat.totalSalesAmount * 10000.0) / 100.0 : 0.0;
            stat.orderRate = stat.productCount > 0 ? Math.round((double) stat.totalSalesVolume / stat.productCount * 100.0) / 100.0 : 0.0;
        }

        List<Map<String, Object>> statsList = new ArrayList<>();
        for (String cat : ALL_CATEGORIES) {
            CategoryStat stat = categoryStats.get(cat);
            if (stat != null) {
                statsList.add(stat.toMap());
            } else {
                Map<String, Object> emptyStat = new LinkedHashMap<>();
                emptyStat.put("category", cat);
                emptyStat.put("productCount", 0);
                emptyStat.put("totalSalesVolume", 0);
                emptyStat.put("totalSalesAmount", 0.0);
                emptyStat.put("totalOrderQuantity", 0);
                emptyStat.put("avgAcoas", 0.0);
                emptyStat.put("avgRoas", 0.0);
                emptyStat.put("avgCvr", 0.0);
                emptyStat.put("totalAdSpend", 0.0);
                emptyStat.put("totalAdSales", 0.0);
                emptyStat.put("orderRate", 0.0);
                statsList.add(emptyStat);
            }
        }

        statsList.sort((a, b) -> {
            double aAmount = ((Number) a.get("totalSalesAmount")).doubleValue();
            double bAmount = ((Number) b.get("totalSalesAmount")).doubleValue();
            return Double.compare(bAmount, aAmount);
        });

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("stats", statsList);
        result.put("total_products", allAsins.size());
        result.put("filters", Map.of(
                "start_date", actualStartDate != null ? actualStartDate : "",
                "end_date", actualEndDate != null ? actualEndDate : "",
                "store", store != null ? store : "all",
                "country", country != null ? country : "all",
                "developer", developer != null ? developer : "all"
        ));

        return result;
    }

    @Override
    public Map<String, Object> getProducts(int page, int size, String startDate, String endDate,
                                            String store, String country, String category, String month,
                                            String developer, String searchKeyword, String sortField, String sortOrder) {
        log.info("[ProductDataService] Getting products: page={}, size={}", page, size);

        if (page < 1) page = 1;
        if (size < 1) size = 20;
        if (size > 100) size = 100;

        String actualStartDate = startDate;
        String actualEndDate = endDate;
        if (month != null && !month.isEmpty()) {
            actualStartDate = month + "-01";
            LocalDate end = LocalDate.parse(actualStartDate, DATE_FORMATTER).plusMonths(1).minusDays(1);
            actualEndDate = end.format(DATE_FORMATTER);
        }

        String finalSortField = sortField != null ? sortField : "sales_amount";
        boolean descending = !"asc".equalsIgnoreCase(sortOrder);

        List<Map<String, Object>> allProducts = new ArrayList<>();
        Set<String> seenAsins = ConcurrentHashMap.newKeySet();

        try (ParquetReader<Group> reader = createParquetReader()) {
            Group line;
            while ((line = reader.read()) != null) {
                if (!dateMatchesRange(getStringValue(line, "日期", ""), actualStartDate, actualEndDate)) {
                    continue;
                }
                if (!filterByConditions(line, store, country, developer)) {
                    continue;
                }

                String asin = getStringValue(line, "ASIN", "");
                if (seenAsins.contains(asin)) {
                    continue;
                }

                if (category != null && !category.isEmpty()) {
                    String catRank = getStringValue(line, "大类排名", "");
                    String extractedCat = extractCategory(catRank);
                    if (!category.equals(extractedCat) && !catRank.contains(category)) {
                        continue;
                    }
                }

                if (searchKeyword != null && !searchKeyword.isEmpty()) {
                    String title = getStringValue(line, "标题", "");
                    if (!asin.toLowerCase().contains(searchKeyword.toLowerCase()) &&
                            !title.toLowerCase().contains(searchKeyword.toLowerCase())) {
                        continue;
                    }
                }

                seenAsins.add(asin);
                allProducts.add(convertGroupToMap(line));
            }
        } catch (IOException e) {
            log.error("[ProductDataService] Failed to read parquet file", e);
        }

        finalSortField = getChineseField(finalSortField);
        final String effectiveSortField = finalSortField;
        allProducts.sort((a, b) -> {
            Object valA = a.get(effectiveSortField);
            Object valB = b.get(effectiveSortField);
            int cmp = compareValues(valA, valB);
            return descending ? -cmp : cmp;
        });

        int total = allProducts.size();
        int offset = (page - 1) * size;
        int endIndex = Math.min(offset + size, total);

        List<Map<String, Object>> pagedProducts = offset < total ?
                allProducts.subList(offset, endIndex) : Collections.emptyList();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("list", pagedProducts);
        result.put("total", total);
        result.put("page", page);
        result.put("pageSize", size);

        return result;
    }

    @Override
    public byte[] exportProducts(String startDate, String endDate, String store, String country,
                                 String category, String month, String developer, String searchKeyword) {
        log.info("[ProductDataService] Exporting products");

        Map<String, Object> productsData = getProducts(1, 100000, startDate, endDate, store, country,
                category, month, developer, searchKeyword, "sales_amount", "desc");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> products = (List<Map<String, Object>>) productsData.get("list");

        StringBuilder csv = new StringBuilder();
        csv.append("ASIN,标题,店铺,国家,开发人,销量,销售额,订单量,大类排名,广告CVR,ROAS,广告花费,广告销售额,日期\n");

        for (Map<String, Object> p : products) {
            csv.append(escapeCsv(String.valueOf(p.getOrDefault("ASIN", "")))).append(",");
            csv.append(escapeCsv(String.valueOf(p.getOrDefault("标题", "")))).append(",");
            csv.append(escapeCsv(String.valueOf(p.getOrDefault("店铺", "")))).append(",");
            csv.append(escapeCsv(String.valueOf(p.getOrDefault("国家", "")))).append(",");
            csv.append(escapeCsv(String.valueOf(p.getOrDefault("开发人", "")))).append(",");
            csv.append(p.getOrDefault("销量", "0")).append(",");
            csv.append(p.getOrDefault("销售额", "0")).append(",");
            csv.append(p.getOrDefault("订单量", "0")).append(",");
            csv.append(escapeCsv(String.valueOf(p.getOrDefault("大类排名", "")))).append(",");
            csv.append(escapeCsv(String.valueOf(p.getOrDefault("广告CVR", "")))).append(",");
            csv.append(p.getOrDefault("ROAS", "0")).append(",");
            csv.append(p.getOrDefault("广告花费", "0")).append(",");
            csv.append(p.getOrDefault("广告销售额", "0")).append(",");
            csv.append(escapeCsv(String.valueOf(p.getOrDefault("日期", ""))));
            csv.append("\n");
        }

        return csv.toString().getBytes();
    }

    @Override
    public Map<String, Object> getSalesTrend(String startDate, String endDate, String timeDimension,
                                              int months, String category, String store, String country, String developer) {
        log.info("[ProductDataService] Getting sales trend: dimension={}, months={}", timeDimension, months);

        Map<String, Object> result = new LinkedHashMap<>();

        LocalDate end = LocalDate.now();
        LocalDate start = end.minusMonths(months);

        Map<String, Double> dailySales = new LinkedHashMap<>();
        LocalDate current = start;
        while (!current.isAfter(end)) {
            dailySales.put(current.format(DATE_FORMATTER), 0.0);
            current = current.plusDays(1);
        }

        Map<String, Double> finalDailySales = dailySales;

        try (ParquetReader<Group> reader = createParquetReader()) {
            Group line;
            while ((line = reader.read()) != null) {
                String date = getStringValue(line, "日期", "");
                if (!dailySales.containsKey(date)) {
                    continue;
                }
                if (!filterByConditions(line, store, country, developer)) {
                    continue;
                }

                double sales = getDoubleValue(line, "销售额", 0.0);
                finalDailySales.put(date, finalDailySales.get(date) + sales);
            }
        } catch (IOException e) {
            log.error("[ProductDataService] Failed to read parquet file", e);
        }

        if ("week".equalsIgnoreCase(timeDimension)) {
            Map<String, Double> weeklySales = aggregateByWeek(dailySales);
            result.put("labels", new ArrayList<>(weeklySales.keySet()));
            result.put("values", new ArrayList<>(weeklySales.values()));
        } else if ("month".equalsIgnoreCase(timeDimension)) {
            Map<String, Double> monthlySales = aggregateByMonth(dailySales);
            result.put("labels", new ArrayList<>(monthlySales.keySet()));
            result.put("values", new ArrayList<>(monthlySales.values()));
        } else {
            result.put("labels", new ArrayList<>(dailySales.keySet()));
            result.put("values", new ArrayList<>(dailySales.values()));
        }

        result.put("time_dimension", timeDimension != null ? timeDimension : "day");
        result.put("total_sales", dailySales.values().stream().mapToDouble(Double::doubleValue).sum());

        return result;
    }

    @Override
    public Map<String, Object> getTopProducts(String startDate, String endDate, int limit,
                                               String category, String store, String country, String developer) {
        log.info("[ProductDataService] Getting top products: limit={}", limit);

        Map<String, Double> productSales = new ConcurrentHashMap<>();
        Map<String, Map<String, Object>> productData = new ConcurrentHashMap<>();

        try (ParquetReader<Group> reader = createParquetReader()) {
            Group line;
            while ((line = reader.read()) != null) {
                if (!dateMatchesRange(getStringValue(line, "日期", ""), startDate, endDate)) {
                    continue;
                }
                if (!filterByConditions(line, store, country, developer)) {
                    continue;
                }

                String asin = getStringValue(line, "ASIN", "");
                double sales = getDoubleValue(line, "销售额", 0.0);

                productSales.merge(asin, sales, Double::sum);

                if (!productData.containsKey(asin)) {
                    productData.put(asin, convertGroupToMap(line));
                }
            }
        } catch (IOException e) {
            log.error("[ProductDataService] Failed to read parquet file", e);
        }

        List<Map.Entry<String, Double>> sorted = productSales.entrySet().stream()
                .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                .limit(limit > 0 ? limit : 10)
                .collect(Collectors.toList());

        List<Map<String, Object>> topProducts = new ArrayList<>();
        for (Map.Entry<String, Double> entry : sorted) {
            Map<String, Object> product = productData.get(entry.getKey());
            if (product != null) {
                product.put("sales_amount", entry.getValue());
                topProducts.add(product);
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("list", topProducts);
        result.put("total", topProducts.size());

        return result;
    }

    @Override
    public Map<String, Object> getFilterOptions() {
        log.info("[ProductDataService] Getting filter options");

        Set<String> stores = ConcurrentHashMap.newKeySet();
        Set<String> countries = ConcurrentHashMap.newKeySet();
        Set<String> developers = ConcurrentHashMap.newKeySet();

        try (ParquetReader<Group> reader = createParquetReader()) {
            Group line;
            int count = 0;
            while ((line = reader.read()) != null && count < 50000) {
                String store = getStringValue(line, "店铺", "");
                String country = getStringValue(line, "国家", "");
                String developer = getStringValue(line, "开发人", "");

                if (store != null && !store.isEmpty()) stores.add(store);
                if (country != null && !country.isEmpty()) countries.add(country);
                if (developer != null && !developer.isEmpty()) developers.add(developer);

                count++;
            }
        } catch (IOException e) {
            log.error("[ProductDataService] Failed to read parquet file", e);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("stores", new ArrayList<>(stores));
        result.put("countries", new ArrayList<>(countries));
        result.put("developers", new ArrayList<>(developers));
        result.put("categories", Arrays.asList(ALL_CATEGORIES));

        return result;
    }

    @Override
    public Map<String, Object> getAdPerformance(String startDate, String endDate, String category,
                                                String store, String country, String developer) {
        log.info("[ProductDataService] Getting ad performance");

        long totalImpressions = 0;
        long totalClicks = 0;
        double totalAdSpend = 0.0;
        double totalAdSales = 0.0;

        try (ParquetReader<Group> reader = createParquetReader()) {
            Group line;
            while ((line = reader.read()) != null) {
                if (!dateMatchesRange(getStringValue(line, "日期", ""), startDate, endDate)) {
                    continue;
                }
                if (!filterByConditions(line, store, country, developer)) {
                    continue;
                }

                totalImpressions += getIntValue(line, "展示", 0);
                totalClicks += getIntValue(line, "点击", 0);
                totalAdSpend += getDoubleValue(line, "广告花费", 0.0);
                totalAdSales += getDoubleValue(line, "广告销售额", 0.0);
            }
        } catch (IOException e) {
            log.error("[ProductDataService] Failed to read parquet file", e);
        }

        double ctr = totalImpressions > 0 ? Math.round((double) totalClicks / totalImpressions * 10000.0) / 100.0 : 0.0;
        double roas = totalAdSpend > 0 ? Math.round(totalAdSales / totalAdSpend * 100.0) / 100.0 : 0.0;

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("total_spend", Math.round(totalAdSpend * 100.0) / 100.0);
        result.put("total_revenue", Math.round(totalAdSales * 100.0) / 100.0);
        result.put("total_clicks", totalClicks);
        result.put("total_impressions", totalImpressions);
        result.put("ctr", ctr);
        result.put("roas", roas);

        return result;
    }

    @Override
    public Map<String, Object> clearCache() {
        log.info("[ProductDataService] Clearing cache");
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("message", "缓存清除完成");
        return result;
    }

    @Override
    public Map<String, Object> getCompareData(String currentStartDate, String currentEndDate,
                                              String compareStartDate, String compareEndDate,
                                              String category, String store, String country, String developer) {
        log.info("[ProductDataService] Getting compare data: current={}~{}, compare={}~{}",
                currentStartDate, currentEndDate, compareStartDate, compareEndDate);

        Map<String, Object> currentStats = getCategoryStats(currentStartDate, currentEndDate, null, store, country, developer);
        Map<String, Object> compareStats = getCategoryStats(compareStartDate, compareEndDate, null, store, country, developer);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> currentList = (List<Map<String, Object>>) currentStats.get("stats");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> compareList = (List<Map<String, Object>>) compareStats.get("stats");

        Map<String, Map<String, Object>> currentDict = new LinkedHashMap<>();
        Map<String, Map<String, Object>> compareDict = new LinkedHashMap<>();

        for (Map<String, Object> stat : currentList) {
            String cat = String.valueOf(stat.get("category"));
            currentDict.put(cat, stat);
        }
        for (Map<String, Object> stat : compareList) {
            String cat = String.valueOf(stat.get("category"));
            compareDict.put(cat, stat);
        }

        List<Map<String, Object>> filledCurrent = new ArrayList<>();
        List<Map<String, Object>> filledCompare = new ArrayList<>();

        for (String cat : ALL_CATEGORIES) {
            Map<String, Object> curr = currentDict.getOrDefault(cat, createEmptyStat(cat));
            Map<String, Object> comp = compareDict.getOrDefault(cat, createEmptyStat(cat));
            filledCurrent.add(curr);
            filledCompare.add(comp);
        }

        Map<String, Object> currentTotal = calculateTotals(filledCurrent);
        Map<String, Object> compareTotal = calculateTotals(filledCompare);

        double currentAcoas = ((Number) currentTotal.get("sales_amount")).doubleValue() > 0 ?
                ((Number) currentTotal.get("ad_spend")).doubleValue() / ((Number) currentTotal.get("sales_amount")).doubleValue() * 100 : 0;
        double compareAcoas = ((Number) compareTotal.get("sales_amount")).doubleValue() > 0 ?
                ((Number) compareTotal.get("ad_spend")).doubleValue() / ((Number) compareTotal.get("sales_amount")).doubleValue() * 100 : 0;
        double currentRoas = ((Number) currentTotal.get("ad_spend")).doubleValue() > 0 ?
                ((Number) currentTotal.get("ad_sales")).doubleValue() / ((Number) currentTotal.get("ad_spend")).doubleValue() : 0;
        double compareRoas = ((Number) compareTotal.get("ad_spend")).doubleValue() > 0 ?
                ((Number) compareTotal.get("ad_sales")).doubleValue() / ((Number) compareTotal.get("ad_spend")).doubleValue() : 0;

        Map<String, Double> growthRates = new LinkedHashMap<>();
        growthRates.put("product_count", calculateGrowth((int) currentTotal.get("product_count"), (int) compareTotal.get("product_count")));
        growthRates.put("sales_volume", calculateGrowth((int) currentTotal.get("sales_volume"), (int) compareTotal.get("sales_volume")));
        growthRates.put("sales_amount", calculateGrowth((double) currentTotal.get("sales_amount"), (double) compareTotal.get("sales_amount")));
        growthRates.put("order_quantity", calculateGrowth((int) currentTotal.get("order_quantity"), (int) compareTotal.get("order_quantity")));
        growthRates.put("ad_spend", calculateGrowth((double) currentTotal.get("ad_spend"), (double) compareTotal.get("ad_spend")));
        growthRates.put("acoas", Math.round((currentAcoas - compareAcoas) * 100.0) / 100.0);
        growthRates.put("roas", Math.round((currentRoas - compareRoas) * 100.0) / 100.0);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("current", Map.of(
                "stats", filledCurrent,
                "total", currentTotal,
                "avg_acoas", Math.round(currentAcoas * 100.0) / 100.0,
                "avg_roas", Math.round(currentRoas * 100.0) / 100.0
        ));
        result.put("compare", Map.of(
                "stats", filledCompare,
                "total", compareTotal,
                "avg_acoas", Math.round(compareAcoas * 100.0) / 100.0,
                "avg_roas", Math.round(compareRoas * 100.0) / 100.0
        ));
        result.put("growth_rates", growthRates);

        return result;
    }

    private Map<String, Object> createEmptyStat(String category) {
        Map<String, Object> stat = new LinkedHashMap<>();
        stat.put("category", category);
        stat.put("productCount", 0);
        stat.put("totalSalesVolume", 0);
        stat.put("totalSalesAmount", 0.0);
        stat.put("totalOrderQuantity", 0);
        stat.put("avgAcoas", 0.0);
        stat.put("avgRoas", 0.0);
        stat.put("avgCvr", 0.0);
        stat.put("totalAdSpend", 0.0);
        stat.put("totalAdSales", 0.0);
        stat.put("orderRate", 0.0);
        return stat;
    }

    private Map<String, Object> calculateTotals(List<Map<String, Object>> stats) {
        Map<String, Object> totals = new LinkedHashMap<>();
        int productCount = 0;
        int salesVolume = 0;
        double salesAmount = 0;
        int orderQuantity = 0;
        double adSpend = 0;
        double adSales = 0;

        for (Map<String, Object> stat : stats) {
            productCount += ((Number) stat.getOrDefault("productCount", 0)).intValue();
            salesVolume += ((Number) stat.getOrDefault("totalSalesVolume", 0)).intValue();
            salesAmount += ((Number) stat.getOrDefault("totalSalesAmount", 0)).doubleValue();
            orderQuantity += ((Number) stat.getOrDefault("totalOrderQuantity", 0)).intValue();
            adSpend += ((Number) stat.getOrDefault("totalAdSpend", 0)).doubleValue();
            adSales += ((Number) stat.getOrDefault("totalAdSales", 0)).doubleValue();
        }

        totals.put("product_count", productCount);
        totals.put("sales_volume", salesVolume);
        totals.put("sales_amount", Math.round(salesAmount * 100.0) / 100.0);
        totals.put("order_quantity", orderQuantity);
        totals.put("ad_spend", Math.round(adSpend * 100.0) / 100.0);
        totals.put("ad_sales", Math.round(adSales * 100.0) / 100.0);

        return totals;
    }

    private double calculateGrowth(double current, double compare) {
        if (compare == 0) {
            return current > 0 ? 100.0 : 0.0;
        }
        return Math.round((current - compare) / compare * 10000.0) / 100.0;
    }

    private ParquetReader<Group> createParquetReader() throws IOException {
        Configuration conf = new Configuration();
        conf.set("fs.s3a.impl", "org.apache.hadoop.fs.LocalFileSystem");
        GroupReadSupport readSupport = new GroupReadSupport();
        return ParquetReader.builder(readSupport, new Path(parquetFilePath))
                .withConf(conf)
                .build();
    }

    private String getChineseField(String englishField) {
        return FIELD_MAPPING.getOrDefault(englishField, englishField);
    }

    private String extractCategory(String categoryRank) {
        if (categoryRank == null || categoryRank.isEmpty()) {
            return "淘汰sku";
        }
        String category = CATEGORY_NUMBER_PATTERN.matcher(categoryRank).replaceAll("").trim();
        if (category.isEmpty()) {
            return "淘汰sku";
        }
        return category;
    }

    private boolean dateMatchesRange(String date, String startDate, String endDate) {
        if (date == null || date.isEmpty()) {
            return false;
        }
        try {
            LocalDate d = LocalDate.parse(date, DATE_FORMATTER);
            if (startDate != null && !startDate.isEmpty()) {
                LocalDate start = LocalDate.parse(startDate, DATE_FORMATTER);
                if (d.isBefore(start)) return false;
            }
            if (endDate != null && !endDate.isEmpty()) {
                LocalDate end = LocalDate.parse(endDate, DATE_FORMATTER);
                if (d.isAfter(end)) return false;
            }
            return true;
        } catch (DateTimeParseException e) {
            return false;
        }
    }

    private boolean filterByConditions(Group line, String store, String country, String developer) {
        if (store != null && !store.isEmpty()) {
            if (!store.equals(getStringValue(line, "店铺", ""))) {
                return false;
            }
        }
        if (country != null && !country.isEmpty()) {
            if (!country.equals(getStringValue(line, "国家", ""))) {
                return false;
            }
        }
        if (developer != null && !developer.isEmpty()) {
            if (!developer.equals(getStringValue(line, "开发人", ""))) {
                return false;
            }
        }
        return true;
    }

    private double parseCvr(String cvrStr) {
        if (cvrStr == null || cvrStr.isEmpty()) {
            return 0.0;
        }
        try {
            String cleaned = cvrStr.replace("%", "").trim();
            return Double.parseDouble(cleaned);
        } catch (NumberFormatException e) {
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
        } catch (Exception ignored) {
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
        } catch (Exception ignored) {
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
        } catch (Exception ignored) {
        }
        return defaultValue;
    }

    private Map<String, Object> convertGroupToMap(Group line) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("ASIN", getStringValue(line, "ASIN", ""));
        map.put("标题", getStringValue(line, "标题", ""));
        map.put("店铺", getStringValue(line, "店铺", ""));
        map.put("国家", getStringValue(line, "国家", ""));
        map.put("开发人", getStringValue(line, "开发人", ""));
        map.put("销量", getIntValue(line, "销量", 0));
        map.put("销售额", getDoubleValue(line, "销售额", 0.0));
        map.put("订单量", getIntValue(line, "订单量", 0));
        map.put("大类排名", getStringValue(line, "大类排名", ""));
        map.put("广告CVR", getStringValue(line, "广告CVR", "0"));
        map.put("ROAS", getDoubleValue(line, "ROAS", 0.0));
        map.put("广告花费", getDoubleValue(line, "广告花费", 0.0));
        map.put("广告销售额", getDoubleValue(line, "广告销售额", 0.0));
        map.put("日期", getStringValue(line, "日期", ""));
        map.put("展示", getIntValue(line, "展示", 0));
        map.put("点击", getIntValue(line, "点击", 0));
        map.put("CTR", getDoubleValue(line, "CTR", 0.0));
        return map;
    }

    private String escapeCsv(String value) {
        if (value == null) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }

    private int compareValues(Object a, Object b) {
        if (a == null && b == null) return 0;
        if (a == null) return -1;
        if (b == null) return 1;
        if (a instanceof Number && b instanceof Number) {
            return Double.compare(((Number) a).doubleValue(), ((Number) b).doubleValue());
        }
        return String.valueOf(a).compareTo(String.valueOf(b));
    }

    private Map<String, Double> aggregateByWeek(Map<String, Double> dailySales) {
        Map<String, Double> weeklySales = new LinkedHashMap<>();
        List<String> dates = new ArrayList<>(dailySales.keySet());
        for (int i = 0; i < dates.size(); i += 7) {
            int end = Math.min(i + 7, dates.size());
            String weekStart = dates.get(i);
            String weekEnd = dates.get(end - 1);
            String label = weekStart + " ~ " + weekEnd;
            double sum = 0;
            for (int j = i; j < end; j++) {
                sum += dailySales.get(dates.get(j));
            }
            weeklySales.put(label, sum);
        }
        return weeklySales;
    }

    private Map<String, Double> aggregateByMonth(Map<String, Double> dailySales) {
        Map<String, Double> monthlySales = new LinkedHashMap<>();
        for (Map.Entry<String, Double> entry : dailySales.entrySet()) {
            String month = entry.getKey().substring(0, 7);
            monthlySales.merge(month, entry.getValue(), Double::sum);
        }
        return monthlySales;
    }

    private List<String> generateDefaultMonths() {
        List<String> months = new ArrayList<>();
        LocalDate now = LocalDate.now();
        for (int i = 0; i < 12; i++) {
            months.add(now.minusMonths(i).format(DateTimeFormatter.ofPattern("yyyy-MM")));
        }
        return months;
    }

    private static class CategoryStat {
        String category;
        int productCount = 0;
        double totalSalesVolume = 0;
        double totalSalesAmount = 0;
        int totalOrderQuantity = 0;
        double totalAdSpend = 0;
        double totalAdSales = 0;
        double avgRoasSum = 0;
        double avgCvrSum = 0;
        int roasCount = 0;
        double avgRoas = 0;
        double avgCvr = 0;
        double avgAcoas = 0;
        double orderRate = 0;

        Map<String, Object> toMap() {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("category", category);
            map.put("productCount", productCount);
            map.put("totalSalesVolume", (int) totalSalesVolume);
            map.put("totalSalesAmount", Math.round(totalSalesAmount * 100.0) / 100.0);
            map.put("totalOrderQuantity", totalOrderQuantity);
            map.put("avgAcoas", avgAcoas);
            map.put("avgRoas", avgRoas);
            map.put("avgCvr", avgCvr);
            map.put("totalAdSpend", Math.round(totalAdSpend * 100.0) / 100.0);
            map.put("totalAdSales", Math.round(totalAdSales * 100.0) / 100.0);
            map.put("orderRate", orderRate);
            return map;
        }
    }
}

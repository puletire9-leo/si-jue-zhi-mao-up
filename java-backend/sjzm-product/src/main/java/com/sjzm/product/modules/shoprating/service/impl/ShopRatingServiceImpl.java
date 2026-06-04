package com.sjzm.product.modules.shoprating.service.impl;

import com.sjzm.product.entity.DengZongShop;
import com.sjzm.product.mapper.CompetitorProductMapper;
import com.sjzm.product.mapper.DengZongShopMapper;
import com.sjzm.product.modules.shoprating.dto.ShopRatingResult;
import com.sjzm.product.modules.shoprating.service.ShopRatingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationContext;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ShopRatingServiceImpl implements ShopRatingService {

    private final CompetitorProductMapper competitorProductMapper;
    private final DengZongShopMapper dengZongShopMapper;
    private final StringRedisTemplate redisTemplate;
    private final ApplicationContext applicationContext;

    // 候选店铺的数据来源表
    private static final String SOURCE_TABLE = "competitor_products";

    private static final String TASK_KEY_PREFIX = "shop-rating:task:";
    private static final String LOCK_KEY_PREFIX = "shop-rating:lock:";
    private static final int PRICE_BUCKETS = 5;

    // 本地基准缓存：marketplace → Benchmark
    private final ConcurrentHashMap<String, Benchmark> benchmarkCache = new ConcurrentHashMap<>();

    // ========== 基准类 ==========

    static class Benchmark {
        Map<Long, Integer> nodeIdCount;      // nodeId → 商品数
        Map<String, Integer> bsrIdCount;     // bsrId → 商品数
        int[] priceBuckets;                  // 各桶商品数
        int totalProducts;
        Map<String, ShopData> sellerShops;   // 每家郑总店铺的数据

        Map<Long, Double> nodeIdDist() { return toDist(nodeIdCount, totalProducts); }
        Map<String, Double> bsrIdDist() { return toDist(bsrIdCount, totalProducts); }
        double[] priceDist() {
            double[] d = new double[PRICE_BUCKETS];
            for (int i = 0; i < PRICE_BUCKETS; i++) d[i] = (double) priceBuckets[i] / totalProducts;
            return d;
        }

        private <K> Map<K, Double> toDist(Map<K, Integer> count, int total) {
            Map<K, Double> dist = new HashMap<>();
            count.forEach((k, v) -> dist.put(k, (double) v / total));
            return dist;
        }
    }

    static class ShopData {
        String sellerName;
        int totalProducts;
        Map<Long, Integer> nodeIdCount;
        Map<String, Integer> bsrIdCount;
        int[] priceBuckets;
    }

    // ========== 公共接口 ==========

    @Override
    public List<ShopRatingResult.CandidateShop> getCandidates(String marketplace, int minCount) {
        // 1. 从新品榜聚合候选店铺
        List<Map<String, Object>> rows = competitorProductMapper.selectNewProductCandidates(marketplace, minCount);
        if (rows.isEmpty()) return Collections.emptyList();

        List<String> sellerNames = rows.stream()
                .map(r -> (String) r.get("sellerName"))
                .collect(Collectors.toList());

        // 2. 批量检查哪些已获取数据
        Set<String> fetchedSet = new HashSet<>(
                dengZongShopMapper.selectFetchedSellerNames(marketplace, sellerNames));

        // 3. 组装结果
        List<ShopRatingResult.CandidateShop> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            ShopRatingResult.CandidateShop shop = new ShopRatingResult.CandidateShop();
            shop.setSellerName((String) row.get("sellerName"));
            shop.setMarketplace((String) row.get("marketplace"));
            shop.setNewProductCount(((Number) row.get("newProductCount")).intValue());
            shop.setDataFetched(fetchedSet.contains(shop.getSellerName()));
            result.add(shop);
        }
        return result;
    }

    @Override
    public String evaluate(String marketplace, int minCount) {
        String lockKey = LOCK_KEY_PREFIX + marketplace;
        String existingTaskKey = redisTemplate.opsForValue().get(lockKey);

        // 同站点互斥：已有任务在跑，返回已有 taskId
        if (existingTaskKey != null) {
            String existingStatus = redisTemplate.opsForValue().get(TASK_KEY_PREFIX + existingTaskKey);
            if (existingStatus != null && (existingStatus.contains("RUNNING") || existingStatus.contains("PENDING"))) {
                return existingTaskKey;
            }
        }

        String taskId = marketplace + "_" + System.currentTimeMillis();
        String taskKey = TASK_KEY_PREFIX + taskId;

        // 初始化任务状态
        redisTemplate.opsForValue().set(taskKey, "{\"status\":\"PENDING\",\"currentStep\":0,\"totalSteps\":0}");
        redisTemplate.opsForValue().set(lockKey, taskId, 30, TimeUnit.MINUTES);

        // 异步执行（必须通过代理调用，否则 @Async 不生效）
        applicationContext.getBean(ShopRatingService.class).evaluateAsync(taskId, marketplace, minCount);

        return taskId;
    }

    @Override
    public ShopRatingResult.TaskStatus getTaskStatus(String taskId) {
        String json = redisTemplate.opsForValue().get(TASK_KEY_PREFIX + taskId);
        if (json == null) return null;
        // 简单解析（不引入 JSON 库，手动解析）
        ShopRatingResult.TaskStatus status = new ShopRatingResult.TaskStatus();
        status.setTaskId(taskId);
        if (json.contains("\"COMPLETED\"")) {
            status.setStatus("COMPLETED");
            // results 存在另一个 key
            String resultsJson = redisTemplate.opsForValue().get(TASK_KEY_PREFIX + taskId + ":results");
            status.setResults(parseResults(resultsJson));
        } else if (json.contains("\"FAILED\"")) {
            status.setStatus("FAILED");
            status.setError(extractField(json, "error"));
        } else if (json.contains("\"RUNNING\"")) {
            status.setStatus("RUNNING");
            status.setCurrentStep(parseInt(extractField(json, "currentStep")));
            status.setTotalSteps(parseInt(extractField(json, "totalSteps")));
        } else {
            status.setStatus("PENDING");
        }
        return status;
    }

    // ========== 异步执行 ==========

    @Override
    @Async
    public void evaluateAsync(String taskId, String marketplace, int minCount) {
        String taskKey = TASK_KEY_PREFIX + taskId;
        try {
            // 1. 构建/获取基准
            Benchmark benchmark = benchmarkCache.computeIfAbsent(marketplace, this::buildBenchmark);

            // 2. 获取候选店铺（全部参与评分，数据来自 competitor_products）
            List<Map<String, Object>> candidates = competitorProductMapper.selectNewProductCandidates(marketplace, minCount);
            List<String> toRate = candidates.stream().map(r -> (String) r.get("sellerName")).collect(Collectors.toList());

            redisTemplate.opsForValue().set(taskKey,
                    "{\"status\":\"RUNNING\",\"currentStep\":0,\"totalSteps\":" + toRate.size() + "}");

            // 3. 逐店评分
            List<ShopRatingResult> results = new ArrayList<>();
            for (int i = 0; i < toRate.size(); i++) {
                String seller = toRate.get(i);
                try {
                    ShopRatingResult result = scoreOneShop(seller, marketplace, benchmark);
                    results.add(result);
                } catch (Exception e) {
                    log.error("评分失败: seller={}", seller, e);
                }
                redisTemplate.opsForValue().set(taskKey,
                        "{\"status\":\"RUNNING\",\"currentStep\":" + (i + 1) + ",\"totalSteps\":" + toRate.size() + "}");
            }

            // 4. 按分数排序
            results.sort((a, b) -> Double.compare(
                    b.getFinalScore() != null ? b.getFinalScore() : 0,
                    a.getFinalScore() != null ? a.getFinalScore() : 0));

            // 5. 写入结果
            redisTemplate.opsForValue().set(taskKey, "{\"status\":\"COMPLETED\"}");
            redisTemplate.opsForValue().set(taskKey + ":results", serializeResults(results), 24, TimeUnit.HOURS);

            // 解锁
            redisTemplate.delete(LOCK_KEY_PREFIX + marketplace);

        } catch (Exception e) {
            log.error("评级任务失败: taskId={}", taskId, e);
            String safeMsg = e.getMessage() != null ? e.getMessage().replace("\"", "'") : "unknown";
            redisTemplate.opsForValue().set(taskKey,
                    "{\"status\":\"FAILED\",\"error\":\"" + safeMsg + "\"}");
            redisTemplate.delete(LOCK_KEY_PREFIX + marketplace);
        }
    }

    // ========== 基准构建 ==========

    private Benchmark buildBenchmark(String marketplace) {
        List<Map<String, Object>> rows = dengZongShopMapper.selectRatingData(marketplace);

        Benchmark bench = new Benchmark();
        bench.nodeIdCount = new HashMap<>();
        bench.bsrIdCount = new HashMap<>();
        bench.priceBuckets = new int[PRICE_BUCKETS];
        bench.totalProducts = rows.size();
        bench.sellerShops = new HashMap<>();

        // 按卖家分组
        Map<String, List<Map<String, Object>>> bySeller = rows.stream()
                .filter(r -> r.get("seller_name") != null)
                .collect(Collectors.groupingBy(r -> (String) r.get("seller_name")));

        for (Map.Entry<String, List<Map<String, Object>>> entry : bySeller.entrySet()) {
            ShopData shop = new ShopData();
            shop.sellerName = entry.getKey();
            shop.nodeIdCount = new HashMap<>();
            shop.bsrIdCount = new HashMap<>();
            shop.priceBuckets = new int[PRICE_BUCKETS];
            shop.totalProducts = entry.getValue().size();

            for (Map<String, Object> row : entry.getValue()) {
                Long nodeId = row.get("node_id") != null ? ((Number) row.get("node_id")).longValue() : null;
                String bsrId = row.get("bsr_id") != null ? (String) row.get("bsr_id") : null;
                BigDecimal price = row.get("price") != null ? new BigDecimal(row.get("price").toString()) : null;

                if (nodeId != null) {
                    bench.nodeIdCount.merge(nodeId, 1, Integer::sum);
                    shop.nodeIdCount.merge(nodeId, 1, Integer::sum);
                }
                if (bsrId != null && !bsrId.isEmpty()) {
                    bench.bsrIdCount.merge(bsrId, 1, Integer::sum);
                    shop.bsrIdCount.merge(bsrId, 1, Integer::sum);
                }
                int bucket = priceBucket(price);
                bench.priceBuckets[bucket]++;
                shop.priceBuckets[bucket]++;
            }
            bench.sellerShops.put(entry.getKey(), shop);
        }
        return bench;
    }

    // ========== 单店评分 ==========

    private ShopRatingResult scoreOneShop(String sellerName, String marketplace, Benchmark benchmark) {
        // 从 competitor_products 查候选店铺数据
        List<Map<String, Object>> shopRows = competitorProductMapper.selectRatingDataBySeller(marketplace, sellerName);
        ShopData shop = buildShopData(sellerName, shopRows);

        // 第一层：总体得分
        double overallScore = calcOverallScore(shop, benchmark);

        // 第二层：匹配得分（vs 每家郑总店铺，取最高）
        double bestMatchScore = 0;
        String bestMatchSeller = null;
        ShopRatingResult.ScoreDetail bestDetail = null;

        for (ShopData zhengShop : benchmark.sellerShops.values()) {
            ShopRatingResult.ScoreDetail detail = new ShopRatingResult.ScoreDetail();
            double score = calcMatchScore(shop, zhengShop, detail);
            if (score > bestMatchScore) {
                bestMatchScore = score;
                bestMatchSeller = zhengShop.sellerName;
                bestDetail = detail;
            }
        }

        double finalScore = Math.max(overallScore, bestMatchScore) * 100;

        ShopRatingResult result = new ShopRatingResult();
        result.setSellerName(sellerName);
        result.setMarketplace(marketplace);
        result.setProductCount(shop.totalProducts);
        result.setOverallScore(Math.round(overallScore * 10000.0) / 100.0);
        result.setMatchScore(Math.round(bestMatchScore * 10000.0) / 100.0);
        result.setFinalScore(Math.round(finalScore * 100.0) / 100.0);
        result.setGrade(toGrade(finalScore));
        result.setBestMatchSeller(bestMatchSeller);
        result.setBestMatchScore(Math.round(bestMatchScore * 10000.0) / 100.0);
        result.setDetail(bestDetail);
        return result;
    }

    // ========== 第一层：总体得分 ==========

    private double calcOverallScore(ShopData shop, Benchmark benchmark) {
        int n = shop.totalProducts;
        if (n < 10) {
            // 最低档：大类命中=50分
            return shop.bsrIdCount.keySet().stream().anyMatch(benchmark.bsrIdCount::containsKey) ? 0.5 : 0;
        }

        double bsrCoverage = coverage(shop.bsrIdCount.keySet(), benchmark.bsrIdCount.keySet());
        double nodeCoverage = coverage(shop.nodeIdCount.keySet(), benchmark.nodeIdCount.keySet());
        double priceOverlap = priceOverlap(shop.priceBuckets, shop.totalProducts, benchmark.priceBuckets, benchmark.totalProducts);

        if (n >= 50) {
            return bsrCoverage * 0.20 + nodeCoverage * 0.35 + priceOverlap * 0.45;
        } else {
            return bsrCoverage * 0.40 + priceOverlap * 0.60;
        }
    }

    // ========== 第二层：匹配得分 ==========

    private double calcMatchScore(ShopData shop, ShopData zhengShop, ShopRatingResult.ScoreDetail detail) {
        int n1 = shop.totalProducts;
        int n2 = zhengShop.totalProducts;
        boolean useCosine = (n1 >= 50 && n2 >= 50) ||
                ((double) Math.min(n1, n2) / Math.max(n1, n2) >= 0.5);

        double bsrCoverage = coverage(shop.bsrIdCount.keySet(), zhengShop.bsrIdCount.keySet());
        double nodeCoverage = coverage(shop.nodeIdCount.keySet(), zhengShop.nodeIdCount.keySet());
        double priceOverlap = priceOverlap(shop.priceBuckets, shop.totalProducts,
                zhengShop.priceBuckets, zhengShop.totalProducts);

        detail.setBsrCoverage(Math.round(bsrCoverage * 10000.0) / 10000.0);
        detail.setNodeCoverage(Math.round(nodeCoverage * 10000.0) / 10000.0);
        detail.setPriceOverlap(Math.round(priceOverlap * 10000.0) / 10000.0);

        if (useCosine) {
            double cosine = cosineSimilarity(shop.nodeIdCount, shop.totalProducts,
                    zhengShop.nodeIdCount, zhengShop.totalProducts);
            detail.setCosineSimilarity(Math.round(cosine * 10000.0) / 10000.0);
            return bsrCoverage * 0.15 + nodeCoverage * 0.20 + cosine * 0.20 + priceOverlap * 0.45;
        } else {
            return bsrCoverage * 0.25 + nodeCoverage * 0.30 + priceOverlap * 0.45;
        }
    }

    // ========== 工具方法 ==========

    /** 覆盖率 = 交集大小 / 店铺自己的大小 */
    private double coverage(Set<?> shopSet, Set<?> baseSet) {
        if (shopSet.isEmpty()) return 0;
        long hit = shopSet.stream().filter(baseSet::contains).count();
        return (double) hit / shopSet.size();
    }

    /** 价格重合度 = Σ min(店铺桶占比, 基准桶占比) */
    private double priceOverlap(int[] shopBuckets, int shopTotal, int[] baseBuckets, int baseTotal) {
        if (shopTotal == 0 || baseTotal == 0) return 0;
        double overlap = 0;
        for (int i = 0; i < PRICE_BUCKETS; i++) {
            overlap += Math.min((double) shopBuckets[i] / shopTotal, (double) baseBuckets[i] / baseTotal);
        }
        return overlap;
    }

    /** Cosine 相似度：向量维度 = nodeId 并集，值 = 该 nodeId 商品占比 */
    private double cosineSimilarity(Map<Long, Integer> aCounts, int aTotal,
                                    Map<Long, Integer> bCounts, int bTotal) {
        if (aTotal == 0 || bTotal == 0) return 0;

        Set<Long> allNodes = new HashSet<>();
        allNodes.addAll(aCounts.keySet());
        allNodes.addAll(bCounts.keySet());

        double dotProduct = 0, normA = 0, normB = 0;
        for (Long nodeId : allNodes) {
            double a = (double) aCounts.getOrDefault(nodeId, 0) / aTotal;
            double b = (double) bCounts.getOrDefault(nodeId, 0) / bTotal;
            dotProduct += a * b;
            normA += a * a;
            normB += b * b;
        }

        if (normA == 0 || normB == 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    private int priceBucket(BigDecimal price) {
        if (price == null || price.compareTo(BigDecimal.ZERO) <= 0) return 0;
        if (price.compareTo(new BigDecimal("5")) <= 0) return 0;
        if (price.compareTo(new BigDecimal("10")) <= 0) return 1;
        if (price.compareTo(new BigDecimal("15")) <= 0) return 2;
        if (price.compareTo(new BigDecimal("20")) <= 0) return 3;
        return 4;
    }

    private String toGrade(double score) {
        if (score >= 80) return "A";
        if (score >= 60) return "B";
        if (score >= 40) return "C";
        if (score >= 20) return "D";
        return "F";
    }

    private ShopData buildShopData(String sellerName, List<Map<String, Object>> rows) {
        ShopData shop = new ShopData();
        shop.sellerName = sellerName;
        shop.totalProducts = rows.size();
        shop.nodeIdCount = new HashMap<>();
        shop.bsrIdCount = new HashMap<>();
        shop.priceBuckets = new int[PRICE_BUCKETS];

        for (Map<String, Object> row : rows) {
            Long nodeId = row.get("node_id") != null ? ((Number) row.get("node_id")).longValue() : null;
            String bsrId = row.get("bsr_id") != null ? (String) row.get("bsr_id") : null;
            BigDecimal price = row.get("price") != null ? new BigDecimal(row.get("price").toString()) : null;

            if (nodeId != null) shop.nodeIdCount.merge(nodeId, 1, Integer::sum);
            if (bsrId != null && !bsrId.isEmpty()) shop.bsrIdCount.merge(bsrId, 1, Integer::sum);
            shop.priceBuckets[priceBucket(price)]++;
        }
        return shop;
    }

    // ========== Redis 序列化（简单 JSON，不引入额外依赖） ==========

    private String serializeResults(List<ShopRatingResult> results) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < results.size(); i++) {
            ShopRatingResult r = results.get(i);
            if (i > 0) sb.append(",");
            sb.append("{\"sellerName\":\"").append(r.getSellerName())
              .append("\",\"marketplace\":\"").append(r.getMarketplace())
              .append("\",\"productCount\":").append(r.getProductCount())
              .append(",\"overallScore\":").append(r.getOverallScore())
              .append(",\"matchScore\":").append(r.getMatchScore())
              .append(",\"finalScore\":").append(r.getFinalScore())
              .append(",\"grade\":\"").append(r.getGrade())
              .append("\",\"bestMatchSeller\":\"").append(r.getBestMatchSeller() != null ? r.getBestMatchSeller() : "")
              .append("\",\"bestMatchScore\":").append(r.getBestMatchScore());
            if (r.getDetail() != null) {
                sb.append(",\"detail\":{\"bsrCoverage\":").append(r.getDetail().getBsrCoverage())
                  .append(",\"nodeCoverage\":").append(r.getDetail().getNodeCoverage())
                  .append(",\"priceOverlap\":").append(r.getDetail().getPriceOverlap())
                  .append(",\"cosineSimilarity\":").append(r.getDetail().getCosineSimilarity()).append("}");
            }
            sb.append("}");
        }
        sb.append("]");
        return sb.toString();
    }

    private List<ShopRatingResult> parseResults(String json) {
        if (json == null || json.isEmpty() || json.trim().equals("[]")) return Collections.emptyList();
        // 简单解析：按 }{ 分割
        List<ShopRatingResult> results = new ArrayList<>();
        json = json.trim();
        if (json.startsWith("[")) json = json.substring(1);
        if (json.endsWith("]")) json = json.substring(0, json.length() - 1);

        for (String item : splitJsonArray(json)) {
            ShopRatingResult r = new ShopRatingResult();
            r.setSellerName(extractField(item, "sellerName"));
            r.setMarketplace(extractField(item, "marketplace"));
            r.setProductCount(parseInt(extractField(item, "productCount")));
            r.setOverallScore(parseDouble(extractField(item, "overallScore")));
            r.setMatchScore(parseDouble(extractField(item, "matchScore")));
            r.setFinalScore(parseDouble(extractField(item, "finalScore")));
            r.setGrade(extractField(item, "grade"));
            r.setBestMatchSeller(extractField(item, "bestMatchSeller"));
            r.setBestMatchScore(parseDouble(extractField(item, "bestMatchScore")));
            // 解析 detail 子对象
            String detailJson = extractJsonObject(item, "detail");
            if (detailJson != null) {
                ShopRatingResult.ScoreDetail detail = new ShopRatingResult.ScoreDetail();
                detail.setBsrCoverage(parseDouble(extractField(detailJson, "bsrCoverage")));
                detail.setNodeCoverage(parseDouble(extractField(detailJson, "nodeCoverage")));
                detail.setPriceOverlap(parseDouble(extractField(detailJson, "priceOverlap")));
                detail.setCosineSimilarity(parseDouble(extractField(detailJson, "cosineSimilarity")));
                r.setDetail(detail);
            }
            results.add(r);
        }
        return results;
    }

    private List<String> splitJsonArray(String json) {
        List<String> items = new ArrayList<>();
        int depth = 0;
        int start = 0;
        for (int i = 0; i < json.length(); i++) {
            char c = json.charAt(i);
            if (c == '{') depth++;
            else if (c == '}') depth--;
            else if (c == ',' && depth == 0) {
                items.add(json.substring(start, i));
                start = i + 1;
            }
        }
        items.add(json.substring(start));
        return items;
    }

    private String extractField(String json, String field) {
        String key = "\"" + field + "\":";
        int idx = json.indexOf(key);
        if (idx < 0) return null;
        int start = idx + key.length();
        if (start >= json.length()) return null;
        if (json.charAt(start) == '"') {
            int end = json.indexOf("\"", start + 1);
            return end > start ? json.substring(start + 1, end) : null;
        }
        // 跳过嵌套对象
        if (json.charAt(start) == '{') return null;
        int end = start;
        while (end < json.length() && json.charAt(end) != ',' && json.charAt(end) != '}') end++;
        return json.substring(start, end).trim();
    }

    /** 提取嵌套 JSON 对象 */
    private String extractJsonObject(String json, String field) {
        String key = "\"" + field + "\":{";
        int idx = json.indexOf(key);
        if (idx < 0) return null;
        int start = idx + key.length() - 1; // 从 { 开始
        int depth = 0;
        int end = start;
        while (end < json.length()) {
            char c = json.charAt(end);
            if (c == '{') depth++;
            else if (c == '}') depth--;
            if (depth == 0) break;
            end++;
        }
        return end > start ? json.substring(start + 1, end) : null;
    }

    private int parseInt(String s) {
        try { return s != null ? Integer.parseInt(s) : 0; } catch (Exception e) { return 0; }
    }

    private double parseDouble(String s) {
        try { return s != null ? Double.parseDouble(s) : 0; } catch (Exception e) { return 0; }
    }
}

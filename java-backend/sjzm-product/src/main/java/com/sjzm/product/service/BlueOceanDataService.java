package com.sjzm.product.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sjzm.product.entity.*;
import com.sjzm.product.mapper.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 蓝海扫描数据服务 — 为 selection-agent 提供品类聚合 + 商品列表 + 结果回写 API。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BlueOceanDataService {

    private final CompetitorProductMapper productMapper;
    private final BlueOceanScanResultMapper scanResultMapper;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * GET /category-aggregation — 全品类10维聚合
     * 按 node_label_path 提取一级/二级品类，GROUP BY 计算聚合指标
     */
    public List<Map<String, Object>> getCategoryAggregation(String marketplace, String month) {
        LambdaQueryWrapper<CompetitorProduct> qw = new LambdaQueryWrapper<>();
        qw.eq(CompetitorProduct::getMarketplace, marketplace)
          .eq(CompetitorProduct::getMonth, month)
          .isNotNull(CompetitorProduct::getNodeLabelPath)
          .ne(CompetitorProduct::getNodeLabelPath, "");

        List<CompetitorProduct> all = productMapper.selectList(qw);
        log.info("getCategoryAggregation: marketplace={}, month={}, total={}", marketplace, month, all.size());

        // 按一级品类（node_label_path 第一段）分组
        Map<String, List<CompetitorProduct>> byCategory = all.stream()
                .filter(p -> p.getNodeLabelPath() != null)
                .collect(Collectors.groupingBy(
                        p -> {
                            String[] parts = p.getNodeLabelPath().split(":");
                            return parts.length > 0 ? parts[0].trim() : "OTHER";
                        },
                        LinkedHashMap::new,
                        Collectors.toList()
                ));

        List<Map<String, Object>> result = new ArrayList<>();
        for (Map.Entry<String, List<CompetitorProduct>> entry : byCategory.entrySet()) {
            String category = entry.getKey();
            List<CompetitorProduct> products = entry.getValue();
            if (products.size() < 2) continue; // 至少2个产品才有分析意义

            Map<String, Object> row = computeAggregation(category, products);
            result.add(row);
        }

        result.sort((a, b) -> {
            BigDecimal sa = (BigDecimal) b.get("blue_ocean_score");
            BigDecimal sb = (BigDecimal) a.get("blue_ocean_score");
            return sa != null && sb != null ? sa.compareTo(sb) : 0;
        });

        log.info("getCategoryAggregation: {} 品类", result.size());
        return result;
    }

    private Map<String, Object> computeAggregation(String category, List<CompetitorProduct> products) {
        int total = products.size();

        // 新品占比（listing_days <= 90）
        long newCount = products.stream().filter(p -> p.getListingDays() != null && p.getListingDays() <= 90).count();
        double newRatio = total > 0 ? (double) newCount / total : 0;

        // 均价
        double avgPrice = products.stream()
                .filter(p -> p.getPrice() != null)
                .mapToDouble(p -> p.getPrice().doubleValue()).average().orElse(0);

        // 平均 BSR
        double avgBsr = products.stream()
                .filter(p -> p.getBsr() != null && p.getBsr() > 0)
                .mapToInt(CompetitorProduct::getBsr).average().orElse(0);

        // 平均评分
        double avgRating = products.stream()
                .filter(p -> p.getRating() != null)
                .mapToDouble(p -> p.getRating().doubleValue()).average().orElse(0);

        // 平均评论数
        double avgRatings = products.stream()
                .filter(p -> p.getRatings() != null)
                .mapToInt(CompetitorProduct::getRatings).average().orElse(0);

        // CR3（前3品牌集中度）
        Map<String, Long> brandCount = products.stream()
                .filter(p -> p.getBrand() != null && !p.getBrand().isEmpty())
                .collect(Collectors.groupingBy(CompetitorProduct::getBrand, Collectors.counting()));
        long top3 = brandCount.values().stream()
                .sorted(Comparator.reverseOrder()).limit(3).mapToLong(Long::longValue).sum();
        double cr3 = total > 0 ? (double) top3 / total : 0;

        // 垄断比例（最大卖家占比）
        Map<String, Long> sellerCount = products.stream()
                .filter(p -> p.getSellerName() != null)
                .collect(Collectors.groupingBy(CompetitorProduct::getSellerName, Collectors.counting()));
        long maxSeller = sellerCount.values().stream().max(Long::compare).orElse(1L);
        double monopolyRatio = total > 0 ? (double) maxSeller / total : 0;

        // 价格跨度
        List<BigDecimal> prices = products.stream()
                .filter(p -> p.getPrice() != null)
                .map(CompetitorProduct::getPrice).sorted().collect(Collectors.toList());
        double priceMin = prices.isEmpty() ? 0 : prices.get(0).doubleValue();
        double priceMax = prices.isEmpty() ? 0 : prices.get(prices.size() - 1).doubleValue();
        double priceSpread = priceMin > 0 ? (priceMax - priceMin) / priceMin : 0;

        // 平均利润率
        double avgProfit = products.stream()
                .filter(p -> p.getProfit() != null)
                .mapToDouble(p -> p.getProfit().doubleValue()).average().orElse(0);

        // 卖家数
        long sellerDiversity = sellerCount.size();

        // ── 蓝海评分 (0-100) ──
        double score = 0;
        score += Math.min(newRatio * 100, 25);           // 新品率 25分
        score += (1 - cr3) * 25;                          // 竞争度 25分
        score += Math.min(avgRating / 5.0 * 15, 15);     // 品质 15分
        score += monopolyRatio < 0.3 ? 15 : (monopolyRatio < 0.5 ? 8 : 0); // 垄断 15分
        score += priceSpread > 1.0 ? 10 : (priceSpread > 0.3 ? 5 : 0);      // 价格空间 10分
        score += avgProfit > 20 ? 10 : (avgProfit > 10 ? 5 : 0);             // 利润 10分
        BigDecimal blueOceanScore = BigDecimal.valueOf(Math.min(score, 100)).setScale(1, RoundingMode.HALF_UP);

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("category", category);
        row.put("marketplace", products.get(0).getMarketplace());
        row.put("month", products.get(0).getMonth());
        row.put("product_count", total);
        row.put("new_ratio", BigDecimal.valueOf(newRatio).setScale(3, RoundingMode.HALF_UP));
        row.put("avg_price", BigDecimal.valueOf(avgPrice).setScale(2, RoundingMode.HALF_UP));
        row.put("avg_bsr", BigDecimal.valueOf(avgBsr).setScale(0, RoundingMode.HALF_UP));
        row.put("avg_rating", BigDecimal.valueOf(avgRating).setScale(1, RoundingMode.HALF_UP));
        row.put("avg_ratings", BigDecimal.valueOf(avgRatings).setScale(0, RoundingMode.HALF_UP));
        row.put("cr3", BigDecimal.valueOf(cr3).setScale(3, RoundingMode.HALF_UP));
        row.put("monopoly_ratio", BigDecimal.valueOf(monopolyRatio).setScale(3, RoundingMode.HALF_UP));
        row.put("price_spread", BigDecimal.valueOf(priceSpread).setScale(2, RoundingMode.HALF_UP));
        row.put("avg_profit", BigDecimal.valueOf(avgProfit).setScale(1, RoundingMode.HALF_UP));
        row.put("seller_count", (int) sellerDiversity);
        row.put("brand_count", brandCount.size());
        row.put("blue_ocean_score", blueOceanScore);
        return row;
    }

    /**
     * GET /category-products — 单品类商品列表
     */
    public List<Map<String, Object>> getCategoryProducts(String marketplace, String month, String category) {
        LambdaQueryWrapper<CompetitorProduct> qw = new LambdaQueryWrapper<>();
        qw.eq(CompetitorProduct::getMarketplace, marketplace)
          .eq(CompetitorProduct::getMonth, month)
          .like(CompetitorProduct::getNodeLabelPath, category)
          .orderByAsc(CompetitorProduct::getBsr);

        List<CompetitorProduct> all = productMapper.selectList(qw);
        log.info("getCategoryProducts: marketplace={}, month={}, category={}, total={}",
                marketplace, month, category, all.size());

        return all.stream().map(p -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("asin", p.getAsin());
            m.put("title", p.getTitle());
            m.put("price", p.getPrice());
            m.put("bsr", p.getBsr());
            m.put("units", p.getUnits());
            m.put("ratings", p.getRatings());
            m.put("rating", p.getRating());
            m.put("profit", p.getProfit());
            m.put("fba", p.getFba());
            m.put("weight_g", p.getWeightG());
            m.put("listing_days", p.getListingDays());
            m.put("seller_name", p.getSellerName());
            m.put("brand", p.getBrand());
            m.put("node_label_path", p.getNodeLabelPath());
            m.put("image_url", p.getImageUrl());
            m.put("product_url", p.getProductUrl());
            m.put("grade", p.getGrade());
            return m;
        }).collect(Collectors.toList());
    }

    /**
     * POST /scan-results — 存储蓝海扫描结果
     */
    @Transactional
    public Map<String, Object> saveScanResults(Map<String, Object> results) {
        String marketplace = (String) results.get("marketplace");
        String month = (String) results.get("month");
        int saved = 0;

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rankings = (List<Map<String, Object>>) results.getOrDefault("rankings", List.of());

        // 构建 opportunity_cards 索引 (category → card)，用于合并 LLM 分析数据
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> cards = (List<Map<String, Object>>) results.getOrDefault("opportunity_cards", List.of());
        Map<String, Map<String, Object>> cardByCategory = new HashMap<>();
        for (Map<String, Object> card : cards) {
            String cardCat = (String) card.get("category_name");
            if (cardCat != null) {
                cardByCategory.put(cardCat, card);
            }
        }

        for (Map<String, Object> r : rankings) {
            try {
                BlueOceanScanResult entity = new BlueOceanScanResult();
                entity.setMarketplace(marketplace);
                entity.setMonth(month);
                // Python pipeline 返回 category_name
                String cat = (String) r.get("category");
                if (cat == null || cat.isEmpty()) {
                    cat = (String) r.get("category_name");
                }
                entity.setCategory(cat);

                // 机会类型 — 使用 label 存储（如 "🌊蓝海机会"）
                Object oppType = r.get("opportunity_type");
                Object oppLabel = r.get("opportunity_label");
                if (oppType instanceof Map) {
                    entity.setOpportunityType((String) ((Map<?, ?>) oppType).get("label"));
                } else if (oppLabel != null) {
                    entity.setOpportunityType(oppLabel.toString());
                } else if (oppType != null) {
                    entity.setOpportunityType(oppType.toString());
                }

                // 蓝海分数 — Python 端字段名为 composite_score
                Object bos = r.get("blue_ocean_score");
                if (!(bos instanceof Number)) {
                    bos = r.get("composite_score");
                }
                if (bos instanceof Number) {
                    entity.setBlueOceanScore(BigDecimal.valueOf(((Number) bos).doubleValue()));
                }

                // 雷达 JSON — 完整保存
                Object radarObj = r.get("radar");
                if (radarObj != null) {
                    entity.setRadarJson(objectMapper.writeValueAsString(radarObj));
                }

                // ── 合并 LLM 分析数据 ──
                Map<String, Object> llmCard = cardByCategory.get(cat);
                Map<String, Object> recJson = new LinkedHashMap<>();

                // 来自 ranking 的确定性数据
                recJson.put("opportunity_type", entity.getOpportunityType());
                recJson.put("composite_score", entity.getBlueOceanScore());
                recJson.put("group_scores", r.get("group_scores"));

                // 来自 opportunity_card 的测品推荐
                if (llmCard != null) {
                    recJson.put("llm_summary", llmCard.get("llm_summary"));
                    recJson.put("entry_difficulty", llmCard.get("entry_difficulty"));
                    recJson.put("entry_angle", llmCard.get("entry_angle"));
                    recJson.put("top_pick", llmCard.get("top_pick"));
                    recJson.put("risks", llmCard.get("risks"));
                    recJson.put("llm_confidence", llmCard.get("llm_confidence"));
                    recJson.put("test_products", llmCard.get("test_products"));
                    recJson.put("seller_signal", llmCard.get("seller_signal"));
                    recJson.put("seller_heat_signal", llmCard.get("seller_heat_signal"));
                }

                entity.setRecommendationsJson(objectMapper.writeValueAsString(recJson));

                // UPSERT
                LambdaQueryWrapper<BlueOceanScanResult> qw = new LambdaQueryWrapper<>();
                qw.eq(BlueOceanScanResult::getMarketplace, marketplace)
                  .eq(BlueOceanScanResult::getMonth, month)
                  .eq(BlueOceanScanResult::getCategory, entity.getCategory());
                BlueOceanScanResult existing = scanResultMapper.selectOne(qw);
                if (existing != null) {
                    entity.setId(existing.getId());
                    scanResultMapper.updateById(entity);
                } else {
                    scanResultMapper.insert(entity);
                }
                saved++;
            } catch (Exception e) {
                log.warn("保存蓝海扫描结果失败: category={}, error={}", r.get("category"), e.getMessage());
            }
        }

        log.info("saveScanResults: marketplace={}, month={}, saved={}", marketplace, month, saved);
        return Map.of("saved", saved, "marketplace", marketplace, "month", month);
    }
}

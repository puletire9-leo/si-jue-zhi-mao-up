package com.sjzm.product.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sjzm.product.entity.*;
import com.sjzm.product.mapper.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 卖家数据服务 — 为 selection-agent 提供读/写 API。
 * 负责 competitor_products 聚合查询 + seller_profiles/follow_signals 存储。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SellerDataService {

    private final CompetitorProductMapper productMapper;
    private final SellerProfileMapper profileMapper;
    private final FollowSignalMapper followSignalMapper;
    private final CategoryHeatRowMapper heatMapper;
    private final ObjectMapper objectMapper = new ObjectMapper();

    // ── 读 ──

    /**
     * GET /raw-products — 按卖家分组返回全量商品
     */
    public Map<String, List<Map<String, Object>>> getRawProducts(String marketplace, String month) {
        LambdaQueryWrapper<CompetitorProduct> qw = new LambdaQueryWrapper<>();
        qw.eq(CompetitorProduct::getMarketplace, marketplace)
          .eq(CompetitorProduct::getMonth, month)
          .isNotNull(CompetitorProduct::getSellerName)
          .ne(CompetitorProduct::getSellerName, "");

        List<CompetitorProduct> all = productMapper.selectList(qw);
        log.info("getRawProducts: marketplace={}, month={}, total={}", marketplace, month, all.size());

        // 按 seller_name 分组
        return all.stream().collect(Collectors.groupingBy(
                p -> p.getSellerName() != null ? p.getSellerName() : "UNKNOWN",
                LinkedHashMap::new,
                Collectors.mapping(this::productToMap, Collectors.toList())
        ));
    }

    /**
     * GET /profiles-by-category — 查询卖家画像，可按品类过滤
     */
    public List<SellerProfile> getProfilesByCategory(String marketplace, String category) {
        LambdaQueryWrapper<SellerProfile> qw = new LambdaQueryWrapper<>();
        qw.eq(SellerProfile::getMarketplace, marketplace);
        if (category != null && !category.isEmpty()) {
            qw.like(SellerProfile::getCategoryFocus, category);
        }
        qw.orderByDesc(SellerProfile::getSmartScore);
        return profileMapper.selectList(qw);
    }

    // ── 写 ──

    /**
     * POST /profiles — 批量写入/更新卖家画像
     */
    @Transactional
    public Map<String, Object> saveProfiles(List<Map<String, Object>> profiles) {
        int saved = 0;
        for (Map<String, Object> p : profiles) {
            try {
                SellerProfile entity = mapToProfile(p);
                // UPSERT: 按 (marketplace, month, seller_name) 唯一键
                LambdaQueryWrapper<SellerProfile> qw = new LambdaQueryWrapper<>();
                qw.eq(SellerProfile::getMarketplace, entity.getMarketplace())
                  .eq(SellerProfile::getMonth, entity.getMonth())
                  .eq(SellerProfile::getSellerName, entity.getSellerName());
                SellerProfile existing = profileMapper.selectOne(qw);
                if (existing != null) {
                    entity.setId(existing.getId());
                    profileMapper.updateById(entity);
                } else {
                    profileMapper.insert(entity);
                }
                saved++;
            } catch (Exception e) {
                log.warn("保存卖家画像失败: seller={}, error={}", p.get("seller_name"), e.getMessage());
            }
        }
        log.info("saveProfiles: saved={}/{}", saved, profiles.size());
        return Map.of("saved", saved);
    }

    /**
     * POST /follow-signals — 批量写入跟品信号
     */
    @Transactional
    public Map<String, Object> saveFollowSignals(List<Map<String, Object>> signals) {
        int saved = 0;
        for (Map<String, Object> s : signals) {
            try {
                FollowSignal entity = new FollowSignal();
                entity.setMarketplace((String) s.get("marketplace"));
                entity.setMonth((String) s.get("month"));
                entity.setCategory((String) s.get("category"));
                entity.setFirstSeller((String) s.get("first_seller"));
                entity.setFirstAsin((String) s.get("first_asin"));
                entity.setFirstListingDays(toInt(s.get("first_listing_days")));
                entity.setFollowerCount(toInt(s.get("follower_count")));
                entity.setSmartFollowerCount(toInt(s.get("smart_follower_count")));
                entity.setSignalStrength((String) s.get("signal_strength"));
                followSignalMapper.insert(entity);
                saved++;
            } catch (Exception e) {
                log.warn("保存跟品信号失败: error={}", e.getMessage());
            }
        }
        log.info("saveFollowSignals: saved={}/{}", saved, signals.size());
        return Map.of("saved", saved);
    }

    /**
     * POST /category-heat-matrix — 批量写入品类热度矩阵
     */
    @Transactional
    public Map<String, Object> saveHeatMatrix(List<Map<String, Object>> rows) {
        int saved = 0;
        for (Map<String, Object> r : rows) {
            try {
                CategoryHeatRow entity = new CategoryHeatRow();
                entity.setMarketplace((String) r.get("marketplace"));
                entity.setMonth((String) r.get("month"));
                entity.setCategory((String) r.get("category"));
                entity.setDengzongCount(toInt(r.get("dengzong_count")));
                entity.setExternalSCount(toInt(r.get("external_s_count")));
                entity.setExternalACount(toInt(r.get("external_a_count")));
                entity.setTotalSellerCount(toInt(r.get("total_seller_count")));
                entity.setDengzongRatio(toBigDecimal(r.get("dengzong_ratio")));
                entity.setSmartDensity(toBigDecimal(r.get("smart_density")));
                entity.setHeatSignal((String) r.get("heat_signal"));

                LambdaQueryWrapper<CategoryHeatRow> qw = new LambdaQueryWrapper<>();
                qw.eq(CategoryHeatRow::getMarketplace, entity.getMarketplace())
                  .eq(CategoryHeatRow::getMonth, entity.getMonth())
                  .eq(CategoryHeatRow::getCategory, entity.getCategory());
                CategoryHeatRow existing = heatMapper.selectOne(qw);
                if (existing != null) {
                    entity.setId(existing.getId());
                    heatMapper.updateById(entity);
                } else {
                    heatMapper.insert(entity);
                }
                saved++;
            } catch (Exception e) {
                log.warn("保存品类热度失败: error={}", e.getMessage());
            }
        }
        return Map.of("saved", saved);
    }

    // ── 工具方法 ──

    /**
     * GET /heat-matrix 查询
     */
    public List<CategoryHeatRow> getHeatMatrix(String marketplace, String month) {
        LambdaQueryWrapper<CategoryHeatRow> qw = new LambdaQueryWrapper<>();
        qw.eq(CategoryHeatRow::getMarketplace, marketplace);
        if (month != null && !month.isEmpty()) {
            qw.eq(CategoryHeatRow::getMonth, month);
        }
        qw.orderByDesc(CategoryHeatRow::getSmartDensity);
        return heatMapper.selectList(qw);
    }

    /**
     * GET /follow-signals 查询
     */
    public List<FollowSignal> getFollowSignals(String marketplace, String month) {
        LambdaQueryWrapper<FollowSignal> qw = new LambdaQueryWrapper<>();
        qw.eq(FollowSignal::getMarketplace, marketplace);
        if (month != null && !month.isEmpty()) {
            qw.eq(FollowSignal::getMonth, month);
        }
        qw.orderByDesc(FollowSignal::getSignalStrength);
        return followSignalMapper.selectList(qw);
    }

    // ── 工具方法 ──

    private Map<String, Object> productToMap(CompetitorProduct p) {
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
        m.put("seller_nation", p.getSellerNation());
        m.put("brand", p.getBrand());
        m.put("node_label_path", p.getNodeLabelPath());
        // 提取一级品类名
        String category = "";
        if (p.getNodeLabelPath() != null && !p.getNodeLabelPath().isEmpty()) {
            String[] parts = p.getNodeLabelPath().split(":");
            category = parts.length > 0 ? parts[0].trim() : "";
        }
        m.put("category", category);
        m.put("parent_asin", p.getParentAsin());
        m.put("bsr_id", p.getBsrId());
        m.put("fulfillment", p.getFulfillment());
        m.put("image_url", p.getImageUrl());
        m.put("product_url", p.getProductUrl());
        m.put("grade", p.getGrade());
        m.put("score", p.getScore());
        m.put("month", p.getMonth());
        m.put("marketplace", p.getMarketplace());
        return m;
    }

    private SellerProfile mapToProfile(Map<String, Object> p) {
        SellerProfile e = new SellerProfile();
        e.setMarketplace((String) p.get("marketplace"));
        e.setMonth((String) p.get("month"));
        e.setSellerName((String) p.get("seller_name"));
        e.setIsDengzong(toInt(p.get("is_dengzong")));
        e.setSmartScore(toBigDecimal(p.get("smart_score")));
        e.setVisionScore(toBigDecimal(p.get("vision_score")));
        e.setNewSuccessRate(toBigDecimal(p.get("new_success_rate")));
        e.setProfitPercentile(toBigDecimal(p.get("profit_percentile")));
        e.setGrade((String) p.get("grade"));
        e.setArchetype((String) p.get("archetype"));
        e.setProductCount(toInt(p.get("product_count")));
        e.setNewProductCount(toInt(p.get("new_product_count")));
        e.setAvgUnits(toBigDecimal(p.get("avg_units")));
        e.setAvgBsr(toInt(p.get("avg_bsr")));
        e.setCategoryFocus((String) p.get("category_focus"));
        return e;
    }

    private Integer toInt(Object v) {
        if (v == null) return null;
        if (v instanceof Number) return ((Number) v).intValue();
        try { return Integer.parseInt(v.toString()); } catch (Exception e) { return null; }
    }

    private java.math.BigDecimal toBigDecimal(Object v) {
        if (v == null) return null;
        if (v instanceof java.math.BigDecimal) return (java.math.BigDecimal) v;
        try { return new java.math.BigDecimal(v.toString()); } catch (Exception e) { return null; }
    }
}

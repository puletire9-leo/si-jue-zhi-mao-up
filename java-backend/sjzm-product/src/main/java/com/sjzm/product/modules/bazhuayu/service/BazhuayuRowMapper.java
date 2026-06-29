package com.sjzm.product.modules.bazhuayu.service;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 八爪鱼原始行 → 初筛输入行的整形（纯函数，便于单测）。
 *
 * filterRows 优先按列索引取值（[1]=ASIN / [3]=price / [4]=reviews），列名作回退。
 * 故整形结果用 LinkedHashMap 固定列序：[0]=标题 [1]=ASIN [2]=占位 [3]=价格 [4]=评论数，
 * 索引与列名两条路径都对齐。
 */
public final class BazhuayuRowMapper {

    // 八爪鱼原始字段候选名（实际字段须按真实采集核实，必要时在此补充）
    static final String[] ASIN_KEYS = {"ASIN", "asin", "Asin", "产品ASIN", "asin码"};
    static final String[] PRICE_KEYS = {"价格", "price", "Price", "售价", "价格(£)", "价格(€)", "价格($)"};
    static final String[] REVIEW_KEYS = {"评论数", "评论数量", "review数量", "reviews", "review", "评论"};
    static final String[] TITLE_KEYS = {"标题", "title", "Title", "产品标题", "商品标题"};

    static final String ASIN_REGEX = "^B0[0-9A-Z]{8}$";

    private BazhuayuRowMapper() {}

    /** 从原始 JSON 行按候选字段名取第一个非空值，全空返回 null */
    public static String pick(JsonNode raw, String[] keys) {
        for (String k : keys) {
            JsonNode v = raw.get(k);
            if (v != null && !v.isNull()) {
                String s = v.asText("").trim();
                if (!s.isEmpty()) return s;
            }
        }
        return null;
    }

    /** 提取并规范化 ASIN（大写、trim）；非法格式返回 null */
    public static String extractAsin(JsonNode raw) {
        String asin = pick(raw, ASIN_KEYS);
        if (asin == null) return null;
        asin = asin.trim().toUpperCase();
        return asin.matches(ASIN_REGEX) ? asin : null;
    }

    /** 整形成 filterRows 期望的固定列序 */
    public static Map<String, String> shapeRow(String asin, String price, String reviews, String title) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("标题", title != null ? title : "");
        row.put("ASIN", asin);
        row.put("_col2", "");
        row.put("价格", price != null ? price : "");
        row.put("review数量", reviews != null ? reviews : "");
        return row;
    }
}

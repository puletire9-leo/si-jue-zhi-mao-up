package com.sjzm.product.modules.lingxing.dto;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 财务日报单行汇总（一个「维度 × 维度值」）。
 *
 * <p>metrics 的 key 使用统一业务名（SKU总数量 / 动销＞90天的SKU / 未上架SKU / 断货SKU / 淘汰SKU /
 * 季节性SKU / 销量 / 订单量 / 销售额 / 展示 / 点击 / 广告订单量 / 广告销售额 / 广告花费 / 可用库存 / 退款金额）。
 * 发布飞书时由调用方按目标表的字段命名（业务名/内部名）映射。</p>
 *
 * @param dimension      维度：总 / 运营 / 开发 / 非标品 / 上架时间
 * @param dimensionValue 维度值（总/非标品为空串，运营=销售人员，开发=开发人员，上架时间=5月档）
 * @param marketplace    财务输出固定 UK；历史未拆分回归可为空
 * @param currencyCode   财务输出固定 GBP；历史未拆分回归可为空
 * @param metrics        已聚合的指标值
 */
public record FinanceDailyReportRow(
        String dimension,
        String dimensionValue,
        String marketplace,
        String currencyCode,
        Map<String, BigDecimal> metrics) {

    public FinanceDailyReportRow(String dimension, String dimensionValue, Map<String, BigDecimal> metrics) {
        this(dimension, dimensionValue, null, null, metrics);
    }

    public FinanceDailyReportRow {
        metrics = metrics == null
                ? Map.of()
                : Collections.unmodifiableMap(new LinkedHashMap<>(metrics));
    }
}

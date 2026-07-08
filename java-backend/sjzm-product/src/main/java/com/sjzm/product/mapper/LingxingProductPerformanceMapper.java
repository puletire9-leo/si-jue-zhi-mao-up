package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.modules.lingxing.entity.LingxingProductPerformance;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;

/**
 * 领星产品表现 Mapper。
 * 放 com.sjzm.product.mapper（@MapperScan 只扫这个包）。
 */
@Mapper
public interface LingxingProductPerformanceMapper extends BaseMapper<LingxingProductPerformance> {

    /**
     * 治本幂等：走 INSERT ... ON DUPLICATE KEY UPDATE（唯一键 uk_biz_key）。
     * 同 biz_key 反复同步只更新不堆积，避免 saveOrUpdateBatch 在批内同键冲突。
     */
    @Insert({"<script>",
        "INSERT INTO lingxing_product_performance (",
        "  id, biz_key, summary_field, summary_value, sid_scope,",
        "  asin, parent_asin, msku, sku, item_name, currency_code,",
        "  start_date, end_date,",
        "  volume, order_items, amount, gross_profit, gross_margin, sessions_total, spend, tacos,",
        "  raw_json, synced_at",
        ") VALUES (",
        "  #{id}, #{bizKey}, #{summaryField}, #{summaryValue}, #{sidScope},",
        "  #{asin}, #{parentAsin}, #{msku}, #{sku}, #{itemName}, #{currencyCode},",
        "  #{startDate}, #{endDate},",
        "  #{volume}, #{orderItems}, #{amount}, #{grossProfit}, #{grossMargin}, #{sessionsTotal}, #{spend}, #{tacos},",
        "  #{rawJson}, NOW()",
        ") ON DUPLICATE KEY UPDATE",
        "  summary_field=VALUES(summary_field), summary_value=VALUES(summary_value), sid_scope=VALUES(sid_scope),",
        "  asin=VALUES(asin), parent_asin=VALUES(parent_asin), msku=VALUES(msku), sku=VALUES(sku),",
        "  item_name=VALUES(item_name), currency_code=VALUES(currency_code),",
        "  start_date=VALUES(start_date), end_date=VALUES(end_date),",
        "  volume=VALUES(volume), order_items=VALUES(order_items), amount=VALUES(amount),",
        "  gross_profit=VALUES(gross_profit), gross_margin=VALUES(gross_margin),",
        "  sessions_total=VALUES(sessions_total), spend=VALUES(spend), tacos=VALUES(tacos),",
        "  raw_json=VALUES(raw_json), synced_at=NOW()",
        "</script>"})
    int upsert(LingxingProductPerformance entity);
}
